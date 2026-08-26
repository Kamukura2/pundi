import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import "fake-indexeddb/auto";
import { cacheGet, cachePut, clearUserScopedState, mutationList, mutationPut } from "../../src/lib/idb.js";

const EXPECTED_PROJECT_REF = "ndeycwoyjwyntjkgbzlz";
const projectRef = process.env.PUNDI_TEST_PROJECT_REF || "";
const supabaseUrl = process.env.PUNDI_TEST_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.PUNDI_TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function fail(message) { throw new Error(message); }
function requireConfig() {
  if (projectRef !== EXPECTED_PROJECT_REF) fail(`Refusing isolation test: PUNDI_TEST_PROJECT_REF must equal ${EXPECTED_PROJECT_REF}.`);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) fail("Isolation test requires PUNDI_TEST_PROJECT_REF, PUNDI_TEST_SUPABASE_URL, PUNDI_TEST_SUPABASE_ANON_KEY, and PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY.");
  const host = new URL(supabaseUrl).hostname;
  if (!host.startsWith(`${EXPECTED_PROJECT_REF}.`)) fail("Refusing isolation test: Supabase URL does not match the expected Pundi project.");
}

const admin = () => createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = () => createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = `PUNDI_PHASE_1_1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUsers = [];
const createdRows = [];

async function signIn(email, password) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert.ok(data.session?.access_token);
  return { client, user: data.user, session: data.session };
}
async function insert(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw error;
  createdRows.push([table, data.id]);
  return data;
}
async function mustReject(promise, label) {
  const result = await promise;
  assert.ok(result.error || !result.data?.length, `${label} unexpectedly succeeded.`);
}
async function countTagged() {
  const db = admin();
  const { count, error } = await db.from("transactions").select("id", { count: "exact", head: true }).eq("description", tag);
  if (error) throw error;
  return count || 0;
}

async function countTaggedUsers() {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).filter(user => String(user.email || "").includes(tag.toLowerCase())).length;
}

async function localIsolation() {
  const userA = `test-user-a-${tag}`;
  const userB = `test-user-b-${tag}`;
  await cachePut(`snapshot:${userA}`, { rows: { marker: "A" } });
  await cachePut(`snapshot:${userB}`, { rows: { marker: "B" } });
  await mutationPut({ key: `${userA}:transactions:a`, userId: userA, action: "insert" });
  await mutationPut({ key: `${userB}:transactions:b`, userId: userB, action: "insert" });
  await clearUserScopedState(userA);
  assert.equal(await cacheGet(`snapshot:${userA}`), null);
  assert.deepEqual(await cacheGet(`snapshot:${userB}`), { rows: { marker: "B" } });
  const remaining = await mutationList();
  assert.equal(remaining.some(item => item.userId === userA), false);
  assert.equal(remaining.some(item => item.userId === userB), true);
  console.log("PASS local snapshot, queue, logout, and account-switch isolation");
}

async function run() {
  requireConfig();
  await localIsolation();
  const db = admin();
  const password = `P11-${crypto.randomUUID()}-Safe!`;
  const emails = [`${tag.toLowerCase()}-a@example.invalid`, `${tag.toLowerCase()}-b@example.invalid`];
  for (const email of emails) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test_run: tag } });
    if (error) throw error;
    createdUsers.push(data.user.id);
  }
  const A = await signIn(emails[0], password);
  const B = await signIn(emails[1], password);
  const aTransaction = await insert(A.client, "transactions", { user_id: A.user.id, transaction_type: "expense", amount: 1, description: tag, category: "Other", channel: "Offline", transaction_date: "2026-08-26" });

  const { data: hidden, error: selectError } = await B.client.from("transactions").select("id").eq("id", aTransaction.id);
  assert.ifError(selectError);
  assert.equal(hidden.length, 0, "User B must not read User A's row.");
  console.log("PASS authenticated cross-user SELECT isolation");

  await mustReject(B.client.from("transactions").insert({ user_id: A.user.id, transaction_type: "expense", amount: 2, description: tag, category: "Other", channel: "Offline", transaction_date: "2026-08-26" }).select(), "ownership-spoof INSERT");
  console.log("PASS ownership-spoof INSERT blocked");

  await mustReject(B.client.from("transactions").update({ description: `${tag}_B` }).eq("id", aTransaction.id).select("id"), "cross-user UPDATE");
  await mustReject(B.client.from("transactions").delete().eq("id", aTransaction.id).select("id"), "cross-user DELETE");
  console.log("PASS authenticated cross-user UPDATE/DELETE isolation");

  const aFacility = await insert(A.client, "credit_facilities", { user_id: A.user.id, source: tag, limit_amount: 1 });
  const aHolding = await insert(A.client, "stock_holdings", { user_id: A.user.id, display_symbol: `P11${tag.slice(-4)}`, market: "NASDAQ", provider: "finnhub", provider_symbol: "P11TEST", currency: "USD", quantity: 1, avg_purchase_price: 1, current_price: 1, manual_current_price: 1, price_source: "manual", price_status: "manual" });
  const aPosition = await insert(A.client, "trading_positions", { user_id: A.user.id, display_symbol: `P11${tag.slice(-4)}`, market: "NASDAQ", provider_symbol: "P11TEST", currency: "USD", quantity: 1, avg_purchase_price: 1, current_price: 1, manual_current_price: 1, target_price: 1, stop_loss_price: 0, price_source: "manual", price_status: "manual" });
  await mustReject(B.client.from("credit_items").insert({ user_id: B.user.id, facility_id: aFacility.id, source: tag, description: tag, amount: 1, due_date: "2026-08-26", is_paid: false }), "cross-owner credit facility FK");
  await mustReject(B.client.from("stock_price_targets").insert({ user_id: B.user.id, holding_id: aHolding.id, scenario: "base", target_year: 2027, target_price: 1 }), "cross-owner stock holding FK");
  await mustReject(B.client.from("investment_dividends").insert({ user_id: B.user.id, holding_id: aHolding.id, event_key: tag, ticker: "P11TEST", dividend_type: "regular", currency: "USD", amount_per_share: 1, eligible_shares: 1, dividend_status: "confirmed", eligibility_status: "pending", source_provider: "manual", source_url: "", is_manual: true, fx_rate: 1 }), "cross-owner dividend FK");
  await mustReject(B.client.from("trading_ledger").insert({ user_id: B.user.id, position_id: aPosition.id, entry_type: "buy", ticker: "P11TEST", quantity: 1, execution_price: 1, currency: "USD", fx_rate: 1, cash_delta_idr: 0, cash_delta_usd: 1, external_flow_idr: 0, realized_pl_idr: 0, trade_date: "2026-08-26", note: tag }), "cross-owner trading position FK");
  console.log("PASS owner-scoped child foreign keys");

  const { data: ownRead, error: ownReadError } = await A.client.from("transactions").select("id").eq("id", aTransaction.id);
  assert.ifError(ownReadError); assert.equal(ownRead.length, 1);
  const { data: ownUpdate, error: ownUpdateError } = await A.client.from("transactions").update({ category: "Food" }).eq("id", aTransaction.id).select("id").single();
  assert.ifError(ownUpdateError); assert.equal(ownUpdate.id, aTransaction.id);
  const { error: ownDeleteError } = await A.client.from("transactions").delete().eq("id", aTransaction.id);
  assert.ifError(ownDeleteError);
  createdRows.splice(createdRows.findIndex(([table, id]) => table === "transactions" && id === aTransaction.id), 1);
  console.log("PASS User A normal CRUD");

  const events = [];
  const channel = B.client.channel(`pundi-isolation-test-${tag}`).on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${B.user.id}` }, payload => events.push(payload));
  const subscribed = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Realtime subscription timeout.")), 15000); channel.subscribe(status => { if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(true); } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error(`Realtime subscription ${status}.`)); } }); });
  assert.equal(subscribed, true);
  const aRealtimeRow = await insert(A.client, "transactions", { user_id: A.user.id, transaction_type: "expense", amount: 3, description: tag, category: "Other", channel: "Offline", transaction_date: "2026-08-26" });
  await new Promise(resolve => setTimeout(resolve, 2500));
  assert.equal(events.length, 0, "User B received a User A realtime event.");
  await B.client.removeChannel(channel);
  console.log("PASS realtime isolation");
  createdRows.push(["transactions", aRealtimeRow.id]);
}

try {
  await run();
  console.log("Pundi two-user isolation harness PASS");
} finally {
  if (supabaseUrl && serviceRoleKey && projectRef === EXPECTED_PROJECT_REF) {
    const db = admin();
    for (const [table, id] of createdRows.reverse()) await db.from(table).delete().eq("id", id);
    for (const id of createdUsers) await db.auth.admin.deleteUser(id);
    const remaining = await countTagged().catch(() => -1);
    const remainingUsers = await countTaggedUsers().catch(() => -1);
    if (remaining !== 0 || remainingUsers !== 0) throw new Error("Isolation cleanup failed: disposable rows or users remain.");
    if (createdUsers.length) console.log("Cleanup PASS: disposable test rows and users removed");
  }
}
