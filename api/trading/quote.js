import { getCachedQuote, setCachedQuote } from "../_lib/cache.js";
import { resolveAuthorizedUser } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchTradingQuote } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    const { user } = await resolveAuthorizedUser(request);
    enforceRateLimit(`trading-quote:${user.id}`, 60);
    const symbol = String(request.query?.symbol || "").trim().toUpperCase();
    if (!/^[A-Z0-9.:-]{1,24}$/.test(symbol)) throw Object.assign(new Error("Invalid trading symbol."), {code:"invalid_symbol",status:400});
    const key = `trading:${symbol}`;
    const force = String(request.query?.refresh || "") === "1";
    const cached = force ? null : getCachedQuote(key, 115000);
    const quote = cached || setCachedQuote(key, await fetchTradingQuote(symbol));
    response.setHeader("Cache-Control", "private, max-age=30");
    return response.status(200).json({...quote,symbol,cache:cached?"hit":"miss"});
  } catch (error) {
    return apiError(response, error);
  }
}
