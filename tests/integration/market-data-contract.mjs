import assert from "node:assert/strict";

process.env.SUPABASE_URL = "";
process.env.SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

const service = await import("../../supabase/functions/market-data/index.js");
const { quoteEquity, quoteCrypto, quoteFx, normalizeEquityMapping, parseCryptoInput, handleRequest, resetMarketDataTestState } = service;

const yahooBody = (symbol, price, stamp = Math.floor(Date.now() / 1000)) => ({
  chart: {
    result: [{
      meta: { regularMarketPrice: price, regularMarketTime: stamp },
      timestamp: [stamp],
      indicators: { quote: [{ close: [price] }] }
    }],
    error: null
  }
});
const indodaxBody = (price, stamp = Math.floor(Date.now() / 1000)) => ({ ticker: { last: String(price), server_time: stamp } });
const binanceBody = (price, stamp = Date.now()) => ({ lastPrice: String(price), closeTime: stamp, priceChangePercent: "1.2", highPrice: String(price + 10), lowPrice: String(price - 10), volume: "100" });

let calls = [];
let responder = async url => { throw new Error(`Unexpected provider call: ${url}`); };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push(target);
  return responder(target, options);
};
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setProvider(fn) { calls = []; responder = fn; }
function assertNoZeroPrice(quote) { assert.notEqual(quote?.price, 0); assert.notEqual(quote?.rate, 0); }

// Mapping is canonical user data; provider-specific IDX formatting is derived.
assert.deepEqual(normalizeEquityMapping({ displaySymbol: " bmri ", market: "idx", providerSymbol: "bmri", currency: "IDR" }), {
  displaySymbol: "BMRI", market: "IDX", providerSymbol: "BMRI.JK", currency: "IDR", normalizedSymbol: "BMRI.JK", assetType: "equity"
});
assert.deepEqual(normalizeEquityMapping({ displaySymbol: "MU", market: "NASDAQ", providerSymbol: "MU", currency: "USD" }).providerSymbol, "MU");
assert.deepEqual(parseCryptoInput("BTCIDR", "USD"), { base: "BTC", requestedQuote: "IDR" });
assert.deepEqual(parseCryptoInput("ETH/IDR", "USD"), { base: "ETH", requestedQuote: "IDR" });

// IDX uses Yahoo's provider symbol and returns an explicit delayed state.
setProvider(async url => jsonResponse(yahooBody("BMRI.JK", 4420)));
const idx = await quoteEquity({ displaySymbol: "BMRI", providerSymbol: "BMRI", market: "IDX", currency: "IDR" }, { ignoreCache: true });
assert.equal(idx.ok, true);
assert.equal(idx.provider, "yahoo");
assert.equal(idx.normalizedSymbol, "BMRI.JK");
assert.equal(idx.status, "DELAYED");
assert.equal(idx.currency, "IDR");
assert.equal(idx.price, 4420);

// US equity works without Finnhub/Twelve Data configuration.
setProvider(async url => jsonResponse(yahooBody("MU", 1016.59)));
const us = await quoteEquity({ displaySymbol: "MU", providerSymbol: "MU", market: "NASDAQ", currency: "USD" }, { ignoreCache: true });
assert.equal(us.ok, true);
assert.equal(us.provider, "yahoo");
assert.equal(us.status, "DELAYED");
assert.equal(us.price, 1016.59);
assert.notEqual(us.errorClass, "provider_not_configured");

// Direct IDR pair takes precedence and never calls Binance/FX.
setProvider(async url => {
  assert.match(url, /indodax\.com\/api\/ticker\/btcidr$/);
  return jsonResponse(indodaxBody(1403468000));
});
const btcIdr = await quoteCrypto({ symbol: "BTC", quote: "IDR" }, { ignoreCache: true });
assert.equal(btcIdr.ok, true);
assert.equal(btcIdr.provider, "indodax");
assert.equal(btcIdr.providerSymbol, "BTCIDR");
assert.equal(btcIdr.quoteMode, "direct-idr");
assert.equal(btcIdr.sourceQuote, "IDR");
assert.equal(btcIdr.status, "LIVE");
assert.equal(btcIdr.price, 1403468000);
assert.equal(calls.length, 1);

setProvider(async url => {
  assert.match(url, /indodax\.com\/api\/ticker\/ethidr$/);
  return jsonResponse(indodaxBody(43251000));
});
const ethIdr = await quoteCrypto({ symbol: "ETH", quote: "IDR" }, { ignoreCache: true });
assert.equal(ethIdr.provider, "indodax");
assert.equal(ethIdr.quoteMode, "direct-idr");
assert.equal(ethIdr.price, 43251000);

// A pair without direct IDR falls back deterministically through Binance + FX.
setProvider(async url => {
  if (url.includes("indodax.com/api/ticker/fooidr")) return jsonResponse({ code: "not_found" }, 404);
  if (url.includes("binance.vision/api/v3/ticker/24hr?symbol=FOOUSDT")) return jsonResponse(binanceBody(2));
  if (url.includes("query1.finance.yahoo.com") && url.includes("IDR%3DX")) return jsonResponse(yahooBody("IDR=X", 17650));
  throw new Error(`Unexpected fallback call: ${url}`);
});
const cryptoFallback = await quoteCrypto({ symbol: "FOO", quote: "IDR" }, { ignoreCache: true });
assert.equal(cryptoFallback.ok, true);
assert.equal(cryptoFallback.provider, "binance");
assert.equal(cryptoFallback.quoteMode, "fx-fallback");
assert.equal(cryptoFallback.status, "FALLBACK");
assert.equal(cryptoFallback.price, 35300);
assert.equal(cryptoFallback.fx.rate, 17650);
assertNoZeroPrice(cryptoFallback);

