import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const origin = process.env.PUNDI_PRODUCTION_URL || "https://app.pundi.online";
const expectedBuild = process.env.PUNDI_EXPECTED_BUILD || execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
const fetchText = async route => { const response = await fetch(origin + route, { cache: "no-store" }); return { response, text: await response.text() }; };
const routes = ["/", "/auth/reset-password", "/api/config", "/sw.js", "/admin"];
const results = {};
for (const route of routes) {
  const { response, text } = await fetchText(route);
  assert.equal(response.status, 200, `${route} status`);
  results[route] = { status: response.status, contentType: response.headers.get("content-type") };
  for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy"]) assert.ok(response.headers.get(header), `${route} missing ${header}`);
  if (route === "/") assert.match(text, /Pundi v8\.5\.0/);
  if (route === "/api/config") { const body = JSON.parse(text); assert.match(body.supabaseUrl, /ndeycwoyjwyntjkgbzlz/); assert.equal(response.headers.get("cache-control"), "no-store"); }
  if (route === "/sw.js") assert.match(text, /pundi-shell-v8\.5\.0/);
}
const home = (await fetchText("/")).text;
const assets = [...home.matchAll(/(?:src|href)="(\/assets\/[^"]+)/g)].map(match => match[1]);
let bundle = "";
for (const asset of assets) bundle += (await fetchText(asset)).text;
assert.match(bundle, /Pundi v8\.5\.0 · build \$\{[A-Za-z_$][\w$]*\} · Beta/);
assert.match(bundle, new RegExp(`const [A-Za-z_$][\\w$]*="${expectedBuild}"`));
assert.doesNotMatch(bundle, /SUPABASE_SERVICE_ROLE_KEY|service_role_key\s*[:=]|smoke password|cvfinance\.supabase\.co/i);
const admin = await fetch(origin + "/api/admin", { cache: "no-store" });
assert.equal(admin.status, 401);
console.log(JSON.stringify({ status: "PASS", origin, expectedBuild, routes, assetCount: assets.length, unauthAdmin: admin.status, authenticatedAdmin: "delegated to test:admin-smoke" }));
