import type { AuthenticateRequest } from "./auth.ts";
import type { Database } from "./database.ts";
import { errorResponse, HttpError } from "./errors.ts";
import type { FeelingsService } from "./feelings.ts";
import { logEvent } from "./log.ts";
import {
  feelingRequestSchema,
  weeklyTrackerQuerySchema,
  weeklyTrackerRequestSchema,
} from "./schemas.ts";
import type { WeeklyTrackersService } from "./weekly.ts";

export type RequestLogger = typeof logEvent;

export const publicBrowserRoutes = Object.freeze(
  [
    "GET /api/feelings",
    "POST /api/feelings",
    "GET /api/weekly-tracker",
    "POST /api/weekly-tracker",
  ] as const,
);
const publicBrowserRouteSet = new Set<string>(publicBrowserRoutes);

export type HandlerOptions = Readonly<{
  allowedOrigins: ReadonlySet<string>;
  authenticate: AuthenticateRequest;
  database: Pick<Database, "checkReadiness">;
  feelings: FeelingsService;
  weeklyTrackers: WeeklyTrackersService;
  deploymentVersion: string;
  logger?: RequestLogger;
}>;

const allowedCorsMethods = new Set(["GET", "POST"]);
const allowedCorsHeaders = new Set([
  "authorization",
  "content-type",
  "x-user-id",
]);

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "access-control-allow-headers": "Authorization, Content-Type, x-user-id",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": origin,
    "access-control-max-age": "600",
    "vary": "Origin",
  });
}

function verifyCors(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
): { origin?: string; preflight?: Response } {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  if (!allowedOrigins.has(origin)) {
    throw new HttpError(
      403,
      "cors_origin_denied",
      "Request origin is not allowed",
    );
  }

  if (request.method !== "OPTIONS") return { origin };

  const requestedMethod = request.headers.get(
    "access-control-request-method",
  )?.toUpperCase();
  const requestedHeaders = request.headers.get("access-control-request-headers")
    ?.split(",").map((header) => header.trim().toLowerCase()).filter(Boolean) ??
    [];
  if (
    !requestedMethod || !allowedCorsMethods.has(requestedMethod) ||
    requestedHeaders.some((header) => !allowedCorsHeaders.has(header))
  ) {
    throw new HttpError(
      403,
      "cors_preflight_denied",
      "CORS preflight is not allowed",
    );
  }

  return {
    origin,
    preflight: new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    }),
  };
}

function routeTemplate(request: Request, pathname: string): string {
  if (request.method === "GET" && pathname === "/healthz") return "/healthz";
  if (request.method === "GET" && pathname === "/readyz") return "/readyz";
  if (publicBrowserRouteSet.has(`${request.method} ${pathname}`)) {
    return pathname;
  }
  return "unmatched";
}

async function parseWeeklyTrackerRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "invalid_request", "Request body is invalid");
  }
  const result = weeklyTrackerRequestSchema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "invalid_request", "Request body is invalid");
  }
  return result.data;
}

function parseWeeklyTrackerQuery(url: URL) {
  const entries = [...url.searchParams.entries()];
  const query = Object.fromEntries(entries);
  const result = entries.length === 1 && entries[0][0] === "weekOf"
    ? weeklyTrackerQuerySchema.safeParse(query)
    : { success: false as const };
  if (!result.success) {
    throw new HttpError(400, "invalid_request", "Query is invalid");
  }
  return result.data;
}

async function parseFeelingRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "invalid_request", "Request body is invalid");
  }
  const result = feelingRequestSchema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "invalid_request", "Request body is invalid");
  }
  return result.data;
}

function responseWithOperationalHeaders(
  response: Response,
  requestId: string,
  origin?: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  if (origin) {
    for (const [key, value] of corsHeaders(origin)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createHandler(
  options: HandlerOptions,
): (request: Request) => Promise<Response> {
  const logger = options.logger ?? logEvent;

  return async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const template = routeTemplate(request, url.pathname);
    let failureCode: string | undefined;
    let origin: string | undefined;
    let response: Response;

    try {
      const cors = verifyCors(request, options.allowedOrigins);
      origin = cors.origin;
      if (cors.preflight) {
        response = cors.preflight;
      } else if (template === "/healthz") {
        response = jsonResponse({ status: "ok" }, 200);
      } else if (template === "/readyz") {
        try {
          await options.database.checkReadiness();
        } catch {
          throw new HttpError(
            503,
            "dependency_unavailable",
            "Service is not ready",
          );
        }
        response = jsonResponse({ status: "ready" }, 200);
      } else if (template === "/api/feelings") {
        const { userId } = await options.authenticate(request);
        if (request.method === "GET") {
          response = jsonResponse(await options.feelings.list(userId), 200);
        } else {
          const feeling = await parseFeelingRequest(request);
          response = jsonResponse(
            await options.feelings.create(userId, feeling),
            200,
          );
        }
      } else if (template === "/api/weekly-tracker") {
        const { userId } = await options.authenticate(request);
        if (request.method === "GET") {
          const query = parseWeeklyTrackerQuery(url);
          response = jsonResponse({
            ok: true,
            record: await options.weeklyTrackers.get(userId, query.weekOf),
          }, 200);
        } else {
          const tracker = await parseWeeklyTrackerRequest(request);
          response = jsonResponse({
            ok: true,
            record: await options.weeklyTrackers.upsert(userId, tracker),
          }, 200);
        }
      } else {
        throw new HttpError(404, "not_found", "Route not found");
      }
    } catch (error) {
      const publicError = error instanceof HttpError
        ? error
        : new HttpError(500, "internal_error", "Internal server error");
      failureCode = publicError.code;
      response = errorResponse(publicError);
    }

    response = responseWithOperationalHeaders(response, requestId, origin);
    logger(
      response.status >= 500
        ? "error"
        : response.status >= 400
        ? "warn"
        : "info",
      "http_request",
      {
        deploymentVersion: options.deploymentVersion,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        failureCode,
        method: request.method,
        requestId,
        routeTemplate: template,
        status: response.status,
      },
    );
    return response;
  };
}
