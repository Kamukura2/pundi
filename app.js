import { createEmptyState, createId, createMvpSeed, readLegacyLocalStorage, YEARS } from "./src/data/default-data.js";
import { annualExpenseBreakdown, annualOperatingPerformance, buildMonthlyTimeline, buildProjection, getBudgetProgress, getClientOutstanding, getClientPaidThisMonth, getCurrentNetWorth, getEndingClients, getEntrustedDeduction, getFixedIncome, getReceivableClients, getRecurringClients, getTotalOutstanding, getTotalPaid, getYearlyProjectionTotal, monthKey, monthlyBudgetRemaining, recordedExpenseForBudget, remainingYearExpenseBreakdown, remainingYearIncomeBreakdown } from "./src/data/finance-model.js";
import { SyncManager } from "./src/sync/sync-manager.js";
import { fetchHoldingQuote, fetchUsdIdrRate, isPriceStale, validateHoldingSymbol } from "./src/stocks/client.js";
import { normalizeStockMapping, quantityForDisplay, quantityForStorage, quantityUnit } from "./src/stocks/holding.js";
import { getSupabase } from "./src/lib/supabase.js";

const COLORS=["#7F66FF","#39C3FF","#FF8F63","#36D695","#F4C24F","#FF6EA8","#62C8FF","#8D7AFF"];
const COMPANY_EXPENSE_TAG="Expense Perusahaan";
const DEFAULT_USD_IDR=17810;
const MIN_USD_IDR=10000;
const MAX_USD_IDR=25000;
const CHANNEL_PRESETS=["Offline","Shopee","GrabFood","GoFood","Transfer","Tokopedia"];
const todayISO=()=>{
 const d=new Date(), pad=n=>String(n).padStart(2,"0");
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const state=createEmptyState();
state.theme=localStorage.getItem("cvfinance-theme-cache")||"dark";
state.language=localStorage.getItem("cvfinance-language-cache")||"en";
let syncManager;
let stockRefreshStarted=false;
let fxRefreshTimer=null;
let fxRefreshPromise=null;
let transactionTagFilter=null;
const currentYear=()=>new Date().getFullYear();
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const validUsdIdr=value=>Number.isFinite(Number(value))&&Number(value)>=MIN_USD_IDR&&Number(value)<=MAX_USD_IDR;
const monthIndexFromName=value=>{
 const parsed=new Date(`${String(value||"").trim()} 1, 2000`).getMonth();
 return Number.isFinite(parsed)?parsed:-1;
};

const fmt=(n,compact=false)=>{
 if(state.privacy) return "Rp••••••";
 n=Number(n||0);
 if(compact){
  const a=Math.abs(n);
  if(a>=1e9) return `Rp${(n/1e9).toFixed(1)}B`;
  if(a>=1e6) return `Rp${(n/1e6).toFixed(1)}M`;
  if(a>=1e3) return `Rp${(n/1e3).toFixed(1)}K`;
 }
 return new Intl.NumberFormat(state.language==="id"?"id-ID":"en-US",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
};
const percent=(value,base,{absolute=false}={})=>{
 const ratio=Number(base)?Number(value)/Math.abs(Number(base))*100:0;
 const normalized=Object.is(ratio,-0)?0:ratio;
 const shown=absolute?Math.abs(normalized):normalized;
 return `${shown>0&&!absolute?"+":""}${shown.toFixed(2)}%`;
};
const save=()=>syncManager?.persist(state);
const saveSettings=()=>save();
const q=(s)=>document.querySelector(s);
const qa=(s)=>[...document.querySelectorAll(s)];
const hasActiveEditor=()=>{
 const active=document.activeElement;
 return Boolean(active&&active.matches("input,select,textarea,[contenteditable=true]")&&!active.closest("#authGate"));
};
const plainNumber=value=>{
 const number=Number(value||0);
 return Number.isInteger(number)?String(number):String(Number(number.toFixed(6)));
};
const accountTotal=()=>state.accounts.reduce((a,b)=>a+Number(b.balance),0);
const entrustedTotal=(source)=>getEntrustedDeduction(state.entrustedFunds,source);
const netAccountTotal=()=>accountTotal()-entrustedTotal("cash");
const recurringClients=()=>getRecurringClients(state.clients);
const endingClients=()=>getEndingClients(state.clients);
const fixedIncome=()=>getFixedIncome(state.clients);
const clientOutstanding=(c)=>getClientOutstanding(c);
const receivableClients=()=>getReceivableClients(state.clients);
const totalOutstanding=()=>getTotalOutstanding(state.clients);
const totalPaid=()=>getTotalPaid(state.clients);
const currentMonthTransactions=()=>state.transactions.filter(isCurrentMonthTx);
const monthlyBudget=()=>state.budgets.reduce((a,b)=>a+Number(b.monthly),0);
const budgetRemaining=()=>monthlyBudgetRemaining(state.budgets,state.transactions,new Date());
const yearlyTotal=()=>state.yearly.reduce((a,b)=>a+Number(b.amount),0);
const yearlyProjectionTotal=(year)=>getYearlyProjectionTotal(state.yearly,year,currentYear());
const eventTotal=()=>state.events.reduce((a,b)=>a+Number(b.amount),0);
const unpaidCreditTotal=()=>state.credit.filter(x=>!x.paid).reduce((a,b)=>a+Number(b.amount),0);
const isCurrentMonthTx=t=>String(t.date).startsWith(monthKey(new Date()));
const isCompanyExpenseTx=t=>t.type==="expense"&&String(t.category||"").trim().toLowerCase()===COMPANY_EXPENSE_TAG.toLowerCase();
const isCompanyExpenseTag=value=>String(value||"").trim().toLowerCase()===COMPANY_EXPENSE_TAG.toLowerCase();
const spentExact=(cat)=>state.transactions.filter(t=>t.type==="expense"&&t.category===cat&&isCurrentMonthTx(t)).reduce((a,b)=>a+Number(b.amount),0);
const coffeeSpentForInsight=()=>state.transactions.filter(t=>t.type==="expense"&&String(t.category).toLowerCase()==="coffee"&&String(t.date).startsWith(monthKey(new Date()))).reduce((a,b)=>a+Number(b.amount),0);
const foodBudget=()=>state.budgets.filter(b=>["Food","Coffee"].includes(b.category)).reduce((a,b)=>a+Number(b.monthly),0);
const stockPrice=(s,y,mode)=>{
 if(y===currentYear()) return Number(s.current);
 const useMode=mode==="base"?state.baseMode:state.optimisticMode;
 const g=mode==="base"?Number(state.baseGrowth):Number(state.optimisticGrowth);
 if(useMode==="auto") return Number(s.current)*Math.pow(1+g/100,y-currentYear());
 return Number(s[mode][y]??s.current);
};
const stockValue=(s,y=currentYear(),mode="base")=>{
 let v=Number(s.quantity)*stockPrice(s,y,mode);
 return s.currency==="USD"?v*state.usdIdr:v;
};
const invested=(s)=>{
 let v=Number(s.quantity)*Number(s.avg);
 return s.currency==="USD"?v*state.usdIdr:v;
};
const stockExtrasValue=()=>Math.max(0,Number(state.stockExtras?.netcashIdr||0))+Math.max(0,Number(state.stockExtras?.walletUsd||0))*Number(state.usdIdr||0);
const holdingsPortfolio=(y=currentYear(),mode="base")=>state.stocks.reduce((a,s)=>a+stockValue(s,y,mode),0);
const portfolio=(y=currentYear(),mode="base")=>holdingsPortfolio(y,mode)+stockExtrasValue();
const netPortfolio=(y=currentYear(),mode="base")=>portfolio(y,mode)-entrustedTotal("stocks");
const currentNW=()=>getCurrentNetWorth(netAccountTotal(),netPortfolio());
const AGE_BASE=[33,30,0];
const ageTriplet=(year)=>AGE_BASE.map(v=>v+(year-2026));
const moneyClass=(n)=>Number(n)<0?"negative":"";
const ID_TRANSLATIONS={
 "Accumulation":"Akumulasi","History":"Riwayat","Expenses":"Pengeluaran","Clients":"Klien","Stocks":"Saham","Electricity":"Listrik","Prospect":"Proyeksi","Insights":"Insight",
 "Available Balance":"Saldo Tersedia","Outstanding Client Income":"Piutang Klien","Balances":"Saldo","Cash, Bank & Wallets":"Tunai, Bank & Dompet","Payment Status":"Status Pembayaran",
 "Pending Expenses":"Kewajiban Mendatang","Where the Money Sits":"Distribusi Aset","Planned vs Actual":"Rencana vs Aktual","All":"Semua","Expense":"Pengeluaran","Income":"Pemasukan",
 "Newest":"Terbaru","Category":"Kategori","Amount":"Nominal","Recorded Income":"Pemasukan Tercatat","Recorded Expense":"Pengeluaran Tercatat","Recorded Net":"Net Tercatat",
 "Total Expense This Month":"Total Pengeluaran Bulan Ini","Expense Categories":"Kategori Pengeluaran","Expense Channels":"Channel Pengeluaran","Channel Mix":"Komposisi Channel","Budget Pace":"Laju Anggaran","Transactions":"Transaksi","Monthly Budget":"Anggaran Bulanan","Yearly Expense":"Pengeluaran Tahunan","Events":"Acara",
 "Remaining Expense This Year":"Sisa Pengeluaran Tahun Ini","Dynamic estimate from this month through December. History is tracking only and excluded from projection.":"Estimasi dinamis dari bulan ini sampai Desember. Riwayat hanya untuk pencatatan dan tidak masuk proyeksi.",
 "Monthly Remaining":"Sisa Bulanan","Events + Credit":"Acara + Kredit","Editable Budgets":"Anggaran yang Dapat Diedit","Category Breakdown":"Rincian Kategori","Credit Card & PayLater":"Kartu Kredit & PayLater","Entrusted Funds":"Titipan Dana","Non-recurring liability":"Kewajiban non-berulang","Budget Tag":"Tag Anggaran","Cash Balance":"Saldo Kas","Settled":"Selesai","Active":"Aktif",
 "Paid Items":"Item Lunas","Paid This Month":"Dibayar Bulan Ini","Outstanding":"Belum Dibayar","Fixed Monthly":"Tetap Bulanan","Recurring Clients":"Klien Berulang","Ending Clients":"Klien Berakhir","Estimated Income This Year":"Estimasi Pemasukan Tahun Ini","Outstanding Now":"Piutang Saat Ini",
 "Fixed Yearly":"Tetap Tahunan","Expense Perusahaan":"Expense Perusahaan","Capital record only":"Pencatatan modal saja",
 "Total Portfolio Value":"Total Nilai Portofolio","Invested":"Modal","Unrealized":"Belum Direalisasi","Allocation":"Alokasi","Holdings":"Kepemilikan","Target prices":"Target harga","Budget":"Anggaran","Optional liquid assets":"Aset likuid opsional","Netcash & USD Wallet":"Netcash & Dompet USD","Included in total assets":"Masuk ke total aset",
 "Latest Meter Balance":"Sisa Token Terbaru","Average Daily Usage":"Rata-rata Harian","Estimated Monthly Cost":"Estimasi Biaya Bulanan","Meter Readings":"Catatan Meter",
 "Read-only projection":"Proyeksi hanya-baca","Annual View":"Tampilan Tahunan","Operating Performance":"Kinerja Operasional","Annual Income":"Pemasukan Tahunan","Annual Expense":"Pengeluaran Tahunan","Annual Net":"Net Tahunan","Future Cash + Assets":"Kas + Aset Masa Depan","Cash Runway":"Daya Tahan Kas","Largest Expense":"Pengeluaran Terbesar","Largest Holding":"Saham Terbesar",
 "Base vs Optimistic":"Dasar vs Optimistis","Money Story This Month":"Cerita Keuangan Bulan Ini","Decision Metrics":"Metrik Keputusan","Add Transaction":"Tambah Transaksi","Save":"Simpan","Editor":"Editor",
 "Financial Action Plan":"Rencana Aksi Keuangan","Next Moves":"Langkah Berikutnya","Operating Balance":"Keseimbangan Operasional","Client Follow-up":"Tindak Lanjut Klien","Cash Buffer":"Cadangan Kas",
 "Data & Sync":"Data & Sinkronisasi","Signed in as":"Masuk sebagai","Sign out":"Keluar","Search...":"Cari...","Base":"Dasar","Optimistic":"Optimistis","Current":"Saat Ini","Yearly":"Tahunan","Monthly":"Bulanan"
};
const ID_REPLACEMENTS=[
 ["Healthy projected net worth","Proyeksi net worth sehat"],["Positive projected net worth","Proyeksi net worth positif"],["Negative projected net worth","Proyeksi net worth negatif"],
 ["Only the unpaid portion this month","Hanya bagian yang belum dibayar bulan ini"],["Due or overdue this month","Jatuh tempo atau terlambat bulan ini"],["Only items due this month","Hanya item jatuh tempo bulan ini"],
 ["Cash, bank & wallets","Tunai, bank & dompet"],["Recurring + ending, unpaid only","Berulang + berakhir, hanya yang belum dibayar"],["Income recorded in History","Pemasukan tercatat di Riwayat"],["Monthly + yearly + events + credit","Bulanan + tahunan + acara + kredit"],["Cash after obligations + stocks","Kas setelah kewajiban + saham"],
 ["months of runway","bulan daya tahan kas"],["Current liquid balance is","Saldo likuid saat ini"],["remaining monthly obligations are","sisa kewajiban bulanan"],["collected","tertagih"],["All client payments are collected. Good job!","Semua pembayaran klien sudah tertagih. Bagus!"],["is still outstanding from recurring and ending clients.","masih belum dibayar oleh klien berulang dan berakhir."],
 ["Coffee spending is controlled","Pengeluaran kopi terkendali"],["Coffee is getting expensive","Pengeluaran kopi mulai mahal"],["Coffee is over budget","Pengeluaran kopi melebihi anggaran"],["Coffee usage is","Pemakaian anggaran kopi"],["of its default monthly budget.","dari anggaran bulanan default."],
 ["Electricity is decreasing — good job!","Pemakaian listrik menurun — bagus!"],["Electricity usage is rising","Pemakaian listrik meningkat"],["Electricity is stable","Pemakaian listrik stabil"],["More readings needed","Perlu lebih banyak pencatatan"],["Latest pace is","Laju terbaru"],["versus the prior interval","dibanding interval sebelumnya"],["Add at least two readings to unlock a usage trend.","Tambahkan minimal dua catatan untuk melihat tren pemakaian."],
 ["Recorded expense","Pengeluaran tercatat"],["Expense baseline is building","Baseline pengeluaran sedang terbentuk"],["History recorded","Riwayat mencatat"],["this month. It updates pacing only and is not deducted twice.","bulan ini. Data hanya memperbarui progress dan tidak dikurangi dua kali."],
 ["Portfolio P/L","Untung/Rugi Portofolio"],["Current portfolio is","Portofolio saat ini"],["against","dibanding"],["invested.","modal."],["Up ","Naik "],["Down ","Turun "],
 ["Cash runway","Daya tahan kas"],["Client collection","Penagihan klien"],["Coffee check","Cek kopi"],["Electricity trend","Tren listrik"],["History trend","Tren riwayat"],
 ["Projected month-end net worth","Proyeksi net worth akhir bulan"],["Remaining monthly budget","Sisa anggaran bulanan"],["Outstanding clients","Piutang klien"],["Additional income","Pemasukan tambahan"],["Remaining expenses","Sisa pengeluaran"],
 ["Starting balance","Saldo awal"],["Current market value","Nilai pasar saat ini"],["Recurring monthly","Berulang bulanan"],["Final payment","Pembayaran terakhir"],["Previous:","Sebelumnya:"],["Outstanding:","Belum dibayar:"],["Remaining:","Sisa:"],
 ["Paid ","Dibayar "],["Unpaid","Belum dibayar"],["Done this year","Lunas tahun ini"],["Undo done","Batalkan lunas"],["DUE ","JATUH TEMPO "],["DONE ","LUNAS "],
 ["Projected Net Worth in","Proyeksi Net Worth pada"],["Projected ","Proyeksi "],["Opening Cash + Stocks + Income − Expenses","Kas Awal + Saham + Pemasukan − Pengeluaran"],["Opening Cash","Kas Awal"],["Cash ","Kas "],["Remaining recurring income","Sisa pemasukan berulang"],["Recurring income","Pemasukan berulang"],["Current receivables","Piutang saat ini"],["Receivables + extra income","Piutang + pemasukan tambahan"],["This month remaining","Sisa bulan ini"],["Recurring expense","Pengeluaran berulang"],["Yearly expense","Pengeluaran tahunan"],["Credit & PayLater","Kredit & PayLater"],["Events + credit","Acara + kredit"],["remaining months","bulan tersisa"],
 ["Entrusted funds","Titipan dana"],["Active cash + stock liabilities","Kewajiban kas + saham aktif"],["Active Liability","Kewajiban Aktif"],["Person / Description","Nama Orang / Keterangan"],["Deduct From","Kurangi Dari"],["Income Tag","Tag Pemasukan"],["after entrusted funds","setelah dikurangi titipan dana"],["money held on behalf of someone else","dana yang dititipkan oleh orang lain"],["Non-recurring liability","Kewajiban non-berulang"],
 ["Add ","Tambah "],["Edit ","Edit "],["Remove","Hapus"],["No ","Tidak ada "],["This Month","Bulan Ini"],["This Year","Tahun Ini"],["Current year","Tahun berjalan"]
];
function translateText(value){
 const text=String(value||"");if(state.language!=="id")return text;
 const trimmed=text.trim();if(ID_TRANSLATIONS[trimmed])return text.replace(trimmed,ID_TRANSLATIONS[trimmed]);
 let out=text;ID_REPLACEMENTS.forEach(([from,to])=>{out=out.replaceAll(from,to)});return out;
}
function applyLanguage(){
 document.documentElement.lang=state.language==="id"?"id":"en";
 languageBtn.dataset.language=state.language;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let node;while((node=walker.nextNode())){
  if(!node.parentElement||node.parentElement.closest("#languageBtn,script,style"))continue;
  if(node.__english===undefined)node.__english=node.nodeValue;
  node.nodeValue=state.language==="id"?translateText(node.__english):node.__english;
 }
 qa("[placeholder],[title],[aria-label]").forEach(el=>["placeholder","title","aria-label"].forEach(attr=>{
  if(!el.hasAttribute(attr)||el.closest("#languageBtn"))return;const key=`i18n${attr.replace("-","")}`;
  if(el.dataset[key]===undefined)el.dataset[key]=el.getAttribute(attr);el.setAttribute(attr,state.language==="id"?translateText(el.dataset[key]):el.dataset[key]);
 }));
 localStorage.setItem("cvfinance-language-cache",state.language);
}

function normalizeStockMappings() {
 let changed=false;
 state.stocks.forEach(stock=>{if(normalizeStockMapping(stock))changed=true;});
 return changed;
}

function projection(mode="base"){
 return buildProjection({
  years:YEARS,referenceDate:new Date(),accountTotal:netAccountTotal(),clients:state.clients,budgets:state.budgets,yearly:state.yearly,
  events:state.events,credit:state.credit,transactions:[],portfolioForYear:year=>netPortfolio(year,mode)
 });
}
function monthlyTimeline(mode="base"){
 return buildMonthlyTimeline({referenceDate:new Date(),accountTotal:netAccountTotal(),clients:state.clients,budgets:state.budgets,yearly:state.yearly,events:state.events,credit:state.credit,transactions:[],portfolioForYear:year=>netPortfolio(year,mode)});
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
 ${pts.map((q,i)=>`<circle class="chart-point" data-tip="${labels[i]||`Point ${i+1}`}" data-value="${vals[i]}" tabindex="0" cx="${q[0]}" cy="${q[1]}" r="6.5" fill="${light?'#fff':'#39C3FF'}"/>`).join("")}
 ${labels.map((l,i)=>`<text x="${pts[i][0]}" y="${h-8}" text-anchor="middle" fill="${light?'rgba(255,255,255,.84)':'#7a879b'}" font-size="13">${l}</text>`).join("")}
 </svg>`;
}
function bars(vals,labels){
 const w=920,h=280,p=28,max=Math.max(...vals,1)*1.15,g=(w-p*2)/Math.max(vals.length,1),bw=Math.min(54,g*.5);
 return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7F66FF"/><stop offset="1" stop-color="#39C3FF"/></linearGradient></defs>
 ${vals.map((v,i)=>{const bh=v/max*(h-p*2),x=p+i*g+g/2-bw/2; return `<rect class="chart-bar" data-tip="${labels[i]}" data-value="${v}" tabindex="0" x="${x}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="10" fill="url(#bg)"/><text x="${x+bw/2}" y="${h-8}" text-anchor="middle" fill="#7a879b" font-size="12">${labels[i]}</text>`}).join("")}
 </svg>`;
}
function lineMulti(series,labels=[]){
 const all=series.flatMap(s=>s.vals), w=920,h=280,p=28,min=Math.min(...all),max=Math.max(...all),rg=max-min||1;
 return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
 ${[0,1,2,3].map(i=>`<line x1="${p}" y1="${p+i*(h-p*2)/3}" x2="${w-p}" y2="${p+i*(h-p*2)/3}" stroke="rgba(144,157,181,.15)"/>`).join("")}
 ${series.map(s=>{const pts=s.vals.map((v,i)=>[p+i*(w-p*2)/Math.max(s.vals.length-1,1),h-p-(v-min)/rg*(h-p*2)]);return `<path d="${pts.map((q,i)=>(i?'L':'M')+q.join(' ')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="4" stroke-linecap="round"/>${pts.map((q,i)=>`<circle class="chart-point" data-tip="${s.name||'Series'} · ${labels[i]||i+1}" data-value="${s.vals[i]}" tabindex="0" cx="${q[0]}" cy="${q[1]}" r="6" fill="${s.color}"/>`).join('')}`}).join("")}
 </svg>`;
}
function listRows(items){
 return items.map(x=>`<div class="list-row"><div class="list-ic">${x.icon||"•"}</div><div class="list-meta"><b>${x.name}</b><small>${x.sub||""}</small></div><div class="list-value ${x.cls||""} private">${x.value||""}</div></div>`).join("");
}
function attachTips(){
 const show=(el,e)=>{
  tooltip.innerHTML=`<b>${el.dataset.tip}</b><br>${fmt(Number(el.dataset.value))}`;
  const rect=el.getBoundingClientRect(),x=Number.isFinite(e?.clientX)&&e.clientX?e.clientX:rect.left+rect.width/2,y=Number.isFinite(e?.clientY)&&e.clientY?e.clientY:rect.top;
  tooltip.style.left=Math.max(10,Math.min(innerWidth-190,x+12))+"px";
  tooltip.style.top=Math.max(12,y-42)+"px";
  tooltip.classList.add("show");
 };
 qa("[data-tip]").forEach(el=>{
  el.onpointerenter=e=>show(el,e);el.onpointermove=e=>show(el,e);el.onpointerleave=()=>tooltip.classList.remove("show");
  el.onfocus=e=>show(el,e);el.onblur=()=>tooltip.classList.remove("show");
  el.onclick=e=>{show(el,e);setTimeout(()=>tooltip.classList.remove("show"),1800);};
 });
}
function toastMsg(x){toast.textContent=x;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1400)}
function setTheme(t){state.theme=t;document.documentElement.dataset.theme=t;localStorage.setItem("cvfinance-theme-cache",t);saveSettings();themeBtn.textContent=t==="dark"?"☀":"☾"}
function switchPage(p){
 state.page=p;
 qa(".page").forEach(x=>x.classList.toggle("active",x.id===p));
 qa("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
 const map={accumulation:["FINANCIAL COMMAND CENTER","Accumulation"],cashflow:["HISTORICAL RECORD","History"],expenses:["EDITABLE BUDGET & COSTS","Expenses"],clients:["RETAINERS & RECEIVABLES","Clients"],stocks:["PORTFOLIO & TARGETS","Stocks"],electricity:["UTILITY COST MONITOR","Electricity"],prospect:["READ-ONLY FUTURE PROJECTION","Prospect"],insights:["INFOGRAPHIC SUMMARY","Insights"]};
 kicker.textContent=map[p][0]; title.textContent=map[p][1];
 applyLanguage();
 if(window.matchMedia("(max-width:1024px)").matches)window.scrollTo({top:0,left:0,behavior:"auto"});
}

function renderAccumulation(){
 const timeline=monthlyTimeline("base"), current=timeline[0]||{nw:currentNW(),cash:netAccountTotal(),income:0,extraIncome:0,recurringExpense:0,yearlyExpense:0,eventExpense:0,creditExpense:0};
 const projected=current.nw;
 projectedCash.textContent=fmt(projected);
 availableBalance.textContent=fmt(netAccountTotal());
 outstandingIncome.textContent=fmt(totalOutstanding());
 cashHealth.textContent=projected>monthlyBudget()*2?"Healthy projected net worth":projected>0?"Positive projected net worth":"Negative projected net worth";
 accChart.innerHTML=line(timeline.map(row=>row.nw),timeline.map(row=>new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"short"}).format(new Date(row.year,row.month,1))),true);
 accountList.innerHTML=listRows(state.accounts.map(a=>({icon:a.type==="Cash"?"💵":a.type==="Bank"?"🏦":"📱",name:a.name,sub:a.type,value:fmt(a.balance)})));
 paymentSummary.innerHTML=listRows(receivableClients().map(c=>({icon:c.clientType==="ending"?"⚑":c.status==="paid"?"✅":"⏳",name:c.name,sub:c.clientType==="ending"?"Ending client":`Paid ${fmt(c.paid)}`,value:fmt(clientOutstanding(c)),cls:clientOutstanding(c)===0?"positive":""})));
 pendingSummary.innerHTML=listRows([
  {icon:"🧾",name:"Remaining monthly budget",sub:"Only the unpaid portion this month",value:fmt(current.recurringExpense)},
  {icon:"📅",name:"Yearly due",sub:"Due or overdue this month",value:fmt(current.yearlyExpense)},
  {icon:"📌",name:"Events + credit due",sub:"Only items due this month",value:fmt(current.eventExpense+current.creditExpense)}
  ,{icon:"🫱🏻‍🫲🏽",name:"Entrusted funds",sub:"Active cash + stock liabilities",value:`−${fmt(entrustedTotal())}`}
 ]);
 balanceDonut.innerHTML=donut(state.accounts.map(a=>[a.name,Number(a.balance)]),fmt(accountTotal(),true));
 balanceLegend.innerHTML=legend(state.accounts.map(a=>[a.name,Number(a.balance)]));
 monthModel.innerHTML=listRows([
  {icon:"🏦",name:"Starting balance",sub:"Cash, bank & wallets after entrusted funds",value:fmt(netAccountTotal()),cls:netAccountTotal()<0?"negative":"positive"},
  {icon:"📥",name:"Outstanding clients",sub:"Recurring + ending, unpaid only",value:fmt(current.income),cls:"positive"},
  {icon:"📓",name:"History entries",sub:"Tracking only · excluded from assets and projection",value:"Ledger only"},
  {icon:"🧾",name:"Remaining expenses",sub:"Monthly + yearly + events + credit",value:`−${fmt(current.expenses)}`,cls:"negative"},
  {icon:"📈",name:"Stocks",sub:"Market value after entrusted funds",value:fmt(current.portfolio),cls:current.portfolio<0?"negative":"positive"},
  {icon:"💎",name:"Projected month-end net worth",sub:"Cash after obligations + stocks",value:fmt(projected),cls:projected<0?"negative":"positive"}
 ]);
}

function renderCashflow(){
 const now=new Date(),activeMonthKey=monthKey(now),currentRows=currentMonthTransactions(),expenseRows=currentRows.filter(t=>t.type==="expense"),totalExpense=expenseRows.reduce((sum,t)=>sum+Number(t.amount),0);
 const activeMonthLabel=new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"long",year:"numeric"}).format(now);
 cashMonthLabel.textContent=activeMonthLabel.toUpperCase();
 cashMonthExpense.textContent=fmt(totalExpense);
 const groupExpenses=field=>Object.entries(expenseRows.reduce((groups,row)=>{const fallback=field==="channel"?"Offline":"Uncategorized",key=String(row[field]||fallback).trim()||fallback;groups[key]=(groups[key]||0)+Number(row.amount);return groups;},{})).sort((a,b)=>b[1]-a[1]);
 const categoryEntries=groupExpenses("category"),channelEntries=groupExpenses("channel"),emptyLegend=`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No expense this month</b><small>New expenses will appear here automatically</small></div></div>`;
 cashDonut.innerHTML=donut(categoryEntries.length?categoryEntries:[["No expense",1]],fmt(totalExpense,true));
 cashLegend.innerHTML=categoryEntries.length?legend(categoryEntries):emptyLegend;
 cashChannelDonut.innerHTML=donut(channelEntries.length?channelEntries:[["No expense",1]],fmt(totalExpense,true));
 cashChannelLegend.innerHTML=channelEntries.length?legend(channelEntries):emptyLegend;
 const pace=[...state.budgets].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)).map(item=>[item.category,recordedExpenseForBudget(item,state.transactions,new Date()),Number(item.monthly)]);
 budgetPace.innerHTML=pace.map(([name,spent,budget])=>{
  const pct=budget?spent/budget*100:0, cls=pct>100?"over":pct>80?"warn":"";
  return `<div class="progress-row"><div class="progress-top"><b>${name}</b><small class="private">${fmt(spent)} / ${fmt(budget)}</small></div><div class="progress ${cls}"><span style="width:${Math.min(100,pct)}%"></span></div><small>${pct.toFixed(1)}% used</small></div>`;
 }).join("")||`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No budget categories</b><small>Add categories in Expenses → Budget</small></div></div>`;
 let list=[...state.transactions];
 const search=(txSearch.value||"").toLowerCase();
 list=list.filter(t=>state.filter==="all"||t.type===state.filter).filter(t=>(`${t.description} ${t.category} ${t.channel}`).toLowerCase().includes(search));
 if(transactionTagFilter)list=list.filter(t=>String(t[transactionTagFilter.kind]||"")===transactionTagFilter.value);
 const sortRows=rows=>{if(state.sort==="category")rows.sort((a,b)=>a.category.localeCompare(b.category));else if(state.sort==="amount")rows.sort((a,b)=>b.amount-a.amount);else rows.sort((a,b)=>b.date.localeCompare(a.date));return rows;};
 const visibleCurrent=sortRows(list.filter(t=>String(t.date).slice(0,7)===activeMonthKey));
 const groups=new Map();
 list.filter(t=>String(t.date).slice(0,7)!==activeMonthKey).forEach(t=>{const key=String(t.date).slice(0,7)||"unknown";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);});
 const tagChip=(kind,value)=>{
  const active=transactionTagFilter?.kind===kind&&transactionTagFilter.value===String(value||"");
  return `<button type="button" class="tx-filter-chip ${kind} ${active?"active":""}" data-tx-tag-kind="${kind}" data-tx-tag-value="${encodeURIComponent(String(value||""))}">${escapeHtml(value||"—")}</button>`;
 };
 const row=t=>`<div class="tx-row"><div class="tx-badge ${t.type}"><span>${t.type==="income" ? "+" : "−"}</span></div><div class="tx-main"><b>${escapeHtml(t.description)}</b></div><div class="tx-meta">${tagChip("category",t.category)}${tagChip("channel",t.channel)}<span class="tx-date">${escapeHtml(t.date)}</span></div><div class="tx-amt ${t.type==="income"?"positive":"negative"} private">${t.type==="income"?"+":"−"}${fmt(t.amount)}</div><button class="icon-mini tx-edit" data-id="${t.id}" title="Edit">✎</button><button class="icon-mini tx-delete" data-delete-tx="${t.id}" title="Delete">🗑</button></div>`;
 const currentIncome=visibleCurrent.filter(t=>t.type==="income").reduce((sum,t)=>sum+Number(t.amount),0),currentExpense=visibleCurrent.filter(t=>t.type==="expense").reduce((sum,t)=>sum+Number(t.amount),0);
 const currentSection=`<section class="tx-current-month"><div class="tx-period-head"><span><small>CURRENT MONTH</small><b>${activeMonthLabel}</b></span><span class="archive-totals private"><em class="positive">+${fmt(currentIncome)}</em><em class="negative">−${fmt(currentExpense)}</em><small>${visibleCurrent.length} transactions</small></span></div><div class="tx-current-list">${visibleCurrent.length?visibleCurrent.map(row).join(""):`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No matching transactions this month</b><small>The active month starts fresh automatically; previous records remain in Archive.</small></div></div>`}</div></section>`;
 const keys=[...groups.keys()].sort((a,b)=>b.localeCompare(a));
 const archiveSection=`<section class="tx-history-archive"><div class="tx-archive-heading"><div><small>ARCHIVE</small><h4>Previous Months</h4></div><p>Stored permanently and excluded from the current-month totals.</p></div>${keys.map(key=>{
  const rows=sortRows(groups.get(key));
  const [year,month]=key.split("-").map(Number),label=Number.isFinite(month)?new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"long",year:"numeric"}).format(new Date(year,month-1,1)):key;
  const income=rows.filter(t=>t.type==="income").reduce((sum,t)=>sum+Number(t.amount),0),expense=rows.filter(t=>t.type==="expense").reduce((sum,t)=>sum+Number(t.amount),0);
  return `<details class="tx-archive"><summary><span><small>MONTHLY ARCHIVE</small><b>${label}</b></span><span class="archive-totals private"><em class="positive">+${fmt(income)}</em><em class="negative">−${fmt(expense)}</em><small>${rows.length} transactions</small></span></summary><div class="tx-archive-list">${rows.map(row).join("")}</div></details>`;
 }).join("")||`<div class="list-row"><div class="list-ic">✓</div><div class="list-meta"><b>No previous-month archive yet</b><small>When the month changes, this month's records move here automatically.</small></div></div>`}</section>`;
 txList.innerHTML=currentSection+archiveSection;
 qa("[data-tx-tag-kind]").forEach(button=>button.onclick=()=>{
  const next={kind:button.dataset.txTagKind,value:decodeURIComponent(button.dataset.txTagValue||"")};
  transactionTagFilter=transactionTagFilter?.kind===next.kind&&transactionTagFilter.value===next.value?null:next;
  renderCashflow();
 });
 qa(".tx-edit").forEach(b=>b.onclick=()=>openTxEditor(b.dataset.id));
 qa("[data-delete-tx]").forEach(b=>b.onclick=()=>{const item=state.transactions.find(t=>t.id===b.dataset.deleteTx);if(!item||!confirm(`Delete ${item.description}?`))return;state.transactions=state.transactions.filter(t=>t.id!==item.id);save();renderAll();toastMsg("Transaction deleted");});
}

function renderExpenses(){
 const annual=remainingYearExpenseBreakdown({referenceDate:new Date(),budgets:state.budgets,yearly:state.yearly,events:state.events,credit:state.credit,transactions:[]});
 monthlyExpenseTotal.textContent=fmt(monthlyBudget());
 yearlyExpenseTotal.textContent=fmt(yearlyTotal());
 eventExpenseTotal.textContent=fmt(annual.events);
 annualExpenseGrandTotal.textContent=fmt(annual.total);
 annualRecurringExpense.textContent=fmt(annual.recurring);
 annualYearlyExpense.textContent=fmt(annual.yearly);
 annualEventsExpense.textContent=fmt(annual.events+annual.credit);
 qa("[data-expense-view]").forEach(button=>button.classList.toggle("active",button.dataset.expenseView===state.expenseView));
 qa("[data-expense-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.expensePanel===state.expenseView));
 const orderedBudgets=[...state.budgets].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
 budgetRows.innerHTML=orderedBudgets.map(b=>{
  const i=state.budgets.indexOf(b);
  const progress=getBudgetProgress(b,state.transactions,new Date());
  const pct=b.monthly?progress.paid/b.monthly*100:0, cls=pct>=100?"done":pct>80?"warn":"";
  const status=progress.status==="done"?"DONE THIS MONTH":progress.status==="partial"?"PARTIAL":"AUTO FROM HISTORY";
  return `<div class="progress-row budget-progress ${cls}" data-budget-id="${b.id}" title="Drag card to reorder"><div class="progress-top"><b class="budget-category-tag">${b.category}</b><span class="budget-status ${progress.status}">${status}</span></div><div class="progress ${cls}"><span style="width:${Math.min(100,pct)}%"></span></div><div class="budget-numbers private"><small>Paid ${fmt(progress.paid)}</small><b>Remaining ${fmt(progress.remaining)}</b><small>Default ${fmt(b.monthly)}</small></div><div class="tile-actions"><button class="icon-mini" data-edit-budget="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-budget="${i}" title="Remove">🗑</button></div></div>`;
 }).join("");
 qa("[data-edit-budget]").forEach(b=>b.onclick=()=>editMonthly(Number(b.dataset.editBudget)));
 qa("[data-remove-budget]").forEach(b=>b.onclick=()=>{state.budgets.splice(Number(b.dataset.removeBudget),1); save(); renderAll();});
 enableBudgetDrag();
 const budgetEntries=state.budgets.map(b=>[b.category,Number(b.monthly)]).sort((a,b)=>b[1]-a[1]);
 expenseDonut.innerHTML=donut(budgetEntries,fmt(monthlyBudget(),true));
 expenseLegend.innerHTML=legend(budgetEntries);
 const companyRows=state.transactions.filter(isCompanyExpenseTx).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const nowForCompany=new Date(),companyYear=nowForCompany.getFullYear(),companyMonth=monthKey(nowForCompany);
 const companyThisMonth=companyRows.filter(row=>String(row.date).startsWith(companyMonth)).reduce((sum,row)=>sum+Math.abs(Number(row.amount)),0);
 const companyThisYear=companyRows.filter(row=>String(row.date).startsWith(`${companyYear}-`)).reduce((sum,row)=>sum+Math.abs(Number(row.amount)),0);
 const companyMonthly=Array.from({length:12},(_,index)=>companyRows.filter(row=>String(row.date).startsWith(`${companyYear}-${String(index+1).padStart(2,"0")}`)).reduce((sum,row)=>sum+Math.abs(Number(row.amount)),0));
 const companyPeak=Math.max(1,...companyMonthly);
 const companyRecent=companyRows.slice(0,4);
 companyExpenseDashboard.innerHTML=`<div class="company-expense-hero"><div><small>FIXED HISTORY TAG</small><h3>${COMPANY_EXPENSE_TAG}</h3><p>Capital record only · never changes Balance, Budget, or Prospect.</p></div><strong class="private">${fmt(companyThisMonth)}</strong><span>This month</span></div><div class="company-expense-kpis"><span><small>${companyYear}</small><b class="private">${fmt(companyThisYear)}</b></span><span><small>All-time records</small><b>${companyRows.length}</b></span></div><div class="company-expense-bars" aria-label="${companyYear} company expense by month">${companyMonthly.map((value,index)=>`<span title="${new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"long"}).format(new Date(companyYear,index,1))}: ${fmt(value)}"><i style="height:${Math.max(value?12:3,value/companyPeak*100)}%"></i><small>${new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"narrow"}).format(new Date(companyYear,index,1))}</small></span>`).join("")}</div><div class="company-expense-recent">${companyRecent.length?companyRecent.map(row=>`<span><b>${row.description}</b><small>${row.date}</small><em class="private">${fmt(row.amount)}</em></span>`).join(""):`<div class="company-expense-empty"><b>No company expenses recorded</b><small>Choose the ${COMPANY_EXPENSE_TAG} tag when adding an expense in History.</small></div>`}</div>`;
 const orderedYearly=[...state.yearly].sort((a,b)=>{
  const doneA=Number(a.lastPaidYear)===currentYear(),doneB=Number(b.lastPaidYear)===currentYear();
  return Number(doneA)-Number(doneB)||Number(a.sortOrder||0)-Number(b.sortOrder||0);
 });
 yearlyExpenseGrid.innerHTML=orderedYearly.map(y=>{
 const i=state.yearly.indexOf(y);
 const done=Number(y.lastPaidYear)===currentYear();
  const dueCurrent=!done&&monthIndexFromName(y.month)===new Date().getMonth();
  const dueMonth=String(y.month||"—").slice(0,3).toUpperCase();
  return `<div class="tile yearly-tile ${done?"done":dueCurrent?"due due-current":"due"}" data-yearly-id="${y.id}" title="Drag card to reorder"><span class="payment-badge ${done?"done":"due"}">${done?`DONE ${currentYear()}`:`DUE ${currentYear()}`} · <b>${dueMonth}</b></span><h4>${escapeHtml(y.name)}</h4><small>${escapeHtml(y.category)}</small><strong class="private">${fmt(y.amount)}</strong><div class="tile-actions"><button class="year-paid-toggle ${done?"done":""}" data-paid-yearly="${i}">${done?"Undo done":"Done this year"}</button><button class="icon-mini" data-edit-yearly="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-yearly="${i}" title="Remove">🗑</button></div></div>`;
 }).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No yearly expenses</b></div></div>`;
 const now=new Date(),orderedEvents=[...state.events].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
 eventGrid.innerHTML=orderedEvents.map(e=>{const i=state.events.indexOf(e),date=new Date(`${e.date}T00:00:00`),tone=date.getFullYear()!==now.getFullYear()?"outside":date.getMonth()===now.getMonth()?"current":"this-year",month=new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"short"}).format(date).toUpperCase();return `<div class="tile event-tile event-${tone}" data-event-id="${e.id}" title="Drag card to reorder"><span class="event-year">DUE ${date.getFullYear()} · <b>${month}</b></span><h4>${e.name}</h4><small>${e.date} · ${e.category}</small><strong class="private">${fmt(e.amount)}</strong><div class="tile-actions"><button class="icon-mini" data-edit-event="${i}" title="Edit">✎</button><button class="icon-mini" data-remove-event="${i}" title="Remove">🗑</button></div></div>`;}).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No events</b></div></div>`;
 qa("[data-edit-yearly]").forEach(b=>b.onclick=()=>editYearly(Number(b.dataset.editYearly)));
 qa("[data-remove-yearly]").forEach(b=>b.onclick=()=>{state.yearly.splice(Number(b.dataset.removeYearly),1); save(); renderAll();});
 qa("[data-paid-yearly]").forEach(b=>b.onclick=()=>{const item=state.yearly[Number(b.dataset.paidYearly)];item.lastPaidYear=Number(item.lastPaidYear)===currentYear()?null:currentYear();save();renderAll();});
 qa("[data-edit-event]").forEach(b=>b.onclick=()=>editEvent(Number(b.dataset.editEvent)));
 qa("[data-remove-event]").forEach(b=>b.onclick=()=>{state.events.splice(Number(b.dataset.removeEvent),1); save(); renderAll();});
 enableYearlyDrag();
 enableEventDrag();
 renderCredit();
}

