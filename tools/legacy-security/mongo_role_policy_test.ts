import { strict as assert } from "node:assert";
import { verifyMongoRoleEvidence } from "./mongo_role_policy.ts";

Deno.test("accepts the two exact least-privilege Mongo role boundaries", () => {
  verifyMongoRoleEvidence({
    username: "steady_legacy_runtime",
    custody: "heroku",
    roles: [{ role: "readWrite", database: "feeling" }],
  }, "steady_legacy_runtime");
  verifyMongoRoleEvidence({
    username: "steady_rollback_operator",
    custody: "operator-secret-store",
    roles: [{ role: "readWrite", database: "feeling" }],
  }, "steady_rollback_operator");
});

Deno.test("rejects broad, cross-database, shared-custody, and extra roles", () => {
  assert.throws(() =>
    verifyMongoRoleEvidence({
      username: "steady_legacy_runtime",
      custody: "heroku",
      roles: [{ role: "atlasAdmin", database: "admin" }],
    }, "steady_legacy_runtime")
  );
  assert.throws(() =>
    verifyMongoRoleEvidence({
      username: "steady_rollback_operator",
      custody: "operator-secret-store",
      roles: [{ role: "readWriteAnyDatabase", database: "admin" }],
    }, "steady_rollback_operator")
  );
  assert.throws(() =>
    verifyMongoRoleEvidence({
      username: "steady_rollback_operator",
      custody: "heroku",
      roles: [{ role: "readWrite", database: "feeling" }],
    }, "steady_rollback_operator")
  );
  assert.throws(() =>
    verifyMongoRoleEvidence({
      username: "steady_legacy_runtime",
      custody: "heroku",
      roles: [
        { role: "readWrite", database: "feeling" },
        { role: "read", database: "other" },
      ],
    }, "steady_legacy_runtime")
  );
});
