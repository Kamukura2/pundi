import { getCachedQuote, setCachedQuote } from "../_lib/cache.js";
import { resolveAuthorizedUser } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchUsdIdrQuote } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    const { user } = await resolveAuthorizedUser(request);
    enforceRateLimit(`fx:${user.id}`, 20);
    const cached = getCachedQuote("fx:USD-IDR");
    const quote = cached || setCachedQuote("fx:USD-IDR", await fetchUsdIdrQuote());
    response.setHeader("Cache-Control", "private, max-age=60");
    return response.status(200).json({ ...quote, pair:"USD/IDR", cache:cached ? "hit" : "miss" });
  } catch (error) {
    return apiError(response, error);
  }
}
