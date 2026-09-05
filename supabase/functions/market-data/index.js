const VERSION = "2026-09-05.v3.2.0";
const MIN_FX = 10000;
const MAX_FX = 25000;
const MAX_BATCH = 50;
const PROVIDER_CONCURRENCY = 5;
const CACHE_TTLS = Object.freeze({ IDX: 5 * 60_000, US: 2 * 60_000, CRYPTO: 60_000, FX: 10 * 60_000 });
const MEMORY_CACHE = globalThis.__pundiMarketDataCache || new Map();
globalThis.__pundiMarketDataCache = MEMORY_CACHE;
const RATE_BUCKETS = globalThis.__pundiMarketRateBuckets || new Map();
globalThis.__pundiMarketRateBuckets = RATE_BUCKETS;

const env = name => {
  if (typeof Deno !== "undefined" && Deno.env?.get) return Deno.env.get(name) || "";
  if (typeof process !== "undefined" && process.env) return process.env[name] || "";
  return "";
};

const now = () => new Date();
const iso = value => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

class MarketError extends Error {
  constructor(message, { code = "provider_error", status = 502, state = "OFFLINE", retryable = true, provider = "" } = {}) {
    super(message);
    this.name = "MarketError";
    this.code = code;
    this.status = status;
    this.state = state;
    this.retryable = retryable;
    this.provider = provider;
  }
}

const error = (message, options = {}) => new MarketError(message, options);
const validPrice = value => Number.isFinite(Number(value)) && Number(value) > 0;
const validFx = value => Number.isFinite(Number(value)) && Number(value) >= MIN_FX && Number(value) <= MAX_FX;

function normalizeBase(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(symbol)) throw error("Invalid market symbol.", { code: "invalid_symbol", status: 400, state: "OFFLINE", retryable: false });
  return symbol;
}

function parseCryptoInput(value, fallbackQuote = "USD") {
  const raw = String(value || "").trim().toUpperCase();
  const quote = String(fallbackQuote || "USD").trim().toUpperCase();
  if (!["USD", "IDR", "USDT"].includes(quote)) throw error("Unsupported crypto quote currency.", { code: "invalid_currency", status: 400, state: "OFFLINE", retryable: false });
  if (!raw) throw error("Crypto symbol not found.", { code: "crypto_symbol_invalid", status: 400, state: "OFFLINE", retryable: false });
  const separated = raw.match(/^([A-Z0-9]{2,20})[\/_-](USD|IDR|USDT)$/);
  if (separated) return { base: normalizeBase(separated[1]), requestedQuote: separated[2] };
  const compactQuote = ["USDT", "USD", "IDR"].find(candidate => raw.endsWith(candidate) && raw.length > candidate.length);
  if (compactQuote) return { base: normalizeBase(raw.slice(0, -compactQuote.length)), requestedQuote: compactQuote };
  return { base: normalizeBase(raw), requestedQuote: quote };
}

function normalizeEquityMapping(input = {}) {
  const market = String(input.market || "").trim().toUpperCase();
  if (!["IDX", "NASDAQ", "NYSE", "AMEX"].includes(market)) throw error("Unsupported equity market.", { code: "unsupported_market", status: 400, state: "OFFLINE", retryable: false });
  const displaySymbol = normalizeBase(input.displaySymbol || input.ticker || input.symbol || input.providerSymbol);
  const rawProviderSymbol = String(input.providerSymbol || input.provider_symbol || displaySymbol).trim().toUpperCase();
  const providerSymbol = market === "IDX"
    ? (rawProviderSymbol.endsWith(".JK") ? rawProviderSymbol : `${rawProviderSymbol}.JK`)
    : rawProviderSymbol.replace(/\.(?:US|NASDAQ|NYSE)$/i, "");
  if (!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(providerSymbol)) throw error("Invalid provider symbol.", { code: "invalid_symbol", status: 400, state: "OFFLINE", retryable: false });
  const currency = market === "IDX" ? "IDR" : String(input.currency || "USD").trim().toUpperCase();
  if (!["IDR", "USD"].includes(currency)) throw error("Unsupported equity currency.", { code: "invalid_currency", status: 400, state: "OFFLINE", retryable: false });
  return { displaySymbol, market, providerSymbol, currency, normalizedSymbol: providerSymbol, assetType: "equity" };
}