// FX is provider data, never a UI constant.
setProvider(async url => {
  assert.match(url, /query1\.finance\.yahoo\.com/);
  return jsonResponse(yahooBody("IDR=X", 17656.5));
});
const fx = await quoteFx({ ignoreCache: true });
assert.equal(fx.pair, "USD/IDR");
assert.equal(fx.provider, "yahoo");
assert.equal(fx.status, "DELAYED");
assert.equal(fx.rate, 17656.5);

// Cache hit avoids another upstream request and preserves the quote contract.
setProvider(async url => jsonResponse(yahooBody("CACHE", 123)));
const cacheFirst = await quoteEquity({ displaySymbol: "CACHE", providerSymbol: "CACHE", market: "NASDAQ", currency: "USD" }, { ignoreCache: true });
assert.equal(cacheFirst.cache, "miss");
const firstCallCount = calls.length;
responder = async () => { throw new Error("cache should prevent upstream call"); };
const cacheHit = await quoteEquity({ displaySymbol: "CACHE", providerSymbol: "CACHE", market: "NASDAQ", currency: "USD" });
assert.equal(cacheHit.cache, "hit");
assert.equal(cacheHit.price, 123);
assert.equal(calls.length, firstCallCount);

// Provider outage returns stale last-known data, not zero or a fake live value.
setProvider(async () => { throw new Error("simulated outage"); });
const stale = await quoteEquity({ displaySymbol: "CACHE", providerSymbol: "CACHE", market: "NASDAQ", currency: "USD" }, { ignoreCache: true });
assert.equal(stale.status, "STALE");
assert.equal(stale.state, "STALE");
assert.equal(stale.price, 123);
assertNoZeroPrice(stale);

// Invalid mapping, malformed payload, HTTP error, and rate limit become bounded errors.
await assert.rejects(() => quoteEquity({ displaySymbol: "BAD!", providerSymbol: "BAD!", market: "NASDAQ", currency: "USD" }), error => error.code === "invalid_symbol");
setProvider(async () => new Response("not-json", { status: 200 }));
await assert.rejects(() => quoteEquity({ displaySymbol: "MALFORMED", providerSymbol: "MALFORMED", market: "NASDAQ", currency: "USD" }, { ignoreCache: true }), error => error.code === "provider_payload_invalid");
setProvider(async () => jsonResponse({ error: "upstream" }, 500));
resetMarketDataTestState();
await assert.rejects(() => quoteFx({ ignoreCache: true }), error => ["fx_provider_unavailable", "provider_http_error"].includes(error.code));
setProvider(async () => jsonResponse({ message: "too many" }, 429));
await assert.rejects(() => quoteEquity({ displaySymbol: "LIMIT", providerSymbol: "LIMIT", market: "NASDAQ", currency: "USD" }, { ignoreCache: true }), error => ["provider_rate_limited", "provider_unavailable"].includes(error.code));

// No cache + total outage must fail closed and never manufacture a zero price.
setProvider(async () => { throw new Error("total outage"); });
await assert.rejects(() => quoteEquity({ displaySymbol: "OUTAGE", providerSymbol: "OUTAGE", market: "NASDAQ", currency: "USD" }, { ignoreCache: true }), error => error.code === "provider_network_error");

// Public health endpoint is non-throwing and exposes no provider secret.
setProvider(async url => {
  if (url.includes("BMRI.JK")) return jsonResponse(yahooBody("BMRI.JK", 4420));
  if (url.includes("/MU")) return jsonResponse(yahooBody("MU", 1016));
  if (url.includes("btcidr")) return jsonResponse(indodaxBody(1400000000));
  if (url.includes("dogeidr")) return jsonResponse({ code: "not_found" }, 404);
  if (url.includes("DOGEUSDT")) return jsonResponse(binanceBody(0.2));
  if (url.includes("IDR%3DX")) return jsonResponse(yahooBody("IDR=X", 17650));
  if (url.includes("open.er-api.com")) return jsonResponse({ rates: { IDR: 17650 }, time_last_update_unix: Math.floor(Date.now() / 1000) });
  throw new Error(`Unexpected health call: ${url}`);
});
const healthResponse = await handleRequest(new Request("https://edge.test/market-data?action=health", { method: "GET" }));
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(typeof health.overall, "string");
assert.ok(Array.isArray(health.checks));
assert.equal(JSON.stringify(health).includes("API_KEY"), false);

// Restore process-global fetch for the runner.
globalThis.fetch = originalFetch;
console.log(JSON.stringify({ status: "PASS", checks: ["mapping", "idx", "us", "direct-idr", "crypto-fallback", "fx", "cache", "stale", "negative", "health"] }));
