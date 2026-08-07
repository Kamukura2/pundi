import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert.equal(manifest.name, "CVFinance");
assert.equal(manifest.display, "standalone");
for (const icon of manifest.icons) assert.ok(existsSync(resolve(root, "public", icon.src.replace(/^\//, ""))), `Missing ${icon.src}`);

const index = read("index.html");
for (const tab of ["accumulation","cashflow","expenses","clients","stocks","electricity","prospect","insights"]) assert.match(index, new RegExp(`id="${tab}"`));
assert.match(index, /manifest\.webmanifest/);
assert.match(index, /authForm/);

const sql = read("supabase/migrations/001_initial_schema.sql");
for (const table of ["profiles","accounts","transactions","monthly_budgets","yearly_expenses","planned_events","credit_facilities","credit_items","clients","stock_holdings","stock_price_targets","electricity_readings","app_settings"]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
}
assert.match(sql, /enable row level security/);
assert.match(sql, /auth\.uid\(\)/);

const env = read(".env.example");
for (const key of ["FINNHUB_API_KEY","TWELVE_DATA_API_KEY","SUPABASE_URL","SUPABASE_ANON_KEY"]) assert.match(env, new RegExp(`^${key}=`, "m"));
const serviceWorker = read("public/sw.js");
assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);

const jsFiles = ["app.js","api/config.js","api/_lib/rate-limit.js","api/stocks/quote.js","api/stocks/validate.js","api/cron/refresh-stocks.js","src/data/default-data.js","src/data/repository.js","src/lib/idb.js","src/lib/supabase.js","src/stocks/client.js","src/stocks/holding.js","src/sync/sync-manager.js"];
for (const file of jsFiles) execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio:"pipe" });

for (const file of jsFiles.map(read)) {
  assert.ok(!/sk_live_|service_role\s*[:=]\s*[A-Za-z0-9_-]{20,}/.test(file), "Possible committed secret detected");
}

const { createMvpSeed } = await import("../src/data/default-data.js");
const seed = createMvpSeed();
assert.equal(seed.accounts.reduce((sum, row) => sum + row.balance, 0), 14007953);
assert.equal(seed.clients.filter(row => row.status !== "freeze").reduce((sum, row) => sum + row.monthly, 0), 8300000);
assert.equal(seed.stocks.find(row => row.ticker === "WDC").quantity, 2.8033875);
assert.equal(seed.rateKwh, 1740);
assert.ok(seed.budgets.some(row => row.category === "Food") && seed.budgets.some(row => row.category === "Coffee"));

const { normalizeStockMapping, quantityForDisplay, quantityForStorage } = await import("../src/stocks/holding.js");
const idxHolding = {ticker:"BMRI",market:"IDX",provider:"finnhub",providerSymbol:"BMRI",currency:"IDR",quantity:10000};
assert.equal(quantityForDisplay(idxHolding), 100);
assert.equal(quantityForStorage("IDX", 100), 10000);
assert.equal(normalizeStockMapping(idxHolding), true);
assert.equal(idxHolding.provider, "twelvedata");
assert.equal(quantityForStorage("NASDAQ", 2.8033875), 2.8033875);

process.env.FINNHUB_API_KEY = "test";
process.env.TWELVE_DATA_API_KEY = "test";
process.env.STOCK_SYMBOL_ALLOWLIST = "WDC,BMRI:IDX";
const realFetch = globalThis.fetch;
const { fetchQuote, validateMapping } = await import("../api/_lib/providers.js");
validateMapping({provider:"finnhub",provider_symbol:"WDC",market:"NASDAQ"});
globalThis.fetch = async () => new Response(JSON.stringify({c:123.45,t:Math.floor(Date.now()/1000)}), {status:200,headers:{"content-type":"application/json"}});
const quote = await fetchQuote({provider:"finnhub",provider_symbol:"WDC",market:"NASDAQ"});
assert.equal(quote.price, 123.45);
assert.equal(quote.provider, "finnhub");
globalThis.fetch = realFetch;

await import("fake-indexeddb/auto");
const { FinanceRepository } = await import("../src/data/repository.js");
const { mutationClear, mutationList } = await import("../src/lib/idb.js");
await mutationClear();
const repository = new FinanceRepository({}, {id:"offline-test-user"});
const id = "22222222-2222-4222-8222-222222222222";
await repository.queueOperation({table:"accounts",action:"insert",id,row:{id,name:"Cash",balance:1},previousUpdatedAt:null});
await repository.queueOperation({table:"accounts",action:"update",id,row:{id,name:"Cash",balance:2},previousUpdatedAt:null});
let queued = await mutationList();
assert.equal(queued.length, 1);
assert.equal(queued[0].action, "insert");
assert.equal(queued[0].row.balance, 2);
await repository.queueOperation({table:"accounts",action:"delete",id,previousUpdatedAt:null});
queued = await mutationList();
assert.equal(queued.length, 0);

console.log("CVFinance checks passed: schema, RLS markers, PWA, 8 tabs, MVP invariants, stock provider abstraction, offline queue coalescing, environment template, and JavaScript syntax.");