function cacheTtlFor(type, market = "") {
  if (type === "FX") return CACHE_TTLS.FX;
  if (type === "CRYPTO") return CACHE_TTLS.CRYPTO;
  return market === "IDX" ? CACHE_TTLS.IDX : CACHE_TTLS.US;
}

function responseHeaders(request, extra = {}) {
  const origin = request.headers.get("origin") || "";
  const allowed = origin === "https://app.pundi.online"
    || origin === "https://pundi.online"
    || origin === "https://www.pundi.online"
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    "x-pundi-market-service": VERSION,
    ...extra
  };
  if (allowed) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "authorization, apikey, content-type, x-client-info";
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-max-age"] = "600";
    headers["vary"] = "Origin";
  }
  return headers;
}

function json(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request, extraHeaders) });
}

function checkRateLimit(key, limit = 60, windowMs = 60_000) {
  const timestamp = Date.now();
  const current = RATE_BUCKETS.get(key);
  if (!current || timestamp - current.startedAt >= windowMs) {
    RATE_BUCKETS.set(key, { startedAt: timestamp, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw error("Market data rate limit reached. Try again shortly.", { code: "rate_limited", status: 429, state: "OFFLINE", retryable: true });
}

function requestOriginKey(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return (forwarded.split(",")[0] || request.headers.get("origin") || "anonymous").trim().slice(0, 128);
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch {
      throw error("Provider returned malformed data.", { code: "provider_payload_invalid", status: 502, state: "OFFLINE", retryable: true });
    }
    if (response.status === 429) throw error("Provider rate limit reached.", { code: "provider_rate_limited", status: 429, state: "OFFLINE", retryable: true });
    if (!response.ok) throw error("Provider returned an HTTP error.", { code: "provider_http_error", status: response.status >= 500 ? 502 : response.status, state: "OFFLINE", retryable: response.status >= 500, provider: new URL(url).hostname });
    return body;
  } catch (cause) {
    if (cause instanceof MarketError) throw cause;
    if (cause?.name === "AbortError") throw error("Provider request timed out.", { code: "provider_timeout", status: 504, state: "OFFLINE", retryable: true });
    throw error("Provider request failed.", { code: "provider_network_error", status: 502, state: "OFFLINE", retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

function yahooUrl(symbol, { interval = "1d", range = "5d" } = {}) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");
  return url;
}

function parseYahooResult(body, symbol) {
  if (body?.chart?.error) throw error("Yahoo returned no market data.", { code: "provider_symbol_unavailable", status: 422, state: "OFFLINE", retryable: false, provider: "yahoo" });
  const result = body?.chart?.result?.[0];
  if (!result) throw error("Provider returned no market data.", { code: "provider_payload_empty", status: 502, state: "OFFLINE", retryable: true, provider: "yahoo" });
  const meta = result.meta || {};
  const closes = result.indicators?.quote?.[0]?.close || [];
  const timestamps = result.timestamp || [];
  let price = Number(meta.regularMarketPrice);
  let stamp = Number(meta.regularMarketTime || 0);
  if (!validPrice(price)) {
    for (let index = closes.length - 1; index >= 0; index -= 1) {
      if (validPrice(closes[index])) { price = Number(closes[index]); stamp = Number(timestamps[index] || stamp); break; }
    }
  }
  if (!validPrice(price)) throw error(`No valid price returned for ${symbol}.`, { code: "provider_symbol_unavailable", status: 422, state: "OFFLINE", retryable: false, provider: "yahoo" });
  return { price, quoteTimestamp: stamp > 0 ? iso(stamp * 1000) : iso(now()), provider: "yahoo" };
}

async function yahooEquity(mapping) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastError;
  for (const host of hosts) {
    try {
      const url = yahooUrl(mapping.providerSymbol);
      url.hostname = host;
      const parsed = parseYahooResult(await fetchWithTimeout(url, { headers: { Accept: "application/json", "User-Agent": "Pundi-market-data/3.2" } }), mapping.providerSymbol);
      return {
        ok: true,
        type: "quote",
        ticker: mapping.displaySymbol,
        market: mapping.market,
        normalizedSymbol: mapping.providerSymbol,
        provider: "yahoo",
        currency: mapping.currency,
        price: parsed.price,
        status: "DELAYED",
        state: "DELAYED",
        quoteTimestamp: parsed.quoteTimestamp,
        asOf: parsed.quoteTimestamp,
        errorClass: null,
        retryable: false
      };
    } catch (cause) { lastError = cause; }
  }
  throw lastError || error("Yahoo market data unavailable.", { code: "provider_unavailable", status: 502, state: "OFFLINE", provider: "yahoo" });
}

async function stooqEquity(mapping) {
  const stooq = `https://stooq.com/q/l/?s=${encodeURIComponent(mapping.providerSymbol.toLowerCase() + ".us")}&f=sd2t2ohlcv&h&e=json`;
  const body = await fetchWithTimeout(stooq, { headers: { Accept: "application/json" } });
  const row = Array.isArray(body?.data) ? body.data[0] : body?.data || body;
  const price = Number(row?.Close ?? row?.close);
  if (!validPrice(price)) throw error("Fallback provider returned no valid price.", { code: "provider_symbol_unavailable", status: 422, state: "OFFLINE", retryable: false, provider: "stooq" });
  const date = String(row?.Date || "").trim();
  const time = String(row?.Time || "").trim();
  const stamp = date && time && date !== "N/D" && time !== "N/D" ? `${date}T${time}Z` : iso(now());
  return {
    ok: true,
    type: "quote",
    ticker: mapping.displaySymbol,
    market: mapping.market,
    normalizedSymbol: mapping.providerSymbol,
    provider: "stooq",
    currency: mapping.currency,
    price,
    status: "FALLBACK",
    state: "FALLBACK",
    quoteTimestamp: iso(stamp),
    asOf: iso(stamp),
    errorClass: null,
    retryable: false,
    fallbackFrom: "yahoo"
  };
}

async function quoteEquity(input, { ignoreCache = false } = {}) {
  const mapping = normalizeEquityMapping(input);
  const key = `equity:${mapping.market}:${mapping.providerSymbol}`;
  const cached = await readCache(key);
  if (!ignoreCache && cached && cached.expiresAt > Date.now()) return withCache(cached.payload, "hit", cached);
  let primaryError;
  try {
    const quote = await yahooEquity(mapping);
    return await cacheQuote(key, quote, cacheTtlFor("EQUITY", mapping.market));
  } catch (cause) { primaryError = cause; }
  if (mapping.market !== "IDX") {
    try {
      const quote = await stooqEquity(mapping);
      return await cacheQuote(key, quote, cacheTtlFor("EQUITY", mapping.market));
    } catch {}
  }
  const stale = cached || await readCache(key, { allowExpired: true });
  if (stale) return withCache({ ...stale.payload, status: "STALE", state: "STALE", errorClass: primaryError?.code || "provider_unavailable", retryable: true }, "stale", stale);
  throw error("Market data is temporarily unavailable; saved holding data was retained.", { code: primaryError?.code || "provider_unavailable", status: 503, state: "OFFLINE", retryable: true, provider: primaryError?.provider || "market-provider" });
}

async function yahooFx() {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastError;
  for (const host of hosts) {
    try {
      const url = yahooUrl("IDR=X", { interval: "1h", range: "5d" });
      url.hostname = host;
      const parsed = parseYahooResult(await fetchWithTimeout(url, { headers: { Accept: "application/json", "User-Agent": "Pundi-market-data/3.2" } }), "IDR=X");
      if (!validFx(parsed.price)) throw error("Rejected implausible USD/IDR rate.", { code: "provider_payload_invalid", status: 502, state: "OFFLINE", retryable: true, provider: "yahoo" });
      return { ok: true, type: "fx", pair: "USD/IDR", normalizedSymbol: "USD/IDR", provider: "yahoo", currency: "IDR", rate: parsed.price, price: parsed.price, status: "DELAYED", state: "DELAYED", quoteTimestamp: parsed.quoteTimestamp, asOf: parsed.quoteTimestamp, errorClass: null, retryable: false };
    } catch (cause) { lastError = cause; }
  }
  throw lastError || error("USD/IDR provider unavailable.", { code: "fx_provider_unavailable", status: 502, state: "OFFLINE", retryable: true });
}

async function fallbackFx() {
  const body = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", { headers: { Accept: "application/json" } });
  const rate = Number(body?.rates?.IDR);
  if (!validFx(rate)) throw error("Fallback FX provider returned an invalid rate.", { code: "fx_payload_invalid", status: 502, state: "OFFLINE", retryable: true, provider: "open-er-api" });
  const stamp = body?.time_last_update_unix ? Number(body.time_last_update_unix) * 1000 : Date.now();
  return { ok: true, type: "fx", pair: "USD/IDR", normalizedSymbol: "USD/IDR", provider: "open-er-api", currency: "IDR", rate, price: rate, status: "FALLBACK", state: "FALLBACK", quoteTimestamp: iso(stamp), asOf: iso(stamp), errorClass: null, retryable: false, fallbackFrom: "yahoo" };
}

async function yahooHistory(symbol = "SPY") {
  const normalized=String(symbol||"").trim().toUpperCase();
  if(normalized!=="SPY")throw error("Only the configured benchmark is supported.",{code:"invalid_symbol",status:400,state:"OFFLINE",retryable:false});
  const hosts=["query1.finance.yahoo.com","query2.finance.yahoo.com"];
  let lastError;
  for(const host of hosts){
   try{
    const url=yahooUrl(normalized,{interval:"1d",range:"2y"});url.hostname=host;
    const body=await fetchWithTimeout(url,{headers:{Accept:"application/json","User-Agent":"Pundi-market-data/3.2"}});
    const result=body?.chart?.result?.[0],timestamps=result?.timestamp||[],closes=result?.indicators?.quote?.[0]?.close||[];
    const bars=timestamps.map((stamp,index)=>({date:new Date(Number(stamp)*1000).toISOString().slice(0,10),close:Number(closes[index])})).filter(row=>validPrice(row.close));
    if(!bars.length)throw error("Benchmark provider returned no history.",{code:"provider_payload_empty",status:502,state:"OFFLINE",retryable:true,provider:"yahoo"});
    return {ok:true,type:"benchmark",symbol:normalized,provider:"yahoo",bars};
   }catch(cause){lastError=cause;}
  }
  throw lastError||error("Benchmark history is temporarily unavailable.",{code:"benchmark_unavailable",status:503,state:"OFFLINE",retryable:true});
}

async function quoteFx({ ignoreCache = false } = {}) {
  const key = "fx:USD/IDR";
  const cached = await readCache(key);
  if (!ignoreCache && cached && cached.expiresAt > Date.now()) return withCache(cached.payload, "hit", cached);
  let primaryError;
  try { return await cacheQuote(key, await yahooFx(), cacheTtlFor("FX")); } catch (cause) { primaryError = cause; }
  try { return await cacheQuote(key, await fallbackFx(), cacheTtlFor("FX")); } catch {}
  const stale = cached || await readCache(key, { allowExpired: true });
  if (stale) return withCache({ ...stale.payload, status: "STALE", state: "STALE", errorClass: primaryError?.code || "fx_provider_unavailable", retryable: true }, "stale", stale);
  throw error("USD/IDR conversion is temporarily unavailable.", { code: primaryError?.code || "fx_provider_unavailable", status: 503, state: "OFFLINE", retryable: true });
}

async function indodaxDirect(base) {
  const pair = `${base.toLowerCase()}idr`;
  try {
    const body = await fetchWithTimeout(`https://indodax.com/api/ticker/${pair}`, { headers: { Accept: "application/json", "User-Agent": "Pundi-market-data/3.2" } });
    const ticker = body?.ticker || {};
    const price = Number(ticker.last);
    if (!validPrice(price)) throw error("Indodax returned no direct-IDR price.", { code: "provider_symbol_unavailable", status: 422, state: "OFFLINE", retryable: false, provider: "indodax" });
    const stamp = Number(ticker.server_time || 0);
    return { pair: `${base}/IDR`, providerSymbol: `${base}IDR`, provider: "indodax", sourceQuote: "IDR", price, quoteTimestamp: stamp > 0 ? iso(stamp * 1000) : iso(now()) };
  } catch (cause) {
    if (cause instanceof MarketError) throw cause;
    throw error("Indodax direct-IDR request failed.", { code: "provider_network_error", status: 502, state: "OFFLINE", retryable: true, provider: "indodax" });
  }
}

async function binanceTicker(base, quote) {
  const providerSymbol = `${base}${quote}`;
  const body = await fetchWithTimeout(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(providerSymbol)}`, { headers: { Accept: "application/json", "User-Agent": "Pundi-market-data/3.2" } });
  const price = Number(body?.lastPrice);
  if (!validPrice(price)) throw error("Binance returned no valid price.", { code: "provider_symbol_unavailable", status: 422, state: "OFFLINE", retryable: false, provider: "binance" });
  return { providerSymbol, sourceQuote: quote, price, quoteTimestamp: iso(Number(body?.closeTime || Date.now())), changePercent24h: Number(body?.priceChangePercent), high: Number(body?.highPrice), low: Number(body?.lowPrice), volume: Number(body?.volume) };
}

async function quoteCrypto(input, { ignoreCache = false } = {}) {
  const parsed = parseCryptoInput(input.symbol || input.ticker || input.base || input, input.quote || input.requestedQuote || "USD");
  const key = `crypto:${parsed.base}:${parsed.requestedQuote}`;
  const cached = await readCache(key);
  if (!ignoreCache && cached && cached.expiresAt > Date.now()) return withCache(cached.payload, "hit", cached);
  let directError;
  if (parsed.requestedQuote === "IDR") {
    try {
      const direct = await indodaxDirect(parsed.base);
      const quote = { ok: true, type: "quote", ticker: parsed.base, market: "CRYPTO", normalizedSymbol: direct.providerSymbol, providerSymbol: direct.providerSymbol, provider: direct.provider, currency: "IDR", requestedQuote: "IDR", sourceQuote: "IDR", quoteMode: "direct-idr", price: direct.price, sourcePrice: direct.price, status: "LIVE", state: "LIVE", quoteTimestamp: direct.quoteTimestamp, asOf: direct.quoteTimestamp, changePercent24h: null, errorClass: null, retryable: false };
      return await cacheQuote(key, quote, cacheTtlFor("CRYPTO"));
    } catch (cause) { directError = cause; }
  }
  const requested = parsed.requestedQuote;
  const order = requested === "USDT" ? ["USDT", "USDC", "USD", "FDUSD"] : requested === "USD" ? ["USD", "USDT", "USDC", "FDUSD"] : ["USDT", "USDC", "USD", "FDUSD"];
  let route;
  let routeError;
  for (const quoteCurrency of order) {
    try { route = await binanceTicker(parsed.base, quoteCurrency); break; } catch (cause) { routeError = cause; }
  }
  if (route) {
    let price = route.price;
    let status = route.sourceQuote === requested ? "LIVE" : "FALLBACK";
    let quoteMode = route.sourceQuote === requested ? "native" : "normalized-usd";
    let fx = null;
    if (requested === "IDR") {
      try {
        fx = await quoteFx({ ignoreCache: false });
        price = route.price * Number(fx.rate);
      } catch (cause) {
        const staleAfterFxFailure = cached || await readCache(key, { allowExpired: true });
        if (staleAfterFxFailure) return withCache({ ...staleAfterFxFailure.payload, status: "STALE", state: "STALE", errorClass: cause?.code || "fx_provider_unavailable", retryable: true }, "stale", staleAfterFxFailure);
        throw error("Crypto IDR conversion is temporarily unavailable; saved holding data was retained.", { code: cause?.code || "fx_provider_unavailable", status: 503, state: "OFFLINE", retryable: true, provider: cause?.provider || "fx" });
      }
      status = "FALLBACK";
      quoteMode = "fx-fallback";
    } else if (requested === "USD" && route.sourceQuote !== "USD") {
      quoteMode = "stablecoin-normalized";
      status = "FALLBACK";
    }
    const quote = { ok: true, type: "quote", ticker: parsed.base, market: "CRYPTO", normalizedSymbol: route.providerSymbol, providerSymbol: route.providerSymbol, provider: "binance", currency: requested, requestedQuote: requested, sourceQuote: route.sourceQuote, quoteMode, price, sourcePrice: route.price, status, state: status, quoteTimestamp: route.quoteTimestamp, asOf: route.quoteTimestamp, changePercent24h: route.changePercent24h, high: route.high, low: route.low, volume: route.volume, fx: fx ? { pair: "USD/IDR", rate: fx.rate, provider: fx.provider, quoteTimestamp: fx.quoteTimestamp } : null, errorClass: null, retryable: false, fallbackFrom: requested === "IDR" ? (directError?.provider || "indodax") : null };
    return await cacheQuote(key, quote, cacheTtlFor("CRYPTO"));
  }
  const stale = cached || await readCache(key, { allowExpired: true });
  if (stale) return withCache({ ...stale.payload, status: "STALE", state: "STALE", errorClass: directError?.code || routeError?.code || "crypto_provider_unavailable", retryable: true }, "stale", stale);
  throw error("Crypto market data is temporarily unavailable; saved holding data was retained.", { code: directError?.code || routeError?.code || "crypto_provider_unavailable", status: 503, state: "OFFLINE", retryable: true });
}

function cacheServiceHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return key ? { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } : null;
}

async function readCache(key, { allowExpired = true } = {}) {
  const inMemory = MEMORY_CACHE.get(key);
  if (inMemory && (allowExpired || inMemory.expiresAt > Date.now())) return inMemory;
  const headers = cacheServiceHeaders();
  const base = env("SUPABASE_URL");
  if (!headers || !base) return inMemory || null;
  try {
    const url = new URL(`${base}/rest/v1/market_data_cache`);
    url.searchParams.set("select", "cache_key,payload,expires_at,updated_at");
    url.searchParams.set("cache_key", `eq.${key}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers });
    if (!response.ok) return inMemory || null;
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.payload) return inMemory || null;
    const record = { payload: row.payload, expiresAt: new Date(row.expires_at).getTime(), cachedAt: new Date(row.updated_at || row.expires_at).getTime() };
    MEMORY_CACHE.set(key, record);
    if (!allowExpired && record.expiresAt <= Date.now()) return null;
    return record;
  } catch { return inMemory || null; }
}

