import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = "api";
const files = [];
async function walk(dir) { for (const entry of await readdir(dir,{withFileTypes:true})) { const full=path.join(dir,entry.name); if(entry.isDirectory()) await walk(full); else if(entry.name.endsWith('.js')&&!entry.name.startsWith('_')) files.push(full); } }
await walk(root);
const expected = ["account.js","admin.js","config.js","cron/refresh-stocks.js","crypto/quote.js","feedback.js","stocks/dividends.js","stocks/quote.js","stocks/validate.js","trading/benchmark.js","trading/quote.js","telegram/cvfinance-webhook.js"];
for (const route of expected) assert.equal(files.includes(path.join("api",route)), true, `missing endpoint ${route}`);
assert.equal(files.length >= expected.length, true);
const source = Object.fromEntries(await Promise.all(files.map(async f => [f.split(path.sep).join("/"),await readFile(f,"utf8")] )));
for (const [file,text] of Object.entries(source)) {
  if(!/export default async function handler/.test(text)) continue;
  assert.match(text, /method\(|request\.method/);
  assert.doesNotMatch(text, /console\.log\([^)]*(?:token|password|secret|service_role)/i, `${file} logs secret-shaped value`);
  assert.doesNotMatch(text, /response[^\n]*(?:token|password|secret|service_role)/i, `${file} exposes secret-shaped response value`);
}
assert.match(source["api/account.js"], /Cache-Control.*no-store|no-store/);
assert.match(source["api/admin.js"], /Cache-Control.*no-store|no-store/);
assert.match(source["api/account.js"], /Malformed JSON request/);
assert.match(source["api/admin.js"], /Malformed JSON request/);
assert.match(source["api/admin.js"], /401/);
assert.match(source["api/admin.js"], /403/);
assert.match(source["api/telegram/cvfinance-webhook.js"], /export default/);
const vercel = await readFile("vercel.json", "utf8");
assert.match(vercel, /\/api\/stocks\/fx/);
assert.match(source["api/stocks/quote.js"], /__route.*fx/);
console.log(`API contract PASS: ${files.length} actual API modules, methods, auth/error/privacy guards, cache policy, and legacy webhook compatibility`);
