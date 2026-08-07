const cache = globalThis.__cvfinanceQuoteCache || new Map();
globalThis.__cvfinanceQuoteCache = cache;

export function getCachedQuote(key, maxAgeMs = 300000) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.cachedAt > maxAgeMs) return null;
  return { ...hit.value, cache:"hit" };
}

export function setCachedQuote(key, value) {
  cache.set(key, { value, cachedAt:Date.now() });
  return value;
}
