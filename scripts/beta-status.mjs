import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://app.pundi.online";
const ref = "ndeycwoyjwyntjkgbzlz";
const version = JSON.parse(await readFile(path.join(repo, "package.json"), "utf8")).version;

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

async function loadEnv(name) {
  const file = path.join(repo, name);
  if (!existsSync(file)) throw new Error(`ACTION REQUIRED: ${name} is missing.`);
  return parseEnv(await readFile(file, "utf8"));
}

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "error", cache: "no-store" });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function failSafe(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const marker of ["password", "access_token", "refresh_token", "service_role", "transaction_description", "balance", "holding_value", "expense_amount"]) {
    if (text.includes(marker)) throw new Error("Production response contained a forbidden privacy marker.");
  }
}

async function schedulerState() {
  try {
    const { stdout } = await execFileAsync("schtasks", ["/query", "/tn", "Pundi Admin Smoke Health", "/fo", "LIST", "/v"], { windowsHide: true });
    const result = stdout.match(/Last Result:\s*(\S+)/)?.[1] || "unknown";
    const status = stdout.match(/^Status:\s*(.+)$/m)?.[1]?.trim() || "unknown";
    return { status, last_result: result, healthy: status === "Ready" && result === "0" };
  } catch {
    return { status: "unavailable", last_result: "unknown", healthy: false };
  }
}

const admin = await loadEnv(".env.admin-smoke.local");
const smoke = await loadEnv(".env.user-smoke.local");
const config = await json(`${origin}/api/config`, { headers: { Accept: "application/json" } });
if (config.status !== 200 || !config.body?.supabaseUrl || !config.body?.supabaseAnonKey) throw new Error("Production config health check failed.");
const configUrl = new URL(config.body.supabaseUrl);
if (configUrl.hostname !== `${ref}.supabase.co` || configUrl.protocol !== "https:") throw new Error("Refusing status check: Supabase target mismatch.");

const auth = await json(`${config.body.supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: config.body.supabaseAnonKey, "content-type": "application/json" },
  body: JSON.stringify({ email: admin.PUNDI_ADMIN_SMOKE_EMAIL, password: admin.PUNDI_ADMIN_SMOKE_PASSWORD }),
});
if (auth.status !== 200 || !auth.body?.access_token) throw new Error("Admin status authentication failed.");
const dashboard = await json(`${origin}/api/admin`, { headers: { Accept: "application/json", Authorization: `Bearer ${auth.body.access_token}` } });
if (dashboard.status !== 200 || !dashboard.body?.overview || !Array.isArray(dashboard.body.users)) throw new Error("Admin status endpoint failed.");
failSafe(dashboard.body);

const excluded = new Set([admin.PUNDI_ADMIN_SMOKE_EMAIL?.toLowerCase(), smoke.PUNDI_USER_SMOKE_EMAIL?.toLowerCase()].filter(Boolean));
const probableRealUsers = dashboard.body.users.filter(user => !excluded.has(String(user.email || "").toLowerCase())).length;
const overview = dashboard.body.overview;
const feedbackRows = Array.isArray(dashboard.body.feedback) ? dashboard.body.feedback : [];
const feedback = {
  total: feedbackRows.length,
  new: feedbackRows.filter(row => row.status === "New").length,
  unresolved: feedbackRows.filter(row => !["Resolved", "Closed"].includes(row.status)).length,
  critical: feedbackRows.filter(row => row.priority === "Critical" && !["Resolved", "Closed"].includes(row.status)).length,
};
const healthFile = path.join(repo, "runtime", "admin-smoke-health", "latest.json");
let health = { status: "UNKNOWN", timestamp: null };
if (existsSync(healthFile)) {
  health = JSON.parse((await readFile(healthFile, "utf8")).replace(/^\uFEFF/, ""));
}
const scheduler = await schedulerState();
const snapshot = {
  timestamp: new Date().toISOString(),
  version,
  production_health: health.status === "PASS" ? "PASS" : "UNKNOWN",
  total_auth_users: Number(overview.total_users || 0),
  operational_test_users: excluded.size,
  probable_real_users: probableRealUsers,
  feedback_total: feedback.total,
  feedback_new: feedback.new,
  feedback_unresolved: feedback.unresolved,
  critical_feedback: feedback.critical,
  scheduler,
  supabase_ref: ref,
};
const runtimeDir = path.join(repo, "runtime", "beta");
await mkdir(runtimeDir, { recursive: true });
await writeFile(path.join(runtimeDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log("Pundi Beta Status");
console.log(`- version: ${version}`);
console.log(`- production health: ${snapshot.production_health}`);
console.log(`- total Auth users: ${snapshot.total_auth_users}`);
console.log(`- operational/test identities excluded: ${snapshot.operational_test_users}`);
console.log(`- probable real users: ${snapshot.probable_real_users}`);
console.log(`- new feedback: ${feedback.new}`);
console.log(`- unresolved feedback: ${feedback.unresolved}`);
console.log(`- critical issues: ${feedback.critical}`);
console.log(`- scheduler: ${scheduler.healthy ? "PASS" : "ACTION REQUIRED"} (${scheduler.status}, Last Result ${scheduler.last_result})`);
console.log(`- release readiness: ${snapshot.production_health === "PASS" && scheduler.healthy && feedback.critical === 0 ? "READY" : "ACTION REQUIRED"}`);
