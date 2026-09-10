import { z } from "zod";

const originSchema = z.string().trim().url().transform((value, context) => {
  const url = new URL(value);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.origin !== value
  ) {
    context.addIssue({
      code: "custom",
      message: "CORS origins must be exact HTTP(S) origins",
    });
    return z.NEVER;
  }
  return url.origin;
});

const runtimeConfigSchema = z.object({
  AUTH0_AUDIENCE: z.string().trim().min(1),
  AUTH0_ISSUER: z.string().trim().url().refine((value) =>
    value.startsWith("https://") && value.endsWith("/")
  ),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_SSL_MODE: z.enum(["require", "disable"]).default("require"),
  DATABASE_URL: z.string().trim().url().refine((value) =>
    value.startsWith("postgres://") || value.startsWith("postgresql://")
  ),
  DEPLOYMENT_VERSION: z.string().trim().min(1).default("development"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  STATIC_ROOT: z.string().trim().min(1).optional(),
}).strict();

export type RuntimeConfig = {
  allowedOrigins: ReadonlySet<string>;
  auth0Audience: string;
  auth0Issuer: string;
  databaseSslMode: "require" | "disable";
  databaseUrl: string;
  deploymentVersion: string;
  hostname: string;
  port: number;
  staticRoot?: string;
};

function parseOrigins(value: string): ReadonlySet<string> {
  const candidates = value.split(",").map((origin) => origin.trim()).filter(
    Boolean,
  );
  if (candidates.length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one origin");
  }
  return new Set(candidates.map((origin) => originSchema.parse(origin)));
}

export function parseRuntimeConfig(
  values: Record<string, string | undefined>,
): RuntimeConfig {
  const parsed = runtimeConfigSchema.parse(values);
  return {
    allowedOrigins: parseOrigins(parsed.CORS_ORIGINS),
    auth0Audience: parsed.AUTH0_AUDIENCE,
    auth0Issuer: parsed.AUTH0_ISSUER,
    databaseSslMode: parsed.DATABASE_SSL_MODE,
    databaseUrl: parsed.DATABASE_URL,
    deploymentVersion: parsed.DEPLOYMENT_VERSION,
    hostname: parsed.HOST,
    port: parsed.PORT,
    ...(parsed.STATIC_ROOT ? { staticRoot: parsed.STATIC_ROOT } : {}),
  };
}

export function readRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig({
    AUTH0_AUDIENCE: Deno.env.get("AUTH0_AUDIENCE"),
    AUTH0_ISSUER: Deno.env.get("AUTH0_ISSUER"),
    CORS_ORIGINS: Deno.env.get("CORS_ORIGINS"),
    DATABASE_SSL_MODE: Deno.env.get("DATABASE_SSL_MODE"),
    DATABASE_URL: Deno.env.get("DATABASE_URL"),
    DEPLOYMENT_VERSION: Deno.env.get("DEPLOYMENT_VERSION"),
    HOST: Deno.env.get("HOST"),
    PORT: Deno.env.get("PORT"),
    STATIC_ROOT: Deno.env.get("STATIC_ROOT"),
  });
}
