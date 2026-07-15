/**
 * binance.js
 * Thin wrapper around Binance's public REST API (api.binance.com).
 * No API key, no signup, and a far higher rate limit (1200 request-weight
 * per minute) than CoinGecko's anonymous tier — this is now the primary
 * source for price, 24h stats, and candlestick data. It also returns
 * real daily OHLCV candles (CoinGecko's free /ohlc endpoint only gives
 * ~4-day candles at a 365-day range), so indicators computed from it are
 * more accurate, not just more available.
 *
 * Binance doesn't track market cap/circulating supply (no exchange does —
 * that's aggregator-only data), so those fields still come from a small,
 * optional CoinGecko call elsewhere that's allowed to fail silently.
 */
import { fetchJSON } from "./cache.js";

const BASE = "https://api.binance.com/api/v3";

export async function fetchTicker24h(symbol) {
  return fetchJSON(`${BASE}/ticker/24hr?symbol=${symbol}`, { ttlMs: 20_000, retries: 2, timeoutMs: 10_000 });
}

/** Batch multiple symbols in a single request (portfolio/watchlist refresh). */
export async function fetchTicker24hBatch(symbols) {
  if (!symbols.length) return [];
  const param = encodeURIComponent(JSON.stringify(symbols));
  return fetchJSON(`${BASE}/ticker/24hr?symbols=${param}`, { ttlMs: 30_000, retries: 2 });
}

/**
 * Daily candles as clean numeric objects: { time(ms), open, high, low,
 * close, volume }. `limit` is capped at 1000 by Binance; 365 covers a
 * full year of daily candles in one request.
 */
export async function fetchDailyKlines(symbol, limit = 365) {
  const raw = await fetchJSON(`${BASE}/klines?symbol=${symbol}&interval=1d&limit=${limit}`, {
    ttlMs: 5 * 60_000,
    retries: 2,
    timeoutMs: 15_000,
  });
  return raw.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

/** % return between the close `daysAgo` candles back and the latest close. */
export function returnOverDays(candles, daysAgo) {
  if (candles.length <= daysAgo) return null;
  const then = candles[candles.length - 1 - daysAgo].close;
  const now = candles[candles.length - 1].close;
  if (!then) return null;
  return ((now - then) / then) * 100;
}
