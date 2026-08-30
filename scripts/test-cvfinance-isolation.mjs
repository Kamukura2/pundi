import assert from "node:assert/strict";
import { classifyReference, scanTrackedReferences } from "./cvfinance-reference-audit.mjs";

const report = scanTrackedReferences(process.cwd());
assert.equal(report.hardcodedRuntimeResourceHits.length, 0, "Pundi runtime must not target CVFinance resources");
assert.equal(report.references.some((reference) => reference.file.endsWith("cvfinance-reference-audit.mjs")), false, "audit harness must not self-report");
assert.equal(report.references.some((reference) => reference.file.endsWith("test-cvfinance-isolation.mjs")), false, "audit test must not self-report");
assert.ok(report.historicalOrContractHits > 0, "historical/contract references should be classified");
assert.ok(report.legacyNamingOrRuntimeLabelHits > 0, "legacy naming references should be classified");
assert.ok(report.ambiguousRuntimeResourceHits > 0, "legacy Telegram runtime ownership must remain explicit");
assert.equal(classifyReference("docs/TELEGRAM_SETUP.md", "cvfinance-nu.vercel.app").category, "A_HISTORICAL_OR_CONTRACT");
assert.equal(classifyReference("api/telegram/_lib/config.js", "TELEGRAM_CVFINANCE_BOT_TOKEN").category, "B_LEGACY_NAMING_OR_RUNTIME_LABEL");
assert.equal(classifyReference("api/runtime.js", "https://cvfinance.supabase.co/rest/v1").category, "C_HARDCODED_RUNTIME_RESOURCE");
console.log(JSON.stringify({
  status: "PUNDI_CVFINANCE_REFERENCE_AUDIT_OK",
  historicalOrContractHits: report.historicalOrContractHits,
  legacyNamingOrRuntimeLabelHits: report.legacyNamingOrRuntimeLabelHits,
  hardcodedRuntimeResourceHits: report.hardcodedRuntimeResourceHits.length,
  ambiguousRuntimeResourceHits: report.ambiguousRuntimeResourceHits,
}, null, 2));
