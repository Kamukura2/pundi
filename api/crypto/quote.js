import { binanceSpotSymbol, normalizeCryptoSymbol, normalizeQuoteCurrency, parseCryptoPairInput } from "../../src/crypto/binance.js";
import { apiError, fetchJson, method } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

const UPSTREAM = "https://data-api.binance.vision/api/v3";
const SOURCE_QUOTES = ["USDT", "USDC", "FDUSD", "USD"];
const MIN_USD_IDR = 10000;
const MAX_USD_IDR = 25000;

function clientError(message, code, status = 422) {
  return Object.assign(new Error(message), { code, status });
}

function requestKey(request) {
  return String(request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"] || "crypto-public").split(",")[0].trim();
}

function validFx(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= MIN_USD_IDR && rate <= MAX_USD_IDR;
}

function spotAllowed(symbol) {
  return symbol?.isSpotTradingAllowed !== false
    && (!Array.isArray(symbol?.permissions) || symbol.permissions.length === 0 || symbol.permissions.includes("SPOT") || symbol.permissionSets?.some(set => Array.isArray(set) && set.includes("SPOT")));
}

async function findMarket(base, quote) {
  const providerSymbol = binanceSpotSymbol(base, quote);
  try {
    const body = await fetchJson(`${UPSTREAM}/exchangeInfo?symbol=${encodeURIComponent(providerSymbol)}`);
    const symbol = body?.symbols?.find(row => row.symbol === providerSymbol);
    if (!symbol || symbol.status !== "TRADING" || symbol.baseAsset !== base || symbol.quoteAsset !== quote || !spotAllowed(symbol)) return null;
    return { providerSymbol, sourceQuote:quote, quoteMode:quote };
  } catch (error) {
    if ([400,404,422].includes(Number(error.status))) return null;
    throw clientError("Crypto market data is temporarily unavailable.", "crypto_provider_unreachable", 503);
  }
}

async function resolveMarket(base, requestedQuote) {
  const order = requestedQuote === "USDT"
    ? ["USDT", "USDC", "FDUSD", "USD"]
    : requestedQuote === "USD"
      ? ["USD", ...SOURCE_QUOTES]
      : ["IDR", "USD", ...SOURCE_QUOTES];
  const seen = new Set();
  for (const sourceQuote of order) {
    if (seen.has(sourceQuote)) continue;
    seen.add(sourceQuote);
    const route = await findMarket(base, sourceQuote);
    if (route) return { ...route, quoteMode:sourceQuote === requestedQuote ? "native" : "normalized" };
  }
  throw clientError("No supported market-price route for this Crypto asset.", "crypto_price_route_unavailable");
}

function toUsd(sourcePrice, sourceQuote, usdIdr) {
  if (sourceQuote === "IDR") return Number(sourcePrice) / Number(usdIdr);
  if (["USD", "USDT", "USDC", "FDUSD"].includes(sourceQuote)) return Number(sourcePrice);
  return null;
}

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    enforceRateLimit(`crypto:${requestKey(request)}`, 60);
    let parsed;
    try { parsed = parseCryptoPairInput(request.query?.symbol, request.query?.quote || "USD"); }
    catch { throw clientError("Crypto symbol not found.", "crypto_symbol_invalid"); }
    const requestedQuote = normalizeQuoteCurrency(request.query?.quote || parsed.requestedQuote || "USD");
    const base = parsed.baseSymbol;
    const route = await resolveMarket(base, requestedQuote);
    let ticker;
    try { ticker = await fetchJson(`${UPSTREAM}/ticker/24hr?symbol=${encodeURIComponent(route.providerSymbol)}`); }
    catch { throw clientError("Crypto market data is temporarily unavailable.", "crypto_price_unavailable", 503); }
    const sourcePrice = Number(ticker?.lastPrice);
    if (!Number.isFinite(sourcePrice) || sourcePrice <= 0) throw clientError("Crypto market data is temporarily unavailable.", "crypto_price_invalid", 503);
    let price;
    if (requestedQuote === route.sourceQuote) price = sourcePrice;
    else {
      const usdIdr = Number(request.query?.usdIdr);
      if ((requestedQuote === "IDR" || route.sourceQuote === "IDR") && !validFx(usdIdr)) throw clientError("USD/IDR rate is temporarily unavailable.", "crypto_fx_unavailable", 503);
      const usd = toUsd(sourcePrice, route.sourceQuote, usdIdr);
      if (!Number.isFinite(usd) || usd <= 0) throw clientError("No supported market-price route for this Crypto asset.", "crypto_price_route_unavailable");
      price = requestedQuote === "IDR" ? usd * usdIdr : usd;
    }
    response.setHeader("Cache-Control", "public, max-age=3, stale-while-revalidate=7");
    return response.status(200).json({
      ok:true,
      baseSymbol:base,
      requestedQuote,
      displayPair:`${base}/${requestedQuote}`,
      provider:"binance",
      providerSymbol:route.providerSymbol,
      sourceQuote:route.sourceQuote,
      quoteMode:route.quoteMode,
      sourcePrice,
      price,
      changePercent24h:Number(ticker.priceChangePercent),
      high:Number(ticker.highPrice),
      low:Number(ticker.lowPrice),
      volume:Number(ticker.volume),
      asOf:new Date(Number(ticker.closeTime || Date.now())).toISOString()
    });
  } catch (error) {
    return apiError(response, error);
  }
}
