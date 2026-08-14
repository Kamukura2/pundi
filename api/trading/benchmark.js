import { getCachedQuote, setCachedQuote } from "../_lib/cache.js";
import { resolveAuthorizedUser } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchSpyDailyHistory } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    const { user } = await resolveAuthorizedUser(request);
    enforceRateLimit(`trading-benchmark:${user.id}`, 10);
    const cached=getCachedQuote("benchmark:SPY:2y");
    const history=cached||setCachedQuote("benchmark:SPY:2y",await fetchSpyDailyHistory());
    response.setHeader("Cache-Control","private, max-age=300");
    return response.status(200).json({...history,cache:cached?"hit":"miss"});
  } catch(error){return apiError(response,error);}
}
