import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { exportBackup, validateBackup } from "../../src/data/repository.js";

const empty = {
  accounts: [], transactions: [], budgets: [], yearly: [], events: [], creditFacilities: [],
  credit: [], clients: [], stocks: [], electricity: [], electricityTopups: [], entrustedFunds: [],
  tradingPositions: [], tradingLedger: [], tradingSnapshots: [], dividends: []
};
const clone = value => JSON.parse(JSON.stringify(value));
const valid = () => ({ format:"cvfinance-backup", version:1, data:clone(empty) });
const rejects = (value, message) => assert.throws(() => validateBackup(value), /Invalid Pundi backup|Backup is missing|finite|numeric|duplicate|unsafe/i, message);

rejects("not-json", "non-object payload rejected");
rejects({}, "empty object rejected");
rejects({format:"cvfinance-backup", version:2, data:empty}, "future schema rejected");
rejects({format:"cvfinance-backup", version:"1", data:empty}, "legacy string version rejected");
rejects({format:"cvfinance-backup", version:1}, "missing data rejected");
rejects({...valid(), data:{...empty, accounts:{}}}, "object instead of array rejected");
rejects({...valid(), data:{...empty, accounts:[{id:"a"},{id:"a"}]}}, "duplicate ids rejected");
for (const value of [NaN, Infinity, -Infinity]) {
  const fixture = valid(); fixture.data.accounts = [{id:"a", name:"Cash", type:"cash", balance:value}]; rejects(fixture, "non-finite numeric value rejected");
}
for (const value of ["100", "NaN", "Infinity"]) {
  const fixture = valid(); fixture.data.accounts = [{id:"a", name:"Cash", type:"cash", balance:value}]; rejects(fixture, "numeric strings rejected");
}
const unsafe = valid();
unsafe.data.accounts = [{id:"a", name:"Cash", type:"cash", balance:0, user_id:"other-user", owner_id:"other-user", role:"admin", access_token:"secret", refresh_token:"secret", session:{access_token:"secret"}, __proto__:{polluted:true}, constructor:{prototype:{polluted:true}}}];
const sanitized = validateBackup(unsafe);
assert.equal(sanitized.accounts[0].user_id, undefined);
assert.equal(sanitized.accounts[0].owner_id, undefined);
assert.equal(sanitized.accounts[0].role, undefined);
assert.equal(sanitized.accounts[0].access_token, undefined);
assert.equal(sanitized.accounts[0].refresh_token, undefined);
assert.equal(sanitized.accounts[0].session, undefined);
assert.equal(Object.prototype.polluted, undefined);

const exported = exportBackup({ ...empty, accounts:[{id:"a", name:"Cash", type:"cash", balance:0, user_id:"owner-a", token:"secret", admin_role:"owner"}] }, "owner-a");
const serialized = JSON.stringify(exported);
assert.equal(JSON.stringify(exported.data).includes("owner-a"), false);
assert.equal(serialized.includes("secret"), false);
assert.equal(serialized.includes("admin_role"), false);
assert.equal(exported.userId, "owner-a", "format metadata may retain the exporting user id");

const app = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const importHandler = app.slice(app.indexOf("backupFile.onchange"), app.indexOf("legacyImportBtn.onclick"));
assert(importHandler.indexOf("validateBackup") < importHandler.indexOf("confirm("), "invalid backups must be validated before replacement confirmation");

console.log("Backup security contract PASS: invalid schema, ownership, secrets, duplicate IDs, numeric safety, export privacy, and import validation ordering");
