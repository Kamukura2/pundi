import { createClient } from "@supabase/supabase-js";
import { FEEDBACK_CATEGORIES, FEEDBACK_MAX_MESSAGE } from "../src/feedback/contract.js";
import { acquisitionHandler } from "../src/acquisition/server.js";

function reply(response, status, body) { return response.status(status).json(body); }
function serviceDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error("Feedback service is not configured."), { status:503, code:"not_configured" });
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
}
async function identity(request) {
  const token = String(request.headers?.authorization || "");
  if (!token.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw Object.assign(new Error("Authentication service is not configured."), { status:503, code:"not_configured" });
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:{ user }, error } = await auth.auth.getUser(token.slice(7));
  if (error || !user) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  return user;
}
function safeBody(body) {
  const category=String(body?.category || "").trim(), message=String(body?.message || "").trim();
  if (!FEEDBACK_CATEGORIES.includes(category)) throw Object.assign(new Error("Choose a valid feedback category."),{status:400,code:"invalid_category"});
  if (!message) throw Object.assign(new Error("Feedback message is required."),{status:400,code:"missing_message"});
  if (message.length>FEEDBACK_MAX_MESSAGE) throw Object.assign(new Error(`Feedback message must be ${FEEDBACK_MAX_MESSAGE} characters or fewer.`),{status:400,code:"message_too_long"});
  return { category, message, page:String(body?.page||"").slice(0,120), app_version:String(body?.app_version||"").slice(0,32), build_id:String(body?.build_id||"").slice(0,64), browser:String(body?.browser||"").slice(0,160) };
}
export default async function handler(request,response) {
  response.setHeader("Cache-Control","private, no-store"); response.setHeader("Content-Type","application/json; charset=utf-8");
  if (!["GET","POST"].includes(request.method)) return reply(response,405,{error:"Method not allowed.",code:"method_not_allowed"});
  if (request.query?.__route === "acquisition") return acquisitionHandler(request,response);
  try {
    const user=await identity(request), db=serviceDb();
    if (request.method === "GET") {
      const {data,error}=await db.from("beta_feedback").select("id,user_id,category,message,page,app_version,build_id,status,priority,admin_note,created_at,updated_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
      if(error) throw Object.assign(new Error("Feedback history unavailable."),{status:503,code:"query_failed"});
      return reply(response,200,{feedback:data||[]});
    }
    let body; try { body=typeof request.body === "string" ? JSON.parse(request.body||"{}") : request.body||{}; } catch { return reply(response,400,{error:"Malformed JSON request.",code:"invalid_json"}); }
    const input=safeBody(body);
    const {data,error}=await db.from("beta_feedback").insert({user_id:user.id,...input}).select("id,category,message,page,app_version,build_id,status,created_at").single();
    if(error) throw Object.assign(new Error("Feedback could not be sent. Please try again."),{status:503,code:"insert_failed"});
    return reply(response,201,{feedback:data});
  } catch (err) { return reply(response,Number(err.status)||500,{error:err.message||"Feedback request failed.",code:err.code||"feedback_failed"}); }
}
