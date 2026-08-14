import { createClient } from "@supabase/supabase-js";
import { fetchQuote, validateMapping } from "../_lib/providers.js";
import { fetchDividendEvents } from "../_lib/dividends.js";

const isoDay = value => String(value || "").slice(0, 10);

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error:"Method not allowed." });
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error:"Unauthorized." });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(501).json({ error:"Scheduled refresh is not configured." });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
  const { data:holdings, error } = await supabase.from("stock_holdings").select("id,user_id,display_symbol,market,provider,provider_symbol,currency,quantity");
  if (error) return response.status(500).json({ error:error.message });
  const results = [];
  for (const holding of holdings || []) {
    const result = { id:holding.id, quote:false, dividends:0 };
    try {
      validateMapping(holding);
      const quote = await fetchQuote(holding);
      const { error:updateError } = await supabase.from("stock_holdings").update({current_price:quote.price,price_source:quote.provider,price_status:quote.status,price_as_of:quote.asOf,last_price_fetch_at:new Date().toISOString()}).eq("id", holding.id);
      if (updateError) throw updateError;
      result.quote = true;
    } catch (quoteError) {
      result.quoteError = quoteError.code || "quote_failed";
    }
    try {
      const corporateActions = await fetchDividendEvents(holding),today = new Date().toISOString().slice(0,10);
      const rows = (corporateActions.events || []).map(event => {
        const entitlementDate=isoDay(event.recordDate||event.exDate),pastEntitlement=Boolean(entitlementDate&&entitlementDate<today);
        return {user_id:holding.user_id,holding_id:holding.id,event_key:event.eventKey,ticker:holding.display_symbol,dividend_type:event.type||"regular",currency:event.currency||holding.currency,amount_per_share:Number(event.amountPerShare||0),eligible_shares:Number(holding.quantity||0),announcement_date:isoDay(event.announcementDate)||null,ex_date:isoDay(event.exDate)||null,record_date:isoDay(event.recordDate)||null,payment_date:isoDay(event.paymentDate)||null,dividend_status:event.status||"confirmed",eligibility_status:pastEntitlement?"review":"pending",source_provider:event.sourceProvider||"provider",source_url:event.sourceUrl||"",is_manual:false,fx_rate:0};
      }).filter(row=>row.event_key&&row.amount_per_share>0);
      if(rows.length){
        const { data:inserted,error:dividendError }=await supabase.from("investment_dividends").upsert(rows,{onConflict:"user_id,holding_id,event_key",ignoreDuplicates:true}).select("id");
        if(dividendError)throw dividendError;
        result.dividends=inserted?.length||0;
      }
    } catch(dividendError){result.dividendError=dividendError.code||"dividend_refresh_failed";}
    result.ok=result.quote||!result.quoteError;results.push(result);
  }
  return response.status(200).json({ refreshed:results.filter(item => item.quote).length, dividendsAdded:results.reduce((sum,item)=>sum+item.dividends,0), failed:results.filter(item => !item.quote).length, results });
}
