export const BINANCE_REST_BASE = "https://data-api.binance.vision/api/v3";
export const BINANCE_WS_BASE = "wss://data-stream.binance.vision/stream?streams=";
export const CVFINANCE_CRYPTO_API = "/api/crypto/quote";
export const DEFAULT_CRYPTO_QUOTE = "USDT";

// Portfolio normalization only: USDT is approximated with the existing USD/IDR rate.
// This is not a claim that USDT is exactly equal to USD.
export const isDollarLikeCurrency = currency => ["USD","USDT"].includes(String(currency || "").toUpperCase());
export const normalizeQuoteValueToIdr = (amount, currency, usdIdr) => Number(amount || 0) * (isDollarLikeCurrency(currency) ? Number(usdIdr || 0) : 1);

const baseSymbolPattern = /^[A-Z0-9]{2,20}$/;
const quoteSymbolPattern = /^[A-Z0-9]{2,10}$/;
const exchangeInfoCache = new Map();

export function normalizeCryptoSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!baseSymbolPattern.test(symbol) || /[^A-Z0-9]/.test(symbol)) throw new Error("Invalid crypto symbol.");
  if (symbol.endsWith(DEFAULT_CRYPTO_QUOTE) && symbol.length > DEFAULT_CRYPTO_QUOTE.length) return symbol.slice(0, -DEFAULT_CRYPTO_QUOTE.length);
  return symbol;
}

export function binanceSpotSymbol(baseSymbol, quoteCurrency = DEFAULT_CRYPTO_QUOTE) {
  const base = normalizeCryptoSymbol(baseSymbol);
  const quote = String(quoteCurrency || DEFAULT_CRYPTO_QUOTE).trim().toUpperCase();
  if (!quoteSymbolPattern.test(quote)) throw new Error("Invalid crypto quote currency.");
  return `${base}${quote}`;
}

export function cryptoBaseSymbol(providerSymbol, quoteCurrency = DEFAULT_CRYPTO_QUOTE) {
  const pair = String(providerSymbol || "").trim().toUpperCase();
  const quote = String(quoteCurrency || DEFAULT_CRYPTO_QUOTE).trim().toUpperCase();
  if (!pair.endsWith(quote)) throw new Error("Invalid Binance spot symbol.");
  return normalizeCryptoSymbol(pair.slice(0, -quote.length));
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

export function parseBinanceTicker(data = {}, { source = "rest" } = {}) {
  const price = Number(data.lastPrice);
  if (!validCryptoPrice(price)) throw Object.assign(new Error("Binance returned no valid crypto price."), { code:"crypto_price_unavailable" });
  const timestamp = Number(data.closeTime || data.E || Date.now());
  return {
    price,
    asOf: new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()).toISOString(),
    status: source === "websocket" ? "live" : "stale",
    provider: "binance",
    source,
    changePercent: Number(data.priceChangePercent),
    high: Number(data.highPrice),
    low: Number(data.lowPrice),
    volume: Number(data.volume)
  };
}

async function requestCryptoQuote(baseSymbol) {
  const base = normalizeCryptoSymbol(baseSymbol);
  let response;
  try { response = await fetch(`${CVFINANCE_CRYPTO_API}?symbol=${encodeURIComponent(base)}`, { headers:{Accept:"application/json"}, cache:"no-store" }); }
  catch { throw Object.assign(new Error("Unable to reach Crypto market data. Please try again."), { code:"crypto_network_error" }); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const message = body.code === "crypto_symbol_not_found" || body.code === "crypto_symbol_invalid" ? "Crypto symbol not found." : body.error || "Live Crypto price is temporarily unavailable.";
    throw Object.assign(new Error(message), { code:body.code || "crypto_provider_error", status:response.status });
  }
  return body;
}

export async function resolveCryptoSymbol(baseSymbol, quoteCurrency = DEFAULT_CRYPTO_QUOTE) {
  if (String(quoteCurrency).toUpperCase() !== DEFAULT_CRYPTO_QUOTE) throw new Error("Only USDT crypto quotes are supported.");
  const normalizedBase = normalizeCryptoSymbol(baseSymbol);
  const providerSymbol = binanceSpotSymbol(normalizedBase, quoteCurrency);
  const cached = exchangeInfoCache.get(providerSymbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const body = await requestCryptoQuote(normalizedBase);
  const value = { baseSymbol:body.symbol, quoteCurrency:body.quoteCurrency, providerSymbol:body.providerSymbol, status:"TRADING" };
  exchangeInfoCache.set(providerSymbol, { value, expiresAt:Date.now()+60*60*1000 });
  return value;
}

export async function fetchBinanceTicker(providerSymbol) {
  const body = await requestCryptoQuote(cryptoBaseSymbol(providerSymbol), DEFAULT_CRYPTO_QUOTE);
  return { price:body.price, asOf:body.asOf, status:"stale", provider:"binance", source:"same-origin-rest", changePercent:body.changePercent24h, high:body.high, low:body.low, volume:body.volume };
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
        this.onTicker(String(ticker.s).toUpperCase(), parseBinanceTicker(ticker, {source:"websocket"}));
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
