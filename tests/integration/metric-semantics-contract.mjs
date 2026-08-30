import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const growth = await readFile("scripts/growth-status.mjs", "utf8");
const beta = await readFile("scripts/beta-status.mjs", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

assert.equal(packageJson.scripts["test:metric-semantics"], "node tests/integration/metric-semantics-contract.mjs");
for (const source of [growth, beta]) {
  assert.match(source, /probableRealUsers/);
  assert.match(source, /probable_real_users/);
  assert.match(source, /PUNDI_ADMIN_SMOKE_EMAIL/);
  assert.match(source, /PUNDI_USER_SMOKE_EMAIL/);
  assert.match(source, /operational_test_users/);
  assert.doesNotMatch(source, /beta_users:dashboard\.body\.users\.length/);
  assert.doesNotMatch(source, /probable_beta_users/);
}
assert.match(growth, /env\("\.env\.user-smoke\.local"\)/);
assert.match(growth, /users\.filter\(user=>!excluded\.has/);
assert.match(beta, /dashboard\.body\.users\.filter\(user => !excluded\.has/);
console.log("Metric semantics contract PASS: growth and beta status share aggregate probable-real-user definition and exclude operational identities");
