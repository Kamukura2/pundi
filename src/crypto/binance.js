import { fetchCryptoQuote, fetchCryptoQuotes } from "../market-data/client.js";

// Kept as public-provider documentation for legacy callers. Runtime quote
// requests now go through the shared Supabase Edge Function below.
export const BINANCE_REST_BASE = "https://data-api.binance.vision/api/v3";
export const BINANCE_WS_BASE = "wss://data-stream.binance.vision/stream?streams=";
export const PUNDI_CRYPTO_API = "market-data";
export const DEFAULT_CRYPTO_QUOTE = "USD";
export const CRYPTO_QUOTE_CURRENCIES = ["USD", "IDR", "USDT"];

export const isStableQuote = currency => ["USDT", "USDC", "FDUSD"].includes(String(currency || "").toUpperCase());
export const isDollarLikeCurrency = currency => ["USD", ...CRYPTO_QUOTE_CURRENCIES.filter(value => isStableQuote(value))].includes(String(currency || "").toUpperCase());
export const normalizeQuoteValueToIdr = (amount, currency, usdIdr) => Number(amount || 0) * (isDollarLikeCurrency(currency) ? Number(usdIdr || 0) : 1);

const baseSymbolPattern = /^[A-Z0-9]{2,20}$/;

export function normalizeQuoteCurrency(value, fallback = DEFAULT_CRYPTO_QUOTE) {
  const quote = String(value || fallback).trim().toUpperCase();
  if (!CRYPTO_QUOTE_CURRENCIES.includes(quote)) throw new Error("Unsupported Crypto quote currency.");
  return quote;
}

export function normalizeCryptoSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!baseSymbolPattern.test(symbol) || /[^A-Z0-9]/.test(symbol)) throw new Error("Invalid crypto symbol.");
  return symbol;
}

export function parseCryptoPairInput(value, defaultQuote = DEFAULT_CRYPTO_QUOTE) {
  const raw = String(value || "").trim().toUpperCase();
  const fallbackQuote = normalizeQuoteCurrency(defaultQuote);
  if (!raw) throw new Error("Crypto symbol not found.");
  const separated = raw.match(/^([A-Z0-9]{2,20})[\/_-](USD|IDR|USDT)$/);
  if (separated) return { baseSymbol: normalizeCryptoSymbol(separated[1]), requestedQuote: separated[2], explicitQuote: true };
  const compactQuote = ["USDT", "USD", "IDR"].find(quote => raw.endsWith(quote) && raw.length > quote.length);
  if (compactQuote) return { baseSymbol: normalizeCryptoSymbol(raw.slice(0, -compactQuote.length)), requestedQuote: compactQuote, explicitQuote: true };
  return { baseSymbol: normalizeCryptoSymbol(raw), requestedQuote: fallbackQuote, explicitQuote: false };
}

export function binanceSpotSymbol(baseSymbol, quoteCurrency = "USDT") {
  const base = normalizeCryptoSymbol(baseSymbol);
  const quote = String(quoteCurrency || "USDT").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(quote)) throw new Error("Invalid crypto quote currency.");
  return `${base}${quote}`;
}

export function cryptoBaseSymbol(providerSymbol, quoteCurrency = "USDT") {
  const pair = String(providerSymbol || "").trim().toUpperCase();
  const quote = String(quoteCurrency || "USDT").trim().toUpperCase();
  if (!pair.endsWith(quote)) throw new Error("Invalid Binance spot symbol.");
  return normalizeCryptoSymbol(pair.slice(0, -quote.length));
}

export function providerQuoteCurrency(providerSymbol) {
  const pair = String(providerSymbol || "").trim().toUpperCase();
  return ["USDT", "FDUSD", "USDC", "USD", "IDR"].find(quote => pair.endsWith(quote)) || "USDT";
}

export function isCryptoAsset(row = {}) {
  return String(row.assetType || "").toLowerCase() === "crypto"
    || String(row.market || "").toUpperCase() === "CRYPTO"
    || String(row.provider || "").toLowerCase() === "binance"
    || String(row.currency || "").toUpperCase() === "USDT";
}

export function validCryptoPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0;
}

export function normalizeStableQuoteToUsd(value, sourceQuote) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || String(sourceQuote || "").toUpperCase() === "IDR") return null;
  return amount;
}

export function convertCryptoPrice(value, sourceQuote, requestedQuote, usdIdr) {
  const amount = Number(value);
  const source = String(sourceQuote || "").toUpperCase();
  const target = normalizeQuoteCurrency(requestedQuote);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (source === target) return amount;
  const usd = source === "IDR" ? amount / Number(usdIdr || 0) : normalizeStableQuoteToUsd(amount, source);
  if (!Number.isFinite(usd) || usd <= 0) return null;
  if (target === "IDR") return usd * Number(usdIdr || 0);
  return usd;
}

export function parseBinanceTicker(data = {}, { source = "rest", sourceQuote = "USDT" } = {}) {
  const price = Number(data.lastPrice ?? data.price);
  if (!validCryptoPrice(price)) throw Object.assign(new Error("Binance returned no valid crypto price."), { code: "crypto_price_unavailable" });
  const timestamp = Number(data.closeTime || data.E || 0);
  const hasTimestamp = Number.isFinite(timestamp) && timestamp > 0;
  const asOf = hasTimestamp ? new Date(timestamp).toISOString() : null;
  const status = asOf ? (source === "websocket" ? "LIVE" : "STALE") : "STALE";
  return { price, asOf, status, provider: "binance", source, sourceQuote, changePercent: Number(data.priceChangePercent), high: Number(data.highPrice), low: Number(data.lowPrice), volume: Number(data.volume) };
}

