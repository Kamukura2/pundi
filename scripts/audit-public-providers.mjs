const timeout = async (url, ms = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Pundi-market-audit/1.0" } });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    return { ok: false, error: error.name === "AbortError" ? "timeout" : error.message };
  } finally {
    clearTimeout(timer);
  }
};

const yahoo = async (symbol) => {
  const result = await timeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`);
  const chart = result.body?.chart?.result?.[0];
  const meta = chart?.meta || {};
  const closes = chart?.indicators?.quote?.[0]?.close || [];
  const timestamps = chart?.timestamp || [];
  let price = Number(meta.regularMarketPrice);
  let stamp = Number(meta.regularMarketTime || 0);
  if (!(price > 0)) {
    for (let index = closes.length - 1; index >= 0; index -= 1) {
      if (Number(closes[index]) > 0) { price = Number(closes[index]); stamp = Number(timestamps[index] || 0); break; }
    }
  }
  return { provider: "yahoo-chart", symbol, httpStatus: result.status, price: price > 0 ? price : null, asOf: stamp ? new Date(stamp * 1000).toISOString() : null, error: result.body?.chart?.error?.description || (price > 0 ? null : result.error || "no_price") };
};

const indodax = async (pair) => {
  const result = await timeout(`https://indodax.com/api/ticker/${pair.toLowerCase()}`);
  const ticker = result.body?.ticker || {};
  const price = Number(ticker.last);
  const stamp = Number(ticker.server_time || 0);
  return { provider: "indodax", pair, httpStatus: result.status, price: price > 0 ? price : null, asOf: stamp ? new Date(stamp * 1000).toISOString() : null, error: price > 0 ? null : result.error || "no_price" };
};

const binance = async (symbol) => {
  const result = await timeout(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`);
  const price = Number(result.body?.lastPrice);
  const stamp = Number(result.body?.closeTime || 0);
  return { provider: "binance", symbol, httpStatus: result.status, price: price > 0 ? price : null, asOf: stamp ? new Date(stamp).toISOString() : null, error: price > 0 ? null : result.error || result.body?.msg || "no_price" };
};

const fx = async () => {
  const result = await timeout("https://open.er-api.com/v6/latest/USD");
  const price = Number(result.body?.rates?.IDR);
  return { provider: "open-er-api", pair: "USD/IDR", httpStatus: result.status, price: price > 0 ? price : null, asOf: result.body?.time_last_update_utc || null, error: price > 0 ? null : result.error || result.body?.error || "no_rate" };
};

const results = await Promise.all([yahoo("BMRI.JK"), yahoo("MU"), indodax("btcidr"), indodax("ethidr"), binance("BTCUSDT"), binance("ETHUSDT"), fx()]);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