function creditClass(source){
 return source==="ShopeePayLater"?"shopee":source==="GoPayLater"?"gopay":"card";
}
function creditIcon(source){
 if(source==="ShopeePayLater")return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V6.7A5 5 0 0 1 17 6.7V8M4.5 8h15l-1 12h-13l-1-12Z"/><path d="M9.2 13.2c.6-.7 1.5-1 2.8-1 1.6 0 2.7.6 2.7 1.7 0 2.7-5.4.8-5.4 3.3 0 1.1 1.1 1.8 2.8 1.8 1.2 0 2.2-.3 2.9-1"/></svg>`;
 if(source==="GoPayLater")return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 6.2V12h-5.8M8.3 9.2h4.2a2.8 2.8 0 1 1 0 5.6H9.7v-3.2h2.8"/></svg>`;
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>`;
}
function emptyLane(label){
 return `<div class="lane-empty"><span>＋</span><small>${label}</small></div>`;
}

function bindPointerSort(cardSelector,laneSelector,onCommit){
 qa(cardSelector).forEach(card=>{
  card.draggable=false;
  card.onpointerdown=event=>{
   if(event.button!==0||event.target.closest("button,input,select,a,label,summary"))return;
   const start={x:event.clientX,y:event.clientY};
   const rect=card.getBoundingClientRect();
   const offset={x:event.clientX-rect.left,y:event.clientY-rect.top};
   const placeholder=document.createElement("div");
   placeholder.className="sort-placeholder";
   placeholder.style.height=`${rect.height}px`;
   let active=false,lastLane=card.closest(laneSelector),scrollFrame=0;
   const activate=()=>{
    if(active)return;active=true;navigator.vibrate?.(12);
    card.after(placeholder);card.classList.add("is-dragging","is-floating");
    Object.assign(card.style,{position:"fixed",left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,zIndex:"140",pointerEvents:"none",margin:"0"});
    document.body.classList.add("sorting-active");
   };
   const timer=setTimeout(activate,event.pointerType==="mouse"?80:170);
   const move=e=>{
    const distance=Math.hypot(e.clientX-start.x,e.clientY-start.y);
    if(!active){
     if(event.pointerType==="mouse"&&distance>4)activate();
     else if(distance>12){clearTimeout(timer);cleanup(false);}
     if(!active)return;
    }
    e.preventDefault();
    card.style.left=`${e.clientX-offset.x}px`;card.style.top=`${e.clientY-offset.y}px`;
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const lanes=qa(laneSelector);
    const lane=under?.closest(laneSelector)||lanes.find(node=>{const box=node.getBoundingClientRect();return e.clientX>=box.left-24&&e.clientX<=box.right+24&&e.clientY>=box.top-24&&e.clientY<=box.bottom+24;})||lastLane;if(!lane)return;lastLane=lane;
    const targets=[...lane.querySelectorAll(cardSelector)].filter(node=>node!==card);
    const boxes=targets.map(node=>({node,box:node.getBoundingClientRect()}));
    const multiColumn=boxes.some((item,index)=>boxes.slice(index+1).some(other=>Math.abs(item.box.top-other.box.top)<Math.min(item.box.height,other.box.height)*.45));
    const target=boxes.find(({box})=>multiColumn
      ? (e.clientY<box.top+box.height*.25||(e.clientY<=box.bottom&&e.clientX<box.left+box.width/2))
      : e.clientY<box.top+box.height/2)?.node;
    lane.insertBefore(placeholder,target||null);
    cancelAnimationFrame(scrollFrame);
    scrollFrame=requestAnimationFrame(()=>{
     const edge=80,speed=e.clientY<edge?-14:e.clientY>innerHeight-edge?14:0;
     if(speed)window.scrollBy({top:speed,behavior:"auto"});
    });
   };
   const cleanup=commit=>{
    clearTimeout(timer);cancelAnimationFrame(scrollFrame);
    document.removeEventListener("pointermove",move,true);document.removeEventListener("pointerup",end,true);document.removeEventListener("pointercancel",cancel,true);
    if(active){placeholder.replaceWith(card);card.classList.remove("is-dragging","is-floating");card.removeAttribute("style");document.body.classList.remove("sorting-active");if(commit)onCommit();}
   };
   const end=()=>cleanup(true),cancel=()=>cleanup(false);
   document.addEventListener("pointermove",move,{capture:true,passive:false});document.addEventListener("pointerup",end,true);document.addEventListener("pointercancel",cancel,true);
  };
 });
}
function bindNativeSort(cardSelector,laneSelector,onCommit){
 let dragged=null;
 qa(cardSelector).forEach(card=>{
  card.draggable=true;
  card.ondragstart=event=>{if(event.target.closest("button,input,select,a,label")){event.preventDefault();return;}dragged=card;card.classList.add("is-dragging");event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",card.dataset.clientId||card.dataset.yearlyId||card.dataset.eventId||card.dataset.creditId||card.dataset.entrustedId||"");};
  card.ondragend=()=>{card.classList.remove("is-dragging");dragged=null;};
 });
 qa(laneSelector).forEach(lane=>{
  lane.ondragover=event=>{event.preventDefault();if(!dragged)return;const target=event.target.closest(cardSelector);if(target&&target!==dragged){const box=target.getBoundingClientRect();lane.insertBefore(dragged,event.clientY<box.top+box.height/2?target:target.nextSibling)}else if(!target)lane.append(dragged);};
  lane.ondrop=event=>{event.preventDefault();if(!dragged)return;onCommit();};
 });
}

function enableYearlyDrag(){
 const commit=()=>{
  [...yearlyExpenseGrid.querySelectorAll("[data-yearly-id]")].forEach((card,index)=>{
   const item=state.yearly.find(row=>row.id===card.dataset.yearlyId);if(item)item.sortOrder=index;
  });
  save();renderAll();toastMsg("Order saved");
 };
 bindPointerSort(".yearly-tile","#yearlyExpenseGrid",commit);
}

function enableBudgetDrag(){
 const commit=()=>{
  [...budgetRows.querySelectorAll("[data-budget-id]")].forEach((node,index)=>{const item=state.budgets.find(row=>row.id===node.dataset.budgetId);if(item)item.sortOrder=index;});
  save();renderAll();toastMsg("Budget order saved");
 };
 bindPointerSort(".budget-progress","#budgetRows",commit);
}

function enableEventDrag(){
 const commit=()=>{
  [...eventGrid.querySelectorAll("[data-event-id]")].forEach((card,index)=>{const item=state.events.find(row=>row.id===card.dataset.eventId);if(item)item.sortOrder=index;});
  save();renderAll();toastMsg("Event order saved");
 };
 bindPointerSort(".event-tile","#eventGrid",commit);
}

function renderCredit(){
 creditSummary.innerHTML=state.creditFacilities.map(facility=>{
  const used=state.credit.filter(x=>x.source===facility.source && !x.paid).reduce((a,b)=>a+Number(b.amount),0);
  return `<article class="metric-card credit-facility ${creditClass(facility.source)}"><div class="credit-brand-icon">${creditIcon(facility.source)}</div><small>${facility.source}</small><strong class="private">${fmt(used)}</strong><span>Limit ${fmt(facility.limit)}</span></article>`;
 }).join("");
 const activeCredit=state.credit.filter(x=>!x.paid).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
 creditItems.innerHTML=activeCredit.map(c=>{const due=new Date(`${c.due}T00:00:00`),month=new Intl.DateTimeFormat(state.language==="id"?"id-ID":"en-US",{month:"short"}).format(due).toUpperCase();return `<div class="credit-row" data-credit-id="${c.id}" title="Drag card to reorder"><input type="checkbox" class="credit-check" data-paid="${c.id}"><div class="credit-source-icon ${creditClass(c.source)}">${creditIcon(c.source)}</div><div class="credit-main"><b>${c.description}</b><small>${c.source} · <span class="credit-due">DUE ${due.getFullYear()} · <b>${month}</b></span></small></div><div class="list-value private">${fmt(c.amount)}</div><button class="icon-mini" data-edit-credit="${c.id}" title="Edit">✎</button><button class="icon-mini" data-del-credit="${c.id}" title="Remove">🗑</button></div>`;}).join("") || `<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No active credit items</b><small>Add an item using the plus button</small></div></div>`;
 const paidCredit=state.credit.filter(x=>x.paid).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
 creditArchive.innerHTML=paidCredit.length?paidCredit.map(c=>`<div class="list-row credit-archive-row" data-credit-id="${c.id}" title="Drag card to reorder"><div class="list-ic credit-source-icon ${creditClass(c.source)}">${creditIcon(c.source)}</div><div class="list-meta"><b>${c.description}</b><small>${c.source}</small></div><div class="list-value private">${fmt(c.amount)}</div><button class="icon-mini" data-edit-credit="${c.id}" title="Edit">✎</button></div>`).join(""):`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No archive yet</b></div></div>`;
 qa("[data-paid]").forEach(c=>c.onchange=()=>{const item=state.credit.find(x=>x.id===c.dataset.paid); if(item){item.paid=true; save(); renderAll();}});
 qa("[data-edit-credit]").forEach(c=>c.onclick=()=>editCredit(c.dataset.editCredit));
 qa("[data-del-credit]").forEach(c=>c.onclick=()=>{state.credit=state.credit.filter(x=>x.id!==c.dataset.delCredit); save(); renderAll();});
 const commit=()=>{[...creditItems.querySelectorAll("[data-credit-id]")].forEach((node,index)=>{const item=state.credit.find(row=>row.id===node.dataset.creditId);if(item)item.sortOrder=index;});save();renderAll();toastMsg("Credit order saved");};
 bindPointerSort(".credit-row","#creditItems",commit);
 const commitArchive=()=>{[...creditArchive.querySelectorAll("[data-credit-id]")].forEach((node,index)=>{const item=state.credit.find(row=>row.id===node.dataset.creditId);if(item)item.sortOrder=index;});save();renderAll();toastMsg("Archive order saved");};
 bindPointerSort(".credit-archive-row","#creditArchive",commitArchive);
 renderEntrusted();
}

function renderEntrusted(){
 const ordered=[...state.entrustedFunds].sort((a,b)=>Number(a.settled)-Number(b.settled)||Number(a.sortOrder||0)-Number(b.sortOrder||0));
 const cash=entrustedTotal("cash"),stocks=entrustedTotal("stocks");
 entrustedSummary.innerHTML=`<span><small>Cash Balance</small><b class="private">−${fmt(cash)}</b></span><span><small>Stocks</small><b class="private">−${fmt(stocks)}</b></span><span><small>Active Liability</small><b class="private">−${fmt(cash+stocks)}</b></span>`;
 entrustedItems.innerHTML=ordered.map(item=>`<div class="entrusted-row ${item.settled?"settled":"active"}" data-entrusted-id="${item.id}" title="Drag card to reorder"><input type="checkbox" data-settled-entrusted="${item.id}" ${item.settled?"checked":""} aria-label="Mark ${item.name} settled"><div class="entrusted-source ${item.source}">${item.source==="cash"?"💵":"📈"}</div><div class="entrusted-main"><b>${item.name}</b><small>${item.source==="cash"?"Cash Balance":"Stocks"} · ${item.settled?"Settled":"Active"}</small></div><strong class="private">−${fmt(item.amount)}</strong><button class="icon-mini" data-edit-entrusted="${item.id}" title="Edit">✎</button><button class="icon-mini" data-delete-entrusted="${item.id}" title="Remove">🗑</button></div>`).join("")||`<div class="list-row"><div class="list-ic">ℹ</div><div class="list-meta"><b>No entrusted funds</b><small>Add money held on behalf of someone else</small></div></div>`;
 qa("[data-settled-entrusted]").forEach(input=>input.onchange=()=>{const item=state.entrustedFunds.find(row=>row.id===input.dataset.settledEntrusted);if(item){item.settled=input.checked;save();renderAll();}});
 qa("[data-edit-entrusted]").forEach(button=>button.onclick=()=>editEntrusted(button.dataset.editEntrusted));
 qa("[data-delete-entrusted]").forEach(button=>button.onclick=()=>{const item=state.entrustedFunds.find(row=>row.id===button.dataset.deleteEntrusted);if(!item||!confirm(`Delete ${item.name}?`))return;state.entrustedFunds=state.entrustedFunds.filter(row=>row.id!==item.id);save();renderAll();});
 const commit=()=>{[...entrustedItems.querySelectorAll("[data-entrusted-id]")].forEach((node,index)=>{const item=state.entrustedFunds.find(row=>row.id===node.dataset.entrustedId);if(item)item.sortOrder=index;});save();renderAll();toastMsg("Entrusted funds order saved");};
 bindPointerSort(".entrusted-row","#entrustedItems",commit);
}

function renderClients(){
 fixedIncomeTotal.textContent=fmt(fixedIncome());
 fixedYearlyIncomeTotal.textContent=fmt(fixedIncome()*12);
 clientOutstandingTotal.textContent=fmt(totalOutstanding());
 clientPaidTotal.textContent=fmt(totalPaid());
 const income=remainingYearIncomeBreakdown({referenceDate:new Date(),clients:state.clients,transactions:[]});
 clientIncomeGrandTotal.textContent=fmt(income.outstanding+income.recurring);
 clientIncomeOutstanding.textContent=fmt(income.outstanding);
 clientIncomeRecurring.textContent=fmt(income.recurring);
 clientIncomeRemainingMonths.textContent=`${Math.max(0,11-new Date().getMonth())} remaining months`;
 const card=(c)=>{const i=state.clients.indexOf(c),ending=c.clientType==="ending",outstanding=clientOutstanding(c),paid=ending?c.endingPaid:outstanding===0,visual=ending?(paid?"ending-paid":"ending-unpaid"):paid?"paid":"outstanding",statusIcon=ending?"⚑":paid?"✓":"⏳",statusText=paid?"0 outstanding":`${fmt(outstanding)} outstanding left`,meta=ending?(paid?"Final payment completed":"Final payment pending"):`Paid this month: ${fmt(getClientPaidThisMonth(c))} · Previous: ${fmt(c.carry)}`;return `<div class="client-card ${visual} ${ending?"ending":"recurring"}" data-client-id="${c.id}" title="Drag card to reorder or move between sections"><div class="status-icon ${paid?"paid":"pending"}" title="${ending?`ending client · ${paid?"paid":"unpaid"}`:paid?"paid":"outstanding"}">${statusIcon}</div><h4>${escapeHtml(c.name)}</h4><small>${ending?"Final payment":"Recurring monthly"} · ${fmt(c.monthly)}</small><strong class="private client-outstanding-copy">${statusText}</strong><small class="client-payment-meta private">${meta}</small><div class="client-actions"><button class="icon-mini" data-edit-client="${i}" title="Edit">✎</button><button class="icon-mini" data-status-client="${i}" title="Status">◉</button><button class="icon-mini" data-remove-client="${i}" title="Remove">🗑</button></div></div>`;};
 const recurring=[...recurringClients()].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)),ending=[...endingClients()].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
 recurringClientCount.textContent=recurring.length;endingClientCount.textContent=ending.length;
 recurringClientGrid.innerHTML=recurring.map(card).join("")||emptyLane("No recurring clients");
 endingClientGrid.innerHTML=ending.map(card).join("")||emptyLane("No ending clients");
 qa("[data-edit-client]").forEach(b=>b.onclick=()=>editClient(Number(b.dataset.editClient)));
 qa("[data-status-client]").forEach(b=>b.onclick=()=>changeClientStatus(Number(b.dataset.statusClient)));
 qa("[data-remove-client]").forEach(b=>b.onclick=()=>{state.clients.splice(Number(b.dataset.removeClient),1); save(); renderAll();});
 const commitClients=()=>{
  [recurringClientGrid,endingClientGrid].forEach((grid)=>{
   const type=grid.dataset.clientType;
   [...grid.querySelectorAll("[data-client-id]")].forEach((node,index)=>{
    const client=state.clients.find(row=>row.id===node.dataset.clientId);if(!client)return;
    client.clientType=type;client.sortOrder=index;client.status=client.status==="paid"?"paid":"pending";
    if(type==="recurring")client.endingPaid=false;
    else client.endingPaid=client.status==="paid"&&clientOutstanding(client)===0;
   });
  });
  save();renderAll();toastMsg("Client moved");
 };
 bindPointerSort(".client-card",".client-grid",commitClients);
}

function renderStocks(){
 const grossHoldings=holdingsPortfolio(),gross=portfolio(),p=netPortfolio(), inv=state.stocks.reduce((a,s)=>a+invested(s),0),pl=grossHoldings-inv;
 portfolioValue.textContent=fmt(p);
 portfolioInvested.textContent=fmt(inv);
 portfolioPL.textContent=`${fmt(pl)} · ${percent(pl,inv)}`;
 portfolioPL.className=`private ${pl<0?"negative":pl>0?"positive":""}`;
 const entries=state.stocks.map(s=>[s.ticker,stockValue(s)]);
 if(Number(state.stockExtras?.netcashIdr||0)>0)entries.push(["Netcash",Number(state.stockExtras.netcashIdr)]);
 if(Number(state.stockExtras?.walletUsd||0)>0)entries.push(["USD Wallet",Number(state.stockExtras.walletUsd)*Number(state.usdIdr)]);
 stockDonut.innerHTML=donut(entries,fmt(gross,true));
 stockLegend.innerHTML=legend(entries);
 stockValueTrend.innerHTML=line(YEARS.map(year=>netPortfolio(year,"base")),YEARS.map(year=>String(year)),true);
 stockNetcashIdr.value=Number(state.stockExtras?.netcashIdr||0)||"";
 stockWalletUsd.value=Number(state.stockExtras?.walletUsd||0)||"";
 stockNetcashValue.textContent=fmt(state.stockExtras?.netcashIdr||0);
 stockWalletValue.textContent=fmt(Number(state.stockExtras?.walletUsd||0)*Number(state.usdIdr||0));
 if(typeof usdIdrRate!=="undefined"){
  const meta=state.usdIdrMeta;
  const providerLabel=meta?.provider==="yahoo"?"YAHOO FINANCE":meta?.provider==="manual"?"MANUAL":meta?.error?"SAVED RATE · YAHOO UNAVAILABLE":"SAVED RATE · REFRESH YAHOO";
  usdIdrRate.textContent=`1 USD = ${new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(Number(state.usdIdr||0))} IDR · ${providerLabel}`;
  usdIdrRate.title=meta?.asOf?`${providerLabel} · updated ${new Date(meta.asOf).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}`:"Last saved exchange rate";
 }
 stockNetcashIdr.onchange=()=>{state.stockExtras ||= {netcashIdr:0,walletUsd:0};state.stockExtras.netcashIdr=Math.max(0,Number(stockNetcashIdr.value||0));save();renderAll();};
 stockWalletUsd.onchange=()=>{state.stockExtras ||= {netcashIdr:0,walletUsd:0};state.stockExtras.walletUsd=Math.max(0,Number(stockWalletUsd.value||0));save();renderAll();};
 holdingsBody.innerHTML=state.stocks.map((s,i)=>{
  const stale=isPriceStale(s), status=s.priceStatus||"manual", stamp=s.priceAsOf?new Date(s.priceAsOf).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}):"Never";
  const statusLabel=status==="manual"?"MANUAL FALLBACK":status;
  const qty=quantityForDisplay(s), unit=quantityUnit(s.market);
  const pl=stockValue(s)-invested(s);
  return `<tr><td data-label="Ticker"><input data-stock="${i}" data-field="ticker" value="${s.ticker}"></td><td data-label="Market"><select data-stock="${i}" data-field="market"><option ${s.market==="IDX"?"selected":""}>IDX</option><option ${s.market==="NASDAQ"?"selected":""}>NASDAQ</option><option ${s.market==="NYSE"?"selected":""}>NYSE</option></select></td><td data-label="Provider Symbol"><input data-stock="${i}" data-field="providerSymbol" value="${s.providerSymbol||s.ticker}"></td><td data-label="Currency"><input value="${s.currency}" title="Selected automatically from market" disabled></td><td data-label="Quantity"><div class="quantity-field"><input data-stock="${i}" data-field="quantity" type="number" min="0" step=".000001" value="${qty}"><small>${unit}</small></div></td><td data-label="Average / Share"><input data-stock="${i}" data-field="avg" type="number" step=".01" value="${s.avg}"></td><td data-label="Current / Fallback"><input data-stock="${i}" data-field="current" type="number" step=".01" value="${s.current}" title="Latest price. Edit only to set a manual fallback."></td><td data-label="Price State"><span class="price-state ${stale?'stale':''}">${stale?'STALE · ':''}${statusLabel}</span><small class="price-time">${stamp}</small></td><td data-label="Value" class="private">${fmt(stockValue(s))}</td><td data-label="Profit / Loss" class="private holding-pl ${pl<0?"negative":pl>0?"positive":""}"><b>${fmt(pl)}</b><small>${percent(pl,invested(s))}</small></td><td class="stock-remove"><button class="icon-mini" data-del-stock="${i}" title="Remove" aria-label="Remove ${s.ticker}">🗑</button></td></tr>`;
 }).join("");
 qa("[data-stock]").forEach(el=>el.onchange=()=>{
  const i=Number(el.dataset.stock),f=el.dataset.field,s=state.stocks[i];
  if(f==="quantity")s.quantity=quantityForStorage(s.market,el.value);
  else s[f]=["avg","current"].includes(f)?Number(el.value):el.value;
  if(f==="ticker"){s.ticker=String(el.value).toUpperCase();s.displaySymbol=s.ticker;}
  if(f==="providerSymbol")s.providerSymbol=String(el.value).toUpperCase();
  if(f==="market")normalizeStockMapping(s,{resetProviderSymbol:true});
  if(f==="current"){s.manualCurrent=Number(el.value);s.priceSource="manual";s.priceStatus="manual";s.priceAsOf=new Date().toISOString();}
  save();renderAll();
 });
 qa("[data-del-stock]").forEach(el=>el.onclick=()=>{state.stocks.splice(Number(el.dataset.delStock),1);save();renderAll();});
 renderTargetTable("base",baseHead,baseBody);
 renderTargetTable("optimistic",optimisticHead,optimisticBody);
}

function renderTargetTable(mode,headEl,bodyEl){
 const useMode=mode==="base"?state.baseMode:state.optimisticMode;
 const targetYears=YEARS.filter(y=>y!==currentYear());
 headEl.innerHTML=`<span>STOCK TARGETS</span><span>Two years per row · ${useMode==="auto"?"automatic growth":"manual values"}</span>`;
 bodyEl.innerHTML=state.stocks.map((s,i)=>`<section class="target-stock-group"><div class="target-stock-summary"><div class="target-static-box"><small>Ticker</small><strong>${escapeHtml(s.ticker)}</strong></div><div class="target-static-box"><small>Current</small><strong>${plainNumber(s.current)}</strong></div></div><div class="target-years-grid">${targetYears.map(y=>{const val=useMode==="auto"?stockPrice(s,y,mode):Number(s[mode][y]??s.current);return `<label class="target-year-card"><span>${y}</span><input class="target-price-input" type="text" inputmode="decimal" autocomplete="off" ${useMode==="auto"?"disabled":""} data-target="${mode}" data-stock="${i}" data-year="${y}" value="${plainNumber(val)}"></label>`;}).join("")}</div></section>`).join("");
 qa(`[data-target="${mode}"]`).forEach(el=>{
  const commit=()=>{
   const i=Number(el.dataset.stock),y=Number(el.dataset.year),value=Number(String(el.value).replace(/,/g,""));
   if(!Number.isFinite(value)||value<0){el.value=plainNumber(state.stocks[i][mode][y]??state.stocks[i].current);return;}
   if(Number(state.stocks[i][mode][y])===value){el.value=plainNumber(value);return;}
   state.stocks[i][mode][y]=value;el.value=plainNumber(value);save();
   stockValueTrend.innerHTML=line(YEARS.map(year=>netPortfolio(year,"base")),YEARS.map(year=>String(year)),true);attachTips();
  };
  el.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();el.blur()}else if(event.key==="Escape"){el.value=plainNumber(state.stocks[Number(el.dataset.stock)][mode][Number(el.dataset.year)]);el.blur();}});
  el.addEventListener("blur",commit);
 });
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
 const pr=projection(state.prospectMode), first=pr[0],last=pr.at(-1), growth=currentNW()?((last.nw/currentNW()-1)*100):0;
 prospectCurrentValue.textContent=fmt(first.nw);
 prospectCurrentHorizonLabel.textContent=`Projected Net Worth in ${first.year}`;
 prospectValue.textContent=fmt(last.nw);
 sideCurrentLabel.textContent=`Projected ${currentYear()}`;
 sideCurrentProjection.textContent=fmt(first.nw,true);
 sideFutureLabel.textContent=`Projected ${last.year}`;
 prospectHorizonLabel.textContent=`Projected Net Worth in ${last.year}`;
 sideProjection.textContent=fmt(last.nw,true);
 sideScenario.textContent=state.prospectMode==="base"?"Base":"Optimistic";
 prospectBadge.textContent=state.prospectMode.toUpperCase();
 prospectGrowth.textContent=`${growth>=0?"+":""}${growth.toFixed(1)}% over 10 years`;
 prospectDesc.textContent=state.prospectMode==="base"?"Uses base stock targets":"Uses optimistic stock targets";
 prospectChart.innerHTML=line(pr.map(p=>p.nw),pr.map(p=>String(p.year).slice(2)),true);
 const operating=annualOperatingPerformance({clients:state.clients,budgets:state.budgets,yearly:state.yearly});
 const netPositive=operating.net>=0, incomeShare=operating.income?Math.min(100,operating.expense/operating.income*100):100;
 const monthlyOperating={income:operating.income/12,expense:operating.expense/12,net:operating.net/12};
 const monthlyNetPositive=monthlyOperating.net>=0;
 annualPerformanceDashboard.innerHTML=`
  <div class="operating-flow-card operating-income">
   <div class="operating-flow-icon">↗</div><div><small>ANNUAL INCOME</small><strong class="private">${fmt(operating.income)}</strong><p>Recurring clients × 12 months</p></div>
  </div>
  <div class="operating-connector"><span>MINUS</span></div>
  <div class="operating-flow-card operating-expense">
   <div class="operating-flow-icon">↘</div><div><small>ANNUAL EXPENSE</small><strong class="private">${fmt(operating.expense)}</strong><p>Monthly Budget × 12 + Yearly Budget</p></div>
  </div>
  <div class="operating-breakdown">
   <span><small>MONTHLY BUDGET · 12×</small><b class="private">${fmt(operating.monthlyExpense)}</b></span>
   <span><small>YEARLY BUDGET</small><b class="private">${fmt(operating.yearlyExpense)}</b></span>
  </div>
  <div class="operating-ratio" title="Annual expense as a share of recurring annual income"><i style="width:${incomeShare}%"></i></div>
  <div class="operating-net ${netPositive?"profit":"loss"}">
   <div class="operating-net-top"><span>${netPositive?"▲ PROFIT":"▼ LOSS"}</span><small>ANNUAL NET</small></div>
   <strong class="private">${operating.net>=0?"+":""}${fmt(operating.net)}</strong>
   <p>Income − Expense · operating result per year</p>
  </div>
  <div class="operating-net operating-monthly-net ${monthlyNetPositive?"profit":"loss"}">
   <div class="operating-net-top"><span>${monthlyNetPositive?"▲ PROFIT":"▼ LOSS"}</span><small>MONTHLY NET</small></div>
   <strong class="private">${monthlyOperating.net>=0?"+":""}${fmt(monthlyOperating.net)}</strong>
   <div class="monthly-net-breakdown">
    <span><small>INCOME</small><b class="private">${fmt(monthlyOperating.income)}</b></span>
    <span><small>EXPENSE</small><b class="private">${fmt(monthlyOperating.expense)}</b></span>
   </div>
   <p>Monthly Income − Monthly Expense · read-only</p>
  </div>`;
 yearGrid.innerHTML=pr.map(y=>{const ages=ageTriplet(y.year).join(", "),current=y.year===currentYear(),hasCredit=Number(y.expenses.credit)>0; return `<details class="year-card prospect-year-card"><summary><div class="year-head"><small>${y.year}</small><span class="age-triplet">${ages}</span></div><div class="year-summary-value"><h4 class="private ${moneyClass(y.nw)}">${fmt(y.nw)}</h4><span class="year-toggle">⌄</span></div><small class="year-equation">Opening Cash + Stocks + Income − Expenses</small></summary><div class="year-details"><small class="year-split private"><span>Opening Cash <b class="${moneyClass(y.opening)}">${fmt(y.opening)}</b></span><span>Stocks <b class="${moneyClass(y.portfolio)}">${fmt(y.portfolio)}</b></span><span>${current?"Remaining recurring income":"Recurring income"} <b class="positive">+${fmt(y.incomeBreakdown.recurring)}</b></span>${y.incomeBreakdown.outstanding?`<span>Current receivables <b class="positive">+${fmt(y.incomeBreakdown.outstanding)}</b></span>`:""}${current?`<span>This month remaining <b class="negative">−${fmt(y.expenses.currentMonth)}</b></span>`:""}<span>Recurring expense <b class="negative">−${fmt(y.expenses.recurring)}</b></span><span>Yearly expense <b class="negative">−${fmt(y.expenses.yearly)}</b></span><span>Events <b class="negative">−${fmt(y.expenses.events)}</b></span>${hasCredit?`<span>Credit & PayLater <b class="negative">−${fmt(y.expenses.credit)}</b></span>`:""}</small></div></details>`;}).join("");
}

function renderInsights(){
 const runway=monthlyBudget()?netAccountTotal()/monthlyBudget():0;
 const biggestBudget=[...state.budgets].sort((a,b)=>b.monthly-a.monthly)[0];
 const biggestHold=[...state.stocks].sort((a,b)=>stockValue(b)-stockValue(a))[0];
 cashRunway.textContent=`${runway.toFixed(1)} months`;
 largestExpense.textContent=biggestBudget?.category||"—";
 largestHolding.textContent=biggestHold?`${biggestHold.ticker} ${(stockValue(biggestHold)/Math.max(1,portfolio())*100).toFixed(0)}%`:"—";
 const baseProjection=projection("base"),optimisticProjection=projection("optimistic"),baseLast=baseProjection.at(-1),optimisticLast=optimisticProjection.at(-1);
 scenarioCompare.innerHTML=lineMulti([
  {name:"Base",vals:baseProjection.map(x=>x.nw),color:COLORS[0]},
  {name:"Optimistic",vals:optimisticProjection.map(x=>x.nw),color:COLORS[2]}
 ],baseProjection.map(x=>String(x.year)));
 const scenarioGap=optimisticLast.nw-baseLast.nw,baseGrowthPct=currentNW()?((baseLast.nw/currentNW()-1)*100):0;
 scenarioKpis.innerHTML=`<article><small>2036 Scenario Gap</small><strong class="private ${moneyClass(scenarioGap)}">${scenarioGap>=0?"+":""}${fmt(scenarioGap)}</strong></article><article><small>Base Growth</small><strong>${baseGrowthPct>=0?"+":""}${baseGrowthPct.toFixed(1)}%</strong></article><article><small>2036 Closing Cash</small><strong class="private ${moneyClass(baseLast.closing)}">${fmt(baseLast.closing)}</strong></article><article><small>2036 Stock Assets</small><strong class="private ${moneyClass(baseLast.portfolio)}">${fmt(baseLast.portfolio)}</strong></article>`;
 const yearlyMomentum=baseProjection.map((row,index)=>index?row.nw-baseProjection[index-1].nw:row.nw-currentNW());
 const momentumPeak=Math.max(1,...yearlyMomentum.map(value=>Math.abs(value)));
 const positiveYears=yearlyMomentum.filter(value=>value>=0).length;
 const coachTitle=baseLast.nw>=currentNW()?"Consistency is compounding":"The model is a signal, not a verdict";
 const coachText=baseLast.nw>=currentNW()?`${positiveYears} of ${yearlyMomentum.length} projected years improve or hold net worth. Keep income visible, protect runway, and review targets regularly.`:`Your base path needs an adjustment. Closing the income–expense gap now has more impact than waiting for a perfect market year.`;
 insightCoach.innerHTML=`<div class="coach-message"><span>✦</span><div><small>MOMENTUM NOTE</small><h3>${coachTitle}</h3><p>${coachText}</p></div></div><div class="momentum-strip" aria-label="Year-over-year net worth momentum">${yearlyMomentum.map((value,index)=>`<span title="${baseProjection[index].year}: ${value>=0?"+":""}${fmt(value)}"><i class="${value<0?"down":"up"}" style="height:${Math.max(8,Math.abs(value)/momentumPeak*100)}%"></i><small>${String(baseProjection[index].year).slice(2)}</small></span>`).join("")}</div>`;
 const operating=annualOperatingPerformance({clients:state.clients,budgets:state.budgets,yearly:state.yearly});
 const monthlyNet=operating.net/12,monthlyExpense=operating.expense/12,monthlyGap=Math.max(0,-monthlyNet);
 const collectionBase=totalPaid()+totalOutstanding(),collectionPct=collectionBase?totalPaid()/collectionBase*100:100;
 const bufferTarget=monthlyBudget()*3,bufferGap=Math.max(0,bufferTarget-netAccountTotal()),bufferPct=bufferTarget?netAccountTotal()/bufferTarget*100:100;
 const operatingCoverage=monthlyExpense?fixedIncome()/monthlyExpense*100:100;
 const priorities=[
  {icon:monthlyGap?"↗":"✓",tone:monthlyGap?"red":"green",label:"OPERATING BALANCE",title:monthlyGap?`Close ${fmt(monthlyGap)} monthly gap`:`Protect ${fmt(monthlyNet)} monthly surplus`,text:monthlyGap?"Increase recurring income or trim planned budgets until monthly net reaches zero.":"The operating model is profitable. Keep the surplus visible and intentional.",progress:Math.min(100,operatingCoverage)},
  {icon:totalOutstanding()?"◎":"✓",tone:totalOutstanding()?"orange":"green",label:"CLIENT FOLLOW-UP",title:totalOutstanding()?`Collect ${fmt(totalOutstanding())}`:"All client income collected",text:totalOutstanding()?"Prioritize outstanding recurring and ending-client payments.":"No open client receivables remain this month.",progress:Math.min(100,collectionPct)},
  {icon:bufferGap?"◒":"✓",tone:bufferGap?"blue":"green",label:"CASH BUFFER",title:bufferGap?`Build ${fmt(bufferGap)} more`:`3-month buffer secured`,text:bufferGap?`Target liquid reserve: ${fmt(bufferTarget)} based on three months of budget.`:"Liquid balance already covers at least three months of planned budget.",progress:Math.min(100,bufferPct)}
 ];
 const firstOpen=priorities.find(item=>item.progress<100);
 insightActionPlan.innerHTML=`<div class="action-plan-head"><div><small>NEXT MOVES</small><h3>Financial Action Plan</h3></div><span>${firstOpen?"FOCUS MODE":"ON TRACK"}</span></div><div class="action-plan-list">${priorities.map(item=>`<article class="action-plan-item ${item.tone}"><div class="action-plan-icon">${item.icon}</div><div class="action-plan-copy"><small>${item.label}</small><b class="private">${item.title}</b><p>${item.text}</p><div class="action-plan-progress"><i style="width:${item.progress.toFixed(1)}%"></i></div></div><strong>${item.progress.toFixed(0)}%</strong></article>`).join("")}</div><div class="action-plan-footer"><span>✦</span><p><b>Next milestone:</b> <span class="private">${firstOpen?firstOpen.title:"Maintain the current plan and review it monthly."}</span></p></div>`;
 const now=new Date(),prev=new Date(now.getFullYear(),now.getMonth()-1,1);
 const expenseIn=(date)=>state.transactions.filter(row=>row.type==="expense"&&String(row.date).startsWith(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`)).reduce((sum,row)=>sum+Number(row.amount),0);
 const thisExpense=expenseIn(now),previousExpense=expenseIn(prev),expenseDelta=previousExpense?((thisExpense-previousExpense)/previousExpense*100):0;
 const periods=electricityPeriods(),latestElectric=periods.at(-1),previousElectric=periods.at(-2),electricDelta=previousElectric?.daily?((latestElectric.daily-previousElectric.daily)/previousElectric.daily*100):0;
 const coffeePct=foodBudget()?coffeeSpentForInsight()/Math.max(1,state.budgets.find(b=>String(b.category).toLowerCase()==="coffee")?.monthly||foodBudget())*100:0;
 const collected=totalPaid()+totalOutstanding()?totalPaid()/(totalPaid()+totalOutstanding())*100:100;
 const holdingsInvested=state.stocks.reduce((sum,row)=>sum+invested(row),0);
 const pl=holdingsPortfolio()-holdingsInvested;
 const insightData=[
  {asset:"wallet",tone:runway>=6?"green":runway>=3?"yellow":"red",eyebrow:"Cash runway",title:`${runway.toFixed(1)} months of runway`,text:`Current liquid balance after entrusted funds is ${fmt(netAccountTotal())}; remaining monthly obligations are ${fmt(budgetRemaining())}.`},
  {asset:"clients",tone:collected>=80?"green":collected>=50?"yellow":"red",eyebrow:"Client collection",title:`${collected.toFixed(0)}% collected`,text:totalOutstanding()?`${fmt(totalOutstanding())} is still outstanding from recurring and ending clients.`:"All client payments are collected. Good job!"},
  {asset:"coffee",tone:coffeePct>100?"red":coffeePct>75?"yellow":"green",eyebrow:"Coffee check",title:coffeePct>100?"Coffee is over budget":coffeePct>75?"Coffee is getting expensive":"Coffee spending is controlled",text:`Coffee usage is ${coffeePct.toFixed(0)}% of its default monthly budget.`},
  {asset:"electricity",tone:electricDelta>5?"red":electricDelta<-5?"green":"blue",eyebrow:"Electricity trend",title:!latestElectric?"More readings needed":electricDelta<-5?"Electricity is decreasing — good job!":electricDelta>5?"Electricity usage is rising":"Electricity is stable",text:latestElectric?`Latest pace is ${latestElectric.daily.toFixed(1)} kWh/day (${electricDelta>=0?"+":""}${electricDelta.toFixed(1)}% versus the prior interval).`:"Add at least two readings to unlock a usage trend."},
  {asset:"calendar",tone:expenseDelta>5?"red":expenseDelta<-5?"green":"orange",eyebrow:"History trend",title:previousExpense?`Recorded expense ${expenseDelta>=0?"rose":"fell"} ${Math.abs(expenseDelta).toFixed(0)}%`:"Expense baseline is building",text:`History recorded ${fmt(thisExpense)} this month. It updates pacing only and is not deducted twice.`},
  {asset:"stocks",tone:pl<0?"red":"green",eyebrow:"Portfolio P/L",title:`${pl<0?"Down":"Up"} ${fmt(Math.abs(pl))} · ${percent(pl,holdingsInvested,{absolute:true})}`,text:`Current holdings are ${fmt(holdingsPortfolio())} against ${fmt(holdingsInvested)} invested. Optional Netcash and Wallet are assets, not P/L.`}
 ];
 insightCards.innerHTML=insightData.map(x=>`<article class="story-card ${x.tone} insight-${x.asset}"><img src="/assets/insights/${x.asset}.png" alt="" loading="lazy"><div><small>${x.eyebrow}</small><h3>${x.title}</h3><p>${x.text}</p></div></article>`).join("");
 const operatingMargin=operating.income?operating.net/operating.income*100:0;
 const usedBudget=state.budgets.reduce((sum,item)=>sum+recordedExpenseForBudget(item,state.transactions,now),0);
 const budgetUsedPct=monthlyBudget()?usedBudget/monthlyBudget()*100:0;
 const recurring=recurringClients(),largestClient=recurring.reduce((max,row)=>Number(row.monthly)>Number(max?.monthly||0)?row:max,null);
 const clientConcentration=fixedIncome()&&largestClient?Number(largestClient.monthly)/fixedIncome()*100:0;
 const usdAssets=state.stocks.filter(row=>row.currency==="USD").reduce((sum,row)=>sum+stockValue(row),0)+Number(state.stockExtras?.walletUsd||0)*Number(state.usdIdr||0);
 const usdExposure=portfolio()?usdAssets/portfolio()*100:0;
 const decisionMetrics=[
  {icon:"↗",tone:monthlyNet>=0?"green":"red",label:"Monthly Net",value:`${monthlyNet>=0?"+":""}${fmt(monthlyNet)}`,text:"Recurring client income minus monthly budget and one-twelfth of yearly budget."},
  {icon:"◎",tone:operating.net>=0?"green":"red",label:"Annual Net",value:`${operating.net>=0?"+":""}${fmt(operating.net)}`,text:"Full-year recurring income minus monthly budget × 12 and yearly budget."},
  {icon:"%",tone:operatingMargin>=0?"green":"red",label:"Operating Margin",value:`${operatingMargin>=0?"+":""}${operatingMargin.toFixed(1)}%`,text:"Annual operating net divided by annual recurring-client income."},
  {icon:"◔",tone:budgetUsedPct>100?"red":budgetUsedPct>75?"orange":"blue",label:"Budget Used",value:`${budgetUsedPct.toFixed(1)}%`,text:`${fmt(usedBudget)} recorded against ${fmt(monthlyBudget())} of monthly budget.`},
  {icon:"◇",tone:clientConcentration>50?"orange":"blue",label:"Client Concentration",value:`${clientConcentration.toFixed(1)}%`,text:largestClient?`${escapeHtml(largestClient.name)} is the largest share of recurring monthly income.`:"Add recurring clients to calculate concentration."},
  {icon:"$",tone:usdExposure>60?"orange":"blue",label:"USD Exposure",value:`${usdExposure.toFixed(1)}%`,text:"Share of portfolio assets held in USD stocks and USD Wallet."}
 ];
 insightLong.innerHTML=decisionMetrics.map(x=>`<article class="signal-item metric-signal ${x.tone}"><div class="signal-ic"><span class="metric-symbol">${x.icon}</span></div><div><small>${x.label}</small><b class="private">${x.value}</b><p>${x.text}</p></div></article>`).join("");
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
 applyLanguage();
}

