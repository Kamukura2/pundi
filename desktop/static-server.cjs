const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safeAssetPath(distRoot, requestUrl) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname); }
  catch { return null; }
  const relative = pathname === "/" ? "app.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(distRoot, relative);
  const rootPrefix = `${distRoot}${path.sep}`;
  return candidate === distRoot || candidate.startsWith(rootPrefix) ? candidate : null;
}

function sendNotFound(response) {
  response.writeHead(404, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function createStaticServer(distRoot) {
  const root = path.resolve(distRoot);
  return http.createServer((request, response) => {
    const pathname = (() => { try { return new URL(request.url || "/", "http://127.0.0.1").pathname; } catch { return "/"; } })();
    let filename = safeAssetPath(root, request.url || "/");
    if (!filename || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
      // Only extensionless client-side routes use the bundled app shell.
      if (!path.extname(pathname)) filename = path.join(root, "app.html");
      else filename = null;
    }
    if (!filename || !fs.existsSync(filename)) { sendNotFound(response); return; }
    fs.readFile(filename, (error, body) => {
      if (error) { sendNotFound(response); return; }
      const type = MIME_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff"
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    });
  });
}

module.exports = { createStaticServer, safeAssetPath };
