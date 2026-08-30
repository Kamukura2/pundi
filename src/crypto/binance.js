export const BINANCE_REST_BASE = "https://data-api.binance.vision/api/v3";
export const BINANCE_WS_BASE = "wss://data-stream.binance.vision/stream?streams=";
export const PUNDI_CRYPTO_API = "/api/crypto/quote";
import { apiUrl } from "../lib/runtime.js";
export const DEFAULT_CRYPTO_QUOTE = "USD";
export const CRYPTO_QUOTE_CURRENCIES = ["USD", "IDR", "USDT"];

// Portfolio normalization only: stablecoin quotes are approximated with USD.
// This is not a claim that any stablecoin is exactly equal to USD.
export const isStableQuote = currency => ["USDT", "USDC", "FDUSD"].includes(String(currency || "").toUpperCase());
export const isDollarLikeCurrency = currency => ["USD", ...CRYPTO_QUOTE_CURRENCIES.filter(value => isStableQuote(value))].includes(String(currency || "").toUpperCase());
export const normalizeQuoteValueToIdr = (amount, currency, usdIdr) => Number(amount || 0) * (isDollarLikeCurrency(currency) ? Number(usdIdr || 0) : 1);

const baseSymbolPattern = /^[A-Z0-9]{2,20}$/;
const quoteSymbolPattern = /^(USD|IDR|USDT)$/;
const exchangeInfoCache = new Map();

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
  if (separated) return { baseSymbol:normalizeCryptoSymbol(separated[1]), requestedQuote:separated[2], explicitQuote:true };
  const compactQuote = ["USDT", "USD", "IDR"].find(quote => raw.endsWith(quote) && raw.length > quote.length);
  if (compactQuote) return { baseSymbol:normalizeCryptoSymbol(raw.slice(0, -compactQuote.length)), requestedQuote:compactQuote, explicitQuote:true };
  return { baseSymbol:normalizeCryptoSymbol(raw), requestedQuote:fallbackQuote, explicitQuote:false };
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
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (String(sourceQuote || "").toUpperCase() === "IDR") return null;
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
  const price = Number(data.lastPrice);
  if (!validCryptoPrice(price)) throw Object.assign(new Error("Binance returned no valid crypto price."), { code:"crypto_price_unavailable" });
  const timestamp = Number(data.closeTime || data.E || Date.now());
  return {
    price,
    asOf: new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()).toISOString(),
    status: source === "websocket" ? "live" : "stale",
    provider: "binance",
    source,
    sourceQuote,
    changePercent: Number(data.priceChangePercent),
    high: Number(data.highPrice),
    low: Number(data.lowPrice),
    volume: Number(data.volume)
  };
}

async function requestCryptoQuote(baseSymbol, requestedQuote = DEFAULT_CRYPTO_QUOTE, usdIdr = "") {
  const base = normalizeCryptoSymbol(baseSymbol);
  const quote = normalizeQuoteCurrency(requestedQuote);
  let response;
  try {
    const fx = usdIdr ? `&usdIdr=${encodeURIComponent(usdIdr)}` : "";
    response = await fetch(apiUrl(`${PUNDI_CRYPTO_API}?symbol=${encodeURIComponent(base)}&quote=${quote}${fx}`), { headers:{Accept:"application/json"}, cache:"no-store" });
  } catch { throw Object.assign(new Error("Unable to reach Crypto market data. Please try again."), { code:"crypto_network_error" }); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const message = body.code === "crypto_symbol_not_found" || body.code === "crypto_symbol_invalid" ? "Crypto symbol not found." : body.code === "crypto_price_route_unavailable" ? "No supported market-price route for this Crypto asset." : body.error || "Live Crypto price is temporarily unavailable.";
    throw Object.assign(new Error(message), { code:body.code || "crypto_provider_error", status:response.status });
  }
  return body;
}

export async function resolveCryptoPair(value, requestedQuote = DEFAULT_CRYPTO_QUOTE, usdIdr = "") {
  const parsed = parseCryptoPairInput(value, requestedQuote);
  return requestCryptoQuote(parsed.baseSymbol, parsed.requestedQuote, usdIdr);
}

// Backward-compatible v8.2.x resolver; new positions use USD by default.
export async function resolveCryptoSymbol(baseSymbol, quoteCurrency = DEFAULT_CRYPTO_QUOTE, usdIdr = "") {
  return resolveCryptoPair(baseSymbol, quoteCurrency, usdIdr);
}