function openSimple(title,fields,callback){
 simpleTitle.textContent=title;
 simpleFields.innerHTML=fields.map(f=>{
  const input=f.options
   ? `<select id="sf_${f.key}">${f.options.map(o=>`<option ${String(o)===String(f.value)?'selected':''}>${o}</option>`).join("")}</select>`
   : `<input id="sf_${f.key}" type="${f.type||'text'}" ${f.step?`step="${f.step}"`:''} ${f.value!==undefined?`value="${f.value}"`:''} ${f.required===false?'':'required'}>`;
  return `<label>${f.label}${input}</label>`;
 }).join("");
 simpleForm.onsubmit=(e)=>{
  e.preventDefault();
  const obj={};
  fields.forEach(f=>{
   const el=q("#sf_"+f.key);
   obj[f.key]=f.type==="number"?Number(el.value):el.value;
  });
  if(callback(obj)===false)return;
  simpleModal.close();
  save(); renderAll(); toastMsg("Saved");
 };
 simpleModal.showModal();
}
function renderTxCategoryTags(preferred){
 const type=q("#txType .active")?.dataset.type||"expense";
 const budgetTags=state.budgets.map(item=>String(item.category).trim()).filter(Boolean);
 const existing=state.transactions.filter(item=>item.type===type).map(item=>String(item.category).trim()).filter(Boolean);
 const fallbackExpense=["Essentials","Food","Coffee","Electricity","IPL","PAM","Internet","Needs","Subscriptions","Others"];
 const incomeTags=[...existing,"Bonus","Business","Investment","Other Income"];
 const tags=[...new Set(type==="expense"?[...(budgetTags.length?budgetTags:fallbackExpense),COMPANY_EXPENSE_TAG,...(preferred&&!budgetTags.includes(preferred)?[preferred]:[])]:incomeTags)];
 const selected=tags.includes(preferred)?preferred:(tags.includes(txCategory.value)?txCategory.value:tags[0]);
 txCategoryLabel.textContent=type==="expense"?"Budget / Record Tag":"Income Tag";
 txCategory.innerHTML=tags.map(tag=>`<option ${tag===selected?"selected":""}>${tag}</option>`).join("");
 txCategoryTags.innerHTML=tags.map(tag=>`<button type="button" class="category-tag ${tag===selected?"active":""}" data-category-tag="${tag}">${tag}</button>`).join("");
 qa("[data-category-tag]").forEach(button=>button.onclick=()=>{txCategory.value=button.dataset.categoryTag;qa("[data-category-tag]").forEach(item=>item.classList.toggle("active",item===button));});
}
function renderTxChannelTags(preferred){
 const existing=state.transactions.map(item=>String(item.channel||"").trim()).filter(Boolean);
 const tags=[...new Set([...CHANNEL_PRESETS,...existing,...(preferred?[preferred]:[])])];
 const selected=tags.includes(preferred)?preferred:(tags.includes(txChannel.value)?txChannel.value:tags[0]);
 txChannel.value=selected;
 txChannelTags.innerHTML=tags.map(tag=>`<button type="button" class="category-tag ${tag===selected?"active":""}" data-channel-tag="${tag}">${tag}</button>`).join("")+`<button type="button" class="category-tag add-channel-tag" data-add-channel-tag>＋ Custom</button>`;
 qa("[data-channel-tag]").forEach(button=>button.onclick=()=>{txChannel.value=button.dataset.channelTag;qa("[data-channel-tag]").forEach(item=>item.classList.toggle("active",item===button));});
 q("[data-add-channel-tag]").onclick=()=>{
  const custom=prompt("New channel tag (example: TikTok Shop)","")?.trim();
  if(!custom)return;
  txChannel.value=custom;renderTxChannelTags(custom);
 };
}
function openTxEditor(id){
 const tx=state.transactions.find(t=>t.id===id);
 if(!tx) return;
 state.txEdit=id;
 txModalTitle.textContent="Edit Transaction";
 qa("#txType button").forEach(b=>b.classList.toggle("active",b.dataset.type===tx.type));
 txAmount.value=tx.amount; txDescription.value=tx.description; txChannel.value=tx.channel; txDate.value=tx.date;renderTxCategoryTags(tx.category);renderTxChannelTags(tx.channel);
 txModal.showModal();
}
function resetTxModal(){
 state.txEdit=null;
 txModalTitle.textContent="Add Transaction";
 qa("#txType button").forEach((b,i)=>b.classList.toggle("active",i===0));
 txAmount.value=""; txDescription.value=""; txChannel.value="Offline"; txDate.value=todayISO();renderTxCategoryTags();renderTxChannelTags("Offline");
}
function editMonthly(i){
 const x=state.budgets[i];
 openSimple("Edit Monthly Budget",[
  {key:"category",label:"Category",value:x.category},
  {key:"monthly",label:"Default Monthly Budget",type:"number",value:x.monthly},
  {key:"paymentStatus",label:"This Month Status",options:["auto","partial","done"],value:x.trackingMonth===monthKey(new Date())?(x.paymentStatus||"auto"):"auto"},
  {key:"paidAmount",label:"Paid Amount (used for partial)",type:"number",value:x.trackingMonth===monthKey(new Date())?Number(x.paidAmount||0):0}
 ],o=>{if(isCompanyExpenseTag(o.category)){alert(`${COMPANY_EXPENSE_TAG} is a fixed History-only tag and cannot become a budget.`);return false;}state.budgets[i]={...x,...o,trackingMonth:monthKey(new Date())};});
}
function editYearly(i){
 const x=state.yearly[i];
 openSimple("Edit Yearly Expense",[
  {key:"name",label:"Name",value:x.name},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"month",label:"Month",value:x.month},
  {key:"category",label:"Category",value:x.category}
 ],o=>state.yearly[i]={...x,...o,amount:Math.abs(Number(o.amount||0))});
}
function editEvent(i){
 const x=state.events[i];
 openSimple("Edit Event",[
  {key:"name",label:"Name",value:x.name},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"date",label:"Date",type:"date",value:x.date},
  {key:"category",label:"Category",value:x.category}
 ],o=>state.events[i]={...x,...o,amount:Math.abs(Number(o.amount||0))});
}
function editClient(i){
 const x=state.clients[i];
 openSimple("Edit Client",[
  {key:"name",label:"Client Name",value:x.name},
  {key:"clientType",label:"Client Type",options:["recurring","ending"],value:x.clientType||"recurring"},
  {key:"monthly",label:"Monthly Retainer / Final Amount",type:"number",value:x.monthly},
  {key:"paid",label:"Paid This Month",type:"number",value:getClientPaidThisMonth(x)},
  {key:"carry",label:"Previous Outstanding",type:"number",value:x.carry}
 ],o=>{
  state.clients[i]={...x,...o,trackingMonth:monthKey(new Date())};
  if(o.clientType==="ending"){
   state.clients[i].endingPaid=Boolean(x.endingPaid)&&o.paid>=o.monthly+o.carry;
   state.clients[i].status=state.clients[i].endingPaid?"paid":"pending";
  }else{
   state.clients[i].endingPaid=false;
   state.clients[i].status = o.paid >= o.monthly + o.carry ? "paid" : "pending";
  }
 });
}
function changeClientStatus(i){
 const x=state.clients[i];
 if(x.clientType==="ending"){
  openSimple("Update Ending Client",[
   {key:"payment",label:"Final Payment",options:["unpaid","paid"],value:x.endingPaid?"paid":"unpaid"}
  ],o=>{const done=o.payment==="paid";state.clients[i]={...x,endingPaid:done,status:done?"paid":"pending",paid:done?Number(x.monthly)+Number(x.carry):0,trackingMonth:monthKey(new Date())};});
  return;
 }
 openSimple("Update Client Status",[
  {key:"status",label:"Status",options:["paid","pending"],value:x.status},
  {key:"paid",label:"Paid This Month",type:"number",value:getClientPaidThisMonth(x)}
 ],o=>state.clients[i]={...x,status:o.status,paid:o.paid,trackingMonth:monthKey(new Date())});
}
function editCredit(id){
 const i=state.credit.findIndex(item=>item.id===id),x=state.credit[i];
 if(!x)return;
 openSimple("Edit Credit / PayLater Item",[
  {key:"source",label:"Source",options:["Credit Card","GoPayLater","ShopeePayLater"],value:x.source},
  {key:"description",label:"Description",value:x.description},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"due",label:"Due Date",type:"date",value:x.due},
  {key:"payment",label:"Payment Status",options:["unpaid","paid"],value:x.paid?"paid":"unpaid"}
 ],o=>state.credit[i]={...x,source:o.source,description:o.description,amount:Math.abs(Number(o.amount||0)),due:o.due,paid:o.payment==="paid"});
}
function editEntrusted(id){
 const i=state.entrustedFunds.findIndex(item=>item.id===id),x=state.entrustedFunds[i];
 if(!x)return;
 openSimple("Edit Entrusted Fund",[
  {key:"name",label:"Person / Description",value:x.name},
  {key:"amount",label:"Amount",type:"number",value:x.amount},
  {key:"source",label:"Deduct From",options:["Cash Balance","Stocks"],value:x.source==="cash"?"Cash Balance":"Stocks"},
  {key:"status",label:"Status",options:["Active","Settled"],value:x.settled?"Settled":"Active"}
 ],o=>state.entrustedFunds[i]={...x,name:o.name,amount:o.amount,source:o.source==="Cash Balance"?"cash":"stocks",settled:o.status==="Settled"});
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
 if(normalizeStockMappings())await save();
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

async function refreshExchangeRate({silent=false,force=false}={}){
 if(!navigator.onLine)return false;
 if(fxRefreshPromise)return fxRefreshPromise;
 fxRefreshPromise=(async()=>{try{
  if(typeof refreshFxBtn!=="undefined"){refreshFxBtn.disabled=true;refreshFxBtn.classList.add("is-loading");}
  const quote=await fetchUsdIdrRate({force});
  const rate=Number(quote.rate);
  if(!validUsdIdr(rate))throw new Error(`Rejected implausible USD/IDR rate: ${rate||"missing"}.`);
  const previous=Number(state.usdIdr||0);
  if(validUsdIdr(previous)&&Math.abs(rate-previous)/previous>.15)throw new Error(`Rejected sudden USD/IDR jump from ${previous} to ${rate}.`);
  const changed=Number(state.usdIdr)!==rate;
  state.usdIdr=rate;
  state.usdIdrMeta={provider:quote.provider,status:quote.status,asOf:quote.asOf};
  if(changed)saveSettings();
  if(!hasActiveEditor()){renderStocks();renderAccumulation();renderProspect();renderInsights();attachTips();applyLanguage();}
  if(!silent)toastMsg(`USD/IDR updated · ${new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(rate)}`);
  return true;
 }catch(error){
  const previous=Number(state.usdIdr||0);
  state.usdIdr=validUsdIdr(previous)?previous:DEFAULT_USD_IDR;
  state.usdIdrMeta={provider:validUsdIdr(previous)?"saved":"manual",status:"saved fallback",asOf:new Date().toISOString(),error:error.message};
  if(previous!==state.usdIdr)saveSettings();
  if(!hasActiveEditor()){renderStocks();renderAccumulation();renderProspect();renderInsights();attachTips();applyLanguage();}
  if(typeof usdIdrRate!=="undefined"){usdIdrRate.textContent=`1 USD = ${new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(state.usdIdr)} IDR · SAVED RATE`;usdIdrRate.title=`Yahoo refresh unavailable · last valid rate retained · ${error.message}`;}
  if(!silent)toastMsg("Yahoo refresh unavailable · last valid rate retained");
  return false;
 }finally{
  if(typeof refreshFxBtn!=="undefined"){refreshFxBtn.disabled=false;refreshFxBtn.classList.remove("is-loading");}
  fxRefreshPromise=null;
 }})();
 return fxRefreshPromise;
}

async function refreshMarkets({silent=false}={}){
 await refreshExchangeRate({silent:true,force:true});
 await refreshStockPrices({silent:true});
 if(!silent)toastMsg("Market prices and USD/IDR updated");
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
qa(".mobile-more [data-page]").forEach(b=>b.addEventListener("click",()=>dataModal.close()));
qa("[data-go]").forEach(b=>b.onclick=()=>switchPage(b.dataset.go));
themeBtn.onclick=()=>setTheme(state.theme==="dark"?"light":"dark");
languageBtn.onclick=()=>{state.language=state.language==="en"?"id":"en";applyLanguage();saveSettings();renderAll();switchPage(state.page);};
privacyBtn.onclick=()=>{state.privacy=!state.privacy; document.body.classList.toggle("private-hidden",state.privacy); privacyBtn.textContent=state.privacy?"🙈":"👁"; renderAll();};
qa("#cashFilter button").forEach(b=>b.onclick=()=>{qa("#cashFilter button").forEach(x=>x.classList.remove("active")); b.classList.add("active"); state.filter=b.dataset.filter; renderCashflow();});
cashSort.onchange=()=>{state.sort=cashSort.value; renderCashflow();};
txSearch.oninput=()=>renderCashflow();
qa("#prospectTabs button").forEach(b=>b.onclick=()=>{qa("#prospectTabs button").forEach(x=>x.classList.remove("active")); b.classList.add("active"); state.prospectMode=b.dataset.prospect; renderProspect(); renderInsights();});
qa("[data-expense-view]").forEach(b=>b.onclick=()=>{state.expenseView=b.dataset.expenseView;renderExpenses();});
baseModeToggle.onclick=()=>{state.baseMode = state.baseMode === "manual" ? "auto" : "manual"; saveSettings(); updateModeToggleLabels(); renderAll();};
optimisticModeToggle.onclick=()=>{state.optimisticMode = state.optimisticMode === "manual" ? "auto" : "manual"; saveSettings(); updateModeToggleLabels(); renderAll();};
baseGrowth.oninput=()=>{state.baseGrowth=Number(baseGrowth.value); saveSettings(); if(state.baseMode==="auto") renderAll();};
optimisticGrowth.oninput=()=>{state.optimisticGrowth=Number(optimisticGrowth.value); saveSettings(); if(state.optimisticMode==="auto") renderAll();};

qa("[data-open-tx]").forEach(b=>b.onclick=()=>{resetTxModal(); txModal.showModal();});
qa("#txType button").forEach(b=>b.onclick=()=>{qa("#txType button").forEach(x=>x.classList.remove("active")); b.classList.add("active");renderTxCategoryTags();});
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
 {key:"monthly",label:"Monthly Budget",type:"number"},
 {key:"paymentStatus",label:"This Month Status",options:["auto","partial","done"],value:"auto"},
 {key:"paidAmount",label:"Paid Amount (used for partial)",type:"number",value:0}
],o=>{if(isCompanyExpenseTag(o.category)){alert(`${COMPANY_EXPENSE_TAG} is a fixed History-only tag and cannot become a budget.`);return false;}state.budgets.push({id:createId(),...o,trackingMonth:monthKey(new Date()),sortOrder:state.budgets.length});});
addYearlyBtn.onclick=()=>openSimple("Add Yearly Expense",[
 {key:"name",label:"Name"},
 {key:"amount",label:"Amount",type:"number"},
 {key:"month",label:"Payment Month"},
 {key:"category",label:"Category"}
],o=>state.yearly.push({id:createId(),...o,amount:Math.abs(Number(o.amount||0)),lastPaidYear:null,sortOrder:state.yearly.length}));
addEventBtn.onclick=addEventBtnTop.onclick=()=>openSimple("Add Event",[
 {key:"name",label:"Name"},
 {key:"amount",label:"Amount",type:"number"},
 {key:"date",label:"Date",type:"date",value:todayISO()},
 {key:"category",label:"Category"}
],o=>state.events.push({id:createId(),...o,amount:Math.abs(Number(o.amount||0)),sortOrder:state.events.length}));
addCreditBtn.onclick=()=>{
 simpleTitle.textContent="Add Credit / PayLater Item";
 simpleFields.innerHTML=`<label>Source<select id="sf_source"><option>Credit Card</option><option>GoPayLater</option><option>ShopeePayLater</option></select></label><label>Description<input id="sf_description" required></label><label>Amount<input id="sf_amount" type="number" required></label><label>Due Date<input id="sf_due" type="date" value="${autoDueDate('Credit Card')}" required></label>`;
 q("#sf_source").onchange=(e)=>q("#sf_due").value=autoDueDate(e.target.value);
 simpleForm.onsubmit=(e)=>{
  e.preventDefault();
  state.credit.push({id:createId(),source:sf_source.value,description:sf_description.value,amount:Math.abs(Number(sf_amount.value)),due:sf_due.value,paid:false,sortOrder:state.credit.filter(item=>!item.paid).length});
  simpleModal.close(); save(); renderAll(); toastMsg("Credit item added");
 };
 simpleModal.showModal();
};
addEntrustedBtn.onclick=()=>openSimple("Add Entrusted Fund",[
 {key:"name",label:"Person / Description"},
 {key:"amount",label:"Amount",type:"number"},
 {key:"source",label:"Deduct From",options:["Cash Balance","Stocks"],value:"Cash Balance"}
],o=>state.entrustedFunds.push({id:createId(),name:o.name,amount:o.amount,source:o.source==="Cash Balance"?"cash":"stocks",settled:false,sortOrder:state.entrustedFunds.length}));
addClientBtn.onclick=()=>openSimple("Add Client",[
 {key:"name",label:"Client Name"},
 {key:"clientType",label:"Client Type",options:["recurring","ending"],value:"recurring"},
 {key:"monthly",label:"Monthly Retainer / Final Amount",type:"number"},
 {key:"paid",label:"Paid This Month",type:"number",value:0},
 {key:"carry",label:"Previous Outstanding",type:"number",value:0},
 {key:"status",label:"Status",options:["paid","pending"],value:"pending"}
],o=>state.clients.push({id:createId(),...o,sortOrder:state.clients.filter(row=>(row.clientType||"recurring")===o.clientType).length,endingPaid:o.clientType==="ending"&&o.status==="paid",status:o.status==="paid"?"paid":"pending",trackingMonth:monthKey(new Date())}));
addTickerBtn.onclick=()=>openSimple("Add Ticker",[
 {key:"ticker",label:"Ticker"},
 {key:"market",label:"Market",options:["IDX","NASDAQ","NYSE"],value:"NASDAQ"},
 {key:"providerSymbol",label:"Provider Symbol (leave blank to use ticker)",required:false},
 {key:"quantity",label:"Quantity (IDX = lots · US = shares)",type:"number",step:".000001"},
 {key:"avg",label:"Average Price / Share",type:"number",step:".01"},
 {key:"current",label:"Manual Fallback Price / Share",type:"number",step:".01",value:0}
],o=>{o.id=createId();o.ticker=o.ticker.toUpperCase();o.displaySymbol=o.ticker;o.quantity=quantityForStorage(o.market,o.quantity);normalizeStockMapping(o);o.manualCurrent=o.current;o.priceSource="manual";o.priceStatus="manual";o.priceAsOf=null;o.base={};o.optimistic={};YEARS.slice(1).forEach(y=>{o.base[y]=o.current;o.optimistic[y]=o.current});state.stocks.push(o);});
addElectricityBtn.onclick=()=>openSimple("Add Meter Reading",[
 {key:"date",label:"Date",type:"date",value:todayISO()},
 {key:"time",label:"Time",type:"time",value:"19:00"},
 {key:"remaining",label:"Remaining kWh",type:"number",step:".01"}
],o=>state.electricity.push({id:createId(),...o}));

