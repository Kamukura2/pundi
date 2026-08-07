import { fetchJson } from "./http.js";

const symbolPattern = /^[A-Z0-9.:-]{1,24}$/i;

function assertMapping(mapping) {
  if (!mapping || !["finnhub","twelvedata"].includes(mapping.provider)) throw Object.assign(new Error("Unsupported stock provider."), { code:"unsupported_provider", status:400 });
  if (!symbolPattern.test(mapping.provider_symbol || "")) throw Object.assign(new Error("Invalid provider symbol."), { code:"invalid_symbol", status:400 });
  const configured = new Set(String(process.env.STOCK_SYMBOL_ALLOWLIST || "").split(",").map(value => value.trim().toUpperCase()).filter(Boolean));
  const symbol = String(mapping.provider_symbol).toUpperCase();
  const scoped = `${symbol}:${String(mapping.market || "").toUpperCase()}`;
  if (configured.size && !configured.has(symbol) && !configured.has(scoped)) throw Object.assign(new Error("Symbol is not in the server allowlist."), { code:"symbol_not_allowed", status:403 });
}

function classify(timestamp, liveLabel = "real-time") {
  if (!timestamp) return "end-of-day";
  const ageMinutes = (Date.now() - Number(timestamp) * 1000) / 60000;
  return ageMinutes <= 20 ? liveLabel : "end-of-day";
}

async function finnhub(mapping) {
  if (!process.env.FINNHUB_API_KEY) throw Object.assign(new Error("Finnhub is not configured."), { code:"provider_not_configured", status:503 });
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", mapping.provider_symbol);
  const data = await fetchJson(url, { headers:{ "X-Finnhub-Token":process.env.FINNHUB_API_KEY } });
  if (!Number(data.c)) throw Object.assign(new Error("Finnhub returned no current price for this symbol."), { code:"symbol_unavailable", status:422 });
  return { price:Number(data.c), asOf:data.t ? new Date(Number(data.t) * 1000).toISOString() : new Date().toISOString(), status:classify(data.t, "real-time"), provider:"finnhub" };
}

async function twelveData(mapping) {
  if (!process.env.TWELVE_DATA_API_KEY) throw Object.assign(new Error("Twelve Data is not configured."), { code:"provider_not_configured", status:503 });
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", mapping.provider_symbol);
  if (mapping.market === "IDX") url.searchParams.set("exchange", "IDX");
  url.searchParams.set("apikey", process.env.TWELVE_DATA_API_KEY);
  const data = await fetchJson(url);
  if (data.status === "error" || data.code) {
    const planIssue = /plan|credits|access|not available|permission/i.test(data.message || "");
    throw Object.assign(new Error(planIssue ? "API unavailable for current plan" : (data.message || "Twelve Data symbol unavailable.")), { code:planIssue ? "provider_plan_unavailable" : "symbol_unavailable", status:422 });
  }
  const price = Number(data.close || data.price);
  if (!price) throw Object.assign(new Error("Twelve Data returned no price for this symbol."), { code:"symbol_unavailable", status:422 });
  const timestamp = Number(data.timestamp || data.last_quote_at || 0);
  const status = data.is_market_open ? classify(timestamp, "delayed") : "end-of-day";
  return { price, asOf:timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(), status, provider:"twelvedata" };
}

export async function fetchQuote(mapping) {
  assertMapping(mapping);
  return mapping.provider === "finnhub" ? finnhub(mapping) : twelveData(mapping);
}

export function validateMapping(mapping) {
  assertMapping(mapping);
  if (mapping.market === "IDX" && mapping.provider !== "twelvedata") throw Object.assign(new Error("IDX holdings must use the configured IDX provider."), { code:"invalid_mapping", status:400 });
  if (mapping.market !== "IDX" && mapping.provider !== "finnhub") throw Object.assign(new Error("US holdings must use Finnhub in this release."), { code:"invalid_mapping", status:400 });
  return true;
}
