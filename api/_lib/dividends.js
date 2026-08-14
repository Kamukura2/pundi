import { fetchJson } from "./http.js";

const dateOnly = value => String(value || "").slice(0, 10);
const asDate = stamp => stamp ? new Date(Number(stamp) * 1000).toISOString().slice(0, 10) : "";
const currentYear = () => new Date().getFullYear();
const sourceUrls = {
  bmriInterim2026:"https://www.bankmandiri.co.id/documents/38268824/0/PENGUMUMAN%2BJADWAL%2BDAN%2BTATA%2BCARA%2BPEMBAGIAN%2BDIVIDEN%2BINTERIM%2BBMRI%2B%283%29.pdf/23e97db5-8504-bd67-bfb4-82e751994017?t=1767859366452",
  bmriFinal2026:"https://www.bankmandiri.co.id/documents/38268824/0/Bank%2BMandiri%2BAGMS%2BResult.pdf/401b0088-41fa-b903-b027-2dc989b14aa6?t=1782292597983"
};

function eventKey(ticker, event) {
  const date = event.paymentDate || event.recordDate || event.exDate || event.announcementDate || "undated";
  return `${ticker}:${date}:${Number(event.amountPerShare).toFixed(9)}:${event.type || "regular"}`.toLowerCase();
}

function officialEvents(holding) {
  const scoped = `${String(holding.display_symbol).toUpperCase()}:${String(holding.market).toUpperCase()}`;
  if (scoped !== "BMRI:IDX") return [];
  return [
    {type:"interim",currency:"IDR",amountPerShare:100,announcementDate:"2025-12-22",exDate:"2026-01-06",recordDate:"2026-01-07",paymentDate:"2026-01-14",status:"confirmed",sourceProvider:"Bank Mandiri IR",sourceUrl:sourceUrls.bmriInterim2026},
    {type:"final",currency:"IDR",amountPerShare:376.956938949,announcementDate:"2026-04-30",exDate:"2026-05-11",recordDate:"2026-05-12",paymentDate:"2026-05-25",status:"confirmed",sourceProvider:"Bank Mandiri IR",sourceUrl:sourceUrls.bmriFinal2026}
  ].map(event => ({...event,eventKey:eventKey("BMRI",event)}));
}

function twelveSymbol(holding) {
  const symbol = String(holding.provider_symbol || holding.display_symbol).toUpperCase();
  return holding.market === "IDX" ? `${symbol}:IDX` : symbol;
}

async function twelveDataEvents(holding) {
  if (!process.env.TWELVE_DATA_API_KEY) throw new Error("Twelve Data is not configured.");
  const start = `${currentYear()-1}-01-01`, end = `${currentYear()+2}-12-31`;
  const url = new URL("https://api.twelvedata.com/dividends");
  url.searchParams.set("symbol", twelveSymbol(holding));url.searchParams.set("start_date", start);url.searchParams.set("end_date", end);url.searchParams.set("apikey", process.env.TWELVE_DATA_API_KEY);
  const data = await fetchJson(url, {headers:{Accept:"application/json"}});
  if (data?.status === "error" || Number(data?.code) >= 400) throw new Error(data?.message || "Twelve Data dividends are unavailable.");
  const rows = Array.isArray(data?.dividends) ? data.dividends : Array.isArray(data?.data) ? data.data : [];
  return rows.map(row => {
    const event = {
      type:String(row.type || "regular").toLowerCase(),currency:String(row.currency || holding.currency || "USD").toUpperCase(),
      amountPerShare:Number(row.amount || row.dividend || row.cash_amount || 0),announcementDate:dateOnly(row.declaration_date || row.announcement_date),
      exDate:dateOnly(row.ex_date || row.ex_dividend_date),recordDate:dateOnly(row.record_date),paymentDate:dateOnly(row.payment_date),
      status:"confirmed",sourceProvider:"Twelve Data",sourceUrl:"https://twelvedata.com/docs"
    };
    return {...event,eventKey:eventKey(holding.display_symbol,event)};
  }).filter(row => row.amountPerShare > 0 && (row.paymentDate || row.recordDate || row.exDate));
}

function yahooSymbol(holding) {
  const symbol = String(holding.provider_symbol || holding.display_symbol).toUpperCase();
  return holding.market === "IDX" && !symbol.endsWith(".JK") ? `${symbol}.JK` : symbol;
}

async function yahooEvents(holding) {
  const now = Math.floor(Date.now()/1000), from = Math.floor(new Date(`${currentYear()-2}-01-01T00:00:00Z`).getTime()/1000), to = Math.floor(new Date(`${currentYear()+2}-12-31T23:59:59Z`).getTime()/1000);
  const hosts = ["https://query1.finance.yahoo.com","https://query2.finance.yahoo.com"];
  let lastError;
  for (const host of hosts) {
    try {
      const symbol = yahooSymbol(holding),url = new URL(`/v8/finance/chart/${encodeURIComponent(symbol)}`,host);
      url.searchParams.set("period1",String(from));url.searchParams.set("period2",String(Math.max(to,now)));url.searchParams.set("interval","1d");url.searchParams.set("events","div");
      const data = await fetchJson(url,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0 (compatible; CVFinance/8.0; personal corporate-action lookup)"}});
      const result=data?.chart?.result?.[0];if(!result)throw new Error("No Yahoo corporate actions returned.");
      const rows=Object.values(result.events?.dividends||{});
      return rows.map(row=>{
        const event={type:"regular",currency:holding.currency,amountPerShare:Number(row.amount||0),announcementDate:"",exDate:asDate(row.date),recordDate:"",paymentDate:"",status:"confirmed",sourceProvider:"Yahoo corporate actions",sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`};
        return {...event,eventKey:eventKey(holding.display_symbol,event)};
      }).filter(row=>row.amountPerShare>0&&row.exDate);
    } catch(error){lastError=error;}
  }
  throw lastError || new Error("Yahoo corporate actions are unavailable.");
}

function dedupe(events) {
  const ordered=[...events].sort((a,b)=>(a.sourceProvider?.includes(" IR")?-1:0)-(b.sourceProvider?.includes(" IR")?-1:0));
  const result=[];
  ordered.forEach(event=>{
    const duplicate=result.some(row=>Math.abs(Number(row.amountPerShare)-Number(event.amountPerShare))<0.000001&&[row.paymentDate,row.recordDate,row.exDate].filter(Boolean).some(date=>[event.paymentDate,event.recordDate,event.exDate].includes(date)));
    if(!duplicate)result.push(event);
  });
  return result;
}

export async function fetchDividendEvents(holding) {
  const events=[...officialEvents(holding)],failures=[];
  try{events.push(...await twelveDataEvents(holding));}catch(error){failures.push(`Twelve Data: ${error.message}`);}
  try{events.push(...await yahooEvents(holding));}catch(error){failures.push(`Yahoo: ${error.message}`);}
  const rows=dedupe(events);
  if(!rows.length&&failures.length===2)throw Object.assign(new Error(failures.join(" | ")),{code:"dividends_unavailable",status:502});
  return {events:rows,coverage:[...new Set(rows.map(row=>row.sourceProvider))].join(" + ")||"No confirmed dividend",warnings:failures};
}