qa(".close-dialog").forEach(b=>b.onclick=()=>b.closest("dialog").close());
qa("dialog").forEach(dialog=>{
 let backdropPress=null;
 dialog.addEventListener("pointerdown",event=>{
  backdropPress=event.target===dialog?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;
 });
 dialog.addEventListener("pointerup",event=>{
  if(!backdropPress||backdropPress.id!==event.pointerId)return;
  const moved=Math.hypot(event.clientX-backdropPress.x,event.clientY-backdropPress.y);
  const shouldClose=event.target===dialog&&moved<7;
  backdropPress=null;
  if(shouldClose)dialog.close();
 });
 dialog.addEventListener("pointercancel",()=>{backdropPress=null;});
});

function applyCloudState(next,{preserveUi=false}={}){
 if(preserveUi)return;
 if(hasActiveEditor())return;
 const ui={page:state.page,privacy:state.privacy,filter:state.filter,sort:state.sort,expenseView:state.expenseView,txEdit:null,prospectMode:state.prospectMode};
 Object.assign(state,next,ui);
 document.documentElement.dataset.theme=state.theme;
 localStorage.setItem("cvfinance-theme-cache",state.theme);
 localStorage.setItem("cvfinance-language-cache",state.language||"en");
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
 if(!validUsdIdr(state.usdIdr)){
  state.usdIdr=DEFAULT_USD_IDR;
  state.usdIdrMeta={provider:"manual",status:"sanitized fallback",asOf:new Date().toISOString(),error:"Previously saved rate was outside the safe range."};
  await saveSettings();
 }
 if(normalizeStockMappings())await save();
 if(!stockRefreshStarted){
  stockRefreshStarted=true;
  setTimeout(()=>refreshMarkets({silent:true}),500);
  fxRefreshTimer=setInterval(()=>refreshExchangeRate({silent:true}),5*60*1000);
 }
}

