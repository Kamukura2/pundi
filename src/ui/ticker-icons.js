const TICKER_ICONS = Object.freeze({
  AAPL: { name: "Apple", mark: "A", tone: "silver" },
  AMZN: { name: "Amazon", mark: "a", tone: "amber" },
  ASII: { name: "Astra International", mark: "AS", tone: "blue" },
  BBCA: { name: "Bank Central Asia", mark: "BCA", tone: "blue" },
  BBRI: { name: "Bank Rakyat Indonesia", mark: "BRI", tone: "teal" },
  BMRI: { name: "Bank Mandiri", mark: "BM", tone: "gold" },
  BTC: { name: "Bitcoin", mark: "₿", tone: "orange" },
  ETH: { name: "Ethereum", mark: "Ξ", tone: "violet" },
  GOOGL: { name: "Alphabet", mark: "G", tone: "blue" },
  GOTO: { name: "GoTo", mark: "GOTO", tone: "red" },
  META: { name: "Meta", mark: "∞", tone: "blue" },
  MSFT: { name: "Microsoft", mark: "MS", tone: "multi" },
  MU: { name: "Micron", mark: "MU", tone: "indigo" },
  NFLX: { name: "Netflix", mark: "N", tone: "red" },
  NVDA: { name: "NVIDIA", mark: "N", tone: "green" },
  QQQ: { name: "Invesco QQQ", mark: "QQQ", tone: "navy" },
  SOL: { name: "Solana", mark: "SOL", tone: "violet" },
  SPY: { name: "SPDR S&P 500 ETF", mark: "SPY", tone: "navy" },
  TLKM: { name: "Telkom Indonesia", mark: "TLKM", tone: "red" },
  TSLA: { name: "Tesla", mark: "T", tone: "red" },
  USD: { name: "USD wallet", mark: "$", tone: "slate" },
  USDT: { name: "Tether", mark: "₮", tone: "teal" },
  NETCASH: { name: "Netcash", mark: "N", tone: "slate" },
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function normalizeTicker(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";
  const withoutVenue = raw.replace(/^(?:IDX|NASDAQ|NYSE|CRYPTO):/, "").replace(/\.JK$/, "");
  const first = withoutVenue.split(/[\s/:-]/).filter(Boolean)[0] || withoutVenue;
  return first;
}

export function tickerIcon(value, { label = "" } = {}) {
  const raw = String(value ?? "").trim().toUpperCase();
  const key = normalizeTicker(raw);
  const spec = TICKER_ICONS[key];
  const mark = spec?.mark || key.slice(0, 3) || "?";
  const name = label || spec?.name || (raw ? `${raw} asset` : "Unknown asset");
  const safeName = escapeHtml(name);
  const safeKey = escapeHtml(spec ? key : "fallback");
  const safeMark = escapeHtml(mark);
  return `<span class="ticker-icon ${spec ? "ticker-icon-known" : "ticker-icon-fallback"} ticker-icon-tone-${spec?.tone || "fallback"}" data-ticker-icon="${safeKey}" role="img" aria-label="${safeName} · ${escapeHtml(raw || "Unknown")}" title="${safeName} · ${escapeHtml(raw || "Unknown")}"><strong>${safeMark}</strong></span>`;
}

export const knownTickerIcons = Object.freeze(Object.keys(TICKER_ICONS));
