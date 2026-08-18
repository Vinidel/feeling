import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./errors.ts";

export type AuthenticatedIdentity = Readonly<{ userId: string }>;
export type AuthenticateRequest = (
  request: Request,
) => Promise<AuthenticatedIdentity>;

export type Auth0VerifierOptions = Readonly<{
  audience: string;
  issuer: string;
  jwksUrl?: URL;
}>;

const invalidToken = () =>
  new HttpError(401, "invalid_token", "Valid authentication is required");

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw invalidToken();
  return match[1];
}

export function createAuth0Authenticator(
  options: Auth0VerifierOptions,
): AuthenticateRequest {
  const jwksUrl = options.jwksUrl ??
    new URL(".well-known/jwks.json", options.issuer);
  const remoteJwks = createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: 60 * 60 * 1000,
    cooldownDuration: 30 * 1000,
    timeoutDuration: 3 * 1000,
  });

  return async (request: Request): Promise<AuthenticatedIdentity> => {
    let payload;
    try {
      ({ payload } = await jwtVerify(bearerToken(request), remoteJwks, {
        algorithms: ["RS256"],
        audience: options.audience,
        issuer: options.issuer,
        requiredClaims: ["exp", "sub"],
      }));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw invalidToken();
    }

    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId || userId !== userId.trim()) throw invalidToken();

    const headerUserId = request.headers.get("x-user-id");
    if (headerUserId !== null && headerUserId !== userId) {
      throw new HttpError(
        403,
        "forbidden_identity",
        "Request identity does not match the authenticated user",
      );
    }

    return { userId };
  };
}
