import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const read = file => readFileSync(resolve(root, file), "utf8");
const app = read("app.js");
const html = read("app.html");
const sync = read("src/sync/sync-manager.js");
const api = read("api/account.js");
const schema = read("supabase/migrations/001_initial_schema.sql") + read("supabase/migrations/019_admin_dashboard.sql");

assert.match(html, /Forgot password\?/);
assert.match(sync, /resetPasswordForEmail/);
assert.match(sync, /window\.location\.origin\}\/auth\/reset-password/);
assert.match(app, /URLSearchParams\([\s\S]*get\("type"\).*recovery/);
assert.match(app, /updatePassword|changePassword/);
assert.match(app, /Set new password/);
assert.match(app, /authPassword\.closest\("label"\)\.hidden=forgot/);
assert.match(html, /id=\"changePasswordForm\"/);
assert.match(html, /id=\"deleteAccountBtn\"/);
assert.match(app, /prompt\([\s\S]*Type DELETE/);
assert.match(app, /confirm\([\s\S]*Final confirmation/);
assert.match(api, /auth\.getUser/);
assert.match(api, /user\.id/);
assert.match(api, /confirmation !== \"DELETE\"/);
assert.match(api, /app_admins/);
assert.match(api, /admin_deletion_blocked/);
assert.match(api, /admin_audit_log.*delete|delete\([^\n]*admin_audit_log|auditCleanupError/);
assert.match(api, /auth\.admin\.deleteUser\(user\.id\)/);
assert.doesNotMatch(api, /request\.body.*user_id|body\.user_id/);
for (const table of ["profiles","accounts","transactions","monthly_budgets","yearly_expenses","planned_events","credit_facilities","clients","stock_holdings","stock_price_targets","electricity_readings","app_settings","subscriptions","entitlement_overrides"]) {
  assert.match(schema, new RegExp(`public\\.${table}[\\s\\S]*?references auth\\.users\\(id\\) on delete cascade`));
}
assert.match(sync, /clearUserScopedState\(userId\)/);
assert.match(sync, /signOut\(\{ scope:\"local\" \}\)/);
assert.doesNotMatch(app + sync + api, /console\.log\([^\n]*(password|token|Authorization)/i);
console.log("Account lifecycle contract PASS: recovery, password change, settings, authenticated self-delete, confirmation, admin protection, cascade schema, and local cleanup");
