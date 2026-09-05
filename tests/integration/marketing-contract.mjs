import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const pages = ["landing.html", "catatan-keuangan.html", "pencatat-pengeluaran.html", "budgeting.html", "aset-investasi.html", "net-worth.html", "trading-journal.html", "backup-keuangan.html"];
for (const page of pages) {
  const html = read(page);
  assert.match(html, /<html lang="id">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/pundi\.online\//);
  assert.match(html, /https:\/\/app\.pundi\.online\//);
  assert.doesNotMatch(html, /testimonial|customers?\s*served|bank-grade|end-to-end encryption|automatic bank feeds/i);
}
const landing = read("landing.html");
const scriptBlocks = /<script[^>]*>[\s\S]*?<\/script>/gi;
for (const page of ["landing.html", "index.html"]) {
  const html = read(page);
  assert.ok(html.includes('<script defer src="/marketing-stories.js"></script>'));
  scriptBlocks.lastIndex = 0;
  const hasInlineExecutable = [...html.matchAll(scriptBlocks)].some(([block]) => {
    const openTag = block.slice(0, block.indexOf(">") + 1);
    return !/\bsrc\s*=/.test(openTag) && !/type\s*=\s*["']application\/ld\+json["']/i.test(openTag);
  });
  assert.equal(hasInlineExecutable, false, `${page} must not use executable inline scripts under strict CSP`);
}
assert.match(read("public/marketing-stories.js"), /const stories=/);
for (const marker of ["Keuanganmu,", "Catat", "Pantau", "Pahami", "DATA FIKSI", "akun", "backup", "FAQ", "application/ld"]) assert.match(landing, new RegExp(marker, "i"));
assert.match(landing, /Coba Pundi/);
assert.match(landing, /data-story="catat"/);
assert.match(read("public-site.css"), /prefers-reduced-motion/);
const sitemap = read("public/sitemap.xml");
for (const page of pages.slice(1)) assert.match(sitemap, new RegExp(`https://pundi\\.online/${page.replace(".html", "")}`));
assert.match(read("public/robots.txt"), /Sitemap:\s*https:\/\/pundi\.online\/sitemap\.xml/);
assert.match(read("vercel.json"), /catatan-keuangan/);
console.log("Marketing contract PASS: Indonesian acquisition pages, metadata, CTA, sitemap, robots, demo disclosure, and safe claims");
