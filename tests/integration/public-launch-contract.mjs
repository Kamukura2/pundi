import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const files = ["landing.html", "privacy.html", "terms.html", "support.html", "updates.html", "public/robots.txt", "public/sitemap.xml"];
for (const file of files) assert.ok(existsSync(resolve(root, file)), `Missing public launch file: ${file}`);

const landing = read("landing.html");
assert.match(landing, /<main\b/);
assert.match(landing, /<h1[^>]*>/);
assert.match(landing, /Keuanganmu|Your money/);
assert.match(landing, /<title>Pundi/);
assert.match(landing, /canonical.*https:\/\/pundi\.online/i);
assert.match(landing, /https:\/\/app\.pundi\.online/);
assert.match(landing, /Pundi Pro Lifetime/);
assert.match(landing, /data-region="ID"/);
assert.match(landing, /data-region="US"/);
assert.match(landing, /Privasi|Privacy/);
assert.match(landing, /Ketentuan|Terms/);
assert.match(landing, /Bantuan|Help/);
assert.doesNotMatch(landing, /testimonial|customers?\s*served|bank-grade|end-to-end encryption|automatic bank feeds|paid theme/i);

for (const page of ["privacy.html", "terms.html", "support.html", "updates.html"]) {
  const html = read(page);
  assert.match(html, /<main\b/);
  assert.match(html, /<h1\b/);
  assert.match(html, /https:\/\/pundi\.online\/(privacy|terms|support|updates)/i);
}
const support = read("support.html");
assert.match(support, /supportpundi@gmail\.com/i);
assert.match(support, /beta feedback|feedback/i);
assert.doesNotMatch(support, /SUPPORT_EMAIL_OWNER_DECISION|support@pundi\.online|dedicated support mailbox has not been published|TODO|DEBUG/i);
const privacy = read("privacy.html");
const terms = read("terms.html");
assert.match(privacy, /supportpundi@gmail\.com/i);
assert.match(terms, /supportpundi@gmail\.com/i);
assert.match(terms, /public operator\/display name.*Pundi/i);

const app = read("app.html");
assert.match(app, /id="feedbackBtn"/);
assert.match(read("app.js"), /feedbackBtn/);
assert.match(read("src/sync/sync-manager.js"), /authRedirectOrigin/);
assert.doesNotMatch(read("src/sync/sync-manager.js"), /pundi-silk\.vercel\.app/);

const vercel = read("vercel.json");
assert.match(vercel, /pundi\.online/);
assert.match(vercel, /www\.pundi\.online/);
assert.match(vercel, /auth\/reset-password/);
assert.doesNotMatch(vercel, /auth\.pundi\.online/);

const robots = read("public/robots.txt");
assert.match(robots, /Disallow:\s*\/app/);
assert.match(robots, /Disallow:\s*\/admin/);
assert.match(robots, /sitemap\.xml/);
console.log("Public launch contract PASS: current R3 routes, metadata, identity, domain routing, legal/support, and feedback");
