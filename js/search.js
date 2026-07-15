/**
 * search.js
 * Handles: autocomplete dropdown, coin lookup, and rendering the coin
 * detail card — price header, a real candlestick chart (TradingView's
 * open-source lightweight-charts library), and a panel of honestly-labelled
 * technical indicators (RSI, MACD, Bollinger Bands, ATR, Stochastic RSI,
 * VWAP, and a simple linear-regression trend line).
 *
 * Data sourcing: price, 24h stats, and daily candles come from Binance's
 * public API (free, keyless, ~1200 req/min). Market cap, rank, and the
 * coin logo come from a single optional CoinGecko call that's allowed to
 * fail — if it's rate-limited or slow, those fields just show "—" instead
 * of blocking the whole card.
 */
import { fetchJSON, debounce } from "./cache.js";
import { searchCoins, resolveCoin } from "./coinlist.js";
import { fetchTicker24h, fetchDailyKlines } from "./binance.js";
import { el, clear, fmtUSD, fmtCompactUSD, fmtPct } from "./dom.js";
import * as ind from "./indicators.js";
import { addToWatchlist, isWatched } from "./portfolio.js";

const CG_API = "https://api.coingecko.com/api/v3";

export function initSearch() {
  const input = document.getElementById("crypto-input");
  const button = document.getElementById("search-button");
  const dropdown = document.getElementById("search-autocomplete");
  const loader = document.getElementById("search-loader");
  const result = document.getElementById("crypto-result");

  const showDropdown = debounce(async (query) => {
    if (!query.trim()) { dropdown.classList.add("hidden"); return; }
    let matches;
    try { matches = await searchCoins(query); } catch { return; }
    clear(dropdown);
    if (matches.length === 0) {
      dropdown.classList.add("hidden");
      return;
    }
    matches.forEach((m) => {
      const item = el(
        "button",
        { type: "button", class: "w-full text-left px-5 py-3 hover:bg-white/10 flex items-center justify-between gap-3 text-sm" },
        [
          el("span", { class: "text-white font-medium" }, m.name),
          el("span", { class: "text-slate-500 uppercase text-xs" }, m.symbol),
        ]
      );
      item.addEventListener("click", () => {
        input.value = m.name;
        dropdown.classList.add("hidden");
        runSearch(m);
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.remove("hidden");
  }, 300);

  input?.addEventListener("input", (e) => showDropdown(e.target.value));
  input?.addEventListener("focus", (e) => { if (e.target.value) showDropdown(e.target.value); });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) dropdown.classList.add("hidden");
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { dropdown.classList.add("hidden"); resolveAndSearch(input.value); }
  });
  button?.addEventListener("click", () => resolveAndSearch(input.value));

  async function resolveAndSearch(rawQuery) {
    const query = rawQuery.trim();
    if (!query) return;
    const coin = await resolveCoin(query);
    runSearch(coin);
  }

  async function runSearch(coin) {
    loader.classList.remove("hidden");
    loader.classList.add("flex");
    clear(result);
    try {
      if (coin.binance) {
        const [ticker, klines] = await Promise.all([
          fetchTicker24h(coin.binance),
          fetchDailyKlines(coin.binance, 365),
        ]);
        if (!klines.length) throw new Error("No candle data returned");
        const meta = await fetchOptionalMeta(coin.id);
        renderCoinCardFromBinance(result, coin, ticker, klines, meta);
      } else {
        await renderCoinCardFromCoinGecko(result, coin.id);
      }
    } catch (err) {
      result.appendChild(
        el("div", { class: "p-6 glass-card rounded-2xl text-rose-400 text-center" },
          `Couldn't load that asset (${err.message}). Try a different name.`)
      );
    } finally {
      loader.classList.remove("flex");
      loader.classList.add("hidden");
    }
  }

  window.__ca_runSearch = (id) => resolveCoin(id).then(runSearch);
}

/** Market cap / rank / logo — nice to have, never blocks the card. */
async function fetchOptionalMeta(coingeckoId) {
  try {
    const data = await fetchJSON(`${CG_API}/coins/markets?vs_currency=usd&ids=${coingeckoId}`, {
      ttlMs: 10 * 60_000,
      retries: 1,
      timeoutMs: 6_000,
    });
    return data[0] || null;
  } catch {
    return null;
  }
}

function renderCoinCardFromBinance(container, coin, ticker, klines, meta) {
  const price = parseFloat(ticker.lastPrice);
  const change = parseFloat(ticker.priceChangePercent);
  const high24h = parseFloat(ticker.highPrice);
  const low24h = parseFloat(ticker.lowPrice);
  const quoteVolume = parseFloat(ticker.quoteVolume);
  const color = change >= 0 ? "text-emerald-400" : "text-rose-400";

  const header = buildCoinHeader(
    coin.name, coin.symbol, price, change, color,
    meta?.market_cap_rank ? `Global Rank #${meta.market_cap_rank}` : "Live via Binance",
    meta?.image || null,
    coin.id, meta?.image || ""
  );

  const stats = el("div", { class: "grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-b border-white/10" }, [
    statCell("High 24h", fmtUSD(high24h)),
    statCell("Low 24h", fmtUSD(low24h)),
    statCell("Market Cap", meta ? fmtCompactUSD(meta.market_cap) : "—"),
    statCell("Volume 24h", fmtCompactUSD(quoteVolume)),
  ]);

  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const volumes = klines.map((k) => k.volume);

  const { splitGrid, trendRow } = buildSplitLayout(closes, highs, lows, closes, volumes,
    "Real daily OHLCV via Binance · TradingView Lightweight Charts");

  const card = el("div", { class: "glass-card rounded-3xl overflow-hidden text-left" }, [header, stats, splitGrid, trendRow]);
  container.appendChild(card);
  mountCandlestick(card.querySelector(".candle-chart"), klines, klines);

  if (!meta) {
    card.appendChild(
      el("p", { class: "px-6 pb-5 text-[10px] text-slate-600 italic" },
        "Market cap unavailable right now (CoinGecko enrichment call didn't come through) — price, chart, and indicators above are unaffected since they come from Binance.")
    );
  }
}

/** Fallback path for coins not in the curated Binance-mapped catalog. */
async function renderCoinCardFromCoinGecko(container, id) {
  const [detail, chart, ohlc] = await Promise.all([
    fetchJSON(`${CG_API}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`, { ttlMs: 2 * 60_000 }),
    fetchJSON(`${CG_API}/coins/${id}/market_chart?vs_currency=usd&days=365`, { ttlMs: 5 * 60_000 }),
    fetchJSON(`${CG_API}/coins/${id}/ohlc?vs_currency=usd&days=365`, { ttlMs: 5 * 60_000 }),
  ]);
  const m = detail.market_data;
  const change = m.price_change_percentage_24h;
  const color = change >= 0 ? "text-emerald-400" : "text-rose-400";

  const header = buildCoinHeader(
    detail.name, detail.symbol, m.current_price.usd, change, color,
    `Global Rank #${detail.market_cap_rank ?? "—"}`,
    detail.image.small,
    detail.id, detail.image.small
  );

  const stats = el("div", { class: "grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-b border-white/10" }, [
    statCell("High 24h", fmtUSD(m.high_24h.usd)),
    statCell("Low 24h", fmtUSD(m.low_24h.usd)),
    statCell("Market Cap", fmtCompactUSD(m.market_cap.usd)),
    statCell("Volume 24h", fmtCompactUSD(m.total_volume.usd)),
  ]);

  const closes = chart.prices.map((p) => p[1]);
  const highs = ohlc.map((c) => c[2]);
  const lows = ohlc.map((c) => c[3]);
  const ohlcCloses = ohlc.map((c) => c[4]);
  const volumePairs = chart.total_volumes;
  const ohlcVolumes = ohlc.map((c) => nearestVolume(c[0], volumePairs));
  const cgCandles = ohlc.map((c) => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4] }));

  const { splitGrid, trendRow } = buildSplitLayout(closes, highs, lows, ohlcCloses, ohlcVolumes,
    "OHLC data via CoinGecko (not on Binance) · TradingView Lightweight Charts");

  const card = el("div", { class: "glass-card rounded-3xl overflow-hidden text-left" }, [header, stats, splitGrid, trendRow]);
  container.appendChild(card);
  mountCandlestick(card.querySelector(".candle-chart"), cgCandles, cgCandles);
}