async function writeDurableCache(key, payload, ttlMs) {
  const headers = cacheServiceHeaders();
  const base = env("SUPABASE_URL");
  if (!headers || !base) return;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const body = { cache_key: key, payload, provider: String(payload.provider || "market-provider"), normalized_symbol: String(payload.normalizedSymbol || payload.pair || key).slice(0, 64), currency: String(payload.currency || "USD"), quote_status: String(payload.status || "STALE"), quote_as_of: iso(payload.quoteTimestamp || now()), expires_at: expiresAt, updated_at: new Date().toISOString() };
  try {
    await fetch(`${base}/rest/v1/market_data_cache`, { method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
  } catch {}
}

async function cacheQuote(key, payload, ttlMs) {
  const record = { payload, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() };
  MEMORY_CACHE.set(key, record);
  await writeDurableCache(key, payload, ttlMs);
  return withCache(payload, "miss", record);
}

function withCache(payload, cache, record) {
  return { ...payload, cache, cacheAgeMs: record?.cachedAt ? Math.max(0, Date.now() - record.cachedAt) : 0 };
}

function authToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length <= 7) throw error("Authentication required.", { code: "unauthorized", status: 401, state: "OFFLINE", retryable: false });
  return header.slice(7).trim();
}

async function requireUser(request) {
  const token = authToken(request);
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!base || !anon) throw error("Market service authentication is not configured.", { code: "auth_not_configured", status: 503, state: "OFFLINE", retryable: true });
  try {
    const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.id) throw new Error("unauthorized");
    return { id: body.id, token, anon, base };
  } catch (cause) {
    if (cause instanceof MarketError) throw cause;
    throw error("Authentication required.", { code: "unauthorized", status: 401, state: "OFFLINE", retryable: false });
  }
}

