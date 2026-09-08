import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const publicRoutes = [
  ["/", "landing.html"],
  ["/privacy", "privacy.html"],
  ["/terms", "terms.html"],
  ["/support", "support.html"],
  ["/updates", "updates.html"]
];

assert.equal(read("landing.html"), read("index.html"), "public entry pages synchronized");
const landing = read("landing.html");
assert.match(landing, /<main\b/);
assert.match(landing, /<h1\b[\s\S]*lang="id"[\s\S]*Keuanganmu,/i);
assert.match(landing, /<span lang="en">Your money\./i);
assert.match(landing, /Pemasukan, pengeluaran, dan investasi\./i);
assert.match(landing, /Yang masuk\./i);
assert.match(landing, /Lebih dari/i);
assert.match(landing, /Tetap di tanganmu\./i);
assert.match(landing, /Pundi Pro Lifetime/i);
assert.match(landing, /Harga katalog sandbox/i);
assert.match(landing, /Pembelian produksi belum dibuka/i);
assert.match(landing, /data-region="ID"/);
assert.match(landing, /data-region="US"/);
assert.match(landing, /id="harga"/);
assert.match(landing, /Pembaruan|Updates/i);
assert.match(landing, /application\/ld\+json/);
assert.match(landing, /https:\/\/schema\.org/);
assert.doesNotMatch(landing, /Coba Pundi|data-story=|section-number|feature-strip|testimonial|customers?\s*served|bank-grade|end-to-end encryption|automatic bank feeds|Play Store tersedia/i);

for (const [route, file] of publicRoutes) {
  assert.ok(existsSync(resolve(root, file)), `Missing public route file: ${file}`);
  const html = read(file);
  assert.match(html, /<html lang="(?:id|en)">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  const canonical = route === "/" ? "https://pundi.online/" : `https://pundi.online${route}`;
  assert.match(html, new RegExp(`rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(html, /<main\b/);
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /bank-grade|military-grade|automatic bank feeds/i);
}

const updates = read("updates.html");
assert.match(updates, /Public website · R3/i);
assert.match(updates, /Owner-review candidate · not deployed/i);
assert.match(updates, /Pundi 8\.7\.2/i);
const support = read("support.html");
assert.match(support, /Beta feedback/i);
assert.match(support, /supportpundi@gmail\.com/i);
assert.doesNotMatch(support, /SUPPORT_EMAIL_OWNER_DECISION|dedicated support mailbox has not been published|support@pundi\.online|TODO|DEBUG/i);

for (const page of ["privacy.html", "terms.html"]) {
  const html = read(page);
  assert.match(html, /supportpundi@gmail\.com/i);
  assert.match(html, /Pundi/);
}

const sitemap = read("public/sitemap.xml");
for (const [route] of publicRoutes) assert.match(sitemap, new RegExp(`https://pundi\\.online${route === "/" ? "/" : route}`));
assert.match(read("public/robots.txt"), /Sitemap:\s*https:\/\/pundi\.online\/sitemap\.xml/);
assert.match(read("public-site.css"), /prefers-reduced-motion/);
assert.match(read("vercel.json"), /pundi\.online/);

console.log("Marketing contract PASS: approved R3 homepage, public routes, localization controls, changelog, metadata, sitemap, and safe claims");
