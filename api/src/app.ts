import { logEvent } from "./log.ts";

export type RequestLogger = typeof logEvent;

export type HandlerOptions = Readonly<{
  deploymentVersion: string;
  logger?: RequestLogger;
}>;

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function createHandler(
  options: HandlerOptions,
): (request: Request) => Response {
  const logger = options.logger ?? logEvent;

  return (request: Request): Response => {
    const startedAt = performance.now();
    const url = new URL(request.url);

    let response: Response;
    let routeTemplate: string;
    if (request.method === "GET" && url.pathname === "/healthz") {
      routeTemplate = "/healthz";
      response = jsonResponse({ status: "ok" }, 200);
    } else {
      routeTemplate = "unmatched";
      response = jsonResponse({
        error: { code: "not_found", message: "Route not found" },
      }, 404);
    }

    logger("info", "http_request", {
      deploymentVersion: options.deploymentVersion,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      method: request.method,
      routeTemplate,
      status: response.status,
    });
    return response;
  };
}