function restHeaders(auth) { return { apikey: auth.anon, Authorization: `Bearer ${auth.token}`, Accept: "application/json" }; }
function validateId(value) { const id = String(value || "").trim(); if (!/^[0-9a-f-]{36}$/i.test(id)) throw error("Invalid holding id.", { code: "invalid_request", status: 400, state: "OFFLINE", retryable: false }); return id; }

async function loadHolding(auth, holdingId) {
  const id = validateId(holdingId);
  const url = new URL(`${auth.base}/rest/v1/stock_holdings`);
  url.searchParams.set("select", "id,display_symbol,market,provider,provider_symbol,currency,asset_type");
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: restHeaders(auth) });
  const rows = await response.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!response.ok || !row) throw error("Holding not found or not allowed.", { code: "not_found", status: 404, state: "OFFLINE", retryable: false });
  return row;
}

async function loadHoldings(auth, holdingIds) {
  const ids = holdingIds.map(validateId);
  if (!ids.length || ids.length > MAX_BATCH) throw error("Batch size is outside the supported range.", { code: "invalid_batch", status: 400, state: "OFFLINE", retryable: false });
  const url = new URL(`${auth.base}/rest/v1/stock_holdings`);
  url.searchParams.set("select", "id,display_symbol,market,provider,provider_symbol,currency,asset_type");
  url.searchParams.set("id", `in.(${ids.join(",")})`);
  const response = await fetch(url, { headers: restHeaders(auth) });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows)) throw error("Unable to load holdings for market data.", { code: "holdings_unavailable", status: 502, state: "OFFLINE", retryable: true });
  return new Map(rows.map(row => [row.id, row]));
}

