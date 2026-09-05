import { getSupabase } from "../lib/supabase.js";

function marketError(error, body = {}) {
  return Object.assign(new Error(body.error || "Market data is temporarily unavailable."), {
    code: body.code || error?.code || "market_data_unavailable",
    state: body.state || "OFFLINE",
    errorClass: body.errorClass || body.code || "market_data_unavailable",
    retryable: body.retryable !== false
  });
}

export async function invokeMarketData(body) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw Object.assign(new Error("Authentication required."), { code: "unauthorized", state: "OFFLINE", retryable: false });
  const result = await supabase.functions.invoke("market-data", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (result.error) {
    let details = {};
    try { details = await result.error.context?.json?.() || {}; } catch {}
    throw marketError(result.error, details);
  }
  if (!result.data?.ok) throw marketError(null, result.data || {});
  return result.data;
}

export const fetchHoldingQuote = holdingId => invokeMarketData({ action: "quote", holdingId });
export const fetchHoldingQuotes = holdingIds => invokeMarketData({ action: "batchQuotes", holdingIds });
export const validateHoldingSymbol = holdingId => invokeMarketData({ action: "validateHolding", holdingId });
export const fetchUsdIdrRate = ({ force = false } = {}) => invokeMarketData({ action: "fx", refresh: force ? "1" : "0" });
export const fetchTradingQuote = (symbol, { force = false, market = "NASDAQ", currency = "USD" } = {}) => invokeMarketData({ action: "tradingQuote", symbol, market, currency, refresh: force ? "1" : "0" });
export const fetchTradingBenchmark = () => invokeMarketData({ action: "benchmarkHistory", symbol: "SPY" });
export const fetchCryptoQuote = (symbol, quote = "USD", { force = false } = {}) => invokeMarketData({ action: "cryptoQuote", symbol, quote, refresh: force ? "1" : "0" });
export const fetchCryptoQuotes = items => invokeMarketData({ action: "batchCryptoQuotes", items });

export function isPriceStale(stock) {
  if (!stock.priceAsOf) return true;
  return Date.now() - new Date(stock.priceAsOf).getTime() > 36 * 60 * 60 * 1000;
}