async function requestCryptoQuote(baseSymbol, requestedQuote = DEFAULT_CRYPTO_QUOTE) {
  const base = normalizeCryptoSymbol(baseSymbol);
  const quote = normalizeQuoteCurrency(requestedQuote);
  return fetchCryptoQuote(base, quote);
}

export async function resolveCryptoPair(value, requestedQuote = DEFAULT_CRYPTO_QUOTE) {
  const parsed = parseCryptoPairInput(value, requestedQuote);
  return requestCryptoQuote(parsed.baseSymbol, parsed.requestedQuote);
}

export async function resolveCryptoSymbol(baseSymbol, quoteCurrency = DEFAULT_CRYPTO_QUOTE) {
  return resolveCryptoPair(baseSymbol, quoteCurrency);
}

export async function fetchBinanceTicker(providerSymbol, requestedQuote = "USDT") {
  const sourceQuote = providerQuoteCurrency(providerSymbol);
  const base = cryptoBaseSymbol(providerSymbol, sourceQuote);
  const body = await requestCryptoQuote(base, requestedQuote);
  return { price: body.price, asOf: body.asOf, status: body.status || "STALE", provider: body.provider || "market-data", source: "pundi-market-data", sourceQuote: body.requestedQuote || requestedQuote, requestedQuote: body.requestedQuote || requestedQuote, changePercent: body.changePercent24h, high: body.high, low: body.low, volume: body.volume, providerSymbol: body.normalizedSymbol };
}

export { fetchCryptoQuotes };

// Shared Edge Function polling replaces direct per-client Binance WebSocket
// connections. This keeps web, Android, and Windows on one contract and uses
// one batch request for all visible crypto rows.
export class CryptoMarketStream {
  constructor({ onTicker = () => {}, onStatus = () => {}, fetchQuotes = fetchCryptoQuotes } = {}) {
    this.onTicker = onTicker;
    this.onStatus = onStatus;
    this.fetchQuotes = fetchQuotes;
    this.requests = [];
    this.timer = null;
    this.retryTimer = null;
    this.closed = true;
    this.retryCount = 0;
    this.refreshing = false;
  }

  setRequests(requests = []) {
    const next = requests.map(item => ({ id: String(item.id || item.symbol || ""), symbol: String(item.symbol || "").trim().toUpperCase(), quote: normalizeQuoteCurrency(item.quote || "USD") })).filter(item => item.id && item.symbol).sort((a, b) => a.id.localeCompare(b.id));
    if (JSON.stringify(next) === JSON.stringify(this.requests)) return;
    this.requests = next;
    this.retryCount = 0;
    this.closed = !next.length;
    this.stopTimers();
    if (this.closed) { this.onStatus({ state: "offline", reason: "no crypto holdings" }); return; }
    this.onStatus({ state: "connecting", reason: "shared market-data service" });
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 60_000);
  }

  setSymbols(symbols = []) {
    this.setRequests(symbols.map(symbol => ({ id: symbol, symbol, quote: "USDT" })));
  }

  stopTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
  }

  stop() {
    this.stopTimers();
    this.requests = [];
    this.closed = true;
    this.refreshing = false;
    this.onStatus({ state: "offline", reason: "stopped" });
  }

  async refresh() {
    if (this.closed || !this.requests.length || this.refreshing) return;
    this.refreshing = true;
    try {
      const body = await this.fetchQuotes(this.requests);
      const quotes = Array.isArray(body?.quotes) ? body.quotes : [];
      if (!quotes.length) throw Object.assign(new Error("No crypto quotes returned."), { code: "crypto_provider_unavailable" });
      const expectedIds = new Set(this.requests.map(request => request.id));
      const receivedIds = new Set();
      quotes.forEach(quote => {
        const id = String(quote?.id || quote?.normalizedSymbol || "");
        if (!id) return;
        receivedIds.add(id);
        this.onTicker(id, quote);
      });
      const degraded = quotes.some(quote => quote?.ok === false || ["STALE", "OFFLINE"].includes(String(quote?.status || quote?.state || "").toUpperCase()))
        || receivedIds.size < expectedIds.size;
      if (degraded) {
        this.onStatus({ state: "stale", reason: "shared market-data service returned partial or stale data" });
        if (!this.closed && !this.retryTimer) {
          const delay = Math.min(30_000, 2_000 * (2 ** Math.min(this.retryCount, 4)));
          this.retryCount += 1;
          this.retryTimer = setTimeout(() => { this.retryTimer = null; this.refresh(); }, delay);
        }
        return;
      }
      this.retryCount = 0;
      this.onStatus({ state: "live", reason: "shared market-data service" });
    } catch (error) {
      this.onStatus({ state: "stale", reason: error.message });
      if (!this.closed && !this.retryTimer) {
        const delay = Math.min(30_000, 2_000 * (2 ** Math.min(this.retryCount, 4)));
        this.retryCount += 1;
        this.retryTimer = setTimeout(() => { this.retryTimer = null; this.refresh(); }, delay);
      }
    } finally { this.refreshing = false; }
  }
}
