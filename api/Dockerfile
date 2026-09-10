FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS client_builder

WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
ENV REACT_APP_API_URL=same-origin
RUN npm run build

FROM denoland/deno:debian-2.9.4@sha256:c777b4b225501a61074837e90a826a58f99124837824023cd60334b1e2374498

WORKDIR /app
USER deno

COPY --chown=deno:deno api/deno.json api/deno.lock ./
COPY --chown=deno:deno api/src ./src
COPY --from=client_builder --chown=deno:deno /build/client/build ./public

RUN deno ci --prod
RUN deno check src/main.ts

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DEPLOYMENT_VERSION=stage-12
ENV STATIC_ROOT=/app/public
EXPOSE 8080

CMD ["run", "--frozen", "--cached-only", "--no-prompt", "--allow-env=AUTH0_AUDIENCE,AUTH0_ISSUER,CORS_ORIGINS,DATABASE_SSL_MODE,DATABASE_URL,DEPLOYMENT_VERSION,HOST,PORT,STATIC_ROOT", "--ignore-env=PG*", "--allow-read=/app/public", "--allow-net=0.0.0.0:8080,dev-vin.au.auth0.com:443,aws-0-ap-southeast-2.pooler.supabase.com:6543", "src/main.ts"]
