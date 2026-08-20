export function formatCryptoQuote(value, quoteCurrency = "USDT", { locale = "en-US", minimumFractionDigits = 2, maximumFractionDigits = 8 } = {}) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits, maximumFractionDigits }).format(Number.isFinite(amount) ? amount : 0)} ${quoteCurrency}`;
}

export function formatFiatCurrency(value, currency = "IDR", { locale = "en-US", maximumFractionDigits } = {}) {
  const normalized = String(currency || "IDR").toUpperCase();
  if (normalized === "USDT") return formatCryptoQuote(value, "USDT", { locale, minimumFractionDigits:2, maximumFractionDigits:maximumFractionDigits ?? 8 });
  const isoCurrency = normalized === "USD" ? "USD" : "IDR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: isoCurrency,
    maximumFractionDigits: maximumFractionDigits ?? (isoCurrency === "USD" ? 4 : 2)
  }).format(Number(value || 0));
}