async function boot(){
 document.documentElement.dataset.theme=state.theme;themeBtn.textContent=state.theme==="dark"?"☀":"☾";
 privacyBtn.textContent="👁";txDate.value=todayISO();updateModeToggleLabels();
 baseGrowth.value=state.baseGrowth;optimisticGrowth.value=state.optimisticGrowth;renderAll();applyLanguage();
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
logoutBtn.onclick=()=>{if(fxRefreshTimer)clearInterval(fxRefreshTimer);syncManager.signOut();};
refreshStocksBtn.onclick=()=>refreshMarkets();
refreshFxBtn.onclick=()=>refreshExchangeRate({force:true});
editFxBtn.onclick=()=>openSimple("Set USD/IDR manually",[
 {key:"rate",label:"1 USD in IDR",type:"number",step:".01",value:Number(state.usdIdr||DEFAULT_USD_IDR)}
],o=>{
 const rate=Number(o.rate);
 if(!validUsdIdr(rate)){alert("Enter a valid USD/IDR rate between 10,000 and 25,000.");return false;}
 state.usdIdr=rate;state.usdIdrMeta={provider:"manual",status:"manual",asOf:new Date().toISOString()};
});
validateSymbolsBtn.onclick=()=>validateStockSymbols();

let installPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;installPwaBtn.hidden=false;});
installPwaBtn.onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installPwaBtn.hidden=true;};

boot();
