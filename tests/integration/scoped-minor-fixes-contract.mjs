import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { accountPlanPresentation } from "../../src/entitlements/resolver.js";

const html = await readFile("app.html", "utf8");
const app = await readFile("app.js", "utf8");
const css = await readFile("styles.css", "utf8");

assert.match(html, /id="addYearlyBtn"[^>]*data-icon="plus"/);
assert.match(html, /id="addEventBtn"[^>]*data-icon="plus"/);
assert.match(app, /addYearlyBtn\.onclick=\(\)=>openSimple\("Add Yearly Expense"/);
assert.match(app, /addEventBtn\.onclick=addEventBtnTop\.onclick=\(\)=>openSimple\("Add Event"/);

const lifetime = accountPlanPresentation({ entitlements: [{ plan_code: "pundi_pro_lifetime", status: "active" }] });
const free = accountPlanPresentation({ entitlements: [] });
assert.deepEqual(lifetime, { label: "Premium", detail: "Lifetime Access", key: "lifetime" });
assert.equal(free.key, "free");
assert.match(app, /function renderCommerceCatalog\(catalog,account=null\)/);
assert.match(app, /const ownsLifetime=presentation\?\.key==="lifetime"/);
assert.match(app, /if\(ownsLifetime\)[\s\S]*commerceCatalog\.innerHTML=""/);
assert.match(app, /renderCommerceCatalog\(catalogResult\.value,account\)/);

assert.match(html, /<details id="securityDetails" class="account-security">/);
assert.match(html, /<summary>[\s\S]*Change password[\s\S]*<\/summary>/);
assert.match(html, /id="changePasswordForm"/);
assert.doesNotMatch(html, /<details id="securityDetails"[^>]*open/);
assert.match(app, /changePasswordForm\.onsubmit=async event=>/);

assert.match(app, /asset:"coffee-budget"/);
assert.doesNotMatch(app, /asset:"coffee",tone:/);
assert.match(css, /\.story-card\.insight-coffee-budget\{background:/);
assert.match(app, /insightData\.map\(x=>`<article class="story-card \$\{x\.tone\} insight-\$\{x\.asset\}"/);

console.log("Scoped minor fixes contract PASS: Expense add actions, entitlement-gated Lifetime offer, collapsed password security, and Insights asset/color");
