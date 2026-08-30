import { getCachedQuote, setCachedQuote } from "../_lib/cache.js";
import { resolveAuthorizedHolding, resolveAuthorizedUser } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchQuote, fetchUsdIdrQuote, validateMapping } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    if (String(request.query?.__route || "") === "fx") {
      const { user } = await resolveAuthorizedUser(request);
      enforceRateLimit(`fx:${user.id}`, 20);
      const forceRefresh = String(request.query?.refresh || "") === "1";
      const cached = forceRefresh ? null : getCachedQuote("fx:USD-IDR");
      const quote = cached || setCachedQuote("fx:USD-IDR", await fetchUsdIdrQuote());
      response.setHeader("Cache-Control", forceRefresh ? "private, no-store" : "private, max-age=60");
      return response.status(200).json({ ...quote, pair:"USD/IDR", cache:cached ? "hit" : "miss" });
    }
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
