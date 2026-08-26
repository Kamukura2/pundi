import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import handler from "../../api/account.js";

const REF = "ndeycwoyjwyntjkgbzlz";
const projectRef = process.env.PUNDI_TEST_PROJECT_REF || "";
const url = process.env.PUNDI_TEST_SUPABASE_URL || "";
const anon = process.env.PUNDI_TEST_SUPABASE_ANON_KEY || "";
const service = process.env.PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY || "";
if (projectRef !== REF || !url || !anon || !service) throw new Error(`Refusing account lifecycle integration: explicit Pundi test configuration required.`);
process.env.SUPABASE_URL = url;
process.env.SUPABASE_ANON_KEY = anon;
process.env.SUPABASE_SERVICE_ROLE_KEY = service;
const admin = createClient(url, service, { auth:{ persistSession:false, autoRefreshToken:false } });
const auth = createClient(url, anon, { auth:{ persistSession:false, autoRefreshToken:false } });
const tag = `pundi-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2,8)}`.toLowerCase();
const email = `${tag}@example.invalid`;
const password = `Disposable-${crypto.randomUUID()}-Safe!`;
let userId = null;
function response(){ return { statusCode:0, headers:{}, body:null, setHeader(k,v){this.headers[k]=v;}, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;} }; }
async function call(request){ const res=response(); await handler(request,res); return res; }
async function count(table){ const {data,error}=await admin.from(table).select("user_id").eq("user_id",userId); if(error)throw error; return data.length; }
try {
  const created = await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{test_run:tag}});
  if(created.error)throw created.error;
  userId=created.data.user.id;
  const inserted = await admin.from("accounts").insert({user_id:userId,name:"Disposable lifecycle fixture",account_type:"Cash",balance:1});
  if(inserted.error)throw inserted.error;
  const signed = await auth.auth.signInWithPassword({email,password});
  if(signed.error)throw signed.error;
  const token=signed.data.session.access_token;
  let result=await call({method:"DELETE",headers:{},body:{confirmation:"DELETE"}});
  assert.equal(result.statusCode,401,"Unauthenticated deletion must be blocked");
  result=await call({method:"DELETE",headers:{authorization:`Bearer ${token}`},body:{confirmation:"NO"}});
  assert.equal(result.statusCode,400,"Deletion confirmation must be required");
  result=await call({method:"DELETE",headers:{authorization:`Bearer ${token}`},body:{confirmation:"DELETE"}});
  assert.equal(result.statusCode,200,"Authenticated self-delete must succeed");
  const deleted = await admin.auth.admin.getUserById(userId);
  assert.equal(deleted.data.user,null,"Deleted user must not remain in Auth");
  assert.equal(await count("accounts"),0,"Owned finance rows must be removed");
  console.log("Account lifecycle integration PASS: unauthenticated block, confirmation gate, JWT-owned deletion, Auth removal, and finance cascade");
} finally {
  if(userId){
    await admin.from("accounts").delete().eq("user_id",userId);
    await admin.from("admin_audit_log").delete().eq("target_user_id",userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
