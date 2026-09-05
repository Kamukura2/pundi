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
export const MAX_MARKET_DATA_BATCH = 50;

async function invokeBatchChunks(items, makeBody, invoke) {
  const responses = [];
  for (let index = 0; index < items.length; index += MAX_MARKET_DATA_BATCH) {
    responses.push(await invoke(makeBody(items.slice(index, index + MAX_MARKET_DATA_BATCH))));
  }
  return responses;
}

export async function fetchHoldingQuotes(holdingIds = [], { invoke = invokeMarketData } = {}) {
  const ids = [...new Set((holdingIds || []).map(value => String(value || "").trim()).filter(Boolean))];
  if (!ids.length) return { ok: true, type: "batchQuotes", quotes: [] };
  const responses = await invokeBatchChunks(ids, chunk => ({ action: "batchQuotes", holdingIds: chunk }), invoke);
  return { ok: true, type: "batchQuotes", quotes: responses.flatMap(response => Array.isArray(response?.quotes) ? response.quotes : []) };
}
export const validateHoldingSymbol = holdingId => invokeMarketData({ action: "validateHolding", holdingId });
export const fetchUsdIdrRate = ({ force = false } = {}) => invokeMarketData({ action: "fx", refresh: force ? "1" : "0" });
export const fetchTradingQuote = (symbol, { force = false, market = "NASDAQ", currency = "USD" } = {}) => invokeMarketData({ action: "tradingQuote", symbol, market, currency, refresh: force ? "1" : "0" });
export const fetchTradingBenchmark = () => invokeMarketData({ action: "benchmarkHistory", symbol: "SPY" });
export const fetchCryptoQuote = (symbol, quote = "USD", { force = false } = {}) => invokeMarketData({ action: "cryptoQuote", symbol, quote, refresh: force ? "1" : "0" });

export async function fetchCryptoQuotes(items = [], { invoke = invokeMarketData } = {}) {
  const unique = [];
  const seen = new Set();
  for (const item of items || []) {
    const normalized = { ...item, id: String(item?.id || item?.symbol || "").trim(), symbol: String(item?.symbol || item?.ticker || "").trim().toUpperCase(), quote: String(item?.quote || "USD").trim().toUpperCase() };
    const key = `${normalized.id}:${normalized.symbol}:${normalized.quote}`;
    if (!normalized.id || !normalized.symbol || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  if (!unique.length) return { ok: true, type: "batchCryptoQuotes", quotes: [] };
  const responses = await invokeBatchChunks(unique, chunk => ({ action: "batchCryptoQuotes", items: chunk }), invoke);
  return { ok: true, type: "batchCryptoQuotes", quotes: responses.flatMap(response => Array.isArray(response?.quotes) ? response.quotes : []) };
}

export function isPriceStale(stock) {
  if (!stock.priceAsOf) return true;
  return Date.now() - new Date(stock.priceAsOf).getTime() > 36 * 60 * 60 * 1000;
}
