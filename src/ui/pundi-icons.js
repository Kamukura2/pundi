const ICONS = {
  overview: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.7"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.7"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.7"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.7"/><path d="M10.5 7.25h3M7.25 10.5v3M16.75 10.5v3M10.5 16.75h3" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  transactions: '<path d="M6 3.8h8.8l3.2 3.2v13.2H6z"/><path d="M14.5 3.8V7h3.2M8.7 10h6.6M8.7 13.5h6.6M8.7 17h4.1" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  income: '<path d="M4.5 18.5V11h4v7.5M10 18.5V8h4v10.5M15.5 18.5V5h4v13.5" stroke="var(--pundi-icon-accent)" stroke-width="2"/><path d="M4 5.5h7M8 2.5l3 3-3 3" stroke="currentColor" stroke-width="1.8"/>',
  expenses: '<path d="M5.5 4.5h9l3.5 3.5v11.5h-12.5z"/><path d="M14.5 4.5V8H18M8.5 11.5h6M8.5 15h6" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><path d="M19.5 13v6M16.5 16l3 3 3-3" stroke="currentColor" stroke-width="1.8"/>',
  assets: '<path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><circle cx="12" cy="8" r="1.5" fill="var(--pundi-icon-accent)" stroke="none"/>',
  trading: '<path d="M5 19V9M5 12h3M10 19V5M10 8h3M15 19v-7M15 15h3M20 19V7M20 10h-3" stroke="var(--pundi-icon-accent)" stroke-width="2"/><path d="M3.5 19.5h18M6.5 7.5l3.5-3 5 5 5-5" stroke="currentColor" stroke-width="1.6"/>',
  electricity: '<path d="m13.5 2.8-8 10.1h5.8l-.8 8.3 8-10.1h-5.8l.8-8.3Z" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>',
  prospect: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3" fill="var(--pundi-icon-accent)" stroke="none"/><path d="m12 3.5 1.6 6.9L20.5 12l-6.9 1.6L12 20.5l-1.6-6.9L3.5 12l6.9-1.6Z" stroke="var(--pundi-icon-accent)" stroke-width="1.5"/><path d="m17 4.5 1 2.5 2.5 1" stroke="currentColor" stroke-width="1.5"/>',
  insights: '<path d="M5 4.5h9.5A4.5 4.5 0 0 1 19 9v10.5H9.5A4.5 4.5 0 0 0 5 24V4.5Z"/><path d="M19 19.5H9.5A4.5 4.5 0 0 0 5 24M9 9h6M9 12.5h6M9 16h4" stroke="var(--pundi-icon-accent)" stroke-width="1.7"/><path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7Z" fill="var(--pundi-icon-accent)" stroke="none"/>',
  settings: '<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.2 13.4 1.2.9-1.5 2.6-1.4-.5a7.3 7.3 0 0 1-1.6.9l-.2 1.5h-3l-.2-1.5a7.3 7.3 0 0 1-1.6-.9l-1.4.5L8 14.3l1.2-.9a7.2 7.2 0 0 1 0-1.8L8 10.7l1.5-2.6 1.4.5a7.3 7.3 0 0 1 1.6-.9l.2-1.5h3l.2 1.5a7.3 7.3 0 0 1 1.6.9l1.4-.5 1.5 2.6-1.2.9a7.2 7.2 0 0 1 0 1.8Z" stroke="var(--pundi-icon-accent)" stroke-width="1.35"/>',
  pro: '<path d="m12 3 2.5 2.1 3.3-.2.8 3.2 2.6 2-1.7 2.8.5 3.2-3.1 1.1-1.4 2.9-3.1-.9-3.1.9-1.4-2.9-3.1-1.1.5-3.2-1.7-2.8 2.6-2 .8-3.2 3.3.2L12 3Z" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.35"/><path d="m8.8 11.9 2.1 2.1 4.4-4.5" stroke="currentColor" stroke-width="1.8"/>',
  account: '<circle cx="12" cy="8" r="3.3" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 20c.7-3.5 3-5.4 6.5-5.4s5.8 1.9 6.5 5.4" stroke="currentColor" stroke-width="1.7"/>',
  cash: '<rect x="3.5" y="6" width="17" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.6" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><path d="M6.5 9.2h0M17.5 14.8h0" stroke="var(--pundi-icon-accent)" stroke-width="2.5"/>',
  bank: '<path d="m3.5 9 8.5-5 8.5 5"/><path d="M5.5 10.5v6.2M9.5 10.5v6.2M14.5 10.5v6.2M18.5 10.5v6.2M3.5 19h17"/><path d="M4.5 21h15" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  wallet: '<path d="M4 7.5h16v10.8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z"/><path d="M4.5 7.5V5.8A2 2 0 0 1 6.5 4H18a2 2 0 0 1 2 2v1.5"/><path d="M15 13h5" stroke="var(--pundi-icon-accent)" stroke-width="2"/><circle cx="15" cy="13" r=".8" fill="var(--pundi-icon-accent)" stroke="none"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.2"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/><path d="M8 13h0M12 13h0M16 13h0M8 17h0M12 17h0" stroke="var(--pundi-icon-accent)" stroke-width="2.2"/>',
  pin: '<path d="M12 21s6-5.3 6-10.6a6 6 0 1 0-12 0C6 15.7 12 21 12 21Z"/><circle cx="12" cy="10.4" r="2.1" fill="var(--pundi-icon-accent)" stroke="none"/>',
  ledger: '<path d="M6 4.5h12a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><path d="M8.5 8h8M8.5 12h8M8.5 16h5"/><path d="M5 17.5H3.8A1.8 1.8 0 0 1 2 15.7V6.5A2 2 0 0 1 4 4.5" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5c4-2.3 7.2 2.3 12 0v8c-4.8 2.3-8-2.3-12 0" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.5"/>',
  check: '<circle cx="12" cy="12" r="8.5" fill="var(--pundi-icon-accent)" stroke="none"/><path d="m8 12.2 2.5 2.5 5.5-5.7" stroke="currentColor" stroke-width="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2" stroke="var(--pundi-icon-accent)" stroke-width="2"/>',
  warning: '<path d="m12 3 9 17H3L12 3Z" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.4"/><path d="M12 8v5M12 16.5h0" stroke="currentColor" stroke-width="1.9"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v5" stroke="var(--pundi-icon-accent)" stroke-width="2"/><path d="M12 7.5h0" stroke="var(--pundi-icon-accent)" stroke-width="2.5"/>',
  edit: '<path d="m4 16.8-.7 3.9 3.9-.7L18 9.2 14.8 6 4 16.8Z"/><path d="m13.7 7.1 3.2 3.2M17.5 3.8l2.7 2.7" stroke="var(--pundi-icon-accent)" stroke-width="1.7"/>',
  trash: '<path d="M5 7h14M10 3.5h4L15.2 7H8.8L10 3.5ZM7 7l.7 13h8.6L17 7M10 10.5v6M14 10.5v6" stroke="var(--pundi-icon-accent)" stroke-width="1.7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-13.8-5.4L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 13.8 5.4L20 16"/><path d="M20 20v-4h-4" stroke="var(--pundi-icon-accent)" stroke-width="1.7"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="var(--pundi-icon-accent)" stroke-width="2.2"/>',
  minus: '<path d="M5 12h14" stroke="var(--pundi-icon-accent)" stroke-width="2.2"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  arrowUp: '<path d="M5 17 17.5 4.5M8 4.5h9.5V14" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  arrowDown: '<path d="M5 7 17.5 19.5M8 19.5h9.5V10" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  chevronDown: '<path d="m6.5 9 5.5 5.5L17.5 9" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" stroke="var(--pundi-icon-accent)" stroke-width="2"/>',
  eye: '<path d="M3.5 12s3.1-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3.1 5.5-8.5 5.5S3.5 12 3.5 12Z"/><circle cx="12" cy="12" r="2.5" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  eyeOff: '<path d="m4 4 16 16" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><path d="M9.5 6.8A9 9 0 0 1 12 6.5c5.4 0 8.5 5.5 8.5 5.5a15.4 15.4 0 0 1-2.5 3.2M6.1 8.1C4.4 9.5 3.5 12 3.5 12S6.6 17.5 12 17.5c1 0 1.8-.2 2.6-.5"/>',
  sun: '<circle cx="12" cy="12" r="3.3" fill="var(--pundi-icon-accent)" stroke="none"/><path d="M12 2.7v2M12 19.3v2M21.3 12h-2M4.7 12h-2M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4M18.6 18.6l-1.4-1.4M6.8 6.8 5.4 5.4" stroke="var(--pundi-icon-accent)" stroke-width="1.7"/>',
  moon: '<path d="M19.4 15.1A7.5 7.5 0 0 1 8.9 4.6 7.5 7.5 0 1 0 19.4 15.1Z" fill="var(--pundi-icon-accent)" stroke="none"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><circle cx="12" cy="12" r="1.7" fill="var(--pundi-icon-accent)" stroke="none"/>',
  support: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 10.2a3.5 3.5 0 0 1 7 0c0 2.4-3.5 2.3-3.5 4.3M12 17.5h0" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  deposit: '<path d="M5 19h14M7 16.5h10M9 14h6"/><path d="M12 3v8M8.5 7.5 12 11l3.5-3.5" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  outflow: '<path d="M5 5h14M7 8.5h10M9 12h6"/><path d="M12 13v8M8.5 17.5 12 21l3.5-3.5" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  pulse: '<path d="M3.5 13h4l1.8-6 3.3 12 2.1-6h5.8" stroke="var(--pundi-icon-accent)" stroke-width="2"/>',
  shield: '<path d="M12 3.5 19 6v5.2c0 4.4-2.5 7.8-7 9.3-4.5-1.5-7-4.9-7-9.3V6l7-2.5Z"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  sparkle: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" fill="var(--pundi-icon-accent)" stroke="none"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" fill="currentColor" stroke="none"/>',
  bolt: '<path d="m13.5 2.8-8 10.1h5.8l-.8 8.3 8-10.1h-5.8l.8-8.3Z" fill="var(--pundi-icon-accent)" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.8"/><path d="M3 10h18M7 15h4" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5" stroke="var(--pundi-icon-accent)" stroke-width="2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="var(--pundi-icon-accent)" stroke-width="1.9"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--pundi-icon-accent)" stroke-width="1.8"/><circle cx="12" cy="15" r="1.2" fill="var(--pundi-icon-accent)" stroke="none"/>'
};