function mapHolding(row) { return { displaySymbol: row.display_symbol, market: row.market, providerSymbol: row.provider_symbol, currency: row.currency }; }

function publicError(cause) {
  const known = cause instanceof MarketError ? cause : error("Market data is temporarily unavailable.");
  const message = ["invalid_symbol", "unsupported_market", "invalid_currency", "not_found", "invalid_request", "invalid_batch"].includes(known.code) ? known.message : known.state === "STALE" ? "The last valid market quote is shown as stale." : known.status === 401 ? "Authentication required." : "Market data is temporarily unavailable.";
  return { ok: false, error: message, code: known.code, state: known.state || "OFFLINE", errorClass: known.code, retryable: Boolean(known.retryable) };
}

async function safeHealthCase(name, fn) {
  try {
    const quote = await fn();
    return { name, status: ["LIVE", "DELAYED", "FALLBACK"].includes(quote.status || quote.state) ? "PASS" : "DEGRADED", state: quote.status || quote.state, provider: quote.provider, normalizedSymbol: quote.normalizedSymbol, quoteTimestamp: quote.quoteTimestamp, priceValid: validPrice(quote.price ?? quote.rate) };
  } catch (cause) {
    const details = publicError(cause);
    return { name, status: "FAIL", state: details.state, errorClass: details.errorClass, priceValid: false };
  }
}

