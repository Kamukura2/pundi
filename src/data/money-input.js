export function parseMoneyInput(value) {
  const raw = String(value ?? "").replace(/\./g, "").replace(/,/g, ".");
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

export function formatMoneyInput(value, locale = "id-ID") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number);
}

export function isMoneyField(field = {}) {
  if (field.money === true) return true;
  if (field.money === false) return false;
  return /amount|balance|monthly|paid|carry|limit/i.test(String(field.key || ""));
}
