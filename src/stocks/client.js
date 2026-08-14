import { getSupabase } from "../lib/supabase.js";

async function request(path, holdingId) {
  const supabase = await getSupabase();
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required.");
  const response = await fetch(`${path}?holdingId=${encodeURIComponent(holdingId)}`, {
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
  const response = await fetch(path, { headers:{ Authorization:`Bearer ${session.access_token}` }, cache:"no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Market data request failed."), { code:body.code });
  return body;
}

export const fetchHoldingQuote = holdingId => request("/api/stocks/quote", holdingId);
export const fetchHoldingDividends = holdingId => request("/api/stocks/dividends", holdingId);
export const validateHoldingSymbol = holdingId => request("/api/stocks/validate", holdingId);
export const fetchUsdIdrRate = ({force=false}={}) => authenticatedRequest(`/api/stocks/fx${force?`?refresh=1&t=${Date.now()}`:""}`);
export const fetchTradingQuote = (symbol,{force=false}={}) => authenticatedRequest(`/api/trading/quote?symbol=${encodeURIComponent(symbol)}${force?`&refresh=1&t=${Date.now()}`:""}`);
export const fetchTradingBenchmark = () => authenticatedRequest("/api/trading/benchmark");

export function isPriceStale(stock) {
  if (!stock.priceAsOf) return true;
  return Date.now() - new Date(stock.priceAsOf).getTime() > 36 * 60 * 60 * 1000;
}
