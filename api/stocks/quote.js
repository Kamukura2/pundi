import { getCachedQuote, setCachedQuote } from "../_lib/cache.js";
import { resolveAuthorizedHolding } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchQuote, validateMapping } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    const holding = await resolveAuthorizedHolding(request, String(request.query.holdingId || ""));
    enforceRateLimit(`quote:${holding.user_id}`, 30);
    validateMapping(holding);
    const key = `${holding.provider}:${holding.provider_symbol}:${holding.market}`;
    const cached = getCachedQuote(key);
    const quote = cached || setCachedQuote(key, await fetchQuote(holding));
    response.setHeader("Cache-Control", "private, max-age=60");
    return response.status(200).json({ ...quote, displaySymbol:holding.display_symbol, currency:holding.currency, cache:cached ? "hit" : "miss" });
  } catch (error) {
    return apiError(response, error);
  }
}