const ALIASES = {
  '💰': 'overview', '📊': 'transactions', '🧾': 'expenses', '🤝': 'income', '📈': 'assets', '⚡': 'electricity', '🚀': 'prospect', '✨': 'insights', 'history': 'transactions', 'read': 'insights',
  '💵': 'cash', '🏦': 'bank', '📱': 'wallet', '⚑': 'flag', '✅': 'check', '⏳': 'clock', '📅': 'calendar', '📌': 'pin', '🫱🏻‍🫲🏽': 'income', '📥': 'income', '📓': 'ledger', '💎': 'pro', '⚠': 'warning', '📆': 'calendar',
  '🛡': 'shield', '🔥': 'bolt', '🧠': 'insights', '↗': 'arrowUp', '↘': 'arrowDown', 'arrow-up-right': 'arrowUp', 'arrow-down-right': 'arrowDown', '✓': 'check', '◉': 'target', '◒': 'target', '◎': 'target', '◔': 'target', '◇': 'assets', '$': 'wallet', '%': 'insights', 'α': 'insights', '＋': 'plus', '+': 'plus', '−': 'outflow', '✎': 'edit', '🗑': 'trash', '↻': 'refresh', '×': 'close', '👁': 'eye', '🙈': 'eyeOff', 'eye-off': 'eyeOff', '☾': 'moon', '☀': 'sun', 'ℹ': 'info', 'chevron-down': 'chevronDown', 'spark': 'sparkle'
};

