import { createClient } from "@supabase/supabase-js";
import { fetchQuote, validateMapping } from "../_lib/providers.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error:"Method not allowed." });
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error:"Unauthorized." });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(501).json({ error:"Scheduled refresh is not configured." });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
  const { data:holdings, error } = await supabase.from("stock_holdings").select("id,user_id,display_symbol,market,provider,provider_symbol,currency");
  if (error) return response.status(500).json({ error:error.message });
  const results = [];
  for (const holding of holdings || []) {
    try {
      validateMapping(holding);
      const quote = await fetchQuote(holding);
      const { error:updateError } = await supabase.from("stock_holdings").update({current_price:quote.price,price_source:quote.provider,price_status:quote.status,price_as_of:quote.asOf,last_price_fetch_at:new Date().toISOString()}).eq("id", holding.id);
      if (updateError) throw updateError;
      results.push({ id:holding.id, ok:true });
    } catch (quoteError) {
      results.push({ id:holding.id, ok:false, code:quoteError.code || "quote_failed" });
    }
  }
  return response.status(200).json({ refreshed:results.filter(item => item.ok).length, failed:results.filter(item => !item.ok).length, results });
}
