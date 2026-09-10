import { decodeReportKey } from "../migrate/hashing.ts";
import { analyzeDocuments } from "../migrate/parse.ts";
import { writeJson } from "../migrate/report.ts";
import { reconcileTargetToMongo, type RollbackMode } from "./reconcile.ts";

class CliError extends Error {}

interface Arguments {
  mode: RollbackMode;
  feelingsPath: string;
  weeklyPath: string;
  reportPath: string;
}

function parseArguments(args: string[]): Arguments {
  const mode = args[0];
  if (mode !== "plan" && mode !== "execute") {
    throw new CliError("mode must be plan or execute");
  }
  const values = new Map<string, string>();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined || values.has(flag)) {
      throw new CliError("arguments must be unique flag/value pairs");
    }
    values.set(flag, value);
  }
  if (
    [...values.keys()].some((flag) =>
      !["--feelings", "--weekly-trackers", "--report"].includes(flag)
    )
  ) throw new CliError("unknown argument");
  const required = (flag: string): string => {
    const value = values.get(flag);
    if (!value) throw new CliError(`missing ${flag}`);
    return value;
  };
  return {
    mode,
    feelingsPath: required("--feelings"),
    weeklyPath: required("--weekly-trackers"),
    reportPath: required("--report"),
  };
}

async function readArray(path: string): Promise<unknown[]> {
  try {
    const value = JSON.parse(await Deno.readTextFile(path));
    if (Array.isArray(value)) return value;
  } catch {
    // Use one sanitized invocation error for unreadable and malformed inputs.
  }
  throw new CliError("input must be a readable JSON array");
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new CliError(`${name} is required`);
  return value;
}

function sslMode(): "require" | "disable" {
  const value = Deno.env.get("ROLLBACK_DATABASE_SSL_MODE") ?? "require";
  if (value !== "require" && value !== "disable") {
    throw new CliError("ROLLBACK_DATABASE_SSL_MODE must be require or disable");
  }
  return value;
}

export async function run(args: string[]): Promise<number> {
  const options = parseArguments(args);
  const reportKey = decodeReportKey(requireEnvironment("ROLLBACK_REPORT_KEY"));
  const analysis = await analyzeDocuments(
    await readArray(options.feelingsPath),
    await readArray(options.weeklyPath),
    reportKey,
  );
  if (analysis.exceptions.length > 0) {
    throw new CliError("source checkpoint contains rejected records");
  }

  let report: Deno.FsFile;
  try {
    report = await Deno.open(options.reportPath, {
      createNew: true,
      write: true,
      mode: 0o600,
    });
  } catch {
    throw new CliError("report path must not already exist");
  }

  try {
    const userIds = [
      ...new Set([
        ...analysis.feelings.map((row) => row.userId),
        ...analysis.weeklyTrackers.map((row) => row.userId),
      ]),
    ];
    const metrics = await reconcileTargetToMongo({
      databaseUrl: requireEnvironment("ROLLBACK_DATABASE_URL"),
      databaseSslMode: sslMode(),
      mongoUrl: requireEnvironment("ROLLBACK_MONGODB_URL"),
      mongoDatabase: Deno.env.get("ROLLBACK_MONGODB_DATABASE") ?? "feeling",
      mode: options.mode,
      userIds,
    });
    await writeJson(report, {
      format_version: 1,
      mode: options.mode,
      source_checkpoint: {
        feelings: analysis.feelings.length,
        weekly_trackers: analysis.weeklyTrackers.length,
        rejected: 0,
        user_hashes: [
          ...new Set([
            ...analysis.feelings.map((row) => row.userHash),
            ...analysis.weeklyTrackers.map((row) => row.userHash),
          ]),
        ].sort(),
      },
      reconciliation: metrics,
    });
    report.close();
    console.log(JSON.stringify({
      event: "rollback_reconciliation_complete",
      mode: options.mode,
      target_only_feelings: metrics.target_only_feelings,
      weekly_processed: metrics.weekly_inserted + metrics.weekly_updated +
        metrics.weekly_already_matched,
      target_rows_linked: metrics.target_rows_linked,
    }));
    return 0;
  } catch (error) {
    report.close();
    await Deno.remove(options.reportPath).catch(() => undefined);
    throw error;
  }
}

if (import.meta.main) {
  try {
    Deno.exit(await run(Deno.args));
  } catch (error) {
    console.error(JSON.stringify({
      event: error instanceof CliError
        ? "invalid_invocation"
        : "rollback_reconciliation_failed",
    }));
    Deno.exit(1);
  }
}
