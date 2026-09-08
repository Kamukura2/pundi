import assert from "node:assert/strict";
import handler from "../../api/stocks/quote.js";

const originalFetch = globalThis.fetch;
const now = Math.floor(Date.now() / 1000);
let upstreamCalls = 0;
let upstreamRate = 16000;
globalThis.fetch = async () => {
  upstreamCalls += 1;
  return {
    ok:true,
    status:200,
    async json() {
      return { chart:{ result:[{ meta:{ regularMarketPrice: upstreamRate, regularMarketTime:now } }] } };
    }
  };
};

globalThis.__cvfinanceQuoteCache?.delete("public-fx:USD-IDR");

globalThis.__cvfinanceRateBuckets?.clear();
function responseCapture() {
  const state = { status:0, headers:{}, body:null };
  const response = {
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.status = code; return response; },
    json(body) { state.body = body; return body; },
    end() { return undefined; }
  };
  return { response, state };
}
async function call(request) {
  const { response, state } = responseCapture();
  request.query = { __route:"public_fx", ...(request.query || {}) };
  await handler(request, response);
  return state;
}

const first = await call({ method:"GET", headers:{ "x-forwarded-for":"198.51.100.10" }, query:{} });
assert.equal(first.status, 200);
assert.deepEqual(first.body.pair, "USD/IDR");
assert.equal(first.body.rate, 16000);
assert.match(first.body.asOf, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(first.body.cache, "miss");
assert.match(first.headers["Cache-Control"], /public/);
assert.equal(upstreamCalls, 1);
assert.equal(first.body.authorization, undefined);

const second = await call({ method:"GET", headers:{ "x-forwarded-for":"198.51.100.10" }, query:{} });
assert.equal(second.status, 200);
assert.equal(second.body.cache, "hit");
assert.equal(upstreamCalls, 1, "server cache prevents repeated upstream fetches");

const queryEscape = await call({ method:"GET", headers:{}, query:{ symbol:"AAPL" } });
assert.equal(queryEscape.status, 400);
assert.equal(queryEscape.body.code, "invalid_request");

const post = await call({ method:"POST", headers:{}, query:{} });
assert.equal(post.status, 405);

globalThis.__cvfinanceQuoteCache?.delete("public-fx:USD-IDR");
upstreamRate = -10;
const invalidQuote = await call({ method:"GET", headers:{ "x-forwarded-for":"198.51.100.12" }, query:{} });
assert.equal(invalidQuote.status, 502);
assert.equal(invalidQuote.body.code, "yahoo_fx_unavailable");
upstreamRate = 16000;

const rateLimitIp = "198.51.100.11";
let last;
for (let index = 0; index < 31; index += 1) {
  last = await call({ method:"GET", headers:{ "x-forwarded-for":rateLimitIp }, query:{} });
}
assert.equal(last.status, 429);
assert.equal(last.body.code, "rate_limited");

globalThis.fetch = originalFetch;
console.log(JSON.stringify({
  pass:true,
  anonymousGet:first.status,
  pair:first.body.pair,
  cacheHit:second.body.cache,
  upstreamCalls,
  queryEscape:queryEscape.status,
  post:post.status,
  rateLimit:last.status,
  authRequired:false
}, null, 2));
