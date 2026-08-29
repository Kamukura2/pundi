import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const ref = "ndeycwoyjwyntjkgbzlz";
const url = process.env.PUNDI_TEST_SUPABASE_URL || "";
const key = process.env.PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key || new URL(url).hostname !== `${ref}.supabase.co`) throw new Error("Refusing smoke-user provisioning: Pundi target credentials are missing or mismatched.");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = "pundi-user-smoke@creativevista.dev";
const password = `Pundi-smoke-${randomBytes(24).toString("base64url")}`;
let found = null;
for (let page = 1; page <= 20 && !found; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  found = data.users.find(user => user.email?.toLowerCase() === email);
  if (!data.users.length || data.users.length < 100) break;
}
let user;
if (found) {
  const { data, error } = await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
const { data: adminRow, error: adminError } = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
if (adminError) throw adminError;
const { data: subscription, error: subscriptionError } = await admin.from("subscriptions").select("plan,status,provider").eq("user_id", user.id).maybeSingle();
if (subscriptionError) throw subscriptionError;
const { data: overrides, error: overrideError } = await admin.from("entitlement_overrides").select("feature").eq("user_id", user.id);
if (overrideError) throw overrideError;
if (adminRow || overrides?.length || (subscription && (subscription.plan !== "free" || subscription.status !== "free" || subscription.provider !== "manual"))) throw new Error("Smoke user has privileged or paid metadata.");
const tables = ["profiles","accounts","transactions","budgets","yearly_expenses","events","credit","credit_facilities","entrusted_funds","stocks","dividends","trading_positions","trading_ledger","trading_snapshots","electricity","electricity_topups","clients"];
const counts = {};
for (const table of tables) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (error && !/column .*user_id.*does not exist/i.test(error.message)) throw error;
  counts[table] = error ? 0 : (count || 0);
}
const financeCounts = Object.fromEntries(Object.entries(counts).filter(([table]) => table !== "profiles"));
if (Object.values(financeCounts).some(count => count !== 0)) throw new Error(`Smoke user has existing finance/customer data: ${JSON.stringify(financeCounts)}`);
await writeFile(".env.user-smoke.local", `PUNDI_USER_SMOKE_EMAIL=${email}\nPUNDI_USER_SMOKE_PASSWORD=${password}\n`, { encoding: "utf8" });
console.log(JSON.stringify({ status: "PASS", action: found ? "reused" : "created", admin: false, plan: subscription?.plan || "free", status: subscription?.status || "free", overrides: 0, financeRows: 0, credentialsFile: ".env.user-smoke.local" }));
