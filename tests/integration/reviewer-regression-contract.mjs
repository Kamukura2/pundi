import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");

// Persistence must keep the database's canonical crypto provider mapping even
// when the quote route used a direct-IDR provider.
const holding = await import("../../src/stocks/holding.js");
const crypto = await import("../../src/crypto/binance.js");
const unknownBinance = crypto.parseBinanceTicker({ lastPrice: "1" }, { source: "websocket" });
assert.equal(unknownBinance.asOf, null);
assert.equal(unknownBinance.status, "STALE");
assert.equal(holding.persistenceProvider({ assetType: "crypto", provider: "indodax" }), "binance");
assert.notEqual(holding.tradingQuoteKey({ market: "IDX", currency: "IDR", providerSymbol: "ABC" }), holding.tradingQuoteKey({ market: "NASDAQ", currency: "USD", providerSymbol: "ABC" }));
assert.equal(holding.tradingQuoteKey({ market: "NASDAQ", currency: "USD", providerSymbol: "MU" }), "NASDAQ:USD:MU");
const appSource = read("app.js");
assert.match(appSource, /symbolMappings=new Map\(equityPositions\.map\(position=>\[tradingQuoteKey\(position\)/);
assert.doesNotMatch(appSource, /quotes\.get\("SPY"\)/);
assert.match(appSource, /priceAsOf=quote\.asOf\|\|quote\.quoteTimestamp\|\|null/);
assert.match(appSource, /const degraded=quotes\.some\(quote=>quote\?\.ok===false/);

// The schema must retain the eight-decimal crypto price contract.
const precision = read("supabase/migrations/024_crypto_price_precision.sql");
for (const column of ["avg_purchase_price", "current_price", "manual_current_price", "target_price", "stop_loss_price", "execution_price"]) {
  assert.match(precision, new RegExp(`alter column ${column} type numeric\\(28,10\\)`, "i"));
}
assert.doesNotMatch(precision, /drop\s+table|truncate\s+|delete\s+from/i);

// Client batching must remain valid above the Edge Function's 50-item cap.
const client = await import("../../src/market-data/client.js");
const holdingCalls = [];
const holdingIds = Array.from({ length: 105 }, (_, index) => `holding-${index}`);
const holdingResult = await client.fetchHoldingQuotes(holdingIds, {
  invoke: async body => {
    holdingCalls.push(body);
    return { ok: true, type: "batchQuotes", quotes: body.holdingIds.map(holdingId => ({ holdingId, ok: true, price: 1 })) };
  }
});
assert.deepEqual(holdingCalls.map(call => call.holdingIds.length), [50, 50, 5]);
assert.equal(holdingResult.quotes.length, 105);

const cryptoCalls = [];
const cryptoItems = Array.from({ length: 105 }, (_, index) => ({ id: `crypto-${index}`, symbol: "BTC", quote: "USD" }));
const cryptoResult = await client.fetchCryptoQuotes(cryptoItems, {
  invoke: async body => {
    cryptoCalls.push(body);
    return { ok: true, type: "batchCryptoQuotes", quotes: body.items.map(item => ({ id: item.id, ok: true, price: 1 })) };
  }
});
assert.deepEqual(cryptoCalls.map(call => call.items.length), [50, 50, 5]);
assert.equal(cryptoResult.quotes.length, 105);

// A partial crypto failure must reach the row handler and schedule a retry.
const { CryptoMarketStream } = await import("../../src/crypto/binance.js");
const tickers = [];
const statuses = [];
const stream = new CryptoMarketStream({
  fetchQuotes: async () => ({ quotes: [
    { id: "ok", ok: true, price: 10, status: "LIVE" },
    { id: "bad", ok: false, state: "OFFLINE", code: "provider_timeout" }
  ] }),
  onTicker: (id, quote) => tickers.push([id, quote]),
  onStatus: status => statuses.push(status)
});
stream.setRequests([{ id: "ok", symbol: "BTC", quote: "USD" }, { id: "bad", symbol: "ETH", quote: "USD" }]);
for (let attempt = 0; attempt < 20 && !statuses.some(status => status.state === "stale"); attempt++) await new Promise(resolve => setTimeout(resolve, 5));
assert.deepEqual(tickers.map(([id]) => id).sort(), ["bad", "ok"]);
assert.equal(statuses.at(-1)?.state, "stale");
assert.ok(stream.retryTimer);
stream.stop();

console.log(JSON.stringify({ status: "PASS", checks: ["crypto-persistence-mapping", "precision-migration", "batch-chunking", "quote-key", "stream-partial-failure"] }));
