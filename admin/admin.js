import { createClient } from "@supabase/supabase-js";
import { bootstrapAdminState, withTimeout } from "./state.js";
import { normalizeDashboardPayload, renderCardsHtml, renderFailureHtml, renderRowsHtml } from "./render.js";
const $ = id => document.getElementById(id);
let supabase, session, records=[], page=0;
const pageSize=20;
const BOOT_TIMEOUT_MS=10000;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const date = value => value ? new Date(value).toLocaleString() : "—";
function showError(message){
  const error = $("error");
  if(!error)return;
  error.textContent=message || "";
  error.hidden=!message;
}
function renderCards(overview){ $("cards").innerHTML=renderCardsHtml(overview); }
function renderRows(){
  $("userRows").innerHTML=renderRowsHtml(records);
  const start=page*pageSize;
  $("count").textContent=records.length?`${start+1}–${Math.min(start+pageSize,records.length)} of ${records.length}`:"0 users";
  $("prev").disabled=page===0; $("next").disabled=(page+1)*pageSize>=records.length;
  document.querySelectorAll("[data-detail]").forEach(button=>button.onclick=()=>showDetail(records.find(row=>row.user_id===button.dataset.detail)));
}
async function api(method="GET", body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),BOOT_TIMEOUT_MS);
  try{
    const response=await fetch("/api/admin",{method,cache:"no-store",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json","Cache-Control":"no-cache"},body:body?JSON.stringify(body):undefined,signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(!data || typeof data!=="object") throw Object.assign(new Error("Admin API returned an invalid response."),{status:response.status});
    if(!response.ok) throw Object.assign(new Error(data.error || `Admin request failed (${response.status}).`),{status:response.status});
    return data;
  }catch(error){ if(error.name==="AbortError") throw new Error("Admin API request timed out. Please retry."); throw error; }
  finally{ clearTimeout(timer); }
}
async function load(){
  showError("");
  const data=normalizeDashboardPayload(await api("GET",null));
  // Filtering is repeated locally for responsive pagination; API remains the authorization boundary.
  const search=$("search").value.trim().toLowerCase(), plan=$("plan").value, status=$("status").value;
  records=data.users.filter(row=>{
    const email=row.email.toLowerCase(), userId=row.user_id.toLowerCase();
    return (!search||email.includes(search)||userId.includes(search)) && (!plan||(plan==="paid"?row.plan!=="free":row.plan===plan)) && (!status||row.subscription_status===status);
  });
  if($("sort").value==="oldest")records.reverse();
  page=0; renderCards(data.overview); renderRows(); $("dashboard").hidden=false; $("notice").hidden=true;
}
function showDetail(row){
  if(!row)return;
  $("detailTitle").textContent=row.email;
  const counts=Object.entries(row.aggregate_record_counts||{}).map(([key,value])=>`<div><small>${esc(key.replaceAll("_"," "))}</small><b>${value}</b></div>`).join("")||"<div><small>Aggregate records</small><b>0</b></div>";
  const features=Object.entries(row.feature_entitlements||{}).map(([feature,enabled])=>`<div class="feature"><span>${esc(feature.replaceAll("_"," "))}</span><button data-feature="${esc(feature)}" data-enabled="${enabled}">${enabled?"Enabled":"Disabled"}</button></div>`).join("");
  $("detailBody").innerHTML=`<div class="detail-grid"><div><small>Email</small><b>${esc(row.email)}</b></div><div><small>User ID</small><b>${esc(row.user_id)}</b></div><div><small>Created</small><b>${date(row.created_at)}</b></div><div><small>Last active</small><b>${date(row.last_active)}</b></div><div><small>Plan</small><b>${esc(row.plan)} · manual</b></div><div><small>Status</small><b>${esc(row.subscription_status)} · ${esc(row.account_status)}</b></div><div><small>Subscription period</small><b>${date(row.subscription_started_at)} → ${date(row.current_period_end)}</b></div></div><h3>Aggregate record counts</h3><div class="detail-grid">${counts}</div><h3>Feature entitlements</h3>${features}<h3>Manual plan</h3><div class="toolbar"><select id="detailPlan"><option value="free">Free</option><option value="paid">Paid</option></select><select id="detailStatus"><option>free</option><option>trialing</option><option>active</option><option>past_due</option><option>cancelled</option><option>expired</option></select><button class="primary" id="savePlan">Save manual plan</button></div><div class="meta">All subscription values on this console are manual metadata until a payment provider is integrated.</div>`;
  $("detailPlan").value=row.plan; $("detailStatus").value=row.subscription_status;
  $("savePlan").onclick=async()=>{try{await api("POST",{action:"set_plan",user_id:row.user_id,plan:$("detailPlan").value,status:$("detailStatus").value});await load();$("drawer").hidden=true;}catch(error){showError(error.message);}};
  document.querySelectorAll("[data-feature]").forEach(button=>button.onclick=async()=>{try{await api("POST",{action:"set_entitlement",user_id:row.user_id,feature:button.dataset.feature,enabled:button.dataset.enabled!=="true",reason:"Manual admin override"});await load();showDetail(records.find(item=>item.user_id===row.user_id));}catch(error){showError(error.message);}});
  $("drawer").hidden=false;
}
function showFailure(message){
  const notice=$("notice"), dashboard=$("dashboard");
  notice.innerHTML=renderFailureHtml(message);
  notice.classList.add("error");
  notice.hidden=false;
  dashboard.hidden=false;
  $("cards").innerHTML=renderCardsHtml({total_users:0,new_users_7_days:0,new_users_30_days:0,active_users_7_days:0,free_users:0,paid_users:0});
  $("userRows").innerHTML=renderRowsHtml([]);
  $("count").textContent="Unavailable";
  $("prev").disabled=true; $("next").disabled=true;
  const retry=notice.querySelector("[data-admin-retry]");
  if(retry)retry.onclick=()=>{retry.disabled=true;boot();};
}
async function boot(){
  try{
    $("notice").textContent="Loading authenticated admin session…";
    $("notice").classList.remove("error");
    const config=await withTimeout(fetch("/api/config",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error("Supabase configuration unavailable.");return response.json();}),"Supabase configuration",BOOT_TIMEOUT_MS);
    if(!config.supabaseUrl || !config.supabaseAnonKey)throw new Error("Supabase configuration is incomplete.");
    supabase=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const result=await bootstrapAdminState({getSession:()=>supabase.auth.getSession().then(({data})=>data.session),loadDashboard:nextSession=>{session=nextSession;return load();},timeoutMs:BOOT_TIMEOUT_MS});
    if(result.state==="dashboard")return;
    $("dashboard").hidden=true;
    if(result.state==="unauthenticated")$("notice").textContent="You are not signed in. Sign in to Pundi, then open /admin.";
    else if(result.state==="denied")$("notice").textContent="Access denied. This account is not an admin.";
    else throw result.error || new Error("Unable to load the admin dashboard.");
  }catch(error){
    showFailure(error.message || "Unable to load the admin dashboard.");
  }
}
["search","plan","status","sort"].forEach(id=>$(id).oninput=()=>load().catch(error=>showError(error.message)));
$("refresh").onclick=()=>load().catch(error=>showError(error.message)); $("prev").onclick=()=>{page--;renderRows()}; $("next").onclick=()=>{page++;renderRows()}; $("close").onclick=()=>$("drawer").hidden=true; $("drawer").onclick=event=>{if(event.target.id==="drawer")$("drawer").hidden=true}; $("signOut").onclick=async()=>{await supabase?.auth.signOut();location.href="/"};
boot();
