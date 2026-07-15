/**
 * cache.js
 * Lightweight fetch wrapper adding:
 *  - localStorage caching with a TTL (so re-searching the same coin twice
 *    doesn't fire a duplicate network request)
 *  - automatic retry with exponential backoff on transient failures
 *  - simple debounce helper for search-as-you-type inputs
 *
 * This is plain caching/retry logic, not "AI" — kept honest in naming.
 */

const CACHE_PREFIX = "ca_cache::";

function readCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > ttlMs) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ t: Date.now(), data })
    );
  } catch {
    // localStorage full or unavailable — fail silently, caching is best-effort
  }
}

/**
 * Global request queue: CoinGecko's free API tier is shared across every
 * anonymous browser hitting it and rate-limits aggressively. Once it's
 * tripped, it sometimes drops CORS headers on the block response, which
 * makes the browser report a rate-limit as a "CORS policy" error instead
 * of a clean 429 — confusing, but it's the same underlying cause.
 *
 * To stay under that limit, every fetchJSON call — no matter how many the
 * app fires "at once" via Promise.all — is funnelled through this queue,
 * which enforces a minimum gap between actual network dispatches.
 */
const MIN_GAP_MS = 650;
let queueTail = Promise.resolve();

function throttledSlot() {
  let release;
  const slot = new Promise((r) => (release = r));
  const prevTail = queueTail;
  queueTail = queueTail.then(() => slot);
  prevTail.then(async () => {
    await sleep(MIN_GAP_MS);
    release();
  });
  return slot;
}

/**
 * fetchJSON(url, { ttlMs, retries, timeoutMs })
 * Returns parsed JSON. Throws a descriptive Error if all retries fail.
 */
export async function fetchJSON(url, opts = {}) {
  const { ttlMs = 60_000, retries = 3, timeoutMs = 12_000, useCache = true } = opts;

  if (useCache) {
    const cached = readCache(url, ttlMs);
    if (cached) return cached;
  }

  let lastErr;
  let rateLimited = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttledSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        rateLimited = true;
        // Back off harder each time: 1.5s, 3s, 6s, 12s...
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (useCache) writeCache(url, data);
      return data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // A "Failed to fetch" / CORS-looking error right after a 429 is
      // almost always the same rate limit, just without a readable status.
      if (rateLimited || /failed to fetch/i.test(err.message)) {
        rateLimited = true;
        if (attempt < retries) await sleep(1500 * 2 ** attempt);
      } else if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  if (rateLimited) {
    throw new Error(
      "CoinGecko's free API is rate-limiting requests right now. Wait 15–30 seconds and try again."
    );
  }
  throw new Error(
    `Could not reach the data source after ${retries + 1} attempt(s): ${lastErr?.message || lastErr}`
  );
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
