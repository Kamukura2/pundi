const idrFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits:0 });
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits:4 });
const shortMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const formatIdr = value => `IDR ${idrFormatter.format(Number(value || 0))}`;
export const formatNumber = value => numberFormatter.format(Number(value || 0));

export function formatShortDate(iso, includeYear = false) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return `${day} ${shortMonths[month - 1]}${includeYear ? ` ${year}` : ""}`;
}

export function formatUsd(value) {
  return `USD ${new Intl.NumberFormat("en-US", {minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value || 0))}`;
}

export function compactIdr(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) return `IDR ${(amount / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1_000_000) return `IDR ${(amount / 1_000_000).toFixed(2)}M`;
  return formatIdr(amount);
}
