import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { quantityForDisplay, quantityForStorage, quantityUnit } from "../../src/stocks/holding.js";
import { tradingPositionCost, tradingPositionValue } from "../../src/trading/model.js";

const app = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../styles.css", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/012_trading_portfolio.sql", import.meta.url), "utf8");
const idxMigration = await readFile(new URL("../../supabase/migrations/025_trading_idx_market.sql", import.meta.url), "utf8");

// Existing canonical quantities remain stored as shares; only the IDX display is lots.
const legacyIdx = { market:"IDX", quantity:10000, currency:"IDR", avg:4200, current:6200 };
assert.equal(quantityForDisplay(legacyIdx), 100, "legacy IDX shares must display as lots");
assert.equal(quantityUnit("IDX"), "lot", "IDX quantity unit must be lot");
assert.equal(quantityForStorage("IDX", 100), 10000, "IDX lots must persist as shares");
assert.equal(quantityForStorage("NASDAQ", 2.8033875), 2.8033875, "US fractional shares must persist unchanged");
assert.equal(quantityUnit("NASDAQ"), "shares", "US quantity unit must be shares");
assert.equal(quantityUnit("CRYPTO"), "units", "existing crypto Trading behavior must remain units");

// The established accounting formula remains quantity × price using stored shares.
assert.equal(tradingPositionValue(legacyIdx, 16000), 62000000, "Value must continue using stored share quantity");
assert.equal(tradingPositionCost(legacyIdx, 16000), 42000000, "cost basis must continue using stored share quantity");

assert.match(app, /Qty \(Lot \/ Shares\)/, "Trading forms must expose the requested quantity label");
assert.match(app, /quantityForStorage\(values\.market,Number\(values\.quantity\)\)/, "new Trading quantities must use market-aware storage semantics");
assert.match(app, /quantityForStorage\(position\.market,Number\(values\.quantity\)\)/, "BUY\/SELL quantity input must use market-aware storage semantics");
assert.match(app, /data-trading-edit/, "Trading cards must expose a safe quantity edit action");
assert.match(app, /Number\.isInteger\(Number\(values\.quantity\)\)/, "IDX lot input must reject fractional lots");
assert.match(app, /Use BUY MORE or SELL to change its quantity/, "edited positions with trade history must preserve the ledger");
assert.match(css, /\.trading-position-meta\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/, "mobile Trading quantity metrics must use a clean two-column layout");
assert.match(migration, /quantity numeric\(28,10\) not null default 0 check \(quantity >= 0\)/, "Trading quantity schema must remain additive and non-destructive");
assert.match(idxMigration, /check \(market in \('IDX','NASDAQ','NYSE','AMEX','CRYPTO'\)\)/, "Trading schema must permit the existing IDX market option");
assert.match(idxMigration, /drop constraint if exists trading_positions_market_check/, "IDX schema change must be idempotent");

console.log("Trading quantity contract PASS: legacy rows, IDX lots, US shares, value/P&L formula, add/edit/execution labels, validation, responsive card, and schema safety");
