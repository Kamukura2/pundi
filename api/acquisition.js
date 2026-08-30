import { createClient } from "@supabase/supabase-js";

export const ACQUISITION_SOURCES = ["google","reddit","facebook","linkedin","whatsapp","friend","community","organic","direct","other"];
const CTA_NAMES = new Set(["homepage","catatan-keuangan","pencatat-pengeluaran","budgeting","aset-investasi","net-worth","trading-journal","backup-keuangan","kalkulator-net-worth"]);
const EVENT_TYPES = new Set(["cta_click"]);
const reply = (res, status, body) => res.status(status).json(body);
const normalizeSource = value => { const source = String(value || "").trim().toLowerCase(); return ACQUISITION_SOURCES.includes(source) ? source : "other"; };
const safePath = value => { const path = String(value || "/").trim(); return path.startsWith("/") && !path.includes("\\") ? path.slice(0, 200) : "/"; };
const safeCta = value => String(value || "").trim().toLowerCase().slice(0, 80);
function db() { if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error("Acquisition service is not configured."), { status:503, code:"not_configured" }); return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } }); }
async function identity(request) {
  const header = String(request.headers?.authorization || "");
  if (!header.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw Object.assign(new Error("Authentication service is not configured."), { status:503, code:"not_configured" });
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:{ user }, error } = await auth.auth.getUser(header.slice(7));
  if (error || !user) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  return user;
}
async function aggregate(database) {
  const since24 = new Date(Date.now()-864e5).toISOString(), since7 = new Date(Date.now()-7*864e5).toISOString(), since30 = new Date(Date.now()-30*864e5).toISOString();
  const [events, users] = await Promise.all([
    database.from("acquisition_events").select("event_type,source,landing_path,cta,created_at").gte("created_at", since30).order("created_at",{ascending:false}).limit(10000),
    database.from("user_acquisition").select("source,landing_path,created_at").gte("created_at", since30).limit(10000)
  ]);
  if (events.error || users.error) throw Object.assign(new Error("Acquisition metrics unavailable."), {status:503,code:"query_failed"});
  const rows = events.data || [], signups = users.data || [];
  const count = (list, since) => list.filter(row => row.created_at >= since).length;
  const breakdown = Object.fromEntries(ACQUISITION_SOURCES.map(source => [source, signups.filter(row=>row.source===source).length]));
  const pageCounts = {}; for (const row of rows) pageCounts[row.landing_path]=(pageCounts[row.landing_path]||0)+1;
  const ctaSources = {}; for (const row of rows) { const key=`${row.cta}:${row.source}`; ctaSources[key]=(ctaSources[key]||0)+1; }
  const top = object => Object.entries(object).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}));
  return { cta_clicks:{today:count(rows,since24),days_7:count(rows,since7),days_30:rows.length}, attributable_signups:{days_7:count(signups,since7),days_30:signups.length}, signup_conversion: signups.length ? Number((signups.length/rows.length*100).toFixed(1)) : null, source_breakdown:breakdown, top_landing_pages:top(pageCounts), top_cta_sources:top(ctaSources) };
}
export default async function handler(request,response) {
  response.setHeader("Cache-Control","no-store"); response.setHeader("Content-Type","application/json; charset=utf-8");
  if (request.method !== "POST") return reply(response,405,{error:"Method not allowed.",code:"method_not_allowed"});
  try {
    const database=db();
    let body; try { body=typeof request.body === "string" ? JSON.parse(request.body||"{}") : request.body||{}; } catch { return reply(response,400,{error:"Malformed JSON request.",code:"invalid_json"}); }
    if (request.method === "POST" && body.action === "cta_click") {
      const source=normalizeSource(body.source), landing_path=safePath(body.landing_path), cta=safeCta(body.cta);
      if (!CTA_NAMES.has(cta) || body.event_type !== "cta_click") return reply(response,400,{error:"Invalid acquisition event.",code:"invalid_event"});
      const { error } = await database.from("acquisition_events").insert({event_type:"cta_click",source,landing_path,cta});
      if (error) throw Object.assign(new Error("Acquisition event unavailable."),{status:503,code:"insert_failed"});
      return reply(response,201,{ok:true});
    }
    if (request.method === "POST" && body.action === "signup_attribution") {
      const user=await identity(request), source=normalizeSource(body.source), landing_path=safePath(body.landing_path);
      const { error } = await database.from("user_acquisition").upsert({user_id:user.id,source,landing_path},{onConflict:"user_id",ignoreDuplicates:true});
      if (error) throw Object.assign(new Error("Signup attribution unavailable."),{status:503,code:"insert_failed"});
      return reply(response,201,{ok:true});
    }
    return reply(response,400,{error:"Unsupported acquisition action.",code:"invalid_request"});
  } catch (error) { return reply(response,Number(error.status)||500,{error:error.message||"Acquisition request failed.",code:error.code||"acquisition_failed"}); }
}