const ACCENTS = {
  overview: '#72d6ff', transactions: '#8fa5ff', income: '#55e3b0', expenses: '#ff9a87', assets: '#b2a4ff', trading: '#7be4ff', electricity: '#ffd166', prospect: '#74c6ff', insights: '#ff9acb', settings: '#b7c8e9', pro: '#ffd166', account: '#8fd8ff', cash: '#55e3b0', bank: '#8fa5ff', wallet: '#74c6ff', calendar: '#ffd166', warning: '#ffb45c', info: '#8fa5ff', edit: '#8fa5ff', trash: '#ff8f9d', refresh: '#8fd8ff', plus: '#ffffff', minus: '#ff9a87', arrow: '#8fd8ff', arrowUp: '#55e3b0', arrowDown: '#ff9a87', chevronDown: '#b7c8ff', close: '#ff9aab', eye: '#8fd8ff', eyeOff: '#ff9aab', sun: '#ffd166', moon: '#b7c8ff', target: '#b2a4ff', support: '#8fd8ff', deposit: '#55e3b0', outflow: '#ff9a87', pulse: '#8fd8ff', shield: '#8fd8ff', sparkle: '#ff9acb', bolt: '#ffd166', card: '#8fa5ff', search: '#8fd8ff', menu: '#8fd8ff', lock: '#8fd8ff', ledger: '#8fa5ff', flag: '#ffd166', check: '#55e3b0', clock: '#ffd166', pin: '#ff9a87'
};

export function normalizePundiIconName(value) {
  const raw = String(value ?? '').trim();
  return ICONS[raw] ? raw : (ALIASES[raw] || raw || 'info');
}

export function pundiIcon(value, { label = '', size = 24, className = '' } = {}) {
  const name = normalizePundiIconName(value);
  const body = ICONS[name] || ICONS.info;
  const safeLabel = String(label).replace(/[<>&"']/g, '');
  const title = safeLabel ? `<title>${safeLabel}</title>` : '';
  return `<svg class="pundi-icon pundi-icon-${name} ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="${safeLabel ? 'false' : 'true'}"${safeLabel ? ` role="img" aria-label="${safeLabel}"` : ''} style="--pundi-icon-accent:${ACCENTS[name] || ACCENTS.info}">${title}${body}</svg>`;
}

export const pundiIconNames = Object.freeze(Object.keys(ICONS));
