import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { normalizeDashboardPayload, renderCardsHtml, renderRowsHtml } from "../../admin/render.js";

// Legacy fallback remains available: https://pundi-silk.vercel.app
const PRODUCTION_ORIGIN = process.env.PUNDI_PRODUCTION_URL || "https://app.pundi.online";
const PUNDI_REF = "ndeycwoyjwyntjkgbzlz";
const PUNDI_SUPABASE_HOST = `${PUNDI_REF}.supabase.co`;
const email = process.env.PUNDI_ADMIN_SMOKE_EMAIL || "";
const password = process.env.PUNDI_ADMIN_SMOKE_PASSWORD || "";

function fail(message) {
  throw new Error(String(message).replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/(password|token|key|secret)[=:]\s*[^\s,}]+/gi, "$1=[REDACTED]"));
}
function requireTarget(origin, supabaseUrl) {
  assert.equal(origin, PRODUCTION_ORIGIN, "Refusing smoke test: production origin mismatch.");
  const parsed = new URL(supabaseUrl);
  assert.equal(parsed.hostname, PUNDI_SUPABASE_HOST, "Refusing smoke test: Pundi Supabase ref mismatch.");
  assert.equal(parsed.protocol, "https:", "Refusing smoke test: Supabase URL must use HTTPS.");
}
function assertPublicConfig(config) {
  assert.deepEqual(Object.keys(config).sort(), ["supabaseAnonKey", "supabaseUrl"], "Public config contains unexpected fields.");
  assert.equal(typeof config.supabaseUrl, "string");
  assert.equal(typeof config.supabaseAnonKey, "string");
  assert.equal(config.supabaseAnonKey.length > 0, true);
  assert.equal(/service_role|password|refresh_token|access_token|secret|token/i.test(JSON.stringify(config)), false, "Public config contains a private credential marker.");
  requireTarget(PRODUCTION_ORIGIN, config.supabaseUrl);
}
function assertPrivacy(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const marker of ["password", "password_hash", "access_token", "refresh_token", "service_role", "transaction_description", "balance", "investment_value", "holding_value", "expense_amount"]) {
    assert.equal(serialized.includes(marker), false, `Admin response contains forbidden privacy marker: ${marker}`);
  }
}
function assertMetrics(overview) {
  const keys = ["total_users", "new_users_7_days", "new_users_30_days", "active_users_7_days", "free_users", "paid_users"];
  for (const key of keys) {
    assert.equal(typeof overview[key], "number", `Metric ${key} must be numeric.`);
    assert.equal(Number.isFinite(overview[key]), true, `Metric ${key} must be finite.`);
    assert.equal(overview[key] >= 0, true, `Metric ${key} must not be negative.`);
  }
  assert.equal(overview.total_users >= 1, true, "Pundi Auth must contain at least one user.");
  assert.equal(overview.free_users + overview.paid_users <= overview.total_users, true, "Plan counts exceed total users.");
}
function assertPagination(payload) {
  for (const key of ["page", "page_size", "total"]) assert.equal(Number.isInteger(payload[key]), true, `Pagination ${key} must be an integer.`);
  assert.equal(payload.page >= 1, true);
  assert.equal(payload.page_size >= 1, true);
  assert.equal(payload.total >= 0, true);
  assert.equal(payload.total, payload.users.length, "Current API contract must return the filtered collection with matching total.");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(20000) });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function run() {
  const { response: configResponse, body: config } = await fetchJson(`${PRODUCTION_ORIGIN}/api/config`, { cache: "no-store", headers: { Accept: "application/json" } });
  assert.equal(configResponse.status, 200, "Production /api/config must return 200.");
  assertPublicConfig(config);
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) } });

  if (!email || !password) {
    console.log("ACTION REQUIRED: set PUNDI_ADMIN_SMOKE_EMAIL and PUNDI_ADMIN_SMOKE_PASSWORD as untracked local secrets, then rerun npm run test:admin-smoke.");
    return false;
  }

  const authResult = await supabase.auth.signInWithPassword({ email, password });
  if (authResult.error || !authResult.data.session) fail("Pundi Auth smoke login failed.");
  const accessToken = authResult.data.session.access_token;
  try {
    const { response, body } = await fetchJson(`${PRODUCTION_ORIGIN}/api/admin`, {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.status, 200, `Authenticated /api/admin returned HTTP ${response.status}.`);
    assert.equal(response.headers.get("cache-control")?.includes("private"), true);
    assert.equal(response.headers.get("cache-control")?.includes("no-store"), true);
    assert.equal(response.headers.get("cache-control")?.includes("no-cache"), true);
    assert.equal(body && typeof body === "object" && !Array.isArray(body), true, "Admin response must be a JSON object.");
    assertPrivacy(body);
    assert.ok(body.overview && Array.isArray(body.users), "Admin response must contain overview and users.");
    assertMetrics(body.overview);
    assertPagination(body);
    assert.equal(body.users.some(user => String(user.email || "").toLowerCase() === email.toLowerCase()), true, "Designated smoke admin must be represented in users.");
    for (const user of body.users) {
      assert.equal(typeof user.user_id, "string");
      assert.equal(typeof user.email, "string");
      assert.equal(typeof user.plan, "string");
      assert.equal(user.plan.length > 0, true);
      assert.ok(user.feature_entitlements && typeof user.feature_entitlements === "object");
    }
    const normalized = normalizeDashboardPayload(body);
    assertMetrics(normalized.overview);
    assert.equal(Array.isArray(normalized.users), true);
    assert.match(renderCardsHtml(normalized.overview), /Total Users/);
    assert.match(renderRowsHtml(normalized.users), new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    console.log("Pundi admin production smoke PASS: config, real Auth login, read-only owner API, metrics, users, pagination, privacy, and client normalization");
    return true;
  } finally {
    await supabase.auth.signOut();
  }
}

try {
  const completed = await run();
  if (!completed) process.exitCode = 2;
} catch (error) {
  fail(error.message || "Pundi admin production smoke failed.");
}
