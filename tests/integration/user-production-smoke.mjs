import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.PUNDI_PRODUCTION_URL || "https://app.pundi.online";
const email = process.env.PUNDI_USER_SMOKE_EMAIL || "";
const password = process.env.PUNDI_USER_SMOKE_PASSWORD || "";
if (!email || !password) throw new Error("ACTION REQUIRED: local user-smoke credentials are missing.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const result = { status: "PASS", origin, financeMutations: 0 };
try {
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator("#authGate").waitFor({ state: "visible", timeout: 30000 });
  assert.match(await page.title(), /Pundi v8\.8\.0/);
  for (let attempt = 1; attempt <= 3 && await page.locator("#authGate").isVisible(); attempt++) {
    await page.locator("#authEmail").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#authPassword").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#authEmail").fill(email);
    await page.locator("#authPassword").fill(password);
    await page.locator("#authSubmit").click();
    try { await page.locator("#authGate").waitFor({ state: "hidden", timeout: 15000 }); } catch {}
  }
  await page.locator("#authGate").waitFor({ state: "hidden", timeout: 30000 });
  await page.locator("#primarySidebar").waitFor({ state: "visible", timeout: 30000 });
  await page.locator("#onboardingCard").waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator("#onboardingCard").isVisible(), true);
  for (const id of ["onboardingAddAccount", "onboardingAddTransaction", "onboardingExploreAssets"]) assert.equal(await page.locator(`#${id}`).count(), 1);
  assert.equal(await page.locator("[data-onboarding-dismiss]").count(), 1);
  for (const target of ["accumulation", "cashflow", "stocks"]) { await page.locator(`[data-page="${target}"]`).first().click(); await page.locator(`#${target}`).waitFor({ state: "visible", timeout: 10000 }); }
  await page.locator("#dataBtn").click();
  await page.locator("#dataModal").waitFor({ state: "visible", timeout: 10000 });
  for (const id of ["accountEmail", "accountCreatedAt", "accountPlan", "accountStatus", "changePasswordBtn", "logoutBtn", "deleteAccountBtn"]) assert.equal(await page.locator(`#${id}`).count(), 1);
  const token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) { try { const value = JSON.parse(localStorage.getItem(key)); if (value?.access_token) return value.access_token; } catch {} }
    return null;
  });
  assert.ok(token, "authenticated browser session token unavailable");
  const authz = await page.evaluate(async token => { const response = await fetch("/api/admin", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20000) }); return { status: response.status, body: await response.text() }; }, token);
  assert.equal(authz.status, 403);
  assert.doesNotMatch(authz.body, /user_id|total_users|overview|metrics/i);
  await page.locator("#dataModal .close-dialog").first().click();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator("#authGate").waitFor({ state: "hidden", timeout: 30000 });
    await page.locator("#primarySidebar").waitFor({ state: "visible", timeout: 30000 });
    assert.equal(await page.locator("#primarySidebar").isVisible(), true);
  await page.locator("#dataBtn").click();
  await page.locator("#logoutBtn").click();
  await page.locator("#authGate").waitFor({ state: "visible", timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator("#authGate").waitFor({ state: "visible", timeout: 30000 });
  const unauth = await page.evaluate(async () => { const response = await fetch("/api/admin", { cache: "no-store", signal: AbortSignal.timeout(20000) }); return response.status; });
  assert.equal(unauth, 401);
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
