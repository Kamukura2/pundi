import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import handler from "../../api/admin.js";

const REF = "ndeycwoyjwyntjkgbzlz";
const projectRef = process.env.PUNDI_TEST_PROJECT_REF || "";
const url = process.env.PUNDI_TEST_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anon = process.env.PUNDI_TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const service = process.env.PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (projectRef !== REF || !url || !anon || !service || !new URL(url).hostname.startsWith(`${REF}.`)) throw new Error(`Refusing admin test: expected Pundi project ${REF} and explicit test credentials.`);
const adminDb = createClient(url, service, { auth:{ persistSession:false, autoRefreshToken:false } });
const anonDb = createClient(url, anon, { auth:{ persistSession:false, autoRefreshToken:false } });
const tag = `PUNDI_PHASE_2_${Date.now()}_${Math.random().toString(36).slice(2,7)}`.toLowerCase();
const password = `P2-${crypto.randomUUID()}-Safe!`;
const created=[];
async function create(email){ const {data,error}=await adminDb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{test_run:tag}}); if(error)throw error; created.push(data.user.id); return data.user; }
async function token(email){ const {data,error}=await anonDb.auth.signInWithPassword({email,password}); if(error)throw error; return data.session.access_token; }
function response(){ return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}}; }
async function call(request){ const res=response(); await handler(request,res); return res; }
function assertNoPrivate(value){ const text=JSON.stringify(value); for(const marker of ["password","access_token","refresh_token","amount","balance","description","portfolio","holdings"]) assert.equal(text.toLowerCase().includes(marker),false,`Admin payload leaked ${marker}.`); }
async function run(){
  const adminUser=await create(`${tag}-admin@example.invalid`); const normalUser=await create(`${tag}-user@example.invalid`);
  const adminToken=await token(`${tag}-admin@example.invalid`); const normalToken=await token(`${tag}-user@example.invalid`);
  let result=await call({method:"GET",headers:{},query:{}}); assert.equal(result.statusCode,401); console.log("PASS unauthenticated admin API -> 401");
  result=await call({method:"GET",headers:{authorization:`Bearer ${normalToken}`},query:{}}); assert.equal(result.statusCode,403); console.log("PASS normal authenticated user -> 403");
  const {error:registryError}=await adminDb.from("app_admins").insert({user_id:adminUser.id,role:"owner"}); if(registryError)throw registryError;
  result=await call({method:"GET",headers:{authorization:`Bearer ${adminToken}`},query:{}}); assert.equal(result.statusCode,200); assert.ok(result.body.overview); assert.ok(Array.isArray(result.body.users)); assert.ok(result.body.users.some(row=>row.user_id===normalUser.id)); assertNoPrivate(result.body); console.log("PASS authorized admin metadata access and privacy contract");
  result=await call({method:"GET",headers:{authorization:`Bearer ${adminToken}`},query:{plan:"free",sort:"oldest"}}); assert.equal(result.statusCode,200); assert.ok(result.body.users.every(row=>row.plan==="free")); console.log("PASS Free filtering and sort contract");
  result=await call({method:"POST",headers:{authorization:`Bearer ${adminToken}`},body:{action:"set_plan",user_id:normalUser.id,plan:"paid",status:"active"}}); assert.equal(result.statusCode,200); assert.equal(result.body.subscription.provider,"manual"); console.log("PASS manual subscription mutation");
  result=await call({method:"POST",headers:{authorization:`Bearer ${adminToken}`},body:{action:"set_entitlement",user_id:normalUser.id,feature:"premium_features",enabled:true,reason:"test"}}); assert.equal(result.statusCode,200); assert.equal(result.body.entitlement.enabled,true); console.log("PASS entitlement override mutation");
  const {data:audit,error:auditError}=await adminDb.from("admin_audit_log").select("admin_user_id,target_user_id,action,before_metadata,after_metadata").eq("target_user_id",normalUser.id); if(auditError)throw auditError; assert.equal(audit.length,2); assert.ok(audit.every(row=>row.admin_user_id===adminUser.id)); assertNoPrivate(audit); console.log("PASS admin mutation audit logging");
  const {data:sub,error:subError}=await adminDb.from("subscriptions").select("plan,status,provider").eq("user_id",normalUser.id).single(); if(subError)throw subError; assert.deepEqual(sub,{plan:"paid",status:"active",provider:"manual"});
}
try { await run(); console.log("Pundi admin contract harness PASS"); }
finally {
  if (service && projectRef===REF) {
    for(const id of created){ await adminDb.from("admin_audit_log").delete().or(`target_user_id.eq.${id},admin_user_id.eq.${id}`); await adminDb.from("entitlement_overrides").delete().eq("user_id",id); await adminDb.from("subscriptions").delete().eq("user_id",id); await adminDb.from("app_admins").delete().eq("user_id",id); await adminDb.auth.admin.deleteUser(id); }
    const {data:users}=await adminDb.auth.admin.listUsers({page:1,perPage:1000}); const remaining=(users.users||[]).filter(user=>String(user.email||"").includes(tag)).length; if(remaining)throw new Error("Admin contract cleanup failed."); console.log("Cleanup PASS: admin test users and metadata removed");
  }
}
