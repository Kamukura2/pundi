import { execFileSync } from "node:child_process";
import path from "node:path";

const marker = /cvfinance|cv_finance/i;
const hardcodedResource = /cvfinance\.supabase\.co|cvfinance-nu\.vercel\.app|github\.com\/[^\s"']*\/cvfinance(?:\.git)?(?:[\s"'\/]|$)/i;
const historicalPath = /^(?:docs\/|tests\/)|^(?:README\.md|HANDOFF_NOTES_v7\.md)$/i;
const ambiguousRuntimePath = /^(?:api\/telegram\/|supabase\/migrations\/005_telegram_cvfinance\.sql$)/i;

export function classifyReference(file, text) {
  const normalizedFile = String(file).replaceAll("\\", "/");
  const normalizedText = String(text).replace(/\r$/, "");
  if (historicalPath.test(normalizedFile)) return { category: "A_HISTORICAL_OR_CONTRACT", file: normalizedFile, text: normalizedText };
  if (hardcodedResource.test(normalizedText)) return { category: "C_HARDCODED_RUNTIME_RESOURCE", file: normalizedFile, text: normalizedText };
  return { category: "B_LEGACY_NAMING_OR_RUNTIME_LABEL", file: normalizedFile, text: normalizedText };
}

export function scanTrackedReferences(root = process.cwd()) {
  let output = "";
  const exclusions = [":!dist/**", ":!android/**", ":!*.lock", ":!scripts/cvfinance-reference-audit.mjs", ":!scripts/test-cvfinance-isolation.mjs"];
  try {
    output = execFileSync("git", ["grep", "-n", "-i", "-E", "cvfinance|cv_finance|CVFinance", "--", ...exclusions], { cwd: path.resolve(root), encoding: "utf8" });
  } catch (error) {
    if (error.status !== 1) throw error;
    output = error.stdout || "";
  }
  const references = output.split(/\r?\n/).filter(Boolean).map((entry) => {
    const first = entry.indexOf(":");
    const second = entry.indexOf(":", first + 1);
    return classifyReference(entry.slice(0, first), entry.slice(second + 1));
  });
  const categorized = references.map((reference) => ({ ...reference, ambiguousRuntimeResource: ambiguousRuntimePath.test(reference.file) && marker.test(reference.text) }));
  return {
    references: categorized,
    historicalOrContractHits: categorized.filter((item) => item.category === "A_HISTORICAL_OR_CONTRACT").length,
    legacyNamingOrRuntimeLabelHits: categorized.filter((item) => item.category === "B_LEGACY_NAMING_OR_RUNTIME_LABEL").length,
    hardcodedRuntimeResourceHits: categorized.filter((item) => item.category === "C_HARDCODED_RUNTIME_RESOURCE"),
    ambiguousRuntimeResourceHits: categorized.filter((item) => item.ambiguousRuntimeResource).length,
  };
}
