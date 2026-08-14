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
assert.match(index, /annualPerformanceDashboard/);
assert.match(index, /Decision Metrics/);
assert.match(index, /target-price-board/);
assert.match(index, /insightActionPlan/);
assert.match(index, /id="cashMonthExpense"/, "History must show one current-month expense headline");
assert.doesNotMatch(index, /id="cashIncome"|id="cashExpense"|id="cashNet"/, "The old three History summary cards must be removed");
assert.match(index, /id="cashChannelDonut"/);
assert.match(index, /id="cashChannelLegend"/);
assert.ok(index.indexOf('id="txDescription"') < index.indexOf('id="txAmount"'), "Transaction Description must appear above Amount");

const sql = read("supabase/migrations/001_initial_schema.sql");
for (const table of ["profiles","accounts","transactions","monthly_budgets","yearly_expenses","planned_events","credit_facilities","credit_items","clients","stock_holdings","stock_price_targets","electricity_readings","app_settings"]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
}
assert.match(sql, /enable row level security/);
assert.match(sql, /auth\.uid\(\)/);

const env = read(".env.example");
for (const key of ["FINNHUB_API_KEY","SUPABASE_URL","SUPABASE_ANON_KEY"]) assert.match(env, new RegExp(`^${key}=`, "m"));
const serviceWorker = read("public/sw.js");
assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);

const jsFiles = ["app.js","api/config.js","api/_lib/rate-limit.js","api/stocks/fx.js","api/stocks/quote.js","api/stocks/validate.js","api/cron/refresh-stocks.js","src/data/default-data.js","src/data/finance-model.js","src/data/repository.js","src/lib/idb.js","src/lib/supabase.js","src/stocks/client.js","src/stocks/holding.js","src/sync/sync-manager.js"];
for (const file of jsFiles) execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio:"pipe" });

for (const file of jsFiles.map(read)) {
  assert.ok(!/sk_live_|service_role\s*[:=]\s*[A-Za-z0-9_-]{20,}/.test(file), "Possible committed secret detected");
}

const { createMvpSeed } = await import("../src/data/default-data.js");
const seed = createMvpSeed();
assert.equal(seed.accounts.reduce((sum, row) => sum + row.balance, 0), 14007953);
assert.equal(seed.clients.reduce((sum, row) => sum + row.monthly, 0), 10500000);
assert.equal(seed.stocks.find(row => row.ticker === "WDC").quantity, 2.8033875);
assert.equal(seed.rateKwh, 1740);
assert.ok(seed.budgets.some(row => row.category === "Food") && seed.budgets.some(row => row.category === "Coffee"));

