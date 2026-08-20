import { binanceSpotSymbol, normalizeCryptoSymbol } from "../../src/crypto/binance.js";
import { apiError, fetchJson, method } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

const UPSTREAM = "https://data-api.binance.vision/api/v3";

function clientError(message, code, status = 422) {
  return Object.assign(new Error(message), { code, status });
}

function requestKey(request) {
  return String(request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"] || "crypto-public").split(",")[0].trim();
}

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    enforceRateLimit(`crypto:${requestKey(request)}`, 60);
    let base;
    try { base = normalizeCryptoSymbol(request.query?.symbol); }
    catch { throw clientError("Crypto symbol not found.", "crypto_symbol_invalid"); }
    const providerSymbol = binanceSpotSymbol(base, "USDT");
    let exchangeInfo;
    try {
      exchangeInfo = await fetchJson(`${UPSTREAM}/exchangeInfo?symbol=${encodeURIComponent(providerSymbol)}`);
    } catch { throw clientError("Unable to reach Crypto market data. Please try again.", "crypto_provider_unreachable", 503); }
    const symbol = exchangeInfo?.symbols?.find(row => row.symbol === providerSymbol);
    const spotAllowed = symbol?.isSpotTradingAllowed !== false && (!Array.isArray(symbol?.permissions) || symbol.permissions.includes("SPOT"));
    if (!symbol || symbol.status !== "TRADING" || symbol.baseAsset !== base || symbol.quoteAsset !== "USDT" || !spotAllowed) {
      throw clientError("Crypto symbol not found.", "crypto_symbol_not_found");
    }
    let ticker;
    try { ticker = await fetchJson(`${UPSTREAM}/ticker/24hr?symbol=${encodeURIComponent(providerSymbol)}`); }
    catch { throw clientError("Live Crypto price is temporarily unavailable.", "crypto_price_unavailable", 503); }
    const price = Number(ticker?.lastPrice);
    if (!Number.isFinite(price) || price <= 0) throw clientError("Live Crypto price is temporarily unavailable.", "crypto_price_invalid", 503);
    response.setHeader("Cache-Control", "public, max-age=3, stale-while-revalidate=7");
    return response.status(200).json({
      ok:true,
      symbol:base,
      providerSymbol,
      quoteCurrency:"USDT",
      price,
      changePercent24h:Number(ticker.priceChangePercent),
      high:Number(ticker.highPrice),
      low:Number(ticker.lowPrice),
      volume:Number(ticker.volume),
      asOf:new Date(Number(ticker.closeTime || Date.now())).toISOString(),
      provider:"binance"
    });
  } catch (error) {
    return apiError(response, error);
  }
}
