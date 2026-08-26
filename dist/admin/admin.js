const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const $ = id => document.getElementById(id);
let supabase, session, records=[], page=0;
const pageSize=20;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const date = value => value ? new Date(value).toLocaleString() : "—";
function showError(message){ $("error").textContent=message; }
async function api(method="GET", body){
  const response=await fetch("/api/admin",{method,headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Admin request failed (${response.status}).`);
  return data;
}
function renderCards(overview){
  const cards=[["Total Users",overview.total_users],["New Users · 7 Days",overview.new_users_7_days],["New Users · 30 Days",overview.new_users_30_days],["Active · 7 Days",overview.active_users_7_days],["Free Users",overview.free_users],["Paid Users",overview.paid_users]];
  $("cards").innerHTML=cards.map(([label,value])=>`<article class="card"><small>${label}</small><strong>${value}</strong></article>`).join("");
}
function renderRows(){
  const start=page*pageSize, slice=records.slice(start,start+pageSize);
  $("userRows").innerHTML=slice.map(row=>{const features=Object.entries(row.feature_entitlements||{}).filter(([,enabled])=>enabled).map(([name])=>name.replaceAll("_"," ")).join(", ")||"None"; return `<tr><td>${esc(row.email)}</td><td title="${esc(row.user_id)}">${esc(row.user_id.slice(0,8))}…</td><td>${date(row.created_at)}</td><td>${date(row.last_active)}</td><td><span class="badge">${esc(row.plan)}</span></td><td><span class="badge manual">${esc(row.subscription_status)} · ${esc(row.subscription_provider)}</span></td><td>${esc(features)}</td><td>${esc(row.account_status)}</td><td><button data-detail="${esc(row.user_id)}">View</button></td></tr>`;}).join("") || `<tr><td colspan="9">No matching users.</td></tr>`;
  $("count").textContent=records.length?`${start+1}–${Math.min(start+pageSize,records.length)} of ${records.length}`:"0 users";
  $("prev").disabled=page===0; $("next").disabled=(page+1)*pageSize>=records.length;
  document.querySelectorAll("[data-detail]").forEach(button=>button.onclick=()=>showDetail(records.find(row=>row.user_id===button.dataset.detail)));
}
async function load(){
  showError("");
  const params=new URLSearchParams({search:$("search").value,plan:$("plan").value,status:$("status").value,sort:$("sort").value});
  const data=await api("GET",null).then(value=>value);
  // Filtering is repeated locally for responsive pagination; API remains the authorization boundary.
  const search=$("search").value.trim().toLowerCase(), plan=$("plan").value, status=$("status").value;
  records=(data.users||[]).filter(row=>(!search||row.email.toLowerCase().includes(search)||row.user_id.toLowerCase().includes(search))&&(!plan||(plan==="paid"?row.plan!=="free":row.plan===plan))&&(!status||row.subscription_status===status));
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
async function boot(){
  try{
    const config=await fetch("/api/config",{cache:"no-store"}).then(response=>response.json());
    supabase=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    ({data:{session}}=await supabase.auth.getSession());
    if(!session){$("notice").textContent="Sign in to Pundi first, then open /admin.";return;}
    await load();
  }catch(error){$("notice").textContent=error.message;$("notice").classList.add("error");}
}
["search","plan","status","sort"].forEach(id=>$(id).oninput=()=>load().catch(error=>showError(error.message)));
$("refresh").onclick=()=>load().catch(error=>showError(error.message)); $("prev").onclick=()=>{page--;renderRows()}; $("next").onclick=()=>{page++;renderRows()}; $("close").onclick=()=>$("drawer").hidden=true; $("drawer").onclick=event=>{if(event.target.id==="drawer")$("drawer").hidden=true}; $("signOut").onclick=async()=>{await supabase?.auth.signOut();location.href="/"};
boot();
