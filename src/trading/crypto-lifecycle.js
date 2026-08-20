import { parseCryptoPairInput } from "../crypto/binance.js";

const quoteCurrencies = new Set(["USD", "IDR", "USDT"]);

function isCryptoRecord(row = {}) {
  return String(row.assetType || "").toLowerCase() === "crypto"
    || String(row.market || "").toUpperCase() === "CRYPTO";
}

function rowTime(row = {}) {
  return `${String(row.date || row.tradeDate || "")}|${String(row.__createdAt || row.created_at || "")}`;
}

export function historicalCryptoQuote(baseInput, { positions = [], ledger = [] } = {}) {
  let base;
  try { base = parseCryptoPairInput(baseInput).baseSymbol; }
  catch { return null; }
  const records = [
    ...ledger.filter(row => isCryptoRecord(row) && String(row.ticker || row.displaySymbol || "").toUpperCase() === base),
    ...positions.filter(row => isCryptoRecord(row) && String(row.ticker || row.displaySymbol || "").toUpperCase() === base)
  ].sort((a, b) => rowTime(a).localeCompare(rowTime(b)));
  return records.map(row => String(row.currency || "").toUpperCase()).find(currency => quoteCurrencies.has(currency)) || null;
}
