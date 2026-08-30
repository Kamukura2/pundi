import { createClient } from "@supabase/supabase-js";
import { nativeCors } from "./_lib/http.js";

function reply(response, status, body) {
  response.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(body);
}
function serviceClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error("Account service is not configured."), { status:503, code:"not_configured" });
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
}
async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw Object.assign(new Error("Authentication service is not configured."), { status:503, code:"not_configured" });
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:{ user }, error } = await auth.auth.getUser(authorization.slice(7));
  if (error || !user) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  return { user, db:serviceClient() };
}
function safeSubscription(row) {
  return { plan:row?.plan || "free", status:row?.status || "free" };
}
export default async function handler(request, response) {
  if (!nativeCors(request, response, ["GET", "DELETE"])) return;
  if (request.method !== "GET" && request.method !== "DELETE") return reply(response,405,{ error:"Method not allowed.", code:"method_not_allowed" });
  try {
    const { user, db } = await authenticate(request);
    const { data:subscription, error:subscriptionError } = await db.from("subscriptions").select("plan,status").eq("user_id",user.id).maybeSingle();
    if (subscriptionError) throw Object.assign(new Error("Account metadata unavailable."), { status:503, code:"metadata_unavailable" });
    const { data:admin, error:adminError } = await db.from("app_admins").select("user_id,role").eq("user_id",user.id).maybeSingle();
    if (adminError) throw Object.assign(new Error("Account status unavailable."), { status:503, code:"metadata_unavailable" });
    if (request.method === "GET") return reply(response,200,{ email:user.email || "", created_at:user.created_at || null, account_status:user.banned_until ? "banned" : "active", subscription:safeSubscription(subscription), is_admin:Boolean(admin), admin_role:admin?.role || null });
    let body;
    try { body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {}); }
    catch { return reply(response,400,{ error:"Malformed JSON request.", code:"invalid_json" }); }
    if (body.confirmation !== "DELETE") return reply(response,400,{ error:"Type DELETE to confirm account deletion.", code:"confirmation_required" });
    if (admin) return reply(response,403,{ error:"Admin accounts cannot be deleted from self-service settings. Remove admin access first.", code:"admin_deletion_blocked" });
    const { error:auditCleanupError } = await db.from("admin_audit_log").delete().eq("target_user_id",user.id);
    if (auditCleanupError) throw Object.assign(new Error("Account deletion failed."), { status:503, code:"deletion_failed" });
    const { error:deleteError } = await db.auth.admin.deleteUser(user.id);
    if (deleteError) throw Object.assign(new Error("Account deletion failed."), { status:503, code:"deletion_failed" });
    return reply(response,200,{ ok:true });
  } catch (error) {
    return reply(response,Number(error.status) || 500,{ error:error.message || "Account request failed.", code:error.code || "account_failed" });
  }
}
