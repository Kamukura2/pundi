import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 4297;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port)], { cwd:process.cwd(), stdio:"ignore" });
let browser;
async function waitForServer(){
  for(let attempt=0;attempt<40;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${port}/app.html`);if(response.ok)return;}
    catch{}
    await delay(250);
  }
  throw new Error(`Vite test server did not become ready on ${port}`);
}
try {
  await waitForServer();
  browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.goto(`http://127.0.0.1:${port}/app.html`, { waitUntil:"domcontentloaded" });
  await page.locator("#authGate").waitFor({ state:"visible", timeout:10000 });
  assert.equal(await page.locator("#authConfirmField").isHidden(), true, "sign-in must not show confirmation field");
  assert.equal(await page.locator(".mobile-nav").count(), 0, "legacy mobile dock must be removed");
  assert.equal(await page.locator(".mobile-add-transaction").count(), 1, "mobile transaction action must remain floating");
  const viewports = [[360,800],[390,844],[768,1024],[1280,720],[1366,768],[1440,900],[1920,1080]];
  for (const [width,height] of viewports) {
    await page.setViewportSize({width,height});
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      auth: Boolean(document.querySelector("#authGate")),
      keyControls: [...document.querySelectorAll("#authEmail,#authPassword,#authConfirm,#authSubmit,#authModeToggle")].every(el => el.getBoundingClientRect().right <= window.innerWidth + 1),
      onboarding: Boolean(document.querySelector("#onboardingCard")),
      drawer: Boolean(document.querySelector("#mobileMenuBtn")),
      legacyDock: Boolean(document.querySelector(".mobile-nav")),
      floatingAction: Boolean(document.querySelector(".mobile-add-transaction"))
    }));
    assert.equal(result.overflow, false, `horizontal overflow at ${width}x${height}`);
    assert.equal(result.auth, true);
    assert.equal(result.keyControls, true, `auth control clipped at ${width}x${height}`);
    assert.equal(result.onboarding, true);
    assert.equal(result.drawer, true);
    assert.equal(result.legacyDock, false, `legacy mobile dock present at ${width}x${height}`);
    assert.equal(result.floatingAction, true, `floating action missing at ${width}x${height}`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator("#authGate").evaluate(el => { el.hidden = true; });
  await page.locator("#mobileMenuBtn").click();
  assert.equal(await page.locator("body").evaluate(el => el.classList.contains("mobile-menu-open")), true, "mobile drawer must open");
  assert.equal(await page.locator("#mobileMenuBtn").getAttribute("aria-expanded"), "true", "mobile drawer state must be announced");
  await page.locator("#mobileMenuBackdrop").click({ position: { x: 380, y: 420 } });
  assert.equal(await page.locator("body").evaluate(el => el.classList.contains("mobile-menu-open")), false, "mobile drawer must close");
  await page.locator("#authGate").evaluate(el => { el.hidden = false; });
  await page.locator("#authModeToggle").click();
  assert.equal(await page.locator("#authConfirm").isVisible(), true, "sign-up confirmation visible");
  await page.locator("#authModeToggle").click();
  await page.locator("#authForgotPassword").click();
  assert.equal(await page.locator("#authTitle").textContent(), "Reset password", "forgot-password mode visible");
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.locator("#authGate").waitFor({ state:"visible", timeout:10000 });
  assert.equal(await page.locator("#authTitle").textContent(), "Sign in", "fresh auth shell returns to sign-in");
  await browser.close();
  browser = null;
  console.log("Responsive headless contract PASS: seven viewports, auth modes, drawer shell, and onboarding bounds");
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  if (server.exitCode === null && server.pid) {
    if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { stdio:"ignore", timeout:20000 });
    else server.kill();
  }
}
