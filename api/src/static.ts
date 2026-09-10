export type StaticAssetServer = (
  request: Request,
) => Promise<Response | null>;

type ReadFile = (path: string) => Promise<Uint8Array<ArrayBuffer>>;

type StaticAssetOptions = Readonly<{
  root: string;
  readFile?: ReadFile;
}>;

const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

function extension(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot).toLowerCase() : "";
}

function safeRelativePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return segments.join("/");
}

function headersFor(path: string, spaFallback: boolean): Headers {
  const headers = new Headers({
    "cache-control": spaFallback || path.endsWith("/index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
    "content-type": contentTypes[extension(path)] ??
      "application/octet-stream",
    "referrer-policy": "same-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  return headers;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Deno.errors.NotFound ||
    (error instanceof Error && error.name === "NotFound");
}

export function createStaticAssetServer(
  options: StaticAssetOptions,
): StaticAssetServer {
  const root = options.root.replace(/\/$/, "");
  const readFile = options.readFile ?? Deno.readFile;

  return async (request: Request): Promise<Response | null> => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    const pathname = new URL(request.url).pathname;
    const relative = safeRelativePath(pathname);
    if (relative === null || relative.startsWith("api/")) return null;

    const requested = relative || "index.html";
    let served = requested;
    let spaFallback = false;
    let body: Uint8Array<ArrayBuffer>;
    try {
      body = await readFile(`${root}/${requested}`);
    } catch (error) {
      if (!isMissingFile(error) || extension(requested)) return null;
      served = "index.html";
      spaFallback = true;
      try {
        body = await readFile(`${root}/index.html`);
      } catch (fallbackError) {
        if (isMissingFile(fallbackError)) return null;
        throw fallbackError;
      }
    }

    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: headersFor(`${root}/${served}`, spaFallback),
    });
  };
}
