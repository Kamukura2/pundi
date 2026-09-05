import { getSupabase } from "../lib/supabase.js";
import { apiUrl } from "../lib/runtime.js";
import { fetchHoldingQuotes as fetchMarketHoldingQuotes, invokeMarketData } from "../market-data/client.js";

async function request(path, holdingId) {
  const supabase = await getSupabase();
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required.");
  const response = await fetch(apiUrl(`${path}?holdingId=${encodeURIComponent(holdingId)}`), {
    headers:{ Authorization:`Bearer ${session.access_token}` }, cache:"no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Stock API request failed."), { code:body.code });
  return body;
}

async function authenticatedRequest(path) {
  const supabase = await getSupabase();
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required.");
  const response = await fetch(apiUrl(path), { headers:{ Authorization:`Bearer ${session.access_token}` }, cache:"no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Market data request failed."), { code:body.code });
  return body;
}

export const fetchHoldingQuote = holdingId => invokeMarketData({ action:"quote", holdingId });
export const fetchHoldingQuotes = (holdingIds, options) => fetchMarketHoldingQuotes(holdingIds, options);
export const fetchHoldingDividends = holdingId => request("/api/stocks/dividends", holdingId);
export const validateHoldingSymbol = holdingId => invokeMarketData({ action:"validateHolding", holdingId });
export const fetchUsdIdrRate = ({force=false}={}) => invokeMarketData({ action:"fx", refresh:force?"1":"0" });
export const fetchTradingQuote = (symbol,{force=false,market="NASDAQ",currency="USD"}={}) => invokeMarketData({ action:"tradingQuote", symbol, market, currency, refresh:force?"1":"0" });
export const fetchTradingBenchmark = () => invokeMarketData({ action:"benchmarkHistory", symbol:"SPY" });

export function isPriceStale(stock) {
  if (!stock.priceAsOf) return true;
  return Date.now() - new Date(stock.priceAsOf).getTime() > 36 * 60 * 60 * 1000;
}
