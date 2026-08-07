import { fetchJson, fetchText } from "./http.js";

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

function validUsdIdr(value) {
  const raw = String(value ?? "").replace(/[\s\u00a0]/g, "").replace(/[^0-9.,-]/g, "");
  if (!raw) return null;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  let normalized = raw;
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    normalized = raw.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const [left, right = ""] = raw.split(separator);
    normalized = right.length === 3 && left.length <= 3 ? `${left}${right}` : `${left}.${right}`;
  }
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 10000 && rate <= 50000 ? rate : null;
}

async function googleFinanceUsdIdr() {
  const urls = [
    "https://www.google.com/finance/beta/quote/USD-IDR?hl=id&gl=ID",
    "https://www.google.com/finance/beta/quote/USD-IDR?hl=en&gl=US",
    "https://www.google.com/finance/quote/USD-IDR?hl=en&gl=US"
  ];
  const failures = [];
  for (const target of urls) {
    try {
      const html = await fetchText(new URL(target), {
        redirect:"follow",
        headers:{
          Accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":target.includes("hl=id")?"id-ID,id;q=0.9,en;q=0.8":"en-US,en;q=0.9",
          "Cache-Control":"no-cache",
          Pragma:"no-cache",
          Cookie:"CONSENT=YES+cb.20220419-08-p0.en+FX+410; SOCS=CAESHAgBEhIaAB",
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        }
      }, 9000);
      const candidates = [
        ...[...html.matchAll(/data-last-price=["']([^"']+)["']/gi)].map(match => match[1]),
        ...[...html.matchAll(/class=["'][^"']*(?:YMlKec|fxKbKc)[^"']*["'][^>]*>([\s\S]{0,160}?)<\/[^>]+>/gi)].map(match => match[1].replace(/<[^>]+>/g, "")),
        ...[...html.matchAll(/(?:USD\s*\/\s*IDR|USD\s*-\s*IDR)[\s\S]{0,600}?([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,4})?)/gi)].map(match => match[1])
      ];
      const rate = candidates.map(validUsdIdr).find(Boolean);
      if (!rate) throw new Error("price marker missing");
      const timestampMatch = html.match(/data-last-normal-market-timestamp=["'](\d+)["']/i);
      const timestamp = Number(timestampMatch?.[1] || 0);
      return {
        rate,
        asOf:timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        status:"live",
        provider:"google-finance"
      };
    } catch (error) {
      failures.push(`${new URL(target).pathname}: ${error.message}`);
    }
  }
  throw new Error(`Google Finance USD/IDR unavailable. ${failures.join(" | ")}`);
}

export async function fetchUsdIdrQuote() {
  try {
    return await googleFinanceUsdIdr();
  } catch (error) {
    throw Object.assign(new Error(error.message), { code:"google_fx_unavailable", status:502 });
  }
}

export function validateMapping(mapping) {
  assertMapping(mapping);
  if (mapping.market === "IDX" && mapping.provider !== "yahoo") throw Object.assign(new Error("IDX holdings must use Yahoo Finance delayed quotes in this release."), { code:"invalid_mapping", status:400 });
  if (mapping.market !== "IDX" && mapping.provider !== "finnhub") throw Object.assign(new Error("US holdings must use Finnhub in this release."), { code:"invalid_mapping", status:400 });
  return true;
}