const { annualOperatingPerformance, buildMonthlyTimeline, buildProjection, getBudgetProgress, getClientPaidThisMonth, getCurrentNetWorth, getEntrustedDeduction, getFixedIncome, getTotalOutstanding, remainingYearExpenseBreakdown, remainingYearIncomeBreakdown, transactionsForMonth } = await import("../src/data/finance-model.js");
const modelClients = [
  {monthly:1000000,paid:300000,carry:0,status:"pending",clientType:"recurring"},
  {monthly:2000000,paid:0,carry:0,status:"pending",clientType:"ending",endingPaid:false},
  {monthly:3000000,paid:3000000,carry:0,status:"paid",clientType:"ending",endingPaid:true}
];
assert.equal(getFixedIncome(modelClients),1000000,"Ending clients must not enter recurring income");
assert.deepEqual(annualOperatingPerformance({clients:modelClients,budgets:[{monthly:1000000},{monthly:-500000}],yearly:[{amount:2000000},{amount:-1000000}]}),{income:12000000,monthlyExpense:18000000,yearlyExpense:3000000,expense:21000000,net:-9000000},"Annual operating dashboard must use recurring income and absolute monthly/yearly budgets only");
assert.equal(getTotalOutstanding(modelClients),2700000,"Unpaid ending balances remain receivables");
assert.equal(getCurrentNetWorth(10000000,5000000),15000000,"Accumulation is current liquid plus stocks only");
const entrusted=[{amount:1500000,source:"cash",settled:false},{amount:750000,source:"stocks",settled:false},{amount:900000,source:"cash",settled:true}];
assert.equal(getEntrustedDeduction(entrusted),2250000,"Only active entrusted funds reduce net worth");
assert.equal(getEntrustedDeduction(entrusted,"cash"),1500000,"Cash and stock entrusted deductions remain separate");
assert.equal(getCurrentNetWorth(10000000-getEntrustedDeduction(entrusted,"cash"),5000000-getEntrustedDeduction(entrusted,"stocks")),12750000,"Entrusted funds reduce their selected asset source exactly once");
const referenceDate=new Date("2026-08-07T12:00:00+07:00");
const monthlyLedger=[{id:"jul",type:"expense",amount:700000,date:"2026-07-31",category:"Food",channel:"GoFood"},{id:"aug",type:"expense",amount:800000,date:"2026-08-01",category:"Food",channel:"GrabFood"}];
assert.deepEqual(transactionsForMonth(monthlyLedger,2026,7).map(row=>row.id),["aug"],"A new History month must start from only its own dated records");
assert.equal(monthlyLedger.length,2,"Monthly History reset must never delete archived transactions");
const rolledClient={monthly:1000000,paid:1000000,carry:0,status:"paid",clientType:"recurring",trackingMonth:"2026-07"};
assert.equal(getClientPaidThisMonth(rolledClient,referenceDate),0,"Recurring client paid state must reset automatically in a new month");
assert.equal(getTotalOutstanding([rolledClient],referenceDate),1000000,"A new month must restore the recurring invoice without deleting history");
const modelBudgets=[{category:"Food",monthly:1000000,paymentStatus:"partial",paidAmount:400000,trackingMonth:"2026-08"}];
const modelYearly=[{amount:1000000,month:"August",lastPaidYear:null},{amount:2000000,month:"October",lastPaidYear:null},{amount:3000000,month:"June",lastPaidYear:2026}];
const modelEvents=[{date:"2026-08-20",amount:500000},{date:"2028-07-01",amount:5000000}];
const modelCredit=[{due:"2026-08-26",amount:100000,paid:false},{due:"2026-09-26",amount:200000,paid:false},{due:"2027-04-26",amount:300000,paid:false}];
const modelTransactions=[{type:"income",amount:400000,date:"2026-08-05"},{type:"expense",amount:900000,date:"2026-08-05",category:"Food"}];
assert.deepEqual(getBudgetProgress(modelBudgets[0],modelTransactions,referenceDate),{status:"partial",paid:400000,remaining:600000,autoPaid:900000,trackingMonth:"2026-08"},"Manual partial progress must override History without changing the default budget");
assert.deepEqual(remainingYearExpenseBreakdown({referenceDate,budgets:modelBudgets,yearly:modelYearly,events:modelEvents,credit:modelCredit,transactions:modelTransactions}),{recurring:4600000,yearly:3000000,events:500000,eventOnly:500000,credit:300000,total:8400000},"Remaining-year expense must separate one-time events and dated credit");
assert.deepEqual(remainingYearIncomeBreakdown({referenceDate,clients:modelClients,transactions:modelTransactions}),{outstanding:2700000,recurring:4000000,additional:0,total:6700000},"History income must remain ledger-only and never enter projection");
const monthly=buildMonthlyTimeline({referenceDate,accountTotal:10000000,clients:modelClients,budgets:modelBudgets,yearly:modelYearly,events:modelEvents,credit:modelCredit,transactions:modelTransactions,portfolioForYear:()=>0});
assert.deepEqual(monthly.map(row=>row.cash),[10500000,10300000,8300000,8300000,8300000],"Current month uses receivables and planned obligations while ignoring History cashflow");
const modelProjection = buildProjection({
  years:[2026,2027,2028],referenceDate,accountTotal:10000000,clients:modelClients,budgets:modelBudgets,
  yearly:modelYearly,events:modelEvents,credit:modelCredit,transactions:modelTransactions,portfolioForYear:()=>0
});
assert.deepEqual(modelProjection.map(row=>row.closing),[8300000,2000000,-9000000],"Projection must carry closing cash forward, ignore History, and deduct obligations only in their matching year");
assert.equal(modelProjection[0].expenses.currentMonth,600000,"Current-month remaining budget must be disclosed separately");
assert.equal(modelProjection[0].expenses.recurring,4000000,"August projection must show exactly four full recurring expense months after August");
assert.equal(modelProjection[0].incomeBreakdown.recurring,4000000,"August projection must show exactly four full recurring income months after August");
for (const row of modelProjection) assert.equal(row.nw,row.opening+row.portfolio+row.incomeBreakdown.total-row.expenses.total,`Headline ${row.year} must equal its visible equation`);
assert.equal(modelProjection[0].expenses.credit,300000,"Only unpaid credit due in the current year belongs in 2026");
assert.equal(modelProjection[1].expenses.credit,300000,"Credit due in 2027 appears once in 2027");
assert.equal(modelProjection[2].expenses.credit,0,"Credit must not recur after its due year");
const projectionWithoutHistory=buildProjection({years:[2026,2027,2028],referenceDate,accountTotal:10000000,clients:modelClients,budgets:modelBudgets,yearly:modelYearly,events:modelEvents,credit:modelCredit,transactions:[],portfolioForYear:()=>0});
assert.deepEqual(modelProjection.map(row=>row.nw),projectionWithoutHistory.map(row=>row.nw),"Income and expense History entries must never change Net Worth or Prospect");
const autoBudget={category:"Food",monthly:1000000,paymentStatus:"auto",paidAmount:0,trackingMonth:"2026-08"};
assert.equal(getBudgetProgress(autoBudget,modelTransactions,referenceDate).paid,900000,"History expense still fills the matching Budget meter");
assert.equal(remainingYearExpenseBreakdown({referenceDate,budgets:[autoBudget],yearly:[],events:[],credit:[],transactions:modelTransactions}).recurring,5000000,"History meter usage must not reduce planned Budget obligations");
const signedEventProjection=buildProjection({years:[2026,2027,2028],referenceDate,accountTotal:0,clients:[],budgets:[],yearly:[],events:[{date:"2028-06-01",amount:50000000},{date:"2028-07-01",amount:-5500000}],credit:[],transactions:[],portfolioForYear:()=>0});
assert.equal(signedEventProjection[2].expenses.events,55500000,"Expense entries use absolute obligations and can never cancel another event");

