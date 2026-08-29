import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const origin=process.env.PUNDI_PRODUCTION_URL || "https://app.pundi.online";
const env=Object.fromEntries(fs.readFileSync(".env.user-smoke.local","utf8").split(/\r?\n/).filter(x=>x.includes("=")).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)]}));
const admin=Object.fromEntries(fs.readFileSync(".env.admin-smoke.local","utf8").split(/\r?\n/).filter(x=>x.includes("=")).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)]}));
const cfg=await (await fetch(origin+"/api/config",{cache:"no-store"})).json();assert.match(cfg.supabaseUrl,/ndeycwoyjwyntjkgbzlz/);
const unauth=await fetch(origin+"/api/admin",{cache:"no-store"});assert.equal(unauth.status,401);
async function role(e,p,expected){const client=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);const {data,error}=await client.auth.signInWithPassword({email:e,password:p});assert.ifError(error);const r=await fetch(origin+"/api/admin",{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});assert.equal(r.status,expected);await client.auth.signOut();}
await role(env.PUNDI_USER_SMOKE_EMAIL,env.PUNDI_USER_SMOKE_PASSWORD,403);await role(admin.PUNDI_ADMIN_SMOKE_EMAIL,admin.PUNDI_ADMIN_SMOKE_PASSWORD,200);
console.log(JSON.stringify({status:"PASS",unauth:unauth.status,normal:403,admin:200}));
