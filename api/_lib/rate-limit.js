const buckets = globalThis.__cvfinanceRateBuckets || new Map();
globalThis.__cvfinanceRateBuckets = buckets;

export function enforceRateLimit(key, limit = 30, windowMs = 60000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt:now, count:1 });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw Object.assign(new Error("Too many stock requests. Try again shortly."), { code:"rate_limited", status:429 });
}