const migration006 = read("supabase/migrations/006_client_types_yearly_status.sql");
for (const marker of ["client_type","ending_paid","last_paid_year"]) assert.match(migration006,new RegExp(marker));
assert.doesNotMatch(migration006,/drop\s+table|truncate\s+|delete\s+from/i);
const migration007 = read("supabase/migrations/007_projection_budget_sort_language.sql");
for (const marker of ["payment_status","paid_amount","tracking_month","sort_order","language"]) assert.match(migration007,new RegExp(marker));
assert.doesNotMatch(migration007,/drop\s+table|truncate\s+|delete\s+from/i);
const migration008 = read("supabase/migrations/008_event_credit_sort_order.sql");
for (const marker of ["planned_events","credit_items","sort_order","tracking_month"]) assert.match(migration008,new RegExp(marker));
assert.doesNotMatch(migration008,/drop\s+table|truncate\s+|delete\s+from/i);
const migration009 = read("supabase/migrations/009_entrusted_funds.sql");
for (const marker of ["entrusted_funds","deduction_source","is_settled","sort_order","enable row level security"]) assert.match(migration009,new RegExp(marker));
assert.doesNotMatch(migration009,/drop\s+table|truncate\s+|delete\s+from/i);
const migration010 = read("supabase/migrations/010_monthly_budget_sort_order.sql");
for (const marker of ["monthly_budgets","sort_order","monthly_budgets_user_order_idx"]) assert.match(migration010,new RegExp(marker));
assert.doesNotMatch(migration010,/drop\s+table|truncate\s+|delete\s+from/i);
const migration011 = read("supabase/migrations/011_stock_cash_wallet.sql");
for (const marker of ["stock_netcash_idr","stock_wallet_usd","app_settings"]) assert.match(migration011,new RegExp(marker));
assert.doesNotMatch(migration011,/drop\s+table|truncate\s+|delete\s+from/i);

