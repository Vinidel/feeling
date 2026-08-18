import postgres from "postgres";

export type DatabaseOptions = Readonly<{
  databaseUrl: string;
  ssl?: "require" | "disable";
}>;

export type QueryValue = boolean | Date | number | string | null;
export type QueryRow = Record<string, QueryValue>;

export interface UserTransaction {
  readonly userId: string;
  query(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryRow[]>;
  savepoint<T>(
    operation: (transaction: UserTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface Database {
  checkReadiness(): Promise<void>;
  close(): Promise<void>;
  withUserTransaction<T>(
    userId: string,
    operation: (transaction: UserTransaction) => Promise<T>,
  ): Promise<T>;
}

type TransactionSql = postgres.TransactionSql<Record<string, never>>;

function userTransaction(
  transaction: TransactionSql,
  userId: string,
): UserTransaction {
  return {
    userId,
    async query(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<QueryRow[]> {
      return await transaction<QueryRow[]>(
        strings,
        ...(values as postgres.ParameterOrFragment<never>[]),
      );
    },
    async savepoint<T>(
      operation: (nested: UserTransaction) => Promise<T>,
    ): Promise<T> {
      const result = await transaction.savepoint(async (savepoint) => ({
        value: await operation(userTransaction(savepoint, userId)),
      }));
      return result.value;
    },
  };
}

export function createDatabase(options: DatabaseOptions): Database {
  const sql = postgres(options.databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 4,
    max_lifetime: 30 * 60,
    prepare: false,
    ssl: options.ssl === "disable" ? false : "require",
  });

  return {
    async checkReadiness(): Promise<void> {
      await sql`select 1 as ready`;
    },
    async close(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
    async withUserTransaction<T>(
      userId: string,
      operation: (transaction: UserTransaction) => Promise<T>,
    ): Promise<T> {
      if (!userId || userId !== userId.trim()) {
        throw new Error("verified user identity is required");
      }

      const result = await sql.begin(async (transaction) => {
        await transaction.unsafe("set local statement_timeout = '5s'");
        await transaction`
          select set_config('app.auth0_sub', ${userId}, true)
        `;
        return { value: await operation(userTransaction(transaction, userId)) };
      });
      return result.value;
    },
  };
}
