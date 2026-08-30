import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const pkg=JSON.parse(await readFile("package.json","utf8"));
assert.equal(pkg.name,"pundi");assert.equal(pkg.version,"8.6.0");
assert.match(await readFile("vercel.json","utf8"),/pundi|content-security-policy/i);
assert.match(await readFile("vite.config.js","utf8"),/__PUNDI_BUILD_ID__/);
assert.match(await readFile("public/sw.js","utf8"),/pundi-shell-v8\.6\.0/);
for(const file of ["app.js","index.html","src/lib/supabase.js"]){const t=await readFile(file,"utf8");assert.doesNotMatch(t,/cvfinance\.supabase\.co|jensen.*research.*hub/i);}
console.log("Identity drift contract PASS: Pundi package, build, cache, and backend targeting markers are consistent");
