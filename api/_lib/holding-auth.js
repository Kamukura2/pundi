import { createClient } from "@supabase/supabase-js";

export async function resolveAuthorizedHolding(request, holdingId) {
  if (!/^[0-9a-f-]{36}$/i.test(holdingId || "")) throw Object.assign(new Error("Invalid holding id."), { code:"invalid_request", status:400 });
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { code:"unauthorized", status:401 });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global:{ headers:{ Authorization:authorization } }, auth:{ persistSession:false, autoRefreshToken:false }
  });
  const { data, error } = await supabase.from("stock_holdings").select("id,user_id,display_symbol,market,provider,provider_symbol,currency").eq("id", holdingId).single();
  if (error || !data) throw Object.assign(new Error("Holding not found or not allowed."), { code:"not_found", status:404 });
  return data;
}
