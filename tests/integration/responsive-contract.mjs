import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 4177;
const server = spawn(process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm", process.platform === "win32" ? ["/d","/s","/c",`npm run dev -- --host 127.0.0.1 --port ${port}`] : ["run","dev","--","--host","127.0.0.1","--port",String(port)], { stdio:"ignore" });
try {
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.goto(`http://127.0.0.1:${port}/app.html`, { waitUntil:"networkidle" });
  await page.locator("#authGate").waitFor({ state:"visible", timeout:10000 });
  const viewports = [[360,800],[390,844],[768,1024],[1366,768],[1920,1080]];
  for (const [width,height] of viewports) {
    await page.setViewportSize({width,height});
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      auth: Boolean(document.querySelector("#authGate")),
      keyControls: [...document.querySelectorAll("#authEmail,#authPassword,#authConfirm,#authSubmit,#authModeToggle")].every(el => el.getBoundingClientRect().right <= window.innerWidth + 1),
      onboarding: Boolean(document.querySelector("#onboardingCard")),
      drawer: Boolean(document.querySelector("#mobileMenuBtn"))
    }));
    assert.equal(result.overflow, false, `horizontal overflow at ${width}x${height}`);
    assert.equal(result.auth, true);
    assert.equal(result.keyControls, true, `auth control clipped at ${width}x${height}`);
    assert.equal(result.onboarding, true);
    assert.equal(result.drawer, true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator("#authModeToggle").click();
  assert.equal(await page.locator("#authConfirm").isVisible(), true, "sign-up confirmation visible");
  await page.locator("#authModeToggle").click();
  await page.locator("#authForgotPassword").click();
  assert.equal(await page.locator("#authTitle").textContent(), "Reset password", "forgot-password mode visible");
  await page.reload({ waitUntil:"networkidle" });
  await page.locator("#authGate").waitFor({ state:"visible", timeout:10000 });
  assert.equal(await page.locator("#authTitle").textContent(), "Sign in", "fresh auth shell returns to sign-in");
  await browser.close();
  console.log("Responsive headless contract PASS: five viewports, auth modes, drawer shell, and onboarding bounds");
} finally {
  server.kill();
}
