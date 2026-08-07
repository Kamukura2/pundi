import { fetchJson } from "./http.js";

const symbolPattern = /^[A-Z0-9.:-]{1,24}$/i;

function assertMapping(mapping) {
  if (!mapping || !["finnhub","yahoo"].includes(mapping.provider)) throw Object.assign(new Error("Unsupported stock provider."), { code:"unsupported_provider", status:400 });
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

function yahooSymbol(mapping) {
  const symbol = String(mapping.provider_symbol || "").trim().toUpperCase();
  return symbol.endsWith(".JK") ? symbol : `${symbol}.JK`;
}

async function yahoo(mapping) {
  const symbol = yahooSymbol(mapping);
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  const failures = [];
  for (const host of hosts) {
    try {
      const url = new URL(`/v8/finance/chart/${encodeURIComponent(symbol)}`, host);
      url.searchParams.set("interval", "1d");
      url.searchParams.set("range", "5d");
      url.searchParams.set("includePrePost", "false");
      url.searchParams.set("events", "div,splits");
      const data = await fetchJson(url, {
        headers:{
          Accept:"application/json,text/plain,*/*",
          "User-Agent":"Mozilla/5.0 (compatible; CVFinance/7.0; personal-use quote lookup)"
        }
      });
      const chart = data?.chart;
      if (chart?.error) throw new Error(chart.error.description || "Yahoo Finance returned an error.");
      const result = chart?.result?.[0];
      if (!result) throw new Error(`No delayed market data returned for ${symbol}.`);
      const meta = result.meta || {};
      const closes = result.indicators?.quote?.[0]?.close || [];
      const timestamps = result.timestamp || [];
      let price = Number(meta.regularMarketPrice);
      let timestamp = Number(meta.regularMarketTime || 0);
      if (!Number.isFinite(price) || price <= 0) {
        for (let index = closes.length - 1; index >= 0; index -= 1) {
          const candidate = Number(closes[index]);
          if (Number.isFinite(candidate) && candidate > 0) {
            price = candidate;
            timestamp = Number(timestamps[index] || timestamp);
            break;
          }
        }
      }
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Yahoo Finance returned no price for ${symbol}.`);
      return {
        price,
        asOf:timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        status:"delayed",
        provider:"yahoo"
      };
    } catch (error) {
      failures.push(`${new URL(host).hostname}: ${error.message}`);
    }
  }
  throw Object.assign(new Error(`Yahoo Finance delayed quote unavailable for ${symbol}. ${failures.join(" | ")}`), { code:"provider_error", status:502 });
}

export async function fetchQuote(mapping) {
  assertMapping(mapping);
  if (mapping.provider === "finnhub") return finnhub(mapping);
  return yahoo(mapping);
}

async function yahooUsdIdr() {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  const failures = [];
  for (const host of hosts) {
    try {
      const url = new URL(`/v8/finance/chart/${encodeURIComponent("IDR=X")}`, host);
      url.searchParams.set("interval", "1m");
      url.searchParams.set("range", "1d");
      url.searchParams.set("includePrePost", "true");
      const data = await fetchJson(url, {
        headers:{
          Accept:"application/json,text/plain,*/*",
          "User-Agent":"Mozilla/5.0 (compatible; CVFinance/7.7.4; personal-use FX lookup)"
        }
      });
      const chart = data?.chart;
      if (chart?.error) throw new Error(chart.error.description || "Yahoo Finance returned an error.");
      const result = chart?.result?.[0];
      if (!result) throw new Error("Yahoo Finance returned no USD/IDR data.");
      const meta = result.meta || {};
      const closes = result.indicators?.quote?.[0]?.close || [];
      const timestamps = result.timestamp || [];
      let rate = Number(meta.regularMarketPrice);
      let timestamp = Number(meta.regularMarketTime || 0);
      if (!Number.isFinite(rate) || rate <= 0) {
        for (let index = closes.length - 1; index >= 0; index -= 1) {
          const candidate = Number(closes[index]);
          if (Number.isFinite(candidate) && candidate > 0) {
            rate = candidate;
            timestamp = Number(timestamps[index] || timestamp);
            break;
          }
        }
      }
      if (!Number.isFinite(rate) || rate < 10000 || rate > 25000) throw new Error(`Rejected implausible USD/IDR quote: ${rate || "missing"}.`);
      return {
        rate,
        asOf:timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        status:"market quote",
        provider:"yahoo"
      };
    } catch (error) {
      failures.push(`${new URL(host).hostname}: ${error.message}`);
    }
  }
  throw Object.assign(new Error(`Yahoo Finance USD/IDR unavailable. ${failures.join(" | ")}`), { code:"yahoo_fx_unavailable", status:502 });
}

export async function fetchUsdIdrQuote() {
  return yahooUsdIdr();
}

export function validateMapping(mapping) {
  assertMapping(mapping);
  if (mapping.market === "IDX" && mapping.provider !== "yahoo") throw Object.assign(new Error("IDX holdings must use Yahoo Finance delayed quotes in this release."), { code:"invalid_mapping", status:400 });
  if (mapping.market !== "IDX" && mapping.provider !== "finnhub") throw Object.assign(new Error("US holdings must use Finnhub in this release."), { code:"invalid_mapping", status:400 });
  return true;
}
