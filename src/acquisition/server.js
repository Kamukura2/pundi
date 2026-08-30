import { createClient } from "@supabase/supabase-js";

export const ACQUISITION_SOURCES = ["google","reddit","facebook","linkedin","whatsapp","friend","community","organic","direct","other"];
const CTA_NAMES = new Set(["homepage","catatan-keuangan","pencatat-pengeluaran","budgeting","aset-investasi","net-worth","trading-journal","backup-keuangan","kalkulator-net-worth"]);
const reply = (res,status,body) => res.status(status).json(body);
const normalizeSource = value => { const source=String(value||"").trim().toLowerCase(); return ACQUISITION_SOURCES.includes(source)?source:"other"; };
const safePath = value => { const path=String(value||"/").trim(); return path.startsWith("/")&&!path.includes("\\")?path.slice(0,200):"/"; };
function db(){ if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error("Acquisition service is not configured."),{status:503,code:"not_configured"}); return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}); }
async function identity(request){ const header=String(request.headers?.authorization||""); if(!header.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."),{status:401,code:"unauthorized"}); if(!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY) throw Object.assign(new Error("Authentication service is not configured."),{status:503,code:"not_configured"}); const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}); const {data:{user},error}=await auth.auth.getUser(header.slice(7)); if(error||!user) throw Object.assign(new Error("Authentication required."),{status:401,code:"unauthorized"}); return user; }
export async function acquisitionHandler(request,response){
  response.setHeader("Cache-Control","no-store"); response.setHeader("Content-Type","application/json; charset=utf-8");
  if(request.method!=="POST") return reply(response,405,{error:"Method not allowed.",code:"method_not_allowed"});
  try { const database=db(); let body; try{body=typeof request.body==="string"?JSON.parse(request.body||"{}"):request.body||{};}catch{return reply(response,400,{error:"Malformed JSON request.",code:"invalid_json"});}
    if(body.action==="cta_click"){ const source=normalizeSource(body.source), landing_path=safePath(body.landing_path), cta=String(body.cta||"").trim().toLowerCase().slice(0,80); if(!CTA_NAMES.has(cta)||body.event_type!=="cta_click") return reply(response,400,{error:"Invalid acquisition event.",code:"invalid_event"}); const {error}=await database.from("acquisition_events").insert({event_type:"cta_click",source,landing_path,cta}); if(error) throw Object.assign(new Error("Acquisition event unavailable."),{status:503,code:"insert_failed"}); return reply(response,201,{ok:true}); }
    if(body.action==="signup_attribution"){ const user=await identity(request), source=normalizeSource(body.source), landing_path=safePath(body.landing_path); const {error}=await database.from("user_acquisition").upsert({user_id:user.id,source,landing_path},{onConflict:"user_id",ignoreDuplicates:true}); if(error) throw Object.assign(new Error("Signup attribution unavailable."),{status:503,code:"insert_failed"}); return reply(response,201,{ok:true}); }
    return reply(response,400,{error:"Unsupported acquisition action.",code:"invalid_request"});
  }catch(error){return reply(response,Number(error.status)||500,{error:error.message||"Acquisition request failed.",code:error.code||"acquisition_failed"});}
}
