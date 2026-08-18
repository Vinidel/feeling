export type ErrorCode =
  | "cors_origin_denied"
  | "cors_preflight_denied"
  | "dependency_unavailable"
  | "forbidden_identity"
  | "internal_error"
  | "invalid_request"
  | "invalid_token"
  | "not_found";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly publicMessage: string,
  ) {
    super(code);
  }
}

export function errorResponse(error: HttpError): Response {
  return Response.json({
    error: { code: error.code, message: error.publicMessage },
  }, {
    status: error.status,
    headers: { "cache-control": "no-store" },
  });
}
