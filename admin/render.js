const OVERVIEW_KEYS = [
  "total_users",
  "new_users_7_days",
  "new_users_30_days",
  "active_users_7_days",
  "free_users",
  "paid_users",
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;",
}[char]));

const text = value => String(value ?? "");
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function normalizeDashboardPayload(value) {
  if (!value || typeof value !== "object" || !value.overview || !Array.isArray(value.users)) {
    throw new Error("Admin API returned an invalid dashboard response.");
  }
  const overview = Object.fromEntries(OVERVIEW_KEYS.map(key => [key, Number(value.overview[key]) || 0]));
  const users = value.users.map(row => {
    const item = object(row);
    return {
      email: text(item.email),
      user_id: text(item.user_id),
      created_at: item.created_at || null,
      last_active: item.last_active || null,
      plan: text(item.plan) || "free",
      subscription_status: text(item.subscription_status) || "free",
      subscription_provider: text(item.subscription_provider) || "manual",
      subscription_started_at: item.subscription_started_at || null,
      current_period_end: item.current_period_end || null,
      feature_entitlements: object(item.feature_entitlements),
      account_status: text(item.account_status) || "active",
      aggregate_record_counts: object(item.aggregate_record_counts),
    };
  });
  return { overview, users };
}

export function renderCardsHtml(overview) {
  const cards = [
    ["Total Users", overview.total_users],
    ["New Users · 7 Days", overview.new_users_7_days],
    ["New Users · 30 Days", overview.new_users_30_days],
    ["Active · 7 Days", overview.active_users_7_days],
    ["Free Users", overview.free_users],
    ["Paid Users", overview.paid_users],
  ];
  return cards.map(([label, value]) => `<article class="card"><small>${label}</small><strong>${Number(value) || 0}</strong></article>`).join("");
}

export function renderRowsHtml(users) {
  const rows = users.map(row => {
    const features = Object.entries(row.feature_entitlements || {})
      .filter(([, enabled]) => enabled)
      .map(([name]) => name.replaceAll("_", " "))
      .join(", ") || "None";
    const shortId = row.user_id ? `${row.user_id.slice(0, 8)}…` : "—";
    return `<tr><td>${esc(row.email)}</td><td title="${esc(row.user_id)}">${esc(shortId)}</td><td>${esc(row.created_at || "—")}</td><td>${esc(row.last_active || "—")}</td><td><span class="badge">${esc(row.plan)}</span></td><td><span class="badge manual">${esc(row.subscription_status)} · ${esc(row.subscription_provider)}</span></td><td>${esc(features)}</td><td>${esc(row.account_status)}</td><td>${row.user_id ? `<button data-detail="${esc(row.user_id)}">View</button>` : "—"}</td></tr>`;
  });
  return rows.join("") || `<tr><td colspan="9">No matching users.</td></tr>`;
}

export function renderFailureHtml(message) {
  return `<strong>Admin dashboard unavailable.</strong><div>${esc(message || "Unable to load admin dashboard metadata.")}</div><button class="primary" data-admin-retry type="button">Retry</button><div class="meta">No dashboard data available yet.</div>`;
}
