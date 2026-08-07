import { extractTransactionDate } from "./dates.js";

const CATEGORY_WORDS = {
  Food:["grocery","groceries","makan","lunch","dinner","breakfast","restaurant","snack","snacks","grabfood","gofood","food"],
  Coffee:["coffee","kopi","cafe","café","starbucks"],
  Essentials:["electricity","listrik","pln","ipl","internet","wifi","subscription","subscriptions","household","kebutuhan","needs"]
};

const CHANNEL_WORDS = {
  Shopee:["shopee"], Grab:["grab","grabfood"], Gojek:["gojek","gofood"],
  Transfer:["transfer","tf"], Offline:["offline","cash","tunai"], Other:["other"]
};

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const wordMatch = (text, word) => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);

export function parseMoney(value, {allowZero=false} = {}) {
  let raw = normalize(value).replace(/\s+/g, "").trim();
  const suffix = raw.match(/(juta|jt|ribu|rb|k|m)$/)?.[1] || "";
  if (suffix) raw = raw.slice(0, -suffix.length);
  raw = raw.replace(/[.,]+$/, "");
  if (!raw) return null;
  let numeric;
  if (suffix) {
    const decimal = raw.replace(/,/g, ".");
    if (!/^\d+(?:\.\d+)?$/.test(decimal)) return null;
    numeric = Number(decimal);
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) {
    numeric = Number(raw.replace(/[.,]/g, ""));
  } else if (/^\d+$/.test(raw)) {
    numeric = Number(raw);
  } else {
    return null;
  }
  const multiplier = ["jt","juta","m"].includes(suffix) ? 1_000_000 : ["k","rb","ribu"].includes(suffix) ? 1_000 : 1;
  const amount = Math.round(numeric * multiplier);
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

export function parseDecimal(value) {
  const raw = String(value || "").trim().replace(/,/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function inferCategory(description) {
  const text = normalize(description);
  for (const category of ["Coffee","Food","Essentials"]) {
    if (CATEGORY_WORDS[category].some(word => wordMatch(text, normalize(word)))) return { category, certain:true };
  }
  return { category:"Others", certain:false };
}

export function inferChannel(description, transactionType = "expense") {
  const text = normalize(description);
  for (const channel of ["Shopee","Grab","Gojek","Transfer","Offline","Other"]) {
    if (CHANNEL_WORDS[channel].some(word => wordMatch(text, word))) return channel;
  }
  return transactionType === "income" ? "Transfer" : "Offline";
}

export function parseQuickTransaction(input, epochSeconds) {
  const match = String(input || "").trim().match(/^([+-])\s*([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)\s*(?:,\s*)?(.*)$/i);
  if (!match) return null;
  const amount = parseMoney(match[2]);
  if (!amount) throw Object.assign(new Error("Invalid transaction amount."), { code:"invalid_amount", userMessage:"I couldn't read that amount. Try -50k or +1.5jt." });
  const type = match[1] === "+" ? "income" : "expense";
  const dated = extractTransactionDate(match[3], epochSeconds);
  const description = dated.text.trim();
  const category = type === "income" ? {category:"Others",certain:true} : inferCategory(description);
  return {
    type, amount, description, category:category.category, categoryCertain:category.certain,
    channel:inferChannel(description, type), transactionDate:dated.date
  };
}

export function parseCommand(text) {
  const match = String(text || "").trim().match(/^\/([a-z_]+)(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  return match ? { name:match[1].toLowerCase(), args:(match[2] || "").trim() } : null;
}

export function parseNaturalShortcut(text) {
  const value = String(text || "").trim();
  let match = value.match(/^saldo\s+(.+?)\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)$/i);
  if (match) return { kind:"balance", name:match[1].trim(), amount:parseMoney(match[2],{allowZero:true}) };
  match = value.match(/^(?:listrik|electricity)\s+([0-9]+(?:[.,][0-9]+)?)$/i);
  if (match) return { kind:"electricity", remaining:parseDecimal(match[1]) };
  match = value.match(/^(.+?)\s+(?:bayar|paid)\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)$/i);
  if (match) return { kind:"client_payment", name:match[1].replace(/^client\s+/i, "").trim(), amount:parseMoney(match[2],{allowZero:true}) };
  return null;
}

export function normalizeSearch(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

export const TRANSACTION_CATEGORIES = ["Food","Essentials","Coffee","Others"];
export const CREDIT_SOURCES = ["Credit Card","GoPayLater","ShopeePayLater"];
