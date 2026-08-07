import { resolveAuthorizedHolding } from "../_lib/holding-auth.js";
import { apiError, method } from "../_lib/http.js";
import { fetchQuote, validateMapping } from "../_lib/providers.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request, response) {
  if (!method(request, response)) return;
  try {
    const holding = await resolveAuthorizedHolding(request, String(request.query.holdingId || ""));
    enforceRateLimit(`validate:${holding.user_id}`, 12);
    validateMapping(holding);
    const quote = await fetchQuote(holding);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ valid:true, mapping:{displaySymbol:holding.display_symbol,market:holding.market,provider:holding.provider,providerSymbol:holding.provider_symbol,currency:holding.currency}, quote });
  } catch (error) {
    return apiError(response, error);
  }
}
