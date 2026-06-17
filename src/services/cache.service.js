import { CACHE_TTL_MS } from '../config.js';

const cache = new Map();
const pendingRequests = new Map();

export async function cachedJson(key, loader) {
  // Security: Prevent memory exhaustion DoS from unbounded cache growth
  if (cache.size > 2000) {
    // ⚡ Bolt: Don't clear entire cache (causes performance cliff and API rate limits).
    // Instead, evict the oldest 20% to maintain a high cache hit rate while bounding memory.
    const keysToDelete = Array.from(cache.keys()).slice(0, 400);
    for (const k of keysToDelete) {
      cache.delete(k);
    }
  }

  // Security: Prevent request exhaustion and upstream IP ban DoS
  if (pendingRequests.size >= 100 && !pendingRequests.has(key)) {
    const error = new Error('Too many concurrent outbound requests. Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  const hit = cache.get(key);
  if (hit && Date.now() - hit.createdAt < CACHE_TTL_MS) {
    return {
      ...hit.value,
      cache: {
        hit: true,
        ttlSeconds: Math.max(0, Math.round((CACHE_TTL_MS - (Date.now() - hit.createdAt)) / 1000))
      }
    };
  }

  if (pendingRequests.has(key)) {
    const value = await pendingRequests.get(key);
    return {
      ...value,
      cache: {
        hit: true,
        ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
      }
    };
  }

  const promise = loader().then(value => {
    cache.set(key, {
      createdAt: Date.now(),
      value
    });
    return value;
  }).finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  const value = await promise;

  return {
    ...value,
    cache: {
      hit: false,
      ttlSeconds: Math.round(CACHE_TTL_MS / 1000)
    }
  };
}
