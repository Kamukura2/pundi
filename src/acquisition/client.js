const SOURCES = new Set(["google","reddit","facebook","linkedin","whatsapp","friend","community","organic","direct","other"]);
export function acquisitionSource() {
  let value="direct";
  try { value = new URLSearchParams(location.search).get("ref") || sessionStorage.getItem("pundi-acquisition-source") || "direct"; } catch {}
  value=String(value).trim().toLowerCase();
  return SOURCES.has(value) ? value : "other";
}
export async function persistSignupAttribution(user) {
  if (!user?.id) return;
  let landingPath="/"; try { landingPath=sessionStorage.getItem("pundi-acquisition-path") || "/"; } catch {}
  const { getSupabase } = await import("../lib/supabase.js");
  const supabase=await getSupabase(); const { data:{ session } }=await supabase.auth.getSession();
  if (!session?.access_token) return;
  await fetch("/api/acquisition",{method:"POST",cache:"no-store",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"signup_attribution",source:acquisitionSource(),landing_path:landingPath})});
}