export async function fetchBinanceTicker(providerSymbol, requestedQuote = "USDT", usdIdr = "") {
  const sourceQuote = providerQuoteCurrency(providerSymbol);
  const body = await requestCryptoQuote(cryptoBaseSymbol(providerSymbol, sourceQuote), requestedQuote, usdIdr);
  return { price:body.price, asOf:body.asOf, status:"stale", provider:"binance", source:"same-origin-rest", sourceQuote:body.sourceQuote || sourceQuote, changePercent:body.changePercent24h, high:body.high, low:body.low, volume:body.volume };
}

export class CryptoMarketStream {
  constructor({ onTicker = () => {}, onStatus = () => {} } = {}) {
    this.onTicker = onTicker;
    this.onStatus = onStatus;
    this.symbols = [];
    this.socket = null;
    this.retryTimer = null;
    this.restTimer = null;
    this.staleTimer = null;
    this.retryCount = 0;
    this.closed = true;
    this.lastMessageAt = 0;
  }

  setSymbols(symbols = []) {
    const next = [...new Set(symbols.map(symbol => String(symbol || "").trim().toLowerCase()).filter(Boolean))].sort();
    if (next.join(",") === this.symbols.join(",")) return;
    this.symbols = next;
    this.retryCount = 0;
    this.closed = !next.length;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    if (!this.closed) this.connect();
    else this.onStatus({ state:"offline", reason:"no crypto symbols" });
  }

  stop() {
    this.symbols = [];
    this.closed = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.onStatus({ state:"offline", reason:"stopped" });
  }

  clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.restTimer) clearInterval(this.restTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.retryTimer = null;
    this.restTimer = null;
    this.staleTimer = null;
  }

  connect() {
    if (this.closed || !this.symbols.length) return;
    if (typeof WebSocket === "undefined") {
      this.onStatus({ state:"offline", reason:"WebSocket unavailable" });
      this.startRestFallback();
      return;
    }
    const url = `${BINANCE_WS_BASE}${this.symbols.map(symbol => `${symbol}@ticker`).join("/")}`;
    this.onStatus({ state:"connecting" });
    try {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.retryCount = 0;
        this.lastMessageAt = Date.now();
        this.stopRestFallback();
        if (this.staleTimer) clearInterval(this.staleTimer);
        this.staleTimer = setInterval(() => {
          if (!this.closed && this.lastMessageAt && Date.now() - this.lastMessageAt > 15000) this.onStatus({ state:"stale", reason:"No recent ticker message" });
        }, 5000);
        this.onStatus({ state:"live" });
      };
      socket.onmessage = event => {
        if (socket !== this.socket) return;
        let payload;
        try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
        const ticker = payload?.data || payload;
        if (!ticker?.s || !validCryptoPrice(ticker.lastPrice)) return;
        this.lastMessageAt = Date.now();
        this.onTicker(String(ticker.s).toUpperCase(), parseBinanceTicker(ticker, {source:"websocket",sourceQuote:providerQuoteCurrency(ticker.s)}));
      };
      socket.onerror = () => { if (socket === this.socket) socket.close(); };
      socket.onclose = () => {
        if (socket !== this.socket || this.closed) return;
        this.socket = null;
        if (this.staleTimer) clearInterval(this.staleTimer);
        this.staleTimer = null;
        this.onStatus({ state:"stale", reason:"WebSocket disconnected" });
        this.startRestFallback();
        this.scheduleReconnect();
      };
      this.staleTimer = setInterval(() => {
        if (!this.closed && this.lastMessageAt && Date.now() - this.lastMessageAt > 15000) this.onStatus({ state:"stale", reason:"No recent ticker message" });
      }, 5000);
    } catch (error) {
      this.onStatus({ state:"offline", reason:error.message });
      this.startRestFallback();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.closed || this.retryTimer) return;
    const delay = Math.min(30000, 1000 * (2 ** Math.min(this.retryCount, 5)));
    this.retryCount += 1;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, delay);
  }

  startRestFallback() {
    if (this.restTimer || this.closed) return;
    const refresh = async () => {
      for (const symbol of this.symbols) {
        try { this.onTicker(symbol.toUpperCase(), await fetchBinanceTicker(symbol.toUpperCase())); }
        catch (error) { this.onStatus({ state:"stale", reason:error.message }); }
      }
    };
    refresh();
    this.restTimer = setInterval(refresh, 20000);
  }

  stopRestFallback() {
    if (this.restTimer) clearInterval(this.restTimer);
    this.restTimer = null;
  }
}
