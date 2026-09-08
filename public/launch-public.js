(()=>{
'use strict';
const IDR=49000,KEY='pundi-public-fx-v1',MAX_AGE=7*864e5,FRESH=3600e3;
const price=document.getElementById('price'),note=document.getElementById('fx-note');
let quote=null,pending=null;
const valid=q=>q&&q.pair==='USD/IDR'&&Number.isFinite(q.rate)&&q.rate>=1000&&q.rate<=100000&&Number.isFinite(q.asOf)&&q.asOf<=Date.now()+300000&&Date.now()-q.asOf<=MAX_AGE;
try{const cached=JSON.parse(localStorage.getItem(KEY));if(valid(cached))quote=cached;}catch{}
function render(){
 const en=document.documentElement.lang==='en';
 document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===(en?'US':'ID'))));
 price.textContent=en&&valid(quote)?'≈ '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(IDR/quote.rate):'Rp49.000';
 note.hidden=!en;
 note.textContent=!en?'':valid(quote)?`Display estimate · billed in IDR · rate ${new Date(quote.asOf).toLocaleDateString('en-US')}${Date.now()-quote.asOf>FRESH?' (cached)':''}`:'USD estimate unavailable · price shown in IDR.';
 const title=en?'Pundi — Your money, finally in one place.':'Pundi — Keuanganmu, dalam satu tempat.';
 const description=en?'Income, spending, and investments. One clearer picture of your personal finances.':'Pemasukan, pengeluaran, dan investasi. Satu tempat untuk melihat keuangan pribadimu dengan jelas.';
 document.title=title;document.querySelector('meta[name="description"]').content=description;document.querySelector('meta[property="og:title"]').content=title;document.querySelector('meta[property="og:description"]').content=description;
 const labels=en?['Pundi dashboard · fictional data','Pundi income · fictional data','Pundi investments · fictional data']:['Dashboard Pundi · data fiksi','Pemasukan Pundi · data fiksi','Investasi Pundi · data fiksi'];
 document.querySelectorAll('main img').forEach((img,i)=>img.alt=labels[i]);
 document.querySelectorAll('.image-link').forEach((a,i)=>a.setAttribute('aria-label',en?`${i?'Investment':'Income'} screenshot, full size`:`Screenshot ${i?'investasi':'pemasukan'}, ukuran penuh`));
 document.querySelector('.region').setAttribute('aria-label',en?'Language / region':'Bahasa / wilayah');
}
async function updateFx(){
 if(pending||valid(quote)&&Date.now()-quote.asOf<FRESH)return;
 pending=(async()=>{try{
  // Narrow public display route only. No auth token, arbitrary symbol, or checkout changes.
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
  let response;try{response=await fetch('/api/public/fx/usd-idr',{credentials:'omit',cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok)return;
  const data=await response.json();const candidate={pair:data.pair,rate:Number(data.rate),asOf:Date.parse(data.asOf)};
  if(!valid(candidate))return;
  quote=candidate;try{localStorage.setItem(KEY,JSON.stringify(quote));}catch{}
 }catch{}finally{pending=null;render();}})();
}
document.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>{const region=b.dataset.region;document.documentElement.lang=region==='US'?'en':'id';document.documentElement.dataset.locale=document.documentElement.lang;try{localStorage.setItem('pundi-public-region',region);}catch{}render();if(region==='US')updateFx();}));
render();if(document.documentElement.lang==='en')updateFx();
})();
