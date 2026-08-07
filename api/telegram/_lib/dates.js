export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const MONTHS = new Map([
  ["january",1],["jan",1],["januari",1],
  ["february",2],["feb",2],["februari",2],
  ["march",3],["mar",3],["maret",3],
  ["april",4],["apr",4],
  ["may",5],["mei",5],
  ["june",6],["jun",6],["juni",6],
  ["july",7],["jul",7],["juli",7],
  ["august",8],["aug",8],["agustus",8],
  ["september",9],["sep",9],["sept",9],
  ["october",10],["oct",10],["oktober",10],["okt",10],
  ["november",11],["nov",11],
  ["december",12],["dec",12],["desember",12],["des",12]
]);

const pad = value => String(value).padStart(2, "0");

export function jakartaParts(epochSeconds = Math.floor(Date.now() / 1000)) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:JAKARTA_TIME_ZONE,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"
  }).formatToParts(new Date(Number(epochSeconds) * 1000));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year:Number(values.year), month:Number(values.month), day:Number(values.day),
    hour:Number(values.hour), minute:Number(values.minute), second:Number(values.second)
  };
}

export function isoDate(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function jakartaDateTime(epochSeconds) {
  const parts = jakartaParts(epochSeconds);
  return { date:isoDate(parts), time:`${pad(parts.hour)}:${pad(parts.minute)}`, parts };
}

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function makeDate(year, month, day) {
  if (!validDate(year, month, day)) throw Object.assign(new Error("That date is not valid."), { code:"invalid_date", userMessage:"That date is not valid. Use DD/MM/YYYY." });
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(parts, amount) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return makeDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function extractTransactionDate(input, epochSeconds) {
  let text = String(input || "").trim();
  const base = jakartaParts(epochSeconds);
  let match = text.match(/\b(today|hari\s+ini)\b/i);
  if (match) return { date:isoDate(base), text:removeMatch(text, match), explicit:true };
  match = text.match(/\b(yesterday|kemarin)\b/i);
  if (match) return { date:addDays(base, -1), text:removeMatch(text, match), explicit:true };

  match = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (match) {
    let year = match[3] ? Number(match[3]) : base.year;
    if (year < 100) year += 2000;
    return { date:makeDate(year, Number(match[2]), Number(match[1])), text:removeMatch(text, match), explicit:true };
  }

  match = text.match(/\b(\d{1,2})\s+(january|jan|januari|february|feb|februari|march|mar|maret|april|apr|may|mei|june|jun|juni|july|jul|juli|august|aug|agustus|september|sep|sept|october|oct|oktober|okt|november|nov|december|dec|desember|des)(?:\s+(\d{4}))?\b/i);
  if (match) {
    const year = match[3] ? Number(match[3]) : base.year;
    return { date:makeDate(year, MONTHS.get(match[2].toLowerCase()), Number(match[1])), text:removeMatch(text, match), explicit:true };
  }
  return { date:isoDate(base), text, explicit:false };
}

function removeMatch(text, match) {
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ").replace(/^\s*[,;-]\s*|\s*[,;-]\s*$/g, "").trim();
}

export function monthBounds(epochSeconds = Math.floor(Date.now() / 1000)) {
  const parts = jakartaParts(epochSeconds);
  const start = makeDate(parts.year, parts.month, 1);
  const next = new Date(Date.UTC(parts.year, parts.month, 1));
  return { start, next:`${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01` };
}

export function nextDueDate(source, epochSeconds) {
  const dueDays = { "Credit Card":26, GoPayLater:31, ShopeePayLater:25 };
  const base = jakartaParts(epochSeconds);
  const desired = dueDays[source];
  let year = base.year;
  let month = base.month;
  const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  let day = Math.min(desired, lastDay(year, month));
  if (base.day > day) {
    const next = new Date(Date.UTC(year, month, 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = Math.min(desired, lastDay(year, month));
  }
  return makeDate(year, month, day);
}

export function daysBetweenReadings(earlier, later) {
  const left = Date.parse(`${earlier.reading_date}T${String(earlier.reading_time).slice(0,8)}+07:00`);
  const right = Date.parse(`${later.reading_date}T${String(later.reading_time).slice(0,8)}+07:00`);
  return (right - left) / 86400000;
}
