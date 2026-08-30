import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html=await readFile("app.html","utf8");
const app=await readFile("app.js","utf8");
for (const id of ["manageAccountsModal","simpleModal","addClientBtn","addTradingPositionBtn","addTickerBtn","addMonthlyBtn"]) assert.match(html,new RegExp(`id=\"${id}\"`),`${id} selector missing`);
for (const text of ["No recurring clients","No active Trading position","No budget categories","No expense this month","No equity Investment holdings"]) assert.match(app+html,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),`${text} empty state missing`);
assert.match(app,/onboardingAddAccount/); assert.match(app,/onboardingAddTransaction/); assert.match(app,/onboardingExploreAssets/);
assert.doesNotMatch(app,/seedData\(\).*renderOnboarding/);
console.log("Empty-state CTA contract PASS: accounts, transactions, clients, assets, trading, budgets, and no sample-data onboarding");