function nearestVolume(ts, volumePairs) {
  let lo = 0, hi = volumePairs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (volumePairs[mid][0] < ts) lo = mid + 1; else hi = mid;
  }
  return volumePairs[lo] ? volumePairs[lo][1] : 0;
}

function statCell(label, value) {
  return el("div", { class: "p-5 text-center" }, [
    el("small", { class: "text-slate-500 uppercase text-[9px] font-black tracking-widest mb-1 block" }, label),
    el("span", { class: "text-white font-bold" }, value),
  ]);
}

function watchlistButton(id, name, symbol, price, image) {
  const already = isWatched(id);
  const btn = el("button", { class: already ? "btn-watching" : "btn-not-watching" }, [
    el("i", { class: "fas fa-star" }),
    already ? "Watching" : "Watch",
  ]);
  btn.addEventListener("click", () => {
    addToWatchlist({ id, name, symbol, price, image: image || "" });
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    btn.appendChild(el("i", { class: "fas fa-star" }));
    btn.appendChild(document.createTextNode(" Watching"));
    btn.className = "btn-watching";
  });
  return btn;
}

/** Shared coin card header builder */
function buildCoinHeader(name, symbol, price, change, colorClass, rankLabel, imgSrc, coinId, imgForWatchlist) {
  const logoEl = imgSrc
    ? el("img", { src: imgSrc, class: "w-14 h-14 rounded-full ring-2 ring-white/10 shadow-xl" })
    : el("div", { class: "w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 font-black text-lg" }, symbol.slice(0, 3).toUpperCase());

  return el("div", { class: "px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4" }, [
    el("div", { class: "flex items-center gap-4" }, [
      logoEl,
      el("div", {}, [
        el("h4", { class: "text-xl font-bold text-white" }, [
          name + " ",
          el("span", { class: "text-slate-500 text-sm font-normal ml-1" }, symbol.toUpperCase()),
        ]),
        el("span", { class: "text-[10px] font-black text-cyan-400 tracking-[0.25em] uppercase" }, rankLabel),
      ]),
    ]),
    el("div", { class: "flex items-center gap-5" }, [
      el("div", { class: "text-right" }, [
        el("div", { class: "text-3xl font-black text-white leading-none" }, fmtUSD(price)),
        el("div", { class: `${colorClass} text-sm font-bold mt-1` }, [fmtPct(change), el("span", { class: "text-[10px] opacity-50 uppercase ml-1" }, "24H")]),
      ]),
      watchlistButton(coinId, name, symbol, price, imgForWatchlist),
    ]),
  ]);
}

