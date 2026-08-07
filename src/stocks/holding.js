export const IDX_SHARES_PER_LOT = 100;

export const isIdxMarket = market => String(market || "").toUpperCase() === "IDX";

export const quantityUnit = market => isIdxMarket(market) ? "lot" : "shares";

export function quantityForDisplay(stock) {
  const quantity = Number(stock?.quantity || 0);
  return isIdxMarket(stock?.market) ? quantity / IDX_SHARES_PER_LOT : quantity;
}

export function quantityForStorage(market, displayedQuantity) {
  const quantity = Number(displayedQuantity || 0);
  return isIdxMarket(market) ? quantity * IDX_SHARES_PER_LOT : quantity;
}

export function normalizeStockMapping(stock, { resetProviderSymbol = false } = {}) {
  const idx = isIdxMarket(stock.market);
  const ticker = String(stock.ticker || stock.displaySymbol || "").trim().toUpperCase();
  const expected = {
    provider: idx ? "twelvedata" : "finnhub",
    currency: idx ? "IDR" : "USD",
    providerSymbol: resetProviderSymbol
      ? ticker
      : String(stock.providerSymbol || ticker).trim().toUpperCase()
  };
  const changed = stock.provider !== expected.provider
    || stock.currency !== expected.currency
    || stock.providerSymbol !== expected.providerSymbol;
  Object.assign(stock, expected);
  return changed;
}
