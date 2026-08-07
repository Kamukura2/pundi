import { createEmptyState, createId, createMvpSeed, readLegacyLocalStorage, YEARS } from "./src/data/default-data.js";
import { SyncManager } from "./src/sync/sync-manager.js";
import { fetchHoldingQuote, isPriceStale, validateHoldingSymbol } from "./src/stocks/client.js";
import { getSupabase } from "./src/lib/supabase.js";

const COLORS=["#7F66FF","#39C3FF","#FF8F63","#36D695","#F4C24F","#FF6EA8","#62C8FF","#8D7AFF"];
const todayISO=()=>{
 const d=new Date(), pad=n=>String(n).padStart(2,"0");
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const state=createEmptyState();
state.theme=localStorage.getItem("cvfinance-theme-cache")||"dark";
let syncManager;
let stockRefreshStarted=false;

const fmt=(n,compact=false)=>{
 if(state.privacy) return "Rp••••••";
 n=Number(n||0);
 if(compact){
  const a=Math.abs(n);
  if(a>=1e9) return `Rp${(n/1e9).toFixed(1)}B`;
  if(a>=1e6) return `Rp${(n/1e6).toFixed(1)}M`;
  if(a>=1e3) return `Rp${(n/1e3).toFixed(1)}K`;
 }
 return new Intl.NumberFormat("en-US",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
};
const save=()=>syncManager?.persist(state);
const saveSettings=()=>save();
const q=(s)=>document.querySelector(s);
const qa=(s)=>[...document.querySelectorAll(s)];
const accountTotal=()=>state.accounts.reduce((a,b)=>a+Number(b.balance),0);
const recurringClients=()=>state.clients.filter(c=>c.status!=="freeze");
const fixedIncome=()=>recurringClients().reduce((a,b)=>a+Number(b.monthly),0);
const clientOutstanding=(c)=>Math.max(0,Number(c.monthly)+Number(c.carry)-Number(c.paid));
const totalOutstanding=()=>recurringClients().reduce((a,b)=>a+clientOutstanding(b),0);
const totalPaid=()=>recurringClients().reduce((a,b)=>a+Number(b.paid),0);
const txTotals=()=>state.transactions.reduce((a,t)=>(a[t.type]+=Number(t.amount),a),{income:0,expense:0});
const monthlyBudget=()=>state.budgets.reduce((a,b)=>a+Number(b.monthly),0);
const yearlyTotal=()=>state.yearly.reduce((a,b)=>a+Number(b.amount),0);
const eventTotal=()=>state.events.reduce((a,b)=>a+Number(b.amount),0);
const unpaidCreditTotal=()=>state.credit.filter(x=>!x.paid).reduce((a,b)=>a+Number(b.amount),0);
const spentExact=(cat)=>state.transactions.filter(t=>t.type==="expense"&&t.category===cat).reduce((a,b)=>a+Number(b.amount),0);
const foodSpent=()=>state.transactions.filter(t=>t.type==="expense"&&(t.category==="Food"||t.category==="Coffee")).reduce((a,b)=>a+Number(b.amount),0);
const essentialsSpent=()=>state.transactions.filter(t=>t.type==="expense"&&t.category==="Essentials").reduce((a,b)=>a+Number(b.amount),0);
const othersSpent=()=>state.transactions.filter(t=>t.type==="expense"&&t.category==="Others").reduce((a,b)=>a+Number(b.amount),0);
const foodBudget=()=>state.budgets.filter(b=>["Food","Coffee"].includes(b.category)).reduce((a,b)=>a+Number(b.monthly),0);
const essentialsBudget=()=>state.budgets.filter(b=>["Electricity","IPL","Internet","Needs","Subscriptions"].includes(b.category)).reduce((a,b)=>a+Number(b.monthly),0);
const othersBudget=()=>state.budgets.filter(b=>b.category==="Others").reduce((a,b)=>a+Number(b.monthly),0);
const stockPrice=(s,y,mode)=>{
 if(y===2026) return Number(s.current);
 const useMode=mode==="base"?state.baseMode:state.optimisticMode;
 const g=mode==="base"?Number(state.baseGrowth):Number(state.optimisticGrowth);
 if(useMode==="auto") return Number(s.current)*Math.pow(1+g/100,y-2026);
 return Number(s[mode][y]??s.current);
};
const stockValue=(s,y=2026,mode="base")=>{
 let v=Number(s.quantity)*stockPrice(s,y,mode);
 return s.currency==="USD"?v*state.usdIdr:v;
};
const invested=(s)=>{
 let v=Number(s.quantity)*Number(s.avg);
 return s.currency==="USD"?v*state.usdIdr:v;
};
const portfolio=(y=2026,mode="base")=>state.stocks.reduce((a,s)=>a+stockValue(s,y,mode),0);
const currentNW=()=>accountTotal()+portfolio();
const AGE_BASE=[33,30,0];
const ageTriplet=(year)=>AGE_BASE.map(v=>v+(year-2026));
const moneyClass=(n)=>Number(n)<0?"negative":"";

function projection(mode="base"){
 let cash=accountTotal();
 return YEARS.map(y=>{
  const income=fixedIncome()*12;
  const eventExp=state.events.filter(e=>new Date(e.date).getFullYear()===y).reduce((a,b)=>a+Number(b.amount),0);
  const expense=monthlyBudget()*12 + yearlyTotal() + eventExp + (y===2026?unpaidCreditTotal():0);
  const port=portfolio(y,mode);
  const closing=cash + income - expense;
  const nw=closing + port;
  const res={year:y,income,expense,portfolio:port,closing,nw};
  cash=closing;
  return res;
 });
}

function donut(entries,label){
 const total=entries.reduce((a,x)=>a+x[1],0)||1;
 const r=76,c=2*Math.PI*r; let off=0;
 const parts=entries.map((e,i)=>{
  const len=e[1]/total*c;
  const s=`<circle data-tip="${e[0]}" data-value="${e[1]}" cx="120" cy="120" r="${r}" fill="none" stroke="${COLORS[i%COLORS.length]}" stroke-width="24" stroke-linecap="round" stroke-dasharray="${Math.max(0,len-5)} ${c-len+5}" stroke-dashoffset="${-off}" transform="rotate(-90 120 120)" style="cursor:pointer"/>`;
  off+=len; return s;
 }).join("");
 return `<svg class="donut-svg" viewBox="0 0 240 240">${parts}<circle class="donut-hole" cx="120" cy="120" r="56"></circle><text class="donut-label" x="120" y="112" text-anchor="middle">Total</text><text class="donut-total" x="120" y="130" text-anchor="middle">${label}</text></svg>`;
}
function legend(entries){
 const total=entries.reduce((a,x)=>a+x[1],0)||1;
 return entries.map((e,i)=>`<div class="legend-row"><i class="dot" style="background:${COLORS[i%COLORS.length]}"></i><span>${e[0]}</span><b class="metric-idr private">${fmt(e[1])}</b><b>${(e[1]/total*100).toFixed(1)}%</b></div>`).join("");
}
function line(vals,labels=[],light=false){
 const w=920,h=280,p=28,min=Math.min(...vals),max=Math.max(...vals),rg=max-min||1;
 const pts=vals.map((v,i)=>[p+i*(w-p*2)/Math.max(vals.length-1,1),h-p-(v-min)/rg*(h-p*2)]);
 const path=pts.map((q,i)=>(i?"L":"M")+q.join(" ")).join(" ");
 return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
 ${[0,1,2,3].map(i=>`<line x1="${p}" y1="${p+i*(h-p*2)/3}" x2="${w-p}" y2="${p+i*(h-p*2)/3}" stroke="${light?'rgba(255,255,255,.18)':'rgba(144,157,181,.15)'}"/>`).join("")}
 <path d="${path}" fill="none" stroke="${light?'#fff':'#7F66FF'}" stroke-width="4" stroke-linecap="round"/>
 ${pts.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="5.5" fill="${light?'#fff':'#39C3FF'}"/>`).join("")}
 ${labels.map((l,i)=>`<text x="${pts[i][0]}" y="${h-8}" text-anchor="middle" fill="${light?'rgba(255,255,255,.84)':'#7a879b'}" font-size="13">${l}</text>`).join("")}
 </svg>`;
}
function bars(vals,labels){
 const w=920,h=280,p=28,max=Math.max(...vals,1)*1.15,g=(w-p*2)/Math.max(vals.length,1),bw=Math.min(54,g*.5);
 return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7F66FF"/><stop offset="1" stop-color="#39C3FF"/></linearGradient></defs>
 ${vals.map((v,i)=>{const bh=v/max*(h-p*2),x=p+i*g+g/2-bw/2; return `<rect x="${x}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="10" fill="url(#bg)"/><text x="${x+bw/2}" y="${h-8}" text-anchor="middle" fill="#7a879b" font-size="12">${labels[i]}</text>`}).join("")}
 </svg>`;
}
function lineMulti(series){
 const all=series.flatMap(s=>s.vals), w=920,h=280,p=28,min=Math.min(...all),max=Math.max(...all),rg=max-min||1;
 return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
 ${[0,1,2,3].map(i=>`<line x1="${p}" y1="${p+i*(h-p*2)/3}" x2="${w-p}" y2="${p+i*(h-p*2)/3}" stroke="rgba(144,157,181,.15)"/>`).join("")}
 ${series.map(s=>{const pts=s.vals.map((v,i)=>[p+i*(w-p*2)/(s.vals.length-1),h-p-(v-min)/rg*(h-p*2)]);return `<path d="${pts.map((q,i)=>(i?'L':'M')+q.join(' ')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="4" stroke-linecap="round"/>`}).join("")}
 </svg>`;
}
function listRows(items){
 return items.map(x=>`<div class="list-row"><div class="list-ic">${x.icon||"•"}</div><div class="list-meta"><b>${x.name}</b><small>${x.sub||""}</small></div><div class="list-value ${x.cls||""} private">${x.value||""}</div></div>`).join("");
}
function attachTips(){
 qa("[data-tip]").forEach(el=>el.onclick=(e)=>{
  tooltip.innerHTML=`<b>${el.dataset.tip}</b><br>${fmt(Number(el.dataset.value))}`;
  tooltip.style.left=Math.min(innerWidth-180,e.clientX+10)+"px";
  tooltip.style.top=Math.max(12,e.clientY-22)+"px";
  tooltip.classList.add("show");
  setTimeout(()=>tooltip.classList.remove("show"),1500);
 });
}
function toastMsg(x){toast.textContent=x;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1400)}
function setTheme(t){state.theme=t;document.documentElement.dataset.theme=t;localStorage.setItem("cvfinance-theme-cache",t);saveSettings();themeBtn.textContent=t==="dark"?"☀":"☾"}
function switchPage(p){
 state.page=p;
 qa(".page").forEach(x=>x.classList.toggle("active",x.id===p));
 qa("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
 const map={accumulation:["FINANCIAL COMMAND CENTER","Accumulation"],cashflow:["ACTUAL TRANSACTION LEDGER","Cashflow"],expenses:["EDITABLE BUDGET & COSTS","Expenses"],clients:["RETAINERS & RECEIVABLES","Clients"],stocks:["PORTFOLIO & TARGETS","Stocks"],electricity:["UTILITY COST MONITOR","Electricity"],prospect:["READ-ONLY FUTURE PROJECTION","Prospect"],insights:["INFOGRAPHIC SUMMARY","Insights"]};
 kicker.textContent=map[p][0]; title.textContent=map[p][1];
}

function renderAccumulation(){
 const projected=accountTotal()+totalOutstanding()-monthlyBudget()-unpaidCreditTotal();
 projectedCash.textContent=fmt(projected);
 availableBalance.textContent=fmt(accountTotal());
 outstandingIncome.textContent=fmt(totalOutstanding());
 cashHealth.textContent=projected>monthlyBudget()*2?"Healthy buffer":projected>0?"Tight but positive":"Negative cash risk";
 accChart.innerHTML=line([accountTotal()*.84,accountTotal()*.89,accountTotal()*.94,accountTotal()*.98,accountTotal(),projected],[],true);
 accountList.innerHTML=listRows(state.accounts.map(a=>({icon:a.type==="Cash"?"💵":a.type==="Bank"?"🏦":"📱",name:a.name,sub:a.type,value:fmt(a.balance)})));
 paymentSummary.innerHTML=listRows(recurringClients().map(c=>({icon:c.status==="paid"?"✅":"⏳",name:c.name,sub:`Paid ${fmt(c.paid)}`,value:fmt(clientOutstanding(c)),cls:c.status==="paid"?"positive":""})));
 pendingSummary.innerHTML=listRows([
  ...state.events.slice(0,3).map(e=>({icon:"📌",name:e.name,sub:e.date,value:fmt(e.amount)})),
  {icon:"💳",name:"Credit / PayLater",sub:`${state.credit.filter(x=>!x.paid).length} active items`,value:fmt(unpaidCreditTotal())}
 ]);
 balanceDonut.innerHTML=donut(state.accounts.map(a=>[a.name,Number(a.balance)]),fmt(accountTotal(),true));
 balanceLegend.innerHTML=legend(state.accounts.map(a=>[a.name,Number(a.balance)]));
 monthModel.innerHTML=listRows([
  {icon:"📥",name:"Receivables",sub:"Pending clients",value:fmt(totalOutstanding()),cls:"positive"},
  {icon:"🧾",name:"Budget",sub:"Monthly categories",value:fmt(monthlyBudget())},
  {icon:"💳",name:"Credit",sub:"Unpaid items",value:fmt(unpaidCreditTotal())},
  {icon:"📊",name:"Projected",sub:"Month-end balance",value:fmt(projected),cls:projected<0?"negative":"positive"}
 ]);
}

function renderCashflow(){
 const totals=txTotals();
 cashIncome.textContent=fmt(totals.income);
 cashExpense.textContent=fmt(totals.expense);
 cashNet.textContent=fmt(totals.income-totals.expense);
 const entries=Object.entries(state.transactions.filter(t=>t.type==="expense").reduce((o,t)=>((o[t.category]=(o[t.category]||0)+Number(t.amount)),o),{})).sort((a,b)=>b[1]-a[1]);
 cashDonut.innerHTML=donut(entries.length?entries:[["No expense",1]],fmt(totals.expense,true));
 cashLegend.innerHTML=entries.length?legend(entries):`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No data</b><small>Add expense transactions</small></div></div>`;
 const pace=[["Food",foodSpent(),foodBudget()],["Essentials",essentialsSpent(),essentialsBudget()],["Others",othersSpent(),othersBudget()]];
 budgetPace.innerHTML=pace.map(([name,spent,budget])=>{
  const pct=budget?spent/budget*100:0, cls=pct>100?"over":pct>80?"warn":"";
  return `<div class="progress-row"><div class="progress-top"><b>${name}</b><small class="private">${fmt(spent)} / ${fmt(budget)}</small></div><div class="progress ${cls}"><span style="width:${Math.min(100,pct)}%"></span></div><small>${pct.toFixed(1)}% used</small></div>`;
 }).join("");
 let list=[...state.transactions];
 const search=(txSearch.value||"").toLowerCase();
 list=list.filter(t=>state.filter==="all"||t.type===state.filter).filter(t=>(`${t.description} ${t.category} ${t.channel}`).toLowerCase().includes(search));
 if(state.sort==="category") list.sort((a,b)=>a.category.localeCompare(b.category));
 else if(state.sort==="amount") list.sort((a,b)=>b.amount-a.amount);
 else list.sort((a,b)=>b.date.localeCompare(a.date));
 txList.innerHTML=list.map(t=>`<div class="tx-row"><div class="tx-badge ${t.type}"><span>${t.type==="income" ? "+" : "−"}</span></div><div class="tx-main"><b>${t.description}</b></div><div class="tx-meta">${t.category} · ${t.channel} · ${t.date}</div><div class="tx-amt ${t.type==="income"?"positive":"negative"} private">${t.type==="income"?"+":"−"}${fmt(t.amount)}</div><button class="icon-mini tx-edit" data-id="${t.id}" title="Edit">✎</button></div>`).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No transactions</b><small>Add a transaction to get started</small></div></div>`;
 qa(".tx-edit").forEach(b=>b.onclick=()=>openTxEditor(b.dataset.id));
}

function renderExpenses(){
 monthlyExpenseTotal.textContent=fmt(monthlyBudget());
 yearlyExpenseTotal.textContent=fmt(yearlyTotal());
 eventExpenseTotal.textContent=fmt(eventTotal());
 budgetRows.innerHTML=state.budgets.map((b,i)=>{
  const spent=spentExact(b.category);
  const pct=b.monthly?spent/b.monthly*100:0, cls=pct>100?"over":pct>80?"warn":"";
  return `<div class="progress-row"><div class="progress-top"><b>${b.category}</b><small class="private">${fmt(spent)} / ${fmt(b.monthly)}</small></div><div class="progress ${cls}"><span style="width:${Math.min(100,pct)}%"></span></div><div class="tile-actions"><button class="icon-mini" data-edit-budget="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-budget="${i}" title="Remove">🗑</button></div></div>`;
 }).join("");
 qa("[data-edit-budget]").forEach(b=>b.onclick=()=>editMonthly(Number(b.dataset.editBudget)));
 qa("[data-remove-budget]").forEach(b=>b.onclick=()=>{state.budgets.splice(Number(b.dataset.removeBudget),1); save(); renderAll();});
 const budgetEntries=state.budgets.map(b=>[b.category,Number(b.monthly)]).sort((a,b)=>b[1]-a[1]);
 expenseDonut.innerHTML=donut(budgetEntries,fmt(monthlyBudget(),true));
 expenseLegend.innerHTML=legend(budgetEntries);
 yearlyExpenseGrid.innerHTML=state.yearly.map((y,i)=>`<div class="tile"><h4>${y.name}</h4><small>${y.month} · ${y.category}</small><strong class="private">${fmt(y.amount)}</strong><div class="tile-actions"><button class="icon-mini" data-edit-yearly="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-yearly="${i}" title="Remove">🗑</button></div></div>`).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No yearly expenses</b></div></div>`;
 eventGrid.innerHTML=state.events.map((e,i)=>`<div class="tile"><h4>${e.name}</h4><small>${e.date} · ${e.category}</small><strong class="private">${fmt(e.amount)}</strong><div class="tile-actions"><button class="icon-mini" data-edit-event="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-event="${i}" title="Remove">🗑</button></div></div>`).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No events</b></div></div>`;
 qa("[data-edit-yearly]").forEach(b=>b.onclick=()=>editYearly(Number(b.dataset.editYearly)));
 qa("[data-remove-yearly]").forEach(b=>b.onclick=()=>{state.yearly.splice(Number(b.dataset.removeYearly),1); save(); renderAll();});
 qa("[data-edit-event]").forEach(b=>b.onclick=()=>editEvent(Number(b.dataset.editEvent)));
 qa("[data-remove-event]").forEach(b=>b.onclick=()=>{state.events.splice(Number(b.dataset.removeEvent),1); save(); renderAll();});
 renderCredit();
}

function renderCredit(){
 creditSummary.innerHTML=state.creditFacilities.map(facility=>{
  const used=state.credit.filter(x=>x.source===facility.source && !x.paid).reduce((a,b)=>a+Number(b.amount),0);
  return `<article class="metric-card"><small>${facility.source} · limit ${fmt(facility.limit)}</small><strong class="private">${fmt(used)}</strong></article>`;
 }).join("");
 creditItems.innerHTML=state.credit.filter(x=>!x.paid).map(c=>`<div class="credit-row"><input type="checkbox" class="credit-check" data-paid="${c.id}"><div class="credit-main"><b>${c.description}</b><small>${c.source}</small></div><div>${c.source}</div><div>${c.due}</div><div class="list-value private">${fmt(c.amount)}</div><button class="icon-mini" data-del-credit="${c.id}" title="Remove">🗑</button></div>`).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No active credit items</b><small>Add an item using the plus button</small></div></div>`;
 creditArchive.innerHTML=state.credit.filter(x=>x.paid).length?listRows(state.credit.filter(x=>x.paid).map(c=>({icon:"✅",name:c.description,sub:c.source,value:fmt(c.amount)}))):`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No archive yet</b></div></div>`;
 qa("[data-paid]").forEach(c=>c.onchange=()=>{const item=state.credit.find(x=>x.id===c.dataset.paid); if(item){item.paid=true; save(); renderAll();}});
 qa("[data-del-credit]").forEach(c=>c.onclick=()=>{state.credit=state.credit.filter(x=>x.id!==c.dataset.delCredit); save(); renderAll();});
}

function renderClients(){
 fixedIncomeTotal.textContent=fmt(fixedIncome());
 clientOutstandingTotal.textContent=fmt(totalOutstanding());
 clientPaidTotal.textContent=fmt(totalPaid());
 clientGrid.innerHTML=state.clients.map((c,i)=>{
  const statusIcon=c.status==="freeze"?"❄":c.status==="paid"?"✓":"⏳";
  return `<div class="client-card ${c.status}"><div class="status-icon ${c.status}" title="${c.status}">${statusIcon}</div>${c.status==="freeze"?'<div class="freeze-ribbon">FROZEN</div>':''}<h4>${c.name}</h4><small>${fmt(c.monthly)} monthly</small><strong class="private">${fmt(c.paid)} paid</strong><small>Previous: ${fmt(c.carry)}<br>Outstanding: ${fmt(clientOutstanding(c))}</small><div class="client-actions"><button class="icon-mini" data-edit-client="${i}" title="Edit">✎</button><button class="icon-mini" data-status-client="${i}" title="Status">◉</button><button class="icon-mini" data-remove-client="${i}" title="Remove">🗑</button></div></div>`;
 }).join("");
 qa("[data-edit-client]").forEach(b=>b.onclick=()=>editClient(Number(b.dataset.editClient)));
 qa("[data-status-client]").forEach(b=>b.onclick=()=>changeClientStatus(Number(b.dataset.statusClient)));
 qa("[data-remove-client]").forEach(b=>b.onclick=()=>{state.clients.splice(Number(b.dataset.removeClient),1); save(); renderAll();});
}

function renderStocks(){
 const p=portfolio(), inv=state.stocks.reduce((a,s)=>a+invested(s),0);
 portfolioValue.textContent=fmt(p);
 portfolioInvested.textContent=fmt(inv);
 portfolioPL.textContent=fmt(p-inv);
 const entries=state.stocks.map(s=>[s.ticker,stockValue(s)]);
 stockDonut.innerHTML=donut(entries,fmt(p,true));
 stockLegend.innerHTML=legend(entries);
 holdingsBody.innerHTML=state.stocks.map((s,i)=>{
  const stale=isPriceStale(s), status=s.priceStatus||"manual", stamp=s.priceAsOf?new Date(s.priceAsOf).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}):"Never";
  return `<tr><td><input data-stock="${i}" data-field="ticker" value="${s.ticker}"></td><td><select data-stock="${i}" data-field="market"><option ${s.market==="IDX"?"selected":""}>IDX</option><option ${s.market==="NASDAQ"?"selected":""}>NASDAQ</option><option ${s.market==="NYSE"?"selected":""}>NYSE</option></select></td><td><select data-stock="${i}" data-field="provider"><option value="finnhub" ${s.provider==="finnhub"?"selected":""}>Finnhub</option><option value="twelvedata" ${s.provider==="twelvedata"?"selected":""}>Twelve Data</option></select></td><td><input data-stock="${i}" data-field="providerSymbol" value="${s.providerSymbol||s.ticker}"></td><td><select data-stock="${i}" data-field="currency"><option ${s.currency==="IDR"?"selected":""}>IDR</option><option ${s.currency==="USD"?"selected":""}>USD</option></select></td><td><input data-stock="${i}" data-field="quantity" type="number" step=".000001" value="${s.quantity}"></td><td><input data-stock="${i}" data-field="avg" type="number" step=".01" value="${s.avg}"></td><td><input data-stock="${i}" data-field="current" type="number" step=".01" value="${s.current}" title="Edit for manual override"></td><td><span class="price-state ${stale?'stale':''}">${stale?'STALE · ':''}${status}</span><small class="price-time">${stamp}</small></td><td class="private">${fmt(stockValue(s))}</td><td class="private">${fmt(stockValue(s)-invested(s))}</td><td><button class="icon-mini" data-del-stock="${i}" title="Remove">🗑</button></td></tr>`;
 }).join("");
 qa("[data-stock]").forEach(el=>el.onchange=()=>{
  const i=Number(el.dataset.stock),f=el.dataset.field,s=state.stocks[i];
  s[f]=["quantity","avg","current"].includes(f)?Number(el.value):el.value;
  if(f==="ticker"){s.ticker=String(el.value).toUpperCase();s.displaySymbol=s.ticker;}
  if(f==="providerSymbol")s.providerSymbol=String(el.value).toUpperCase();
  if(f==="market"){s.provider=s.market==="IDX"?"twelvedata":"finnhub";s.currency=s.market==="IDX"?"IDR":"USD";}
  if(f==="current"){s.manualCurrent=Number(el.value);s.priceSource="manual";s.priceStatus="manual";s.priceAsOf=new Date().toISOString();}
  save();renderAll();
 });
 qa("[data-del-stock]").forEach(el=>el.onclick=()=>{state.stocks.splice(Number(el.dataset.delStock),1);save();renderAll();});
 renderTargetTable("base",baseHead,baseBody);
 renderTargetTable("optimistic",optimisticHead,optimisticBody);
}

function renderTargetTable(mode,headEl,bodyEl){
 const useMode=mode==="base"?state.baseMode:state.optimisticMode;
 headEl.innerHTML=`<tr><th>Ticker</th>${YEARS.map(y=>`<th>${y===2026?"Current":y}</th>`).join("")}</tr>`;
 bodyEl.innerHTML=state.stocks.map((s,i)=>`<tr><td><b>${s.ticker}</b></td>${YEARS.map(y=>{
   if(y===2026) return `<td>${Number(s.current).toFixed(2)}</td>`;
   const val = useMode==="auto" ? Number(stockPrice(s,y,mode)).toFixed(2) : Number(s[mode][y]??s.current).toFixed(2);
   return `<td><input type="number" step=".01" ${useMode==="auto"?"disabled":""} data-target="${mode}" data-stock="${i}" data-year="${y}" value="${val}"></td>`;
 }).join("")}</tr>`).join("");
 qa(`[data-target="${mode}"]`).forEach(el=>el.onchange=()=>{const i=Number(el.dataset.stock), y=Number(el.dataset.year); state.stocks[i][mode][y]=Number(el.value); save(); renderAll();});
}
function updateModeToggleLabels(){
 if(typeof baseModeToggle!=="undefined") baseModeToggle.textContent = state.baseMode === "auto" ? "Auto" : "Manual";
 if(typeof optimisticModeToggle!=="undefined") optimisticModeToggle.textContent = state.optimisticMode === "auto" ? "Auto" : "Manual";
}

function electricityPeriods(){
 const x=[...state.electricity].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const out=[];
 for(let i=1;i<x.length;i++){
  const prev=x[i-1], cur=x[i];
  const days=(new Date(cur.date+"T"+cur.time)-new Date(prev.date+"T"+prev.time))/864e5;
  const used=Math.max(0,Number(prev.remaining)-Number(cur.remaining));
  const daily=days?used/days:0;
  out.push({from:prev,to:cur,days,used,daily,cost:used*state.rateKwh});
 }
 return out;
}
function electricityDailySeries(){
 const periods=electricityPeriods();
 const vals=[]; const labels=[];
 periods.forEach(p=>{
  let d=new Date(p.from.date+"T00:00:00");
  const end=new Date(p.to.date+"T00:00:00");
  d.setDate(d.getDate()+1);
  while(d<=end){
   vals.push(Number(p.daily.toFixed(1)));
   labels.push(`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`);
   d.setDate(d.getDate()+1);
  }
 });
 return {vals,labels};
}
function renderElectricity(){
 const x=[...state.electricity].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const periods=electricityPeriods(), latest=periods.at(-1), last=x.at(-1);
 const series=electricityDailySeries();
 latestKwh.textContent=`${last?.remaining||0} kWh`;
 dailyKwh.textContent=`${(latest?.daily||0).toFixed(1)} kWh/day`;
 monthlyElectricCost.textContent=fmt((latest?.daily||0)*30*state.rateKwh);
 electricUsageChart.innerHTML=bars(series.vals.length?series.vals:[0],series.labels.length?series.labels:["—"]);
 electricInterval.innerHTML=latest?listRows([
  {icon:"⚡",name:`${latest.used.toFixed(1)} kWh used`,sub:`${latest.from.date} ${latest.from.time} → ${latest.to.date} ${latest.to.time}`,value:fmt(latest.cost)},
  {icon:"📆",name:`${latest.days.toFixed(1)} days interval`,sub:`Average ${latest.daily.toFixed(1)} kWh/day`,value:fmt(latest.daily*state.rateKwh)+" / day"},
  {icon:"📌",name:"Estimated monthly",sub:"Based on latest daily usage",value:fmt(latest.daily*30*state.rateKwh)}
 ]):`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>Add at least 2 readings</b></div></div>`;
 electricityList.innerHTML=listRows(x.map(r=>({icon:"⚡",name:`${r.remaining} kWh`,sub:`${r.date} · ${r.time}`,value:""})));
}

function renderProspect(){
 const pr=projection(state.prospectMode), last=pr.at(-1), growth=currentNW()?((last.nw/currentNW()-1)*100):0;
 prospectValue.textContent=fmt(last.nw);
 sideProjection.textContent=fmt(last.nw,true);
 sideScenario.textContent=state.prospectMode==="base"?"Base":"Optimistic";
 prospectBadge.textContent=state.prospectMode.toUpperCase();
 prospectGrowth.textContent=`${growth>=0?"+":""}${growth.toFixed(1)}% over 10 years`;
 prospectDesc.textContent=state.prospectMode==="base"?"Uses base stock targets":"Uses optimistic stock targets";
 prospectChart.innerHTML=line(pr.map(p=>p.nw),pr.map(p=>String(p.year).slice(2)),true);
 prospectSources.innerHTML=listRows([
  {icon:"🏦",name:"Liquid balance",sub:"Cash + bank + wallets",value:fmt(accountTotal())},
  {icon:"🤝",name:"Recurring income",sub:"Fixed clients / year",value:fmt(fixedIncome()*12)},
  {icon:"🧾",name:"Yearly outflow",sub:"Monthly budgets + yearly costs",value:fmt(monthlyBudget()*12+yearlyTotal())},
  {icon:"📈",name:"Stock scenario",sub:state.prospectMode==="base"?"Base target prices":"Optimistic target prices",value:fmt(portfolio(2036,state.prospectMode))}
 ]);
 yearGrid.innerHTML=pr.map(y=>{const ages=ageTriplet(y.year).join(", "); return `<div class="year-card"><div class="year-head"><small>${y.year}</small><span class="age-triplet">${ages}</span></div><h4 class="private ${moneyClass(y.nw)}">${fmt(y.nw)}</h4><small class="private">Cash <span class="${moneyClass(y.closing)}">${fmt(y.closing)}</span> · Stocks <span class="${moneyClass(y.portfolio)}">${fmt(y.portfolio)}</span></small></div>`;}).join("");
}

function renderInsights(){
 const runway=monthlyBudget()?accountTotal()/monthlyBudget():0;
 const biggestBudget=[...state.budgets].sort((a,b)=>b.monthly-a.monthly)[0];
 const biggestHold=[...state.stocks].sort((a,b)=>stockValue(b)-stockValue(a))[0];
 cashRunway.textContent=`${runway.toFixed(1)} months`;
 largestExpense.textContent=biggestBudget?.category||"—";
 largestHolding.textContent=biggestHold?`${biggestHold.ticker} ${(stockValue(biggestHold)/portfolio()*100).toFixed(0)}%`:"—";
 scenarioCompare.innerHTML=lineMulti([
  {vals:projection("base").map(x=>x.nw),color:COLORS[0]},
  {vals:projection("optimistic").map(x=>x.nw),color:COLORS[2]}
 ]);
 insightCards.innerHTML=[
  {title:"Monthly balance health",text:`${fmt(accountTotal())} liquid balance versus ${fmt(monthlyBudget())} monthly budget gives a runway of ${runway.toFixed(1)} months.`},
  {title:"Client collection pressure",text:`${fmt(totalOutstanding())} is still pending from active clients. This is the fastest lever for improving short-term cash.`},
  {title:"Budget pressure",text:`Food pace is ${foodBudget()?((foodSpent()/foodBudget())*100).toFixed(1):0}% and essentials pace is ${essentialsBudget()?((essentialsSpent()/essentialsBudget())*100).toFixed(1):0}% of budget.`}
 ].map(x=>`<div class="brief-item"><b>${x.title}</b><p>${x.text}</p></div>`).join("");
 insightLong.innerHTML=[
  {ic:"💡",title:"Cash action",text:`Collecting pending client balances of ${fmt(totalOutstanding())} will improve the buffer faster than cutting small day-to-day expenses.`},
  {ic:"🍽",title:"Food cluster",text:`Food and coffee are separated in the ledger for visibility, but should be reviewed as a combined lifestyle spending bucket.`},
  {ic:"🧱",title:"Essentials",text:`Essentials includes IPL, internet, subscriptions, electricity, and household basics. Watch the budget pace widget for early overspend.`},
  {ic:"📈",title:"Portfolio",text:`Live provider prices are used when available. Manual current prices remain available when a provider is unavailable or stale.`},
  {ic:"⚡",title:"Electricity",text:`The more frequently you log meter readings, the more accurate the daily usage and monthly cost estimate will become.`},
  {ic:"🗂",title:"Prospect",text:`Base and Optimistic tabs differ only by stock targets, so future cashflow assumptions remain clean and easy to audit.`}
 ].map(x=>`<div class="signal-item"><div class="signal-ic">${x.ic}</div><div><b>${x.title}</b><p>${x.text}</p></div></div>`).join("");
}

function renderAll(){
 renderAccumulation();
 renderCashflow();
 renderExpenses();
 renderClients();
 renderStocks();
 renderElectricity();
 renderProspect();
 renderInsights();
 attachTips();
}

function openSimple(title,fields,callback){
 simpleTitle.textContent=title;
 simpleFields.innerHTML=fields.map(f=>{
  const input=f.options
   ? `<select id="sf_${f.key}">${f.options.map(o=>`<option ${String(o)===String(f.value)?'selected':''}>${o}</option>`).join("")}</select>`
   : `<input id="sf_${f.key}" type="${f.type||'text'}" ${f.step?`step="${f.step}"`:''} ${f.value!==undefined?`value="${f.value}"`:''} required>`;
  return `<label>${f.label}${input}</label>`;
 }).join("");
 simpleForm.onsubmit=(e)=>{
  e.preventDefault();
  const obj={};
  fields.forEach(f=>{
   const el=q("#sf_"+f.key);
   obj[f.key]=f.type==="number"?Number(el.value):el.value;
  });
  callback(obj);
  simpleModal.close();
  save(); renderAll(); toastMsg("Saved");
 };
 simpleModal.showModal();
}
function openTxEditor(id){
 const tx=state.transactions.find(t=>t.id===id);
 if(!tx) return;
 state.txEdit=id;
 txModalTitle.textContent="Edit Transaction";
 qa("#txType button").forEach(b=>b.classList.toggle("active",b.dataset.type===tx.type));
 txAmount.value=tx.amount; txDescription.value=tx.description; txCategory.value=tx.category; txChannel.value=tx.channel; txDate.value=tx.date;
 txModal.showModal();
}
function resetTxModal(){
 state.txEdit=null;
 txModalTitle.textContent="Add Transaction";
 qa("#txType button").forEach((b,i)=>b.classList.toggle("active",i===0));
 txAmount.value=""; txDescription.value=""; txCategory.value="Essentials"; txChannel.value="Offline"; txDate.value=todayISO();
}
function editMonthly(i){
 const x=state.budgets[i];
 openSimple("Edit Monthly Budget",[
  {key:"category",label:"Category",value:x.category},
  {key:"monthly",label:"Monthly Budget",type:"number",value:x.monthly}
 ],o=>state.budgets[i]={...x,...o});
}
function editYearly(i){
 const x=state.yearly[i];
 openSimple("Edit Yearly Expense",[
  {key:"name",label:"Name",value:x.name},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"month",label:"Month",value:x.month},
  {key:"category",label:"Category",value:x.category}
 ],o=>state.yearly[i]={...x,...o});
}
function editEvent(i){
 const x=state.events[i];
 openSimple("Edit Event",[
  {key:"name",label:"Name",value:x.name},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"date",label:"Date",type:"date",value:x.date},
  {key:"category",label:"Category",value:x.category}
 ],o=>state.events[i]={...x,...o});
}
function editClient(i){
 const x=state.clients[i];
 openSimple("Edit Client",[
  {key:"name",label:"Client Name",value:x.name},
  {key:"monthly",label:"Monthly Retainer",type:"number",value:x.monthly},
  {key:"paid",label:"Paid This Month",type:"number",value:x.paid},
  {key:"carry",label:"Previous Outstanding",type:"number",value:x.carry}
 ],o=>{
  state.clients[i]={...x,...o};
  if(state.clients[i].status!=="freeze"){
   state.clients[i].status = o.paid >= o.monthly + o.carry ? "paid" : "pending";
  }
 });
}
function changeClientStatus(i){
 const x=state.clients[i];
 openSimple("Update Client Status",[
  {key:"status",label:"Status",options:["paid","pending","freeze"],value:x.status},
  {key:"paid",label:"Paid This Month",type:"number",value:x.paid}
 ],o=>state.clients[i]={...x,status:o.status,paid:o.paid});
}
function autoDueDate(source){
 const dueDays={"Credit Card":26,"GoPayLater":31,"ShopeePayLater":25};
 const now=new Date(), target=new Date(now.getFullYear(),now.getMonth(),Math.min(dueDays[source]||25,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()));
 if(target<now) target.setMonth(target.getMonth()+1);
 const pad=n=>String(n).padStart(2,"0");
 return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}`;
}

async function refreshStockPrices({silent=false}={}){
 if(!navigator.onLine||!state.stocks.length)return;
 if(typeof refreshStocksBtn!=="undefined")refreshStocksBtn.disabled=true;
 let updated=0,failed=0;
 for(const stock of state.stocks){
  try{
   const quote=await fetchHoldingQuote(stock.id);
   stock.current=Number(quote.price);stock.priceSource=quote.provider;stock.priceStatus=quote.status;
   stock.priceAsOf=quote.asOf;stock.lastPriceFetchAt=new Date().toISOString();updated++;
  }catch(error){
   stock.priceStatus=error.code==="provider_plan_unavailable"?"API unavailable for current plan":`API error · ${error.code||"unavailable"}`;
   stock.lastPriceFetchAt=new Date().toISOString();failed++;
  }
 }
 save();renderAll();
 if(typeof refreshStocksBtn!=="undefined")refreshStocksBtn.disabled=false;
 if(!silent)toastMsg(`${updated} price${updated===1?"":"s"} updated${failed?`, ${failed} fallback`:""}`);
}

async function validateStockSymbols(){
 if(!state.stocks.length)return;
 if(typeof validateSymbolsBtn!=="undefined")validateSymbolsBtn.disabled=true;
 const results=[];
 for(const stock of state.stocks){
  try{await validateHoldingSymbol(stock.id);results.push(`${stock.ticker}: OK`)}
  catch(error){results.push(`${stock.ticker}: ${error.message}`)}
 }
 if(typeof validateSymbolsBtn!=="undefined")validateSymbolsBtn.disabled=false;
 alert(results.join("\n"));
}

qa("[data-page]").forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
qa("[data-go]").forEach(b=>b.onclick=()=>switchPage(b.dataset.go));
themeBtn.onclick=()=>setTheme(state.theme==="dark"?"light":"dark");
privacyBtn.onclick=()=>{state.privacy=!state.privacy; document.body.classList.toggle("private-hidden",state.privacy); privacyBtn.textContent=state.privacy?"🙈":"👁"; renderAll();};
qa("#cashFilter button").forEach(b=>b.onclick=()=>{qa("#cashFilter button").forEach(x=>x.classList.remove("active")); b.classList.add("active"); state.filter=b.dataset.filter; renderCashflow();});
cashSort.onchange=()=>{state.sort=cashSort.value; renderCashflow();};
txSearch.oninput=()=>renderCashflow();
qa("#prospectTabs button").forEach(b=>b.onclick=()=>{qa("#prospectTabs button").forEach(x=>x.classList.remove("active")); b.classList.add("active"); state.prospectMode=b.dataset.prospect; renderProspect(); renderInsights();});
baseModeToggle.onclick=()=>{state.baseMode = state.baseMode === "manual" ? "auto" : "manual"; saveSettings(); updateModeToggleLabels(); renderAll();};
optimisticModeToggle.onclick=()=>{state.optimisticMode = state.optimisticMode === "manual" ? "auto" : "manual"; saveSettings(); updateModeToggleLabels(); renderAll();};
baseGrowth.oninput=()=>{state.baseGrowth=Number(baseGrowth.value); saveSettings(); if(state.baseMode==="auto") renderAll();};
optimisticGrowth.oninput=()=>{state.optimisticGrowth=Number(optimisticGrowth.value); saveSettings(); if(state.optimisticMode==="auto") renderAll();};

qa("[data-open-tx]").forEach(b=>b.onclick=()=>{resetTxModal(); txModal.showModal();});
qa("#txType button").forEach(b=>b.onclick=()=>{qa("#txType button").forEach(x=>x.classList.remove("active")); b.classList.add("active");});
txForm.onsubmit=(e)=>{
 e.preventDefault();
 const tx={id:state.txEdit||createId(),type:q("#txType .active").dataset.type,amount:Number(txAmount.value),description:txDescription.value,category:txCategory.value,channel:txChannel.value,date:txDate.value};
 if(state.txEdit){
  const idx=state.transactions.findIndex(t=>t.id===state.txEdit);
  if(idx>-1) state.transactions[idx]=tx;
 }else state.transactions.unshift(tx);
 txModal.close(); resetTxModal(); save(); renderAll(); toastMsg("Transaction saved");
};

addAccountBtn.onclick=()=>openSimple("Add Account",[
 {key:"name",label:"Account Name"},
 {key:"type",label:"Type",options:["Cash","Bank","Wallet"],value:"Cash"},
 {key:"balance",label:"Balance",type:"number"}
],o=>state.accounts.push({id:createId(),...o}));

manageAccountsBtn.onclick=()=>{
 manageAccountsList.innerHTML=state.accounts.map((a,i)=>`<div class="manage-account-row"><input data-ma-name="${i}" value="${a.name}"><input data-ma-bal="${i}" type="number" value="${a.balance}"><button class="icon-mini" data-ma-del="${i}">🗑</button></div>`).join("")+`<button class="primary-btn" id="saveAccountsBtn">Save Changes</button>`;
 manageAccountsModal.showModal();
 qa("[data-ma-del]").forEach(b=>b.onclick=()=>{state.accounts.splice(Number(b.dataset.maDel),1); manageAccountsModal.close(); save(); renderAll();});
 q("#saveAccountsBtn").onclick=()=>{
  qa("[data-ma-name]").forEach(el=>state.accounts[Number(el.dataset.maName)].name=el.value);
  qa("[data-ma-bal]").forEach(el=>state.accounts[Number(el.dataset.maBal)].balance=Number(el.value));
  manageAccountsModal.close(); save(); renderAll(); toastMsg("Balances updated");
 };
};

addMonthlyBtn.onclick=()=>openSimple("Add Monthly Budget",[
 {key:"category",label:"Category"},
 {key:"monthly",label:"Monthly Budget",type:"number"}
],o=>state.budgets.push({id:createId(),...o}));
addYearlyBtn.onclick=()=>openSimple("Add Yearly Expense",[
 {key:"name",label:"Name"},
 {key:"amount",label:"Amount",type:"number"},
 {key:"month",label:"Payment Month"},
 {key:"category",label:"Category"}
],o=>state.yearly.push({id:createId(),...o}));
addEventBtn.onclick=addEventBtnTop.onclick=()=>openSimple("Add Event",[
 {key:"name",label:"Name"},
 {key:"amount",label:"Amount",type:"number"},
 {key:"date",label:"Date",type:"date",value:todayISO()},
 {key:"category",label:"Category"}
],o=>state.events.push({id:createId(),...o}));
addCreditBtn.onclick=()=>{
 simpleTitle.textContent="Add Credit / PayLater Item";
 simpleFields.innerHTML=`<label>Source<select id="sf_source"><option>Credit Card</option><option>GoPayLater</option><option>ShopeePayLater</option></select></label><label>Description<input id="sf_description" required></label><label>Amount<input id="sf_amount" type="number" required></label><label>Due Date<input id="sf_due" type="date" value="${autoDueDate('Credit Card')}" required></label>`;
 q("#sf_source").onchange=(e)=>q("#sf_due").value=autoDueDate(e.target.value);
 simpleForm.onsubmit=(e)=>{
  e.preventDefault();
  state.credit.push({id:createId(),source:sf_source.value,description:sf_description.value,amount:Number(sf_amount.value),due:sf_due.value,paid:false});
  simpleModal.close(); save(); renderAll(); toastMsg("Credit item added");
 };
 simpleModal.showModal();
};
addClientBtn.onclick=()=>openSimple("Add Client",[
 {key:"name",label:"Client Name"},
 {key:"monthly",label:"Monthly Retainer",type:"number"},
 {key:"paid",label:"Paid This Month",type:"number",value:0},
 {key:"carry",label:"Previous Outstanding",type:"number",value:0},
 {key:"status",label:"Status",options:["paid","pending","freeze"],value:"pending"}
],o=>state.clients.push({id:createId(),...o}));
addTickerBtn.onclick=()=>openSimple("Add Ticker",[
 {key:"ticker",label:"Ticker"},
 {key:"market",label:"Market",options:["IDX","NASDAQ","NYSE"],value:"NASDAQ"},
 {key:"provider",label:"Provider",options:["finnhub","twelvedata"],value:"finnhub"},
 {key:"providerSymbol",label:"Provider Symbol"},
 {key:"currency",label:"Currency",options:["IDR","USD"],value:"USD"},
 {key:"quantity",label:"Quantity",type:"number",step:".000001"},
 {key:"avg",label:"Average Price",type:"number",step:".01"},
 {key:"current",label:"Current Price",type:"number",step:".01"}
],o=>{o.id=createId();o.ticker=o.ticker.toUpperCase();o.displaySymbol=o.ticker;o.providerSymbol=(o.providerSymbol||o.ticker).toUpperCase();o.manualCurrent=o.current;o.priceSource="manual";o.priceStatus="manual";o.priceAsOf=null;o.base={};o.optimistic={};YEARS.slice(1).forEach(y=>{o.base[y]=o.current;o.optimistic[y]=o.current});state.stocks.push(o);});
addElectricityBtn.onclick=()=>openSimple("Add Meter Reading",[
 {key:"date",label:"Date",type:"date",value:todayISO()},
 {key:"time",label:"Time",type:"time",value:"19:00"},
 {key:"remaining",label:"Remaining kWh",type:"number",step:".01"}
],o=>state.electricity.push({id:createId(),...o}));

qa(".close-dialog").forEach(b=>b.onclick=()=>b.closest("dialog").close());
qa("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close()}));

function applyCloudState(next,{preserveUi=false}={}){
 if(preserveUi){renderAll();return;}
 const ui={page:state.page,privacy:state.privacy,filter:state.filter,sort:state.sort,txEdit:null,prospectMode:state.prospectMode};
 Object.assign(state,next,ui);
 document.documentElement.dataset.theme=state.theme;
 localStorage.setItem("cvfinance-theme-cache",state.theme);
 themeBtn.textContent=state.theme==="dark"?"☀":"☾";
 baseGrowth.value=state.baseGrowth;optimisticGrowth.value=state.optimisticGrowth;
 updateModeToggleLabels();renderAll();switchPage(state.page);
}

function updateSyncStatus(info){
 if(typeof syncStatus==="undefined")return;
 syncStatus.className=`sync-status ${info.kind}`;
 syncStatusText.textContent=info.message;
 unsyncedCount.textContent=info.pending?`${info.pending} unsynced`:"";
 const timestamp=info.lastSynced?new Date(info.lastSynced):null;
 lastSynced.textContent=timestamp?`Last synced ${timestamp.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`:"Not synced";
 syncStatus.title=info.detail||info.message;
}

syncManager=new SyncManager({onState:applyCloudState,onStatus:updateSyncStatus});

async function showSignedIn(user){
 authGate.hidden=true;document.body.classList.remove("auth-locked");
 accountEmail.textContent=user.email||"Private account";
 legacyImportBtn.hidden=!readLegacyLocalStorage();
 if(!stockRefreshStarted){stockRefreshStarted=true;setTimeout(()=>refreshStockPrices({silent:true}),500);}
}

async function boot(){
 document.documentElement.dataset.theme=state.theme;themeBtn.textContent=state.theme==="dark"?"☀":"☾";
 privacyBtn.textContent="👁";txDate.value=todayISO();updateModeToggleLabels();
 baseGrowth.value=state.baseGrowth;optimisticGrowth.value=state.optimisticGrowth;renderAll();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
 try{
  const user=await syncManager.connect();
  if(user)await showSignedIn(user);else{authGate.hidden=false;authEmail.focus();}
 }catch(error){authGate.hidden=false;authError.textContent=error.message;updateSyncStatus({kind:"error",message:"Setup required",detail:error.message});}
}

authForm.onsubmit=async event=>{
 event.preventDefault();authError.textContent="";authSubmit.disabled=true;authSubmit.textContent="Signing in…";
 try{const user=await syncManager.connect(authEmail.value,authPassword.value);await showSignedIn(user)}
 catch(error){authError.textContent=error.message}
 finally{authSubmit.disabled=false;authSubmit.textContent="Sign in";}
};

dataBtn.onclick=()=>dataModal.showModal();
syncStatus.onclick=()=>dataModal.showModal();
exportBackupBtn.onclick=()=>syncManager.downloadBackup(state);
importBackupBtn.onclick=()=>backupFile.click();
backupFile.onchange=async()=>{
 const file=backupFile.files[0];if(!file)return;
 if(!confirm("Replace all cloud data with this backup?"))return;
 try{await syncManager.importBackup(file);dataModal.close();toastMsg("Backup imported")}
 catch(error){alert(error.message)}finally{backupFile.value="";}
};
legacyImportBtn.onclick=async()=>{
 const legacy=readLegacyLocalStorage();if(!legacy)return alert("No v6 local data found on this device.");
 if(!confirm("Replace cloud data with the v6.3.1 data stored in this browser?"))return;
 try{await syncManager.replaceAll(legacy);dataModal.close();toastMsg("Local data migrated")}
 catch(error){alert(error.message)}
};
seedDataBtn.onclick=async()=>{
 if(state.accounts.length)return alert("Cloud data already exists. Seed was not applied.");
 try{
  const supabase=await getSupabase();const {error}=await supabase.rpc("seed_cvfinance_mvp");if(error)throw error;
  await syncManager.handleRemoteChange();dataModal.close();toastMsg("MVP seed loaded");
 }catch(error){alert(error.message)}
};
logoutBtn.onclick=()=>syncManager.signOut();
refreshStocksBtn.onclick=()=>refreshStockPrices();
validateSymbolsBtn.onclick=()=>validateStockSymbols();

let installPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;installPwaBtn.hidden=false;});
installPwaBtn.onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installPwaBtn.hidden=true;};

boot();