const { normalizeStockMapping, quantityForDisplay, quantityForStorage } = await import("../src/stocks/holding.js");
const idxHolding = {ticker:"BMRI",market:"IDX",provider:"finnhub",providerSymbol:"BMRI",currency:"IDR",quantity:10000};
assert.equal(quantityForDisplay(idxHolding), 100);
assert.equal(quantityForStorage("IDX", 100), 10000);
assert.equal(normalizeStockMapping(idxHolding), true);
assert.equal(idxHolding.provider, "yahoo");
assert.equal(quantityForStorage("NASDAQ", 2.8033875), 2.8033875);

process.env.FINNHUB_API_KEY = "test";
process.env.STOCK_SYMBOL_ALLOWLIST = "WDC,BMRI:IDX";
const realFetch = globalThis.fetch;
const { fetchQuote, fetchUsdIdrQuote, validateMapping } = await import("../api/_lib/providers.js");
validateMapping({provider:"finnhub",provider_symbol:"WDC",market:"NASDAQ"});
validateMapping({provider:"yahoo",provider_symbol:"BMRI",market:"IDX"});
globalThis.fetch = async () => new Response(JSON.stringify({c:123.45,t:Math.floor(Date.now()/1000)}), {status:200,headers:{"content-type":"application/json"}});
const quote = await fetchQuote({provider:"finnhub",provider_symbol:"WDC",market:"NASDAQ"});
assert.equal(quote.price, 123.45);
assert.equal(quote.provider, "finnhub");
globalThis.fetch = async url => {
  assert.match(String(url), /\/BMRI\.JK\?/);
  return new Response(JSON.stringify({chart:{result:[{meta:{regularMarketPrice:4220,regularMarketTime:Math.floor(Date.now()/1000)},timestamp:[Math.floor(Date.now()/1000)],indicators:{quote:[{close:[4220]}]}}],error:null}}), {status:200,headers:{"content-type":"application/json"}});
};
const idxQuote = await fetchQuote({provider:"yahoo",provider_symbol:"BMRI",market:"IDX"});
assert.equal(idxQuote.price, 4220);
assert.equal(idxQuote.provider, "yahoo");
assert.equal(idxQuote.status, "delayed");
globalThis.fetch = async url => {
  assert.match(String(url), /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/IDR%3DX/);
  return new Response(JSON.stringify({chart:{result:[{meta:{regularMarketPrice:17810.25,regularMarketTime:1786134000},timestamp:[1786134000],indicators:{quote:[{close:[17810.25]}]}}],error:null}}), {status:200,headers:{"content-type":"application/json"}});
};
const fxQuote = await fetchUsdIdrQuote();
assert.equal(fxQuote.rate, 17810.25);
assert.equal(fxQuote.provider, "yahoo");
let fxHostCalls=0;
globalThis.fetch = async url => {
  fxHostCalls+=1;
  if(String(url).includes("query1.finance.yahoo.com"))return new Response(JSON.stringify({chart:{result:[{meta:{regularMarketPrice:34468}}],error:null}}), {status:200,headers:{"content-type":"application/json"}});
  assert.match(String(url), /query2\.finance\.yahoo\.com\/v8\/finance\/chart\/IDR%3DX/);
  return new Response(JSON.stringify({chart:{result:[{meta:{regularMarketPrice:17811,regularMarketTime:1786134060},timestamp:[1786134060],indicators:{quote:[{close:[17811]}]}}],error:null}}), {status:200,headers:{"content-type":"application/json"}});
};
const fallbackFxQuote = await fetchUsdIdrQuote();
assert.equal(fxHostCalls,2,"An absurd query1 quote must be rejected before query2 is used");
assert.equal(fallbackFxQuote.rate,17811);
globalThis.fetch = async () => new Response(JSON.stringify({chart:{result:[{meta:{regularMarketPrice:4000}}],error:null}}), {status:200,headers:{"content-type":"application/json"}});
await assert.rejects(fetchUsdIdrQuote(), /Yahoo Finance USD\/IDR unavailable/);
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

