import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("app.html", "utf8");
const source = readFileSync("app.js", "utf8");
const shell = readFileSync("src/lib/native-shell.js", "utf8");

const urls = {
  privacy: "https://pundi.online/privacy",
  terms: "https://pundi.online/terms",
  support: "https://pundi.online/support"
};

for (const [name, url] of Object.entries(urls)) {
  assert.match(app, new RegExp(`href=\"${url.replaceAll(".", "\\.")}\"`), `${name} control missing exact URL`);
  assert.ok(url.startsWith("https://"), `${name} must be HTTPS`);
}
assert.match(app, /Bantuan &amp; Legal/);
assert.equal((app.match(/href=\"https:\/\/pundi\.online\/(?:privacy|terms|support)\"/g) || []).length, 3);
assert.match(shell, /Browser\.open\(\{ url: url\.href \}\)/);
assert.doesNotMatch(source, /https:\/\/pundi\.online\/(privacy|terms|support)[^\"'`]*[?&](?:access|refresh|token|session|password)=/i);
console.log("Legal/support contract PASS: fixed HTTPS routes, native external-browser path, no arbitrary URL or credential query");
