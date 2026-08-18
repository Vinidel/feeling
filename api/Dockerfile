FROM denoland/deno:debian-2.9.4@sha256:c777b4b225501a61074837e90a826a58f99124837824023cd60334b1e2374498

WORKDIR /app
USER deno

COPY --chown=deno:deno api/deno.json api/deno.lock ./
COPY --chown=deno:deno api/src ./src

RUN deno ci --prod
RUN deno check src/main.ts

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DEPLOYMENT_VERSION=stage-6
EXPOSE 8080

CMD ["run", "--frozen", "--cached-only", "--no-prompt", "--allow-env=AUTH0_AUDIENCE,AUTH0_ISSUER,CORS_ORIGINS,DATABASE_URL,DEPLOYMENT_VERSION,HOST,PORT", "--ignore-env=PG*", "--allow-net=0.0.0.0:8080,dev-vin.au.auth0.com:443,aws-0-ap-southeast-2.pooler.supabase.com:6543", "src/main.ts"]
