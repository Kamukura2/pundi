import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile("src/sync/sync-manager.js", "utf8");
assert.match(source, /const filename\s*=\s*`pundi-backup-\$\{new Date\(\)\.toISOString\(\)\.slice\(0,10\)\}\.json`/);
assert.match(source, /link\.download\s*=\s*filename/);
assert.match(await readFile("src/data/repository.js", "utf8"), /format\s*:\s*["']cvfinance-backup["']/);
assert.match(await readFile("src/data/repository.js", "utf8"), /format\s*!==\s*["']cvfinance-backup["']/);
console.log("Backup filename contract PASS: new exports use Pundi naming and legacy schema imports remain compatible");