const appSource = read("app.js");
assert.doesNotMatch(appSource, /<input[^>]*type=\"number\"[^>]*data-target=/, "Target-price editors must not use native number steppers");
assert.match(appSource, /class=\"target-price-input\" type=\"text\" inputmode=\"decimal\"/, "Target-price inputs must preserve editable text drafts");
assert.match(appSource, /backdropPress/, "Dialog dismissal must distinguish backdrop clicks from drag-selection gestures");
assert.match(appSource, /fetchUsdIdrRate/, "USD\/IDR live refresh must be wired into the app");
assert.match(appSource, /Number\(s\.quantity\)\*stockPrice[\s\S]*s\.currency===\"USD\"\?v\*state\.usdIdr:v/, "US holdings must convert shares times USD price using USD\/IDR");

assert.match(appSource, /COMPANY_EXPENSE_TAG="Expense Perusahaan"/, "Expense Perusahaan must remain a fixed History-only tag");
assert.match(appSource, /transactions:\[\]/, "Projection calls must explicitly exclude History transactions");
assert.match(appSource, /CHANNEL_PRESETS=\["Offline","Shopee","GrabFood"/, "History editor must expose reusable channel tags");
assert.match(appSource, /DEFAULT_USD_IDR=17810/, "A safe default must repair previously corrupted FX values");
assert.match(appSource, /fixedYearlyIncomeTotal\.textContent=fmt\(fixedIncome\(\)\*12\)/, "Fixed Yearly must equal Fixed Monthly times twelve");
assert.match(appSource, /meta\?\.provider==="yahoo"\?"YAHOO FINANCE"/, "The FX badge must identify Yahoo Finance honestly");
assert.match(appSource, /due due-current/, "Yearly expenses due this month must receive the luminous current-month class");
assert.match(appSource, /data-tx-tag-kind/, "Transaction category and channel chips must act as tag filters");
assert.match(appSource, /currentMonthTransactions/, "History summaries must be scoped to the active month");
assert.match(appSource, /groupExpenses\("category"\).*groupExpenses\("channel"\)/s, "Current expenses must be grouped independently by category and channel");
assert.match(appSource, /tx-current-month/, "The active History month must be visually separate from archives");
assert.match(appSource, /tx-history-archive/, "Previous History months must remain available in Archive");

const app = read("app.js");
assert.match(app, /portfolioPL\.textContent=`\$\{fmt\(pl\)\} · \$\{percent\(pl,inv\)\}`/);
assert.match(app, /const decisionMetrics=/);
assert.match(app, /statusText=paid\?"PAID":fmt\(outstanding\)/, "Paid clients must show PAID while unpaid clients show only the nominal value");
assert.doesNotMatch(app, /0 outstanding|outstanding left/, "Client headline copy must not include outstanding wording");
assert.match(app, /function latestTransactionTemplate\(\)/, "Add Transaction must recover the latest saved entry as its next template");
assert.match(app, /txDescription\.value=template\?\.description[\s\S]*txAmount\.value=template\?\.amount/, "Description and Amount must both remain populated from the latest entry");
assert.match(app, /__createdAt:previous\?\.__createdAt\|\|new Date\(\)\.toISOString\(\)/, "New entries must retain insertion order for persistent templates");
assert.match(app, /class="target-years-grid"/, "Target Price groups must use a compact two-up year grid");
assert.match(app, /class="target-year-card"/, "Each future year and target must remain one stable edit card");
assert.match(app, /<details class="year-card prospect-year-card">/, "Future Cash + Assets details must be collapsed until clicked");
assert.match(app, /Financial Action Plan/);

console.log("CVFinance checks passed: schema, RLS markers, PWA, 8 tabs, v7.7.9 PAID-or-nominal client cards, Description-before-Amount transaction form, persistent latest-entry templates, larger category/channel donuts, monthly History reset without deletion, permanent monthly archives, two-up Target Price cards, collapsed Prospect year details, Financial Action Plan isolation, P/L percentages, annual and monthly operating dashboard isolation, Yahoo FX validation, ledger-only History, dynamic Budget meters, toggleable Transaction tags, safe dialog dismissal, auditable projections, one-time dated credit, optional stock cash assets, sorting invariants, stock provider abstraction, offline queue coalescing, and JavaScript syntax.");
