import assert from "node:assert/strict";
import { createStaticAssetServer } from "../src/static.ts";

const encoder = new TextEncoder();

function virtualAssets(files: Readonly<Record<string, string>>) {
  return createStaticAssetServer({
    root: "/app/public",
    readFile: (path) => {
      const contents = files[path];
      if (contents === undefined) {
        return Promise.reject(new Deno.errors.NotFound());
      }
      return Promise.resolve(encoder.encode(contents));
    },
  });
}

Deno.test("static server serves assets, HEAD, and SPA routes", async () => {
  const serve = virtualAssets({
    "/app/public/index.html": "<main>steady</main>",
    "/app/public/static/app.js": "console.log('steady')",
  });

  const asset = await serve(new Request("https://steady.test/static/app.js"));
  assert.equal(asset?.status, 200);
  assert.equal(
    asset?.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assert.equal(
    asset?.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.equal(await asset?.text(), "console.log('steady')");

  const spa = await serve(new Request("https://steady.test/history"));
  assert.equal(spa?.status, 200);
  assert.equal(spa?.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(spa?.headers.get("cache-control"), "no-cache");
  assert.equal(await spa?.text(), "<main>steady</main>");

  const head = await serve(
    new Request("https://steady.test/", { method: "HEAD" }),
  );
  assert.equal(head?.status, 200);
  assert.equal(await head?.text(), "");
});

Deno.test("static server rejects API paths, unsafe paths, methods, and missing assets", async () => {
  const serve = virtualAssets({
    "/app/public/index.html": "<main>steady</main>",
  });

  for (
    const request of [
      new Request("https://steady.test/api/feelings"),
      new Request("https://steady.test/%5Cprivate"),
      new Request("https://steady.test/missing.js"),
      new Request("https://steady.test/", { method: "POST" }),
    ]
  ) {
    assert.equal(await serve(request), null);
  }
});
