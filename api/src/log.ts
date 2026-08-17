export type LogLevel = "info" | "warn" | "error";

export type LogRecord =
  & Readonly<{
    event: string;
    level: LogLevel;
    timestamp: string;
  }>
  & Readonly<Record<string, unknown>>;

const allowedFields = new Set([
  "deploymentVersion",
  "durationMs",
  "host",
  "method",
  "port",
  "routeTemplate",
  "signal",
  "status",
]);

export function createLogRecord(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  timestamp = new Date().toISOString(),
): LogRecord {
  const sanitizedFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => allowedFields.has(key)),
  );
  return { timestamp, level, event, ...sanitizedFields };
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  console.log(JSON.stringify(createLogRecord(level, event, fields)));
}
