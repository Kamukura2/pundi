import { binanceSpotSymbol, isCryptoAsset, providerQuoteCurrency } from "../crypto/binance.js";

export const IDX_SHARES_PER_LOT = 100;

export const isIdxMarket = market => String(market || "").toUpperCase() === "IDX";
export const isCryptoMarket = market => String(market || "").toUpperCase() === "CRYPTO";
export const quantityUnit = market => isCryptoMarket(market) ? "units" : isIdxMarket(market) ? "lot" : "shares";

export function quantityForDisplay(stock) {
  const quantity = Number(stock?.quantity || 0);
  return isIdxMarket(stock?.market) ? quantity / IDX_SHARES_PER_LOT : quantity;
}

export function quantityForStorage(market, displayedQuantity) {
  const quantity = Number(displayedQuantity || 0);
  return isIdxMarket(market) ? quantity * IDX_SHARES_PER_LOT : quantity;
}

export function normalizeStockMapping(stock, { resetProviderSymbol = false } = {}) {
  const crypto = isCryptoAsset(stock) || isCryptoMarket(stock.market);
  const idx = isIdxMarket(stock.market);
  const ticker = String(stock.ticker || stock.displaySymbol || "").trim().toUpperCase();
  if (crypto) {
    const providerSymbol = resetProviderSymbol || !stock.providerSymbol ? binanceSpotSymbol(ticker, "USDT") : String(stock.providerSymbol).trim().toUpperCase();
    const sourceQuote = providerQuoteCurrency(providerSymbol);
    const semanticQuote = ["IDR","USD","USDT"].includes(String(stock.currency || "").toUpperCase())
      ? String(stock.currency).toUpperCase()
      : ["IDR","USD","USDT"].includes(sourceQuote) ? sourceQuote : "USDT";
    const expected = {
      assetType: "crypto",
      provider: "binance",
      currency: semanticQuote,
      providerSymbol
    };
    const changed = stock.assetType !== expected.assetType
      || stock.provider !== expected.provider
      || stock.currency !== expected.currency
      || stock.providerSymbol !== expected.providerSymbol;
    Object.assign(stock, expected);
    return changed;
  }
  const expected = {
    assetType: "equity",
    provider: idx ? "yahoo" : "finnhub",
    currency: idx ? "IDR" : "USD",
    providerSymbol: resetProviderSymbol
      ? ticker
      : String(stock.providerSymbol || ticker).trim().toUpperCase()
  };
  const changed = stock.assetType !== expected.assetType
    || stock.provider !== expected.provider
    || stock.currency !== expected.currency
    || stock.providerSymbol !== expected.providerSymbol;
  Object.assign(stock, expected);
  return changed;
}
