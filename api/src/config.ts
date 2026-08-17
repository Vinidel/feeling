import { z } from "zod";

const runtimeConfigSchema = z.object({
  DEPLOYMENT_VERSION: z.string().trim().min(1).default("development"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
}).strict();

export type RuntimeConfig = {
  deploymentVersion: string;
  hostname: string;
  port: number;
};

export function parseRuntimeConfig(
  values: Record<string, string | undefined>,
): RuntimeConfig {
  const parsed = runtimeConfigSchema.parse(values);
  return {
    deploymentVersion: parsed.DEPLOYMENT_VERSION,
    hostname: parsed.HOST,
    port: parsed.PORT,
  };
}

export function readRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig({
    DEPLOYMENT_VERSION: Deno.env.get("DEPLOYMENT_VERSION"),
    HOST: Deno.env.get("HOST"),
    PORT: Deno.env.get("PORT"),
  });
}
