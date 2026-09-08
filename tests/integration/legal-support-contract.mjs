import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const source = read("app.js");
const shell = read("src/lib/native-shell.js");

const routes = {
  privacy: "https://pundi.online/privacy",
  terms: "https://pundi.online/terms",
  support: "https://pundi.online/support"
};

for (const [name, url] of Object.entries(routes)) {
  const pagePath = `${name}.html`;
  assert.ok(existsSync(resolve(root, pagePath)), `${name} public page missing`);
  const page = read(pagePath);
  assert.match(page, new RegExp(`href=\"${url.replaceAll(".", "\\.")}\"`), `${name} page missing exact canonical URL`);
  assert.ok(url.startsWith("https://"), `${name} must be HTTPS`);
  assert.match(page, /<main\b/);
  assert.match(page, /<h1\b/);
}

for (const pageName of ["privacy", "terms", "support"]) {
  assert.match(read(`${pageName}.html`), /supportpundi@gmail\.com/i, `${pageName} support contact missing`);
}
assert.match(read("support.html"), /beta feedback|feedback/i, "In-app beta feedback channel missing");
assert.doesNotMatch(read("support.html"), /SUPPORT_EMAIL_OWNER_DECISION|support@pundi\.online|dedicated support mailbox has not been published|TODO|DEBUG/i);
assert.match(shell, /Browser\.open\(\{ url: url\.href \}\)/);
assert.match(source, /feedbackBtn/);
assert.doesNotMatch(source, /https:\/\/pundi\.online\/(privacy|terms|support)[^"'`]*[?&](?:access|refresh|token|session|password)=/i);
console.log("Legal/support contract PASS: fixed HTTPS public routes, approved support identity, native external-browser path, and no credential query");
