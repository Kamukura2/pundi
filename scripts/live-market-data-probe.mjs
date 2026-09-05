import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { quoteCrypto, quoteEquity, quoteFx } from "../supabase/functions/market-data/index.js";

const checks = [
  ["IDX_BMRI", () => quoteEquity({ displaySymbol: "BMRI", providerSymbol: "BMRI", market: "IDX", currency: "IDR" }, { ignoreCache: true })],
  ["US_MU", () => quoteEquity({ displaySymbol: "MU", providerSymbol: "MU", market: "NASDAQ", currency: "USD" }, { ignoreCache: true })],
  ["BTC_IDR_DIRECT", () => quoteCrypto({ symbol: "BTC", quote: "IDR" }, { ignoreCache: true })],
  ["ETH_IDR_DIRECT", () => quoteCrypto({ symbol: "ETH", quote: "IDR" }, { ignoreCache: true })],
  ["QTUM_IDR_FX_FALLBACK", () => quoteCrypto({ symbol: "QTUM", quote: "IDR" }, { ignoreCache: true })],
  ["USD_IDR", () => quoteFx({ ignoreCache: true })]
];

function safeResult(name, quote) {
  const rateOrPrice = Number(quote.rate ?? quote.price);
  return {
    name,
    status: "PASS",
    quoteState: quote.state || quote.status,
    provider: quote.provider,
    normalizedSymbol: quote.normalizedSymbol,
    providerSymbol: quote.providerSymbol || null,
    sourceQuote: quote.sourceQuote || null,
    quoteMode: quote.quoteMode || null,
    currency: quote.currency,
    value: Number.isFinite(rateOrPrice) && rateOrPrice > 0 ? rateOrPrice : null,
    quoteTimestamp: quote.quoteTimestamp || quote.asOf || null,
    cache: quote.cache || "miss"
  };
}

const results = await Promise.all(checks.map(async ([name, fn]) => {
  const startedAt = Date.now();
  try { return { ...safeResult(name, await fn()), durationMs: Date.now() - startedAt }; }
  catch (error) { return { name, status: "FAIL", errorClass: error.code || "provider_error", message: error.message, durationMs: Date.now() - startedAt }; }
}));
const report = { generatedAt: new Date().toISOString(), service: "pundi-market-data-local-provider-probe", results, overall: results.every(result => result.status === "PASS") ? "PASS" : "DEGRADED" };
const output = resolve("runtime/market-data/live-provider-probe.json");
await mkdir(resolve("runtime/market-data"), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: report.overall, results: results.map(({ name, status, quoteState, provider, normalizedSymbol, providerSymbol, sourceQuote, quoteMode, currency, value, quoteTimestamp, errorClass }) => ({ name, status, quoteState, provider, normalizedSymbol, providerSymbol, sourceQuote, quoteMode, currency, value, quoteTimestamp, errorClass })), artifact: output }));
if (report.overall !== "PASS") process.exitCode = 2;
