import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "axe-core";
import { spawn } from "node:child_process";

const port = 4178;
const server = spawn(process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm", process.platform === "win32" ? ["/d","/s","/c",`npm run dev -- --host 127.0.0.1 --port ${port}`] : ["run","dev","--","--host","127.0.0.1","--port",String(port)], { stdio:"ignore" });
try {
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:"networkidle" });
  await page.locator("#authGate").waitFor({ state:"visible", timeout:10000 });
  const axeSource = AxeBuilder.source;
  await page.addScriptTag({ content:axeSource });
  const result = await page.evaluate(async () => window.axe.run(document, { resultTypes:["violations"] }));
  const serious = result.violations.filter(item => ["critical","serious"].includes(item.impact));
  assert.deepEqual(serious, [], `serious accessibility violations: ${serious.map(item => item.id).join(", ")}`);
  const checks = await page.evaluate(() => ({
    duplicateIds: [...document.querySelectorAll("[id]")].map(el => el.id).filter((id,index,all) => all.indexOf(id) !== index),
    labelledInputs: [...document.querySelectorAll("#authGate input,#authGate select,#authGate textarea")].every(el => el.labels?.length || el.getAttribute("aria-label")),
    labelledButtons: [...document.querySelectorAll("#authGate button")].every(el => el.textContent.trim() || el.getAttribute("aria-label") || el.getAttribute("title")),
    authStatusLive: Boolean(document.querySelector("#authError[role='status'],#authError[role='alert']")),
    menuState: document.querySelector("#mobileMenuBtn")?.getAttribute("aria-expanded") === "false"
  }));
  assert.deepEqual(checks.duplicateIds, []);
  assert.equal(checks.labelledInputs, true);
  assert.equal(checks.labelledButtons, true);
  assert.equal(checks.authStatusLive, true);
  assert.equal(checks.menuState, true);
  await browser.close();
  console.log("Accessibility headless contract PASS: axe serious/critical, names, labels, duplicate IDs, live status, and menu state");
} finally {
  server.kill();
}
