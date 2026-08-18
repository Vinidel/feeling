import { importAndReconcile, ReconciliationError } from "./database.ts";
import { decodeReportKey } from "./hashing.ts";
import { analyzeDocuments } from "./parse.ts";
import { buildReport, exceptionManifest, writeJson } from "./report.ts";
import type { MigrationReport } from "./types.ts";

interface Arguments {
  mode: MigrationReport["mode"];
  feelingsPath: string;
  weeklyPath: string;
  reportPath: string;
  exceptionsPath: string;
}

class CliError extends Error {}

function parseArguments(args: string[]): Arguments {
  const mode = args[0];
  if (mode !== "dry-run" && mode !== "import" && mode !== "reconcile") {
    throw new CliError("mode must be dry-run, import, or reconcile");
  }

  const values = new Map<string, string>();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new CliError("arguments must be flag/value pairs");
    }
    if (values.has(flag)) throw new CliError("duplicate argument");
    values.set(flag, value);
  }

  const allowed = new Set([
    "--feelings",
    "--weekly-trackers",
    "--report",
    "--exceptions",
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) {
    throw new CliError("unknown argument");
  }

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
    exceptionsPath: required("--exceptions"),
  };
}

async function readArray(path: string): Promise<unknown[]> {
  let value: unknown;
  try {
    value = JSON.parse(await Deno.readTextFile(path));
  } catch {
    throw new CliError("input must be readable JSON");
  }
  if (!Array.isArray(value)) throw new CliError("input root must be an array");
  return value;
}

function sslMode(): "require" | "disable" {
  const value = Deno.env.get("MIGRATION_DATABASE_SSL_MODE") ?? "require";
  if (value !== "require" && value !== "disable") {
    throw new CliError(
      "MIGRATION_DATABASE_SSL_MODE must be require or disable",
    );
  }
  return value;
}

async function reserveOutputs(
  reportPath: string,
  exceptionsPath: string,
): Promise<[Deno.FsFile, Deno.FsFile]> {
  if (reportPath === exceptionsPath) {
    throw new CliError("output paths must be distinct");
  }

  let reportFile: Deno.FsFile | undefined;
  try {
    reportFile = await Deno.open(reportPath, {
      createNew: true,
      write: true,
      mode: 0o600,
    });
    const exceptionsFile = await Deno.open(exceptionsPath, {
      createNew: true,
      write: true,
      mode: 0o600,
    });
    return [reportFile, exceptionsFile];
  } catch {
    reportFile?.close();
    if (reportFile) await Deno.remove(reportPath).catch(() => undefined);
    throw new CliError("output files must not already exist");
  }
}

function closeQuietly(file: Deno.FsFile): void {
  try {
    file.close();
  } catch {
    // A successful output path may already have closed the file.
  }
}

export async function run(args: string[]): Promise<number> {
  const options = parseArguments(args);
  const encodedKey = Deno.env.get("MIGRATION_REPORT_KEY");
  if (!encodedKey) throw new CliError("MIGRATION_REPORT_KEY is required");
  const reportKey = decodeReportKey(encodedKey);

  const analysis = await analyzeDocuments(
    await readArray(options.feelingsPath),
    await readArray(options.weeklyPath),
    reportKey,
  );
  const [reportFile, exceptionsFile] = await reserveOutputs(
    options.reportPath,
    options.exceptionsPath,
  );

  try {
    let database;
    if (options.mode !== "dry-run" && analysis.exceptions.length === 0) {
      const databaseUrl = Deno.env.get("MIGRATION_DATABASE_URL");
      if (!databaseUrl) {
        throw new CliError("MIGRATION_DATABASE_URL is required");
      }
      try {
        database = await importAndReconcile(
          databaseUrl,
          sslMode(),
          analysis,
          options.mode,
        );
      } catch (error) {
        if (!(error instanceof ReconciliationError)) throw error;
        const feelingConflicts = new Set(
          error.conflicts.filter((item) => item.collection === "feelings").map(
            (item) => item.source_id,
          ),
        );
        const weeklyConflicts = new Set(
          error.conflicts.filter((item) =>
            item.collection === "weekly_trackers"
          ).map((item) => item.source_id),
        );
        analysis.feelings = analysis.feelings.filter((item) =>
          !feelingConflicts.has(item.legacyMongoId)
        );
        analysis.weeklyTrackers = analysis.weeklyTrackers.filter((item) =>
          !weeklyConflicts.has(item.legacyMongoId)
        );
        analysis.transformations = analysis.transformations.filter((item) =>
          !feelingConflicts.has(item.source_id)
        );
        analysis.exceptions.push(...error.conflicts);
        analysis.exceptions.sort((left, right) =>
          `${left.collection}:${left.source_id}:${left.reason_code}`
            .localeCompare(
              `${right.collection}:${right.source_id}:${right.reason_code}`,
            )
        );
      }
    }

    await writeJson(
      reportFile,
      await buildReport(analysis, reportKey, options.mode, database),
    );
    await writeJson(
      exceptionsFile,
      exceptionManifest(analysis.exceptions),
    );
    closeQuietly(reportFile);
    closeQuietly(exceptionsFile);

    console.log(JSON.stringify({
      event: "migration_complete",
      mode: options.mode,
      accepted: analysis.feelings.length + analysis.weeklyTrackers.length,
      rejected: analysis.exceptions.length,
    }));
    return analysis.exceptions.length === 0 ? 0 : 2;
  } catch (error) {
    closeQuietly(reportFile);
    closeQuietly(exceptionsFile);
    await Promise.all([
      Deno.remove(options.reportPath).catch(() => undefined),
      Deno.remove(options.exceptionsPath).catch(() => undefined),
    ]);
    throw error;
  }
}

if (import.meta.main) {
  try {
    Deno.exit(await run(Deno.args));
  } catch (error) {
    const category = error instanceof CliError
      ? "invalid_invocation"
      : "migration_failed";
    console.error(JSON.stringify({ event: category }));
    Deno.exit(1);
  }
}
