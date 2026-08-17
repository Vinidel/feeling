# Standalone Deno API foundation

Stage 2 establishes the replacement runtime without implementing feelings,
weekly tracker, Auth0 middleware, database access, or other business behavior.

## Pinned toolchain and dependencies

- Deno `2.9.4`, from the active Deno 2.9 LTS line
- Native `Deno.serve` HTTP server and `Deno.test` runner
- Zod `4.4.3` for strict request/configuration schemas
- JOSE `6.2.9` for standards-based JWT and remote JWKS support
- postgres.js `3.4.9` for direct PostgreSQL access with TLS and prepared
  statements disabled when required by transaction pooling
- Native JSON logging wrapper with an explicit field allowlist

All versions are explicit in `deno.json` and integrity-pinned in `deno.lock`.
`nodeModulesDir` is disabled, so npm lifecycle scripts are not run and no native
addon installation path exists.

## Commands

From `api/`, using Deno 2.9.4:

```bash
deno ci --prod
deno task fmt:check
deno task lint
deno task check
deno task test
deno task start
```

Build the portable OCI image from the repository root:

```bash
docker build -f api/Dockerfile -t feeling-api:stage-2 .
```

The image is pinned to the official multi-platform Deno base-image digest
`sha256:c777b4b225501a61074837e90a826a58f99124837824023cd60334b1e2374498`. It
listens on port `8080` and exposes only `GET /healthz`; every business or
retired API path returns `404`.

## Runtime permissions

The container starts with explicit stable permission flags and `--no-prompt`:

- environment reads: `HOST`, `PORT`, and `DEPLOYMENT_VERSION` only;
- conventional ambient `PG*` reads attempted by postgres.js return `undefined`
  rather than receiving access;
- network: listen on `0.0.0.0:8080` only;
- filesystem reads/writes: none granted;
- subprocess, FFI, system information, and dynamic-import permissions: none
  granted.

Auth0 and PostgreSQL network hosts are intentionally not granted in Stage 2.
Their exact outbound permissions and server-only environment names are added
only when the corresponding approved implementation stages introduce those
responsibilities.

## Compatibility result

The test suite proves that Zod, JOSE/JWKS, and postgres.js load and perform
their non-network responsibilities under Deno without lifecycle scripts, native
addons, or broad permissions. PostgreSQL connection behavior is tested with a
lazy, non-connecting TLS client; real database connectivity belongs to the
authorized Supabase stages.
