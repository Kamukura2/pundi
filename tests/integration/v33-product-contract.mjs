import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { accountPlanPresentation } from "../../src/entitlements/resolver.js";
import { tickerIcon } from "../../src/ui/ticker-icons.js";

const root = process.cwd();
const read = file => readFileSync(resolve(root, file), "utf8");
const html = read("app.html");
const app = read("app.js");
const css = read("styles.css");
const brandScript = read("scripts/generate-brand-assets.py");
const docs = read("docs/PUNDI_V33_PRODUCT_REVISIONS.md");

assert.doesNotMatch(html, /id="(?:deleteAccountBtn|exportBackupBtn|importBackupBtn|legacyImportBtn|seedDataBtn|backupFile)"/);
assert.doesNotMatch(html, /Bantuan\s*&amp;\s*Legal|Import v6\.3\.1|Load MVP seed data|Export JSON backup|Import JSON backup|Delete my account/i);
assert.match(html, /id="accountPlan"/);
assert.match(html, /id="accountPlanDetail"/);
assert.match(html, /id="changePasswordForm"/);
assert.doesNotMatch(app, /(?:deleteAccountBtn|exportBackupBtn|importBackupBtn|legacyImportBtn|seedDataBtn|backupFile|validateBackup|readLegacyLocalStorage|createMvpSeed)/);
assert.match(app, /accountPlanPresentation/);
assert.match(app, /Promise\.allSettled/);
assert.doesNotMatch(app, /commerceStatus\.textContent=error\.message/);

assert.match(html, />Income This Month<\/h3>/);
assert.match(html, />Outstanding<\/h3>/);
assert.doesNotMatch(html, /<p>Projected income<\/p>|<p>Final payment only<\/p>|>Recurring Clients<\/h3>|>Ending Clients<\/h3>/i);

assert.match(html, /class="trading-summary-grid"/);
assert.match(html, /id="tradingEquity"/);
assert.match(html, /id="tradingAllocationDonut"/);
assert.match(html, /id="tradingAllocationLegend"/);
assert.match(app, /renderTradingAllocation/);
assert.match(app, /tickerIcon\(/);
assert.match(css, /\.trading-summary-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /\.trading-equity-hero\{[^}]*linear-gradient\([^}]*#126f5f/);
assert.match(css, /\.trading-allocation-content/);
assert.match(css, /\.ticker-icon/);
assert.match(css, /@media\(max-width:720px\)/);
assert.match(css, /\.trading-summary-grid\{grid-template-columns:1fr/);

assert.match(brandScript, /FAVICON_LOGO_FRACTION\s*=\s*0\.41/);
assert.match(brandScript, /WEB\.parent\s*\/\s*"favicon\.ico"/);

assert.deepEqual(accountPlanPresentation(), { label: "Free", detail: "Free", key: "free" });
assert.deepEqual(accountPlanPresentation({ subscription: { plan: "premium", status: "active" } }), { label: "Premium", detail: "Premium Access", key: "premium" });
assert.deepEqual(accountPlanPresentation({ subscription: { plan: "pundi_pro_lifetime", status: "active" } }), { label: "Premium", detail: "Lifetime Access", key: "lifetime" });
assert.deepEqual(accountPlanPresentation({ entitlements: [{ plan_code: "pundi_pro_lifetime", status: "active", expires_at: null }] }), { label: "Premium", detail: "Lifetime Access", key: "lifetime" });
assert.equal(accountPlanPresentation({ entitlements: [{ plan_code: "pundi_pro_lifetime", status: "active", expires_at: "2020-01-01T00:00:00.000Z" }] }).label, "Free");

const micron = tickerIcon("MU");
assert.match(micron, /Micron/);
assert.match(micron, /data-ticker-icon="MU"/);
const unknown = tickerIcon("UNKNOWN");
assert.match(unknown, /data-ticker-icon="fallback"/);
assert.match(unknown, /UNKNOWN/);
assert.doesNotMatch(micron, /https?:\/\//);
assert.match(docs, /deterministic local map/);
assert.match(docs, /fail-closed/);

console.log("V3.3 product contract PASS");
