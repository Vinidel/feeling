import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { createAuth0Authenticator } from "../src/auth.ts";
import { HttpError } from "../src/errors.ts";

const audience = "https://audience.example/api";

async function expectHttpError(
  operation: () => Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  await assert.rejects(
    operation,
    (error) =>
      error instanceof HttpError && error.status === status &&
      error.code === code,
  );
}

Deno.test("Auth0 boundary validates RS256 access tokens through cached remote JWKS", async () => {
  const signing = await generateKeyPair("RS256");
  const otherSigning = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(signing.publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid: "stage-6-key", use: "sig" });
  let jwksRequests = 0;
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: () => undefined,
  }, () => {
    jwksRequests += 1;
    return Response.json({ keys: [publicJwk] });
  });

  const localIssuer = `http://127.0.0.1:${server.addr.port}/`;
  const authenticate = createAuth0Authenticator({
    audience,
    issuer: localIssuer,
    jwksUrl: new URL("jwks.json", localIssuer),
  });
  const now = Math.floor(Date.now() / 1000);

  const sign = async (
    claims: JWTPayload,
    options: { otherKey?: boolean; expiration?: number | false } = {},
  ): Promise<string> => {
    let token = new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "stage-6-key" });
    if (options.expiration !== false) {
      token = token.setExpirationTime(options.expiration ?? now + 300);
    }
    return await token.sign(
      options.otherKey ? otherSigning.privateKey : signing.privateKey,
    );
  };

  try {
    const validToken = await sign({
      aud: audience,
      iss: localIssuer,
      sub: "auth0|stage6-user-a",
    });
    const validRequest = new Request("http://localhost/api/feelings", {
      headers: { authorization: `Bearer ${validToken}` },
    });
    assert.deepEqual(await authenticate(validRequest), {
      userId: "auth0|stage6-user-a",
    });
    assert.deepEqual(await authenticate(validRequest), {
      userId: "auth0|stage6-user-a",
    });
    assert.equal(jwksRequests, 1);

    const matchingHeader = new Request("http://localhost/api/feelings", {
      headers: {
        authorization: `Bearer ${validToken}`,
        "x-user-id": "auth0|stage6-user-a",
      },
    });
    assert.deepEqual(await authenticate(matchingHeader), {
      userId: "auth0|stage6-user-a",
    });

    const invalidRequests = [
      new Request("http://localhost/api/feelings"),
      new Request("http://localhost/api/feelings", {
        headers: { authorization: "Basic invalid" },
      }),
      new Request("http://localhost/api/feelings", {
        headers: { authorization: "Bearer malformed" },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: "https://wrong-issuer.example/",
            sub: "auth0|stage6-user-a",
          })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: "https://wrong-audience.example/api",
            iss: localIssuer,
            sub: "auth0|stage6-user-a",
          })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: localIssuer,
            sub: "auth0|stage6-user-a",
          }, { expiration: now - 60 })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: localIssuer,
            sub: "auth0|stage6-user-a",
          }, { expiration: false })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: localIssuer,
          })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: localIssuer,
            sub: "   ",
          })}`,
        },
      }),
      new Request("http://localhost/api/feelings", {
        headers: {
          authorization: `Bearer ${await sign({
            aud: audience,
            iss: localIssuer,
            sub: "auth0|stage6-user-a",
          }, { otherKey: true })}`,
        },
      }),
    ];
    for (const request of invalidRequests) {
      await expectHttpError(() => authenticate(request), 401, "invalid_token");
    }

    const mismatch = new Request("http://localhost/api/feelings", {
      headers: {
        authorization: `Bearer ${validToken}`,
        "x-user-id": "auth0|stage6-user-b",
      },
    });
    await expectHttpError(
      () => authenticate(mismatch),
      403,
      "forbidden_identity",
    );
  } finally {
    await server.shutdown();
  }
});