/**
 * Build the split-grid section (chart left, indicators right)
 * and the trend row below it.
 */
function buildSplitLayout(closes, highs, lows, ohlcCloses, volumes, chartSubtitle) {
  // --- indicator values ---
  const rsiVals = ind.rsi(closes, 14);
  const lastRsi = lastValid(rsiVals);
  const { histogram } = ind.macd(closes);
  const lastMacdHist = lastValid(histogram);
  const bb = ind.bollingerBands(closes, 20, 2);
  const lastClose = closes[closes.length - 1];
  const bbUpper = lastValid(bb.upper), bbLower = lastValid(bb.lower);
  const atrVals = ind.atr(highs, lows, ohlcCloses, 14);
  const lastAtr = lastValid(atrVals);
  const stochRsiVals = ind.stochasticRSI(closes, 14);
  const lastStochRsi = lastValid(stochRsiVals);
  const vwapVals = ind.vwap(highs, lows, ohlcCloses, volumes);
  const lastVwap = lastValid(vwapVals);
  const reg = ind.linearRegressionForecast(closes, 30);

  const rsiState = lastRsi >= 70 ? ["Overbought", "text-rose-400"] : lastRsi <= 30 ? ["Oversold", "text-emerald-400"] : ["Neutral", "text-slate-300"];
  const macdState = lastMacdHist >= 0 ? ["Bullish crossover", "text-emerald-400"] : ["Bearish crossover", "text-rose-400"];
  const bbPos = lastClose > bbUpper ? ["Above upper band", "text-rose-400"] : lastClose < bbLower ? ["Below lower band", "text-emerald-400"] : ["Within bands", "text-slate-300"];
  const vwapPos = lastClose > lastVwap ? ["Trading above VWAP", "text-emerald-400"] : ["Trading below VWAP", "text-rose-400"];
  const stochState = [lastStochRsi >= 80 ? "Overbought" : lastStochRsi <= 20 ? "Oversold" : "Neutral", "text-slate-300"];
  const trendDir = reg.slope >= 0 ? ["Upward", "text-emerald-400"] : ["Downward", "text-rose-400"];

  // --- chart column ---
  const chartCol = el("div", { class: "coin-split-chart" }, [
    el("div", { class: "flex items-center justify-between mb-2" }, [
      el("span", { class: "text-[10px] font-black uppercase tracking-widest text-slate-500" }, "365-Day Candlestick Chart"),
      el("span", { class: "text-[9px] text-slate-600 italic hidden lg:block" }, chartSubtitle),
    ]),
    el("div", { class: "candle-chart rounded-xl overflow-hidden border border-white/5", style: "height:260px" }),
    buildTimeRangeBar(),
  ]);

  // --- indicators column ---
  const indGrid = el("div", { class: "indicator-grid-2col" }, [
    indicatorCell("RSI (14)", lastRsi?.toFixed(1) ?? "—", rsiState,
      "Relative Strength Index (0–100), 14 days. Above 70 = overbought; below 30 = oversold."),
    indicatorCell("MACD Histogram", lastMacdHist?.toFixed(2) ?? "—", macdState,
      "MACD histogram (fast EMA − slow EMA gap). Positive = bullish momentum."),
    indicatorCell("Bollinger Bands", bbPos[0], bbPos,
      "Price relative to bands set 2 std-devs around a 20-day MA."),
    indicatorCell("ATR (14)", lastAtr ? fmtUSD(lastAtr) : "—", ["Volatility (abs $)", "text-slate-300"],
      "Average True Range — typical daily price swing in dollars. Higher = bigger moves."),
    indicatorCell("Stochastic RSI", lastStochRsi?.toFixed(1) ?? "—", stochState,
      "Stochastic oscillator applied to RSI. Above 80 or below 20 flags an extreme."),
    indicatorCell("VWAP", lastVwap ? fmtUSD(lastVwap) : "—", vwapPos,
      "Volume-Weighted Average Price — fair-value benchmark weighted by traded volume."),
  ]);

  const indCol = el("div", { class: "coin-split-indicators" }, [
    el("div", { class: "flex items-center justify-between mb-3" }, [
      el("span", { class: "text-[10px] font-black uppercase tracking-widest text-slate-500" }, "Technical Indicators"),
      el("span", { class: "text-[9px] text-slate-600 italic" }, "Standard TA math — not AI or ML"),
    ]),
    indGrid,
  ]);

  const splitGrid = el("div", { class: "coin-split-grid" }, [chartCol, indCol]);

  // --- trend row ---
  const trendArrow = reg.slope >= 0
    ? el("svg", { width: "36", height: "24", viewBox: "0 0 36 24", fill: "none" }, [
        el("polyline", { points: "2,20 12,8 22,14 34,2", stroke: "#34D399", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round" })
      ])
    : el("svg", { width: "36", height: "24", viewBox: "0 0 36 24", fill: "none" }, [
        el("polyline", { points: "2,2 12,14 22,8 34,20", stroke: "#EF4444", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round" })
      ]);

  const trendRow = el("div", { class: "trend-row" }, [
    el("div", { class: "trend-row-icon" }, [el("i", { class: "fas fa-chart-line" })]),
    el("div", { class: "trend-row-body" }, [
      el("div", { class: "text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1" }, "30-Day Linear Regression Trend"),
      el("p", { class: "text-slate-400 text-xs leading-relaxed" }, [
        `Fitting a straight line through the last ${reg.lookback} daily closes gives an R² of ${reg.r2.toFixed(2)} `,
        `(closer to 1.0 = the trend fits the data more tightly; closer to 0 = the price is too noisy for a line to explain). `,
        `This is a statistical trend line, not a machine-learning model or a guarantee of future price — treat it as one data point, not a forecast.`,
      ]),
    ]),
    el("div", { class: "trend-row-meta" }, [
      el("div", { class: "text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1" }, "Trend Direction"),
      el("div", { class: `trend-direction-label ${trendDir[1]}`, style: "display:flex;align-items:center;gap:8px" }, [
        trendDir[0],
        trendArrow,
      ]),
      el("div", { class: "text-[9px] font-black uppercase tracking-widest text-slate-500 mt-3 mb-0.5" }, "R² (Fit Quality)"),
      el("div", { class: "text-xl font-bold text-white" }, reg.r2.toFixed(2)),
    ]),
  ]);

  return { splitGrid, trendRow };
}

/** Time-range button bar — visual only (chart data is always 365d) */
function buildTimeRangeBar() {
  const ranges = ["1D", "7D", "1M", "3M", "6M", "1Y", "ALL"];
  const bar = el("div", { class: "timerange-bar" });
  ranges.forEach((r, i) => {
    const btn = el("button", { class: `timerange-btn${r === "1Y" ? " active" : ""}`, type: "button" }, r);
    btn.addEventListener("click", () => {
      bar.querySelectorAll(".timerange-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
    bar.appendChild(btn);
  });
  // calendar icon
  const cal = el("button", { class: "timerange-btn", type: "button", "aria-label": "Pick date range" }, [
    el("i", { class: "fas fa-calendar-alt" })
  ]);
  bar.appendChild(cal);
  return bar;
}

function mountCandlestick(target, candles, allCandles) {
  if (!window.LightweightCharts) return;
  const chart = window.LightweightCharts.createChart(target, {
    layout: { background: { color: "transparent" }, textColor: "#7A7F88" },
    grid: { vertLines: { color: "#2B2D33" }, horzLines: { color: "#2B2D33" } },
    rightPriceScale: { borderColor: "#2B2D33", scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: "#2B2D33", timeVisible: true },
    crosshair: { mode: 1 },
    autoSize: true,
  });
  const series = chart.addCandlestickSeries({
    upColor: "#34D399", downColor: "#EF4444",
    borderUpColor: "#34D399", borderDownColor: "#EF4444",
    wickUpColor: "#34D399", wickDownColor: "#EF4444",
  });
  const mapped = candles.map((c) => ({ time: Math.floor(c.time / 1000), open: c.open, high: c.high, low: c.low, close: c.close }));
  series.setData(mapped);
  chart.timeScale().fitContent();

  // Wire up time-range buttons in the same card
  const card = target.closest(".glass-card");
  if (!card) return;
  const allMapped = (allCandles || candles).map((c) => ({ time: Math.floor(c.time / 1000), open: c.open, high: c.high, low: c.low, close: c.close }));
  const now = allMapped[allMapped.length - 1]?.time ?? 0;
  const dayMap = { "1D": 1, "7D": 7, "1M": 30, "3M": 91, "6M": 182, "1Y": 365, "ALL": Infinity };
  card.querySelectorAll(".timerange-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = dayMap[btn.textContent.trim()];
      if (days === undefined) return;
      const cutoff = days === Infinity ? 0 : now - days * 86400;
      const slice = allMapped.filter((c) => c.time >= cutoff);
      series.setData(slice.length ? slice : allMapped);
      chart.timeScale().fitContent();
    });
  });
}

// buildIndicatorPanel is superseded by buildSplitLayout — kept as dead code
// to avoid breaking any external callers.
function buildIndicatorPanel(closes, highs, lows, ohlcCloses, volumes) {
  return el("div", {});
}

function indicatorCard(label, value, [state, colorClass], tip) {
  return el("div", { class: "p-5 rounded-2xl bg-white/[0.03] border border-white/5" }, [
    el("div", { class: "flex items-center gap-1.5 mb-2" }, [
      el("span", { class: "text-[10px] uppercase font-black text-slate-500 tracking-widest" }, label),
      tip ? el("span", { class: "tooltip text-slate-600 hover:text-cyan-400 transition-colors text-[11px] leading-none", "data-tip": tip, tabindex: "0", "aria-label": `What is ${label}?` }, "ⓘ") : null,
    ]),
    el("span", { class: "text-xl font-bold text-white block" }, String(value)),
    el("span", { class: `text-xs font-semibold ${colorClass}` }, state),
  ]);
}

/** Compact indicator cell for the 2-col split panel */
function indicatorCell(label, value, [state, colorClass], tip) {
  return el("div", { class: "indicator-cell" }, [
    el("div", { class: "flex items-center gap-1 mb-1" }, [
      el("span", { class: "text-[9px] uppercase font-black text-slate-500 tracking-widest" }, label),
      tip ? el("span", { class: "tooltip text-slate-600 hover:text-cyan-400 transition-colors text-[10px] leading-none", "data-tip": tip, tabindex: "0", "aria-label": `What is ${label}?` }, "ⓘ") : null,
    ]),
    el("span", { class: "text-base font-bold text-white block leading-tight" }, String(value)),
    el("span", { class: `text-[11px] font-semibold ${colorClass}` }, state),
  ]);
}

function lastValid(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined && !Number.isNaN(arr[i])) return arr[i];
  return null;
}