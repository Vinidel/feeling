/* Run only against a disposable MongoDB database user. */
const expectedUsername = process.env.EXPECTED_MONGO_USERNAME;
if (
  !["steady_legacy_runtime", "steady_rollback_operator"].includes(
    expectedUsername,
  )
) {
  throw new Error("EXPECTED_MONGO_USERNAME must name an approved scoped user");
}

const auth = db.runCommand({ connectionStatus: 1, showPrivileges: true });
if (auth.ok !== 1) {
  throw new Error("could not inspect authenticated Mongo role");
}
const roles = auth.authInfo.authenticatedUserRoles || [];
if (
  roles.length !== 1 || roles[0].role !== "readWrite" ||
  roles[0].db !== "feeling"
) {
  throw new Error("Mongo user must have only readWrite on feeling");
}

const probe = db.getSiblingDB("feeling").getCollection(
  "_steady_stage14_security_probe",
);
probe.drop();
probe.insertOne({ fixture: true, value: 1 });
if (probe.countDocuments({ fixture: true }) !== 1) {
  throw new Error("read probe failed");
}
probe.updateOne({ fixture: true }, { $set: { value: 2 } });
if (probe.findOne({ fixture: true }).value !== 2) {
  throw new Error("update probe failed");
}
probe.deleteOne({ fixture: true });
probe.drop();

function expectUnauthorized(command, label) {
  try {
    const result = command();
    if (
      result.ok === 1 ||
      (result.code !== 13 && result.codeName !== "Unauthorized")
    ) {
      throw new Error(`${label} was not denied`);
    }
  } catch (error) {
    if (error.code === 13 || error.codeName === "Unauthorized") return;
    throw error;
  }
}

expectUnauthorized(
  () => db.getSiblingDB("admin").runCommand({ usersInfo: 1 }),
  "user-management probe",
);
expectUnauthorized(
  () => db.getSiblingDB("other").runCommand({ find: "probe", filter: {} }),
  "cross-database probe",
);

print(JSON.stringify({
  username: expectedUsername,
  role: "readWrite",
  database: "feeling",
  readWriteProbe: "pass",
  userManagementDenied: true,
  crossDatabaseDenied: true,
}));
