/**
 * coinlist.js
 * Resolves a free-typed query ("bitcoin", "eth") to a coin.
 *
 * Search order:
 *   1. The curated catalog (catalog.js) — instant, zero network calls,
 *      covers the ~90 coins almost anyone would search for a demo.
 *   2. CoinGecko's /search endpoint — only used when nothing in the
 *      catalog matches, so it's a rare fallback rather than every
 *      keystroke. Results from this path won't have a `binance` symbol,
 *      so callers fall back to CoinGecko for that coin's data too.
 */
import { fetchJSON } from "./cache.js";
import { searchCatalog, findInCatalog } from "./catalog.js";

const CG_SEARCH_URL = "https://api.coingecko.com/api/v3/search?query=";

export async function searchCoins(query, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const local = searchCatalog(q, limit);
  if (local.length > 0) return local;

  // Nothing in the curated list — fall back to CoinGecko's search.
  try {
    const data = await fetchJSON(`${CG_SEARCH_URL}${encodeURIComponent(q)}`, { ttlMs: 5 * 60_000 });
    const coins = (data.coins || [])
      .slice()
      .sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity));
    return coins.slice(0, limit).map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      binance: null, // not in our curated Binance-mapped catalog
    }));
  } catch {
    return [];
  }
}

/** Best single match — returns { id, name, symbol, binance|null }. */
export async function resolveCoin(query) {
  const q = query.trim();
  const matches = await searchCoins(q, 1);
  if (matches[0]) return matches[0];
  const fallbackId = q.toLowerCase().replace(/\s+/g, "-");
  return { id: fallbackId, name: q, symbol: q, binance: null };
}

export { findInCatalog };