export function marketStatus(market, asOf = Date.now()) {
  const normalized = String(market || "").toUpperCase();
  if (normalized === "CRYPTO") return { market: normalized, session: "continuous", asOf: iso(asOf) };
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(asOf));
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(asOf)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { market: normalized, session: ["Sat", "Sun"].includes(weekday) ? "closed" : minutes >= 570 && minutes < 960 ? "open" : "closed", asOf: iso(asOf) };
}

export async function providerHealth() {
  const checks = await Promise.all([
    safeHealthCase("IDX_BMRI", () => quoteEquity({ displaySymbol: "BMRI", providerSymbol: "BMRI", market: "IDX", currency: "IDR" }, { ignoreCache: true })),
    safeHealthCase("US_MU", () => quoteEquity({ displaySymbol: "MU", providerSymbol: "MU", market: "NASDAQ", currency: "USD" }, { ignoreCache: true })),
    safeHealthCase("CRYPTO_BTC_IDR_DIRECT", () => quoteCrypto({ symbol: "BTC", quote: "IDR" }, { ignoreCache: true })),
    safeHealthCase("CRYPTO_QTUM_IDR_FALLBACK", () => quoteCrypto({ symbol: "QTUM", quote: "IDR" }, { ignoreCache: true })),
    safeHealthCase("FX_USD_IDR", () => quoteFx({ ignoreCache: true }))
  ]);
  return { ok: true, service: "pundi-market-data", version: VERSION, generatedAt: iso(now()), checks, overall: checks.every(check => check.status === "PASS") ? "PASS" : "DEGRADED" };
}

