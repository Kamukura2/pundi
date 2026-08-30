import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const files = ["landing.html", "privacy.html", "terms.html", "support.html", "public-site.css", "public/robots.txt", "public/sitemap.xml"];
for (const file of files) assert.ok(existsSync(resolve(root, file)), `Missing public launch file: ${file}`);

const landing = read("landing.html");
assert.match(landing, /<main\b/);
assert.match(landing, /<h1[^>]*>[^<]*Keuanganmu/);
assert.match(landing, /<title>Pundi/);
assert.match(landing, /canonical.*https:\/\/pundi\.online/i);
assert.match(landing, /https:\/\/app\.pundi\.online/);
assert.match(landing, /Catat/);
assert.match(landing, /Pahami/);
assert.match(landing, /Data terisolasi per akun/i);
assert.match(landing, /backup/i);
assert.match(landing, /Privasi/);
assert.match(landing, /Ketentuan/);
assert.match(landing, /Bantuan/);
assert.doesNotMatch(landing, /testimonial|customers?\s*served|bank-grade|end-to-end encryption|automatic bank feeds/i);

for (const page of ["privacy.html", "terms.html", "support.html"]) {
  const html = read(page);
  assert.match(html, /<main\b/);
  assert.match(html, /<h1\b/);
  assert.match(html, /canonical.*https:\/\/pundi\.online/i);
  assert.match(html, /privacy|terms|support/i);
}
const support = read("support.html");
assert.match(support, /SUPPORT_EMAIL_OWNER_DECISION/);
assert.match(support, /Beta feedback|feedback/i);

const index = read("app.html");
assert.match(index, /id="feedbackBtn"/);
assert.match(read("app.js"), /feedbackBtn/);
assert.match(read("src/sync/sync-manager.js"), /window\.location\.origin/);
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
console.log("Public launch contract RED/GREEN target: routes, metadata, domain routing, legal/support, and feedback");
