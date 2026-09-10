import type { Database, QueryRow } from "./database.ts";
import type { FeelingRequest } from "./schemas.ts";

export type FeelingResponse = Readonly<{
  activities: Readonly<{
    bow: boolean;
    lift: boolean;
    run: boolean;
    cycle: boolean;
    swim: boolean;
  }>;
  status: string;
  createdAt: string;
  comment: string;
  userID: string;
}>;

export interface FeelingsService {
  list(userId: string): Promise<FeelingResponse[]>;
  create(userId: string, feeling: FeelingRequest): Promise<FeelingResponse>;
}

function requiredString(row: QueryRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Invalid feeling ${key}`);
  return value;
}

function requiredBoolean(row: QueryRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Invalid feeling ${key}`);
  return value;
}

function feelingResponse(row: QueryRow): FeelingResponse {
  const status = row.status;
  if (typeof status !== "number" || !Number.isInteger(status)) {
    throw new Error("Invalid feeling status");
  }

  const createdAt = row.created_at;
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    throw new Error("Invalid feeling created_at");
  }

  return {
    activities: {
      bow: requiredBoolean(row, "activity_bow"),
      lift: requiredBoolean(row, "activity_lift"),
      run: requiredBoolean(row, "activity_run"),
      cycle: requiredBoolean(row, "activity_cycle"),
      swim: requiredBoolean(row, "activity_swim"),
    },
    status: String(status),
    createdAt: createdAt.toISOString(),
    comment: requiredString(row, "comment"),
    userID: requiredString(row, "user_id"),
  };
}

export function createFeelingsService(
  database: Pick<Database, "withUserTransaction">,
): FeelingsService {
  return {
    async list(userId: string): Promise<FeelingResponse[]> {
      return await database.withUserTransaction(userId, async (transaction) => {
        const rows = await transaction.query`
          select
            user_id,
            status,
            created_at,
            comment,
            activity_bow,
            activity_lift,
            activity_run,
            activity_cycle,
            activity_swim
          from steady.feelings
          where user_id = ${transaction.userId}
          order by created_at desc, id desc
        `;
        return rows.map(feelingResponse);
      });
    },

    async create(
      userId: string,
      feeling: FeelingRequest,
    ): Promise<FeelingResponse> {
      return await database.withUserTransaction(userId, async (transaction) => {
        const rows = await transaction.query`
          insert into steady.feelings (
            user_id,
            status,
            created_at,
            comment,
            activity_bow,
            activity_lift,
            activity_run,
            activity_cycle,
            activity_swim
          ) values (
            ${transaction.userId},
            ${Number(feeling.status)},
            ${feeling.createdAt},
            ${feeling.comment},
            ${feeling.activities.bow},
            ${feeling.activities.lift},
            ${feeling.activities.run},
            ${feeling.activities.cycle},
            ${feeling.activities.swim}
          )
          returning
            user_id,
            status,
            created_at,
            comment,
            activity_bow,
            activity_lift,
            activity_run,
            activity_cycle,
            activity_swim
        `;
        if (rows.length !== 1) {
          throw new Error("Feeling insert did not return one row");
        }
        return feelingResponse(rows[0]);
      });
    },
  };
}
