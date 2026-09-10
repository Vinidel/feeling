export const EXPECTED_MONGO_USERS = {
  steady_legacy_runtime: "heroku",
  steady_rollback_operator: "operator-secret-store",
} as const;

export type ExpectedMongoUsername = keyof typeof EXPECTED_MONGO_USERS;

export interface MongoRoleEvidence {
  username: string;
  custody: string;
  roles: Array<{ role: string; database: string }>;
}

export function verifyMongoRoleEvidence(
  value: MongoRoleEvidence,
  expectedUsername: ExpectedMongoUsername,
): void {
  if (value.username !== expectedUsername) {
    throw new Error(`expected Mongo user ${expectedUsername}`);
  }
  if (value.custody !== EXPECTED_MONGO_USERS[expectedUsername]) {
    throw new Error(`${expectedUsername} has incorrect credential custody`);
  }
  if (
    value.roles.length !== 1 || value.roles[0].role !== "readWrite" ||
    value.roles[0].database !== "feeling"
  ) {
    throw new Error(
      `${expectedUsername} must have only readWrite on the feeling database`,
    );
  }
}
