import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, FEEDBACK_PRIORITIES, FEEDBACK_MAX_MESSAGE,
  validateFeedbackInput, feedbackPayload, isSafeFeedbackPayload, normalizeFeedbackList,
} from "../../src/feedback/contract.js";

assert.deepEqual(FEEDBACK_CATEGORIES, ["Bug", "Feature request", "Usability", "Data / calculation issue", "Other"]);
assert.deepEqual(FEEDBACK_STATUSES, ["New", "Reviewing", "Planned", "Resolved", "Closed"]);
assert.deepEqual(FEEDBACK_PRIORITIES, ["Low", "Normal", "High", "Critical"]);
assert.deepEqual(validateFeedbackInput({category:" Bug ",message:"  It looks wrong.  "}), {category:"Bug",message:"It looks wrong."});
assert.throws(() => validateFeedbackInput({category:"Invalid",message:"x"}), /valid feedback category/i);
assert.throws(() => validateFeedbackInput({category:"Bug",message:""}), /required/i);
assert.throws(() => validateFeedbackInput({category:"Bug",message:"x".repeat(FEEDBACK_MAX_MESSAGE + 1)}), /4000/);
const payload = feedbackPayload({category:"Bug",message:"<script>alert(1)</script>"},{version:"8.5.0",buildId:"abc123",page:"/insights",userAgent:"Chrome on Windows"});
assert.deepEqual(Object.keys(payload).sort(), ["app_version","browser","build_id","category","message","page"]);
assert.equal(isSafeFeedbackPayload(payload), true);
assert.equal(isSafeFeedbackPayload({...payload,transactions:[{amount:100}]}), false);
const normalized = normalizeFeedbackList([{category:"Bug",message:"hello",status:"Reviewing",priority:"High",admin_note:"triage"}]);
assert.equal(normalized[0].status, "Reviewing");
assert.equal(normalized[0].priority, "High");
assert.equal(normalized[0].message, "hello");
const api = await readFile("api/feedback.js", "utf8");
const admin = await readFile("api/admin.js", "utf8");
const migration = await readFile("supabase/migrations/020_beta_feedback.sql", "utf8");
const app = await readFile("app.js", "utf8");
assert.match(api, /auth\.getUser/);
assert.match(api, /user_id:user\.id/);
assert.doesNotMatch(api, /body\.user_id/);
assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
assert.match(migration, /with check \(user_id = auth\.uid\(\)\)/);
assert.doesNotMatch(migration, /grant .*update .*authenticated/i);
assert.match(admin, /update_feedback/);
assert.match(admin, /FEEDBACK_PRIORITIES/);
assert.match(app, /feedbackPayload/);
assert.match(app, /feedbackSubmitting/);
assert.doesNotMatch(app, /JSON\.stringify\(state\).*feedback|feedback.*JSON\.stringify\(state\)/i);
assert.match(await readFile(new URL("../../app.js", import.meta.url), "utf8"), /Authorization:\s*`Bearer \$\{session\.access_token\}`/);
console.log("Feedback contract PASS: validation, allowlist, safe context, normalization, status, priority, and auth header");