async function handle(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (!["GET", "POST"].includes(request.method)) return json(request, { ok: false, error: "Method not allowed.", code: "method_not_allowed", state: "OFFLINE", retryable: false }, 405, { allow: "GET, POST, OPTIONS" });
  const url = new URL(request.url);
  let body = {};
  if (request.method === "POST") { try { body = await request.json(); } catch { return json(request, { ok: false, error: "Malformed request.", code: "invalid_request", state: "OFFLINE", retryable: false }, 400); } }
  const get = (name, fallback = "") => body?.[name] ?? url.searchParams.get(name) ?? fallback;
  const action = String(get("action", get("type", "health"))).trim();
  if (["health", "providerHealth", "marketStatus"].includes(action)) {
    if (action === "marketStatus") return json(request, { ok: true, ...marketStatus(get("market"), get("asOf", Date.now())) });
    checkRateLimit(`public-health:${requestOriginKey(request)}`, 6, 60_000);
    return json(request, await providerHealth());
  }
  try {
    const user = await requireUser(request);
    checkRateLimit(`${user.id}:${action}`, action.startsWith("batch") ? 20 : 60);
    if (action === "fx") return json(request, await quoteFx({ ignoreCache: String(get("refresh")) === "1" }));
    if (action === "benchmarkHistory") {
      return json(request, await yahooHistory(get("symbol", "SPY")));
    }
    if (action === "quote" || action === "validateHolding") {
      const holding = await loadHolding(user, get("holdingId"));
      const quote = await quoteEquity(mapHolding(holding), { ignoreCache: String(get("refresh")) === "1" });
      if (action === "validateHolding") return json(request, { ok: true, valid: true, mapping: mapHolding(holding), quote });
      return json(request, { ...quote, holdingId: holding.id });
    }
    if (action === "batchQuotes") {
      const requestedIds = Array.isArray(body.holdingIds) ? body.holdingIds : Array.isArray(body.holdings) ? body.holdings.map(item => item.holdingId || item.id) : [];
      const holdings = await loadHoldings(user, requestedIds);
      const quotes = await mapWithConcurrency(requestedIds, PROVIDER_CONCURRENCY, async holdingId => {
        try {
          const holding = holdings.get(String(holdingId));
          if (!holding) throw error("Holding not found or not allowed.", { code: "not_found", status: 404, state: "OFFLINE", retryable: false });
          return { ...(await quoteEquity(mapHolding(holding))), holdingId: holding.id };
        } catch (cause) { return { holdingId: String(holdingId), ...publicError(cause) }; }
      });
      return json(request, { ok: true, type: "batchQuotes", quotes });
    }
    if (action === "cryptoQuote") return json(request, await quoteCrypto({ symbol: get("symbol", get("ticker")), quote: get("quote", "USD") }, { ignoreCache: String(get("refresh")) === "1" }));
    if (action === "batchCryptoQuotes") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > MAX_BATCH) throw error("Batch size is outside the supported range.", { code: "invalid_batch", status: 400, state: "OFFLINE", retryable: false });
      const quotes = await mapWithConcurrency(items, PROVIDER_CONCURRENCY, async item => { try { return { id: item.id, ...(await quoteCrypto({ symbol: item.symbol || item.ticker, quote: item.quote || "USD" })) }; } catch (cause) { return { id: item.id, ...publicError(cause) }; } });
      return json(request, { ok: true, type: "batchCryptoQuotes", quotes });
    }
    if (action === "tradingQuote") {
      const market = String(get("market", "NASDAQ")).toUpperCase();
      if (market === "CRYPTO") return json(request, await quoteCrypto({ symbol: get("symbol"), quote: get("quote", "USD") }));
      return json(request, await quoteEquity({ displaySymbol: get("symbol"), providerSymbol: get("providerSymbol", get("symbol")), market, currency: get("currency", "USD") }, { ignoreCache: String(get("refresh")) === "1" }));
    }
    throw error("Unsupported market-data action.", { code: "invalid_action", status: 400, state: "OFFLINE", retryable: false });
  } catch (cause) {
    const details = publicError(cause);
    return json(request, details, Number(cause?.status) || 502);
  }
}

export function resetMarketDataTestState() {
  MEMORY_CACHE.clear();
  RATE_BUCKETS.clear();
}

export { handle as handleRequest, quoteEquity, quoteCrypto, quoteFx, parseCryptoInput, normalizeEquityMapping };

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve(handle);
