import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'scripts/pundi-supabase.ps1';
assert.ok(fs.existsSync(path), 'Pundi Supabase wrapper must exist');
const source = fs.readFileSync(path, 'utf8');

assert.match(source, /\.env\.supabase-pundi\.local/);
assert.match(source, /git[\s\S]*check-ignore/);
assert.match(source, /SUPABASE_ACCESS_TOKEN/);
assert.match(source, /ndeycwoyjwyntjkgbzlz/);
assert.match(source, /Pundi/);
assert.match(source, /projects list/);
assert.match(source, /SupabaseArgs|db|migration/i);
assert.match(source, /Nook|zewnnzorrjtkhkuxfiou/);
assert.match(source, /finally/i);
assert.doesNotMatch(source, /sbp_[A-Za-z0-9]/);

console.log('Pundi Supabase wrapper contract PASS: ignored token, exact target gate, child-process cleanup, and no embedded secret');
