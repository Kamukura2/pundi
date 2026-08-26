import assert from "node:assert/strict";
import { bootstrapAdminState } from "../../admin/state.js";

const session={access_token:"test-token"};
const dashboard={overview:{total_users:1},users:[]};
const error=(message,status)=>Object.assign(new Error(message),{status});
const run=options=>bootstrapAdminState({timeoutMs:50,...options});

assert.deepEqual((await run({getSession:async()=>session,loadDashboard:async()=>dashboard})).state,"dashboard");
assert.deepEqual((await run({getSession:async()=>null,loadDashboard:async()=>dashboard})).state,"unauthenticated");
assert.deepEqual((await run({getSession:async()=>session,loadDashboard:async()=>{throw error("Access denied",403);}})).state,"denied");
assert.deepEqual((await run({getSession:async()=>session,loadDashboard:async()=>{throw error("Server failed",500);}})).state,"error");
assert.deepEqual((await run({getSession:async()=>session,loadDashboard:async()=>{throw new TypeError("network failure");}})).state,"error");
assert.match((await run({getSession:async()=>session,loadDashboard:async()=>({users:[]})})).error.message,/invalid dashboard response/i);
assert.match((await run({getSession:()=>new Promise(()=>{}),loadDashboard:async()=>dashboard})).error.message,/timed out/i);
assert.match((await run({getSession:async()=>session,loadDashboard:()=>new Promise(()=>{})})).error.message,/timed out/i);
console.log("Admin loading state contract PASS: dashboard, unauthenticated, denied, API error, network error, malformed response, and timeout paths exit loading");
