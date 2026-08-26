import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeDashboardPayload,
  renderCardsHtml,
  renderRowsHtml,
  renderFailureHtml,
} from "../../admin/render.js";

const baseOverview = {
  total_users: 2,
  new_users_7_days: 1,
  new_users_30_days: 2,
  active_users_7_days: 1,
  free_users: 1,
  paid_users: 1,
};
const user = {
  email: "owner@example.invalid",
  user_id: "user-12345678",
  created_at: "2026-08-26T00:00:00Z",
  last_active: null,
  plan: "free",
  subscription_status: "free",
  subscription_provider: "manual",
  feature_entitlements: { core_finance: true },
  account_status: "active",
};

const payload = normalizeDashboardPayload({ overview: baseOverview, users: [user] });
assert.match(renderCardsHtml(payload.overview), /Total Users/);
assert.match(renderCardsHtml(payload.overview), />2</);

const empty = normalizeDashboardPayload({ overview: { ...baseOverview, total_users: 0, free_users: 0, paid_users: 0 }, users: [] });
assert.match(renderCardsHtml(empty.overview), /Total Users/);
assert.match(renderCardsHtml(empty.overview), />0</);
assert.match(renderRowsHtml(empty.users), /No matching users/);

assert.match(renderRowsHtml(payload.users), /owner@example\.invalid/);
assert.match(renderRowsHtml(payload.users), /user-1234/);

assert.doesNotThrow(() => normalizeDashboardPayload({
  overview: {},
  users: [{ email: null, user_id: null, feature_entitlements: null }],
}));

assert.throws(
  () => normalizeDashboardPayload({ overview: {}, users: null }),
  /invalid dashboard response/i,
);

const failure = renderFailureHtml("Admin API failed.");
assert.match(failure, /Admin API failed/);
assert.match(failure, /Retry/);
assert.match(failure, /No dashboard data available/);

const html = await readFile(new URL("../../admin/index.html", import.meta.url), "utf8");
for (const id of ["notice", "dashboard", "cards", "error", "userRows", "count", "refresh"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing DOM target #${id}`);
}

console.log("Admin render contract PASS: metrics, zero users, user rows, optional metadata, malformed payload, failure fallback, and DOM targets");
