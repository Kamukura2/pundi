import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createStaticServer, safeAssetPath } from "../../desktop/static-server.cjs";

const root = resolve(process.cwd(), "dist");
assert.ok((await readFile(resolve(root, "app.html"), "utf8")).includes("Pundi"));
assert.equal(safeAssetPath(root, "/%2e%2e%2fpackage.json"), null);
assert.equal(safeAssetPath(root, "/%2e%2e%2f%2e%2e%2fpackage.json"), null);

const server = createStaticServer(root);
await new Promise((resolveReady, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveReady); });
const { port } = server.address();
try {
  const shell = await fetch(`http://127.0.0.1:${port}/auth/reset-password`);
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /Pundi/);
  const icon = await fetch(`http://127.0.0.1:${port}/icons/icon.svg`);
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get("content-type"), "image/svg+xml");
  const missing = await fetch(`http://127.0.0.1:${port}/assets/not-present.js`);
  assert.equal(missing.status, 404);
  const head = await fetch(`http://127.0.0.1:${port}/icons/icon.svg`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  console.log(JSON.stringify({ status: "PASS", checks: ["shell-route", "icon-mime", "missing-asset-404", "head", "path-traversal"] }));
} finally {
  await new Promise(resolveClosed => server.close(resolveClosed));
}
