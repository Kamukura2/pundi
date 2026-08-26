import { createClient } from "@supabase/supabase-js";

const FEATURES = ["core_finance","cloud_sync","advanced_insights","export","premium_features"];
const PLANS = { free:["core_finance","cloud_sync"], paid:FEATURES };
const STATUS = new Set(["free","trialing","active","past_due","cancelled","expired"]);

function error(response, status, message, code) { return response.status(status).json({ error:message, code }); }
function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error("Admin service is not configured."), { status:503, code:"not_configured" });
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
}
async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw Object.assign(new Error("Authentication service is not configured."), { status:503, code:"not_configured" });
  const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:{ user }, error:authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !user) throw Object.assign(new Error("Authentication required."), { status:401, code:"unauthorized" });
  const db = adminClient();
  const { data:admin, error:adminError } = await db.from("app_admins").select("user_id,role").eq("user_id", user.id).maybeSingle();
  if (adminError) throw Object.assign(new Error("Admin authorization unavailable."), { status:503, code:"authorization_unavailable" });
  if (!admin) throw Object.assign(new Error("Admin access required."), { status:403, code:"forbidden" });
  return { db, user, admin };
}
function safeUser(user, subscription, overrides, counts) {
  const plan = subscription?.plan || "free";
  const status = subscription?.status || "free";
  const base = new Set(PLANS[plan] || PLANS.free);
  const entitlements = Object.fromEntries(FEATURES.map(feature => [feature, overrides[feature]?.enabled ?? base.has(feature)]));
  return {
    email:user.email || "",
    user_id:user.id,
    created_at:user.created_at,
    last_active:user.last_sign_in_at || null,
    plan,
    subscription_status:status,
    subscription_provider:subscription?.provider || "manual",
    subscription_started_at:subscription?.started_at || null,
    current_period_end:subscription?.current_period_end || null,
    feature_entitlements:entitlements,
    account_status:user.banned_until ? "banned" : "active",
    aggregate_record_counts:counts || undefined
  };
}
async function metadata(db, users) {
  const ids = users.map(user => user.id);
  const [subscriptions, overrides, counts] = await Promise.all([
    db.from("subscriptions").select("*").in("user_id", ids),
    db.from("entitlement_overrides").select("user_id,feature,enabled,reason,updated_at").in("user_id", ids),
    Promise.all(["accounts","transactions","clients","stock_holdings","trading_positions"].map(table => db.from(table).select("user_id").in("user_id", ids)))
  ]);
  if (subscriptions.error || overrides.error || counts.some(result => result.error)) throw Object.assign(new Error("Admin metadata query failed."), { status:503, code:"metadata_unavailable" });
  const bySub = new Map((subscriptions.data || []).map(row => [row.user_id,row]));
  const byOverride = new Map();
  for (const row of overrides.data || []) { if (!byOverride.has(row.user_id)) byOverride.set(row.user_id,{}); byOverride.get(row.user_id)[row.feature] = row; }
  const countByUser = new Map(ids.map(id => [id,{}]));
  ["accounts","transactions","clients","stock_holdings","trading_positions"].forEach((table,index) => { for (const row of counts[index].data || []) { const bucket=countByUser.get(row.user_id); if (bucket) bucket[table]=(bucket[table]||0)+1; } });
  // Counts are deliberately aggregate and never include amounts or row contents.
  return users.map(user => safeUser(user, bySub.get(user.id), byOverride.get(user.id) || {}, countByUser.get(user.id)));
}
async function listUsers(db) {
  const { data, error:usersError } = await db.auth.admin.listUsers({ page:1, perPage:1000 });
  if (usersError) throw Object.assign(new Error("User metadata unavailable."), { status:503, code:"users_unavailable" });
  return data.users || [];
}
async function audit(db, adminId, targetId, action, beforeMetadata, afterMetadata) {
  const { error:auditError } = await db.from("admin_audit_log").insert({ admin_user_id:adminId, target_user_id:targetId, action, before_metadata:beforeMetadata, after_metadata:afterMetadata });
  if (auditError) throw Object.assign(new Error("Audit log write failed."), { status:503, code:"audit_unavailable" });
}
export default async function handler(request, response) {
  response.setHeader("Cache-Control","private, no-store, max-age=0");
  if (request.method !== "GET" && request.method !== "POST") return error(response,405,"Method not allowed.","method_not_allowed");
  try {
    const { db, user:adminUser } = await authenticate(request);
    const users = await listUsers(db);
    if (request.method === "GET") {
      const records = await metadata(db, users);
      const q = String(request.query.search || "").trim().toLowerCase();
      const plan = String(request.query.plan || "").trim();
      const status = String(request.query.status || "").trim();
      const sort = request.query.sort === "oldest" ? 1 : -1;
      const filtered = records.filter(row => (!q || row.email.toLowerCase().includes(q) || row.user_id.toLowerCase().includes(q)) && (!plan || (plan === "paid" ? row.plan !== "free" : row.plan === plan)) && (!status || row.subscription_status === status)).sort((a,b) => (Date.parse(a.created_at)-Date.parse(b.created_at))*sort);
      return response.status(200).json({ overview:{ total_users:records.length, new_users_7_days:records.filter(row => Date.now()-Date.parse(row.created_at)<=7*864e5).length, new_users_30_days:records.filter(row => Date.now()-Date.parse(row.created_at)<=30*864e5).length, active_users_7_days:records.filter(row => row.last_active && Date.now()-Date.parse(row.last_active)<=7*864e5).length, free_users:records.filter(row => row.plan === "free").length, paid_users:records.filter(row => row.plan !== "free").length }, users:filtered, page:1, page_size:1000, total:filtered.length });
    }
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});
    const target = users.find(candidate => candidate.id === body.user_id);
    if (!target) return error(response,404,"User not found.","not_found");
    if (body.action === "set_plan") {
      if (typeof body.plan !== "string" || !body.plan.trim() || !STATUS.has(body.status || "free")) return error(response,400,"Invalid manual subscription payload.","invalid_request");
      const before = (await db.from("subscriptions").select("*").eq("user_id",target.id).maybeSingle()).data || { plan:"free",status:"free",provider:"manual" };
      const after = { user_id:target.id, plan:body.plan.trim(), status:body.status || "free", provider:"manual", provider_customer_id:null, provider_subscription_id:null, started_at:body.started_at || null, current_period_end:body.current_period_end || null, updated_at:new Date().toISOString() };
      const { error:upsertError } = await db.from("subscriptions").upsert(after);
      if (upsertError) throw Object.assign(new Error("Subscription update failed."), { status:503, code:"mutation_failed" });
      await audit(db,adminUser.id,target.id,"set_plan",{ plan:before.plan,status:before.status,provider:before.provider },{ plan:after.plan,status:after.status,provider:after.provider });
      return response.status(200).json({ ok:true, user_id:target.id, subscription:{ plan:after.plan,status:after.status,provider:"manual" } });
    }
    if (body.action === "set_entitlement") {
      if (!FEATURES.includes(body.feature) || typeof body.enabled !== "boolean") return error(response,400,"Invalid entitlement payload.","invalid_request");
      const before = (await db.from("entitlement_overrides").select("enabled,reason").eq("user_id",target.id).eq("feature",body.feature).maybeSingle()).data || {};
      const after = { user_id:target.id, feature:body.feature, enabled:body.enabled, reason:String(body.reason || "manual admin override").slice(0,240), updated_by:adminUser.id, updated_at:new Date().toISOString() };
      const { error:upsertError } = await db.from("entitlement_overrides").upsert(after);
      if (upsertError) throw Object.assign(new Error("Entitlement update failed."), { status:503, code:"mutation_failed" });
      await audit(db,adminUser.id,target.id,"set_entitlement",{ feature:body.feature,enabled:before.enabled ?? null },{ feature:body.feature,enabled:after.enabled });
      return response.status(200).json({ ok:true, user_id:target.id, entitlement:{ feature:body.feature,enabled:after.enabled } });
    }
    if (body.action === "refresh_metadata") return response.status(200).json({ ok:true, user:safeUser(target,null,{},{}), refreshed_at:new Date().toISOString() });
    return error(response,400,"Unsupported admin action.","invalid_request");
  } catch (err) { return error(response,Number(err.status)||500,err.message || "Admin request failed.",err.code || "admin_failed"); }
}
