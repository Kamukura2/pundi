import { getCachedQuote, setCachedQuote } from "./cache.js";
import { apiError, method } from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import { fetchUsdIdrQuote } from "./providers.js";

const PAIR = "USD/IDR";
const CACHE_KEY = "public-fx:USD-IDR";

function clientKey(request) {
  const forwarded = String(request.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(request.headers?.["x-real-ip"] || "").trim() || "anonymous";
}

export function validPublicQuote(quote) {
  const timestamp = Date.parse(quote?.asOf || "");
  const rate = Number(quote?.rate);
  return Number.isFinite(rate) && rate >= 10000 && rate <= 25000 && Number.isFinite(timestamp) && timestamp <= Date.now() + 300000 && Date.now() - timestamp <= 7 * 86400000;
}

export async function handlePublicFx(request, response) {
  if (!method(request, response, ["GET"])) return;
  try {
    const queryKeys = Object.keys(request.query || {}).filter(key => !["", "__route"].includes(key));
    if (queryKeys.length > 0) {
      throw Object.assign(new Error("This endpoint only serves USD/IDR."), { code:"invalid_request", status:400 });
    }
    enforceRateLimit(`public-fx:${clientKey(request)}`, 30);
    const cached = getCachedQuote(CACHE_KEY);
    let quote = cached;
    if (!quote) {
      const fresh = await fetchUsdIdrQuote();
      if (!validPublicQuote(fresh)) {
        throw Object.assign(new Error("USD/IDR display quote unavailable."), { code:"quote_unavailable", status:503 });
      }
      quote = setCachedQuote(CACHE_KEY, fresh);
    }
    if (!validPublicQuote(quote)) {
      throw Object.assign(new Error("USD/IDR display quote unavailable."), { code:"quote_unavailable", status:503 });
    }
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    return response.status(200).json({
      pair:PAIR,
      rate:Number(quote.rate),
      asOf:quote.asOf,
      status:quote.status || "market quote",
      cache:cached ? "hit" : "miss"
    });
  } catch (error) {
    return apiError(response, error);
  }
}
