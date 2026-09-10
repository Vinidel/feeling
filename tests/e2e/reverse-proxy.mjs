import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const staticDirectory = resolve(process.env.STATIC_DIR ?? "client/build");
const apiUrl = new URL(process.env.API_URL ?? "http://localhost:8080");
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid port");
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function safeStaticPath(pathname) {
  const candidate = resolve(staticDirectory, `.${pathname}`);
  if (
    candidate !== staticDirectory &&
    !candidate.startsWith(`${staticDirectory}${sep}`)
  ) {
    return null;
  }
  return candidate;
}

async function proxy(request, response, url) {
  const target = new URL(`${url.pathname}${url.search}`, apiUrl);
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await new Promise((resolveBody, reject) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => resolveBody(Buffer.concat(chunks)));
      request.on("error", reject);
    });
  const upstream = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: "manual",
  });
  response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(response, pathname) {
  let path = safeStaticPath(pathname);
  if (path) {
    try {
      if (!(await stat(path)).isFile()) path = null;
    } catch {
      path = null;
    }
  }
  path ??= resolve(staticDirectory, "index.html");
  const content = await readFile(path);
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": contentTypes.get(extname(path)) ??
      "application/octet-stream",
  });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (
      url.pathname.startsWith("/api/") || url.pathname === "/healthz" ||
      url.pathname === "/readyz"
    ) {
      await proxy(request, response, url);
    } else {
      await serveStatic(response, url.pathname);
    }
  } catch {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Test harness unavailable");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ event: "e2e_proxy_ready", port }));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
