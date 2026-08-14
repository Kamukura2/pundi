import { resolveAuthorizedHolding } from "../_lib/holding-auth.js";
import { fetchDividendEvents } from "../_lib/dividends.js";
import { apiError, method } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

export default async function handler(request,response){
  if(!method(request,response))return;
  try{
    const holding=await resolveAuthorizedHolding(request,String(request.query.holdingId||""));
    enforceRateLimit(`dividends:${holding.user_id}`,12);
    const result=await fetchDividendEvents(holding);
    response.setHeader("Cache-Control","private, max-age=900");
    return response.status(200).json({...result,holdingId:holding.id,ticker:holding.display_symbol});
  }catch(error){return apiError(response,error);}
}
