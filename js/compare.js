/**
 * compare.js
 * Side-by-side comparison of two coins: the metrics table, a normalized
 * price-overlay line chart, a radar chart of relative momentum/volatility/
 * liquidity, and volatility/Sharpe ratio figures.
 *
 * Price/return/volatility figures are computed from Binance daily candles
 * (free, keyless, high rate limit). Market cap and circulating supply come
 * from an optional CoinGecko call that's allowed to fail — those two rows
 * just show "—" if it does, rather than breaking the whole comparison.
 */
import { fetchJSON } from "./cache.js";
import { el, clear, fmtUSD, fmtCompactUSD, fmtPct } from "./dom.js";
import { resolveCoin } from "./coinlist.js";
import { fetchDailyKlines, fetchTicker24h, returnOverDays } from "./binance.js";
import { annualizedVolatility, sharpeRatio } from "./indicators.js";

const CG_API = "https://api.coingecko.com/api/v3";

export function initCompare() {
  const form = document.getElementById("compare-form");
  const resultEl = document.getElementById("compare-result");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aRaw = document.getElementById("compare-a").value.trim();
    const bRaw = document.getElementById("compare-b").value.trim();
    if (!aRaw || !bRaw) return;

    clear(resultEl);
    resultEl.appendChild(el("p", { class: "text-slate-500 text-sm italic" }, "Loading comparison…"));
    try {
      const [coinA, coinB] = await Promise.all([resolveCoin(aRaw), resolveCoin(bRaw)]);
      const [dataA, dataB] = await Promise.all([loadCoinStats(coinA), loadCoinStats(coinB)]);
      clear(resultEl);
      resultEl.appendChild(renderComparison(dataA, dataB));
    } catch (err) {
      clear(resultEl);
      resultEl.appendChild(el("p", { class: "text-rose-400 text-sm" }, `Comparison failed: ${err.message}`));
    }
  });
}

async function loadCoinStats(coin) {
  let price = null, r24 = null, r7 = null, r30 = null, candles = null, volatility = null, sharpe = null, volume24h = null;

  if (coin.binance) {
    const [k, ticker] = await Promise.all([
      fetchDailyKlines(coin.binance, 91),
      fetchTicker24h(coin.binance).catch(() => null),
    ]);
    candles = k;
    const closes = k.map((c) => c.close);
    price = closes[closes.length - 1] ?? null;
    r24 = returnOverDays(k, 1);
    r7 = returnOverDays(k, 7);
    r30 = returnOverDays(k, 30);
    volatility = annualizedVolatility(closes);
    sharpe = sharpeRatio(closes);
    volume24h = ticker ? parseFloat(ticker.quoteVolume) : null;
  }

  // Optional enrichment — market cap / circulating supply / logo only.
  let marketCap = null, supply = null, image = null;
  try {
    const meta = await fetchJSON(`${CG_API}/coins/markets?vs_currency=usd&ids=${coin.id}`, { ttlMs: 10 * 60_000, retries: 1, timeoutMs: 6_000 });
    if (meta[0]) {
      marketCap = meta[0].market_cap;
      supply = meta[0].circulating_supply;
      image = meta[0].image;
      if (price === null) price = meta[0].current_price;
      if (r24 === null) r24 = meta[0].price_change_percentage_24h;
    }
  } catch { /* market cap/supply just won't show for this coin */ }

  return { coin, price, r24, r7, r30, marketCap, supply, image, candles, volatility, sharpe, volume24h };
}

function renderComparison(a, b) {
  const rows = [
    ["Price", a.price !== null ? fmtUSD(a.price) : "—", b.price !== null ? fmtUSD(b.price) : "—"],
    ["Market Cap", a.marketCap !== null ? fmtCompactUSD(a.marketCap) : "—", b.marketCap !== null ? fmtCompactUSD(b.marketCap) : "—"],
    ["24h Return", a.r24 !== null ? fmtPct(a.r24) : "—", b.r24 !== null ? fmtPct(b.r24) : "—"],
    ["7d Return", a.r7 !== null ? fmtPct(a.r7) : "—", b.r7 !== null ? fmtPct(b.r7) : "—"],
    ["30d Return", a.r30 !== null ? fmtPct(a.r30) : "—", b.r30 !== null ? fmtPct(b.r30) : "—"],
    ["Volatility (annualized)", a.volatility !== null ? `${a.volatility.toFixed(1)}%` : "—", b.volatility !== null ? `${b.volatility.toFixed(1)}%` : "—"],
    ["Sharpe Ratio (90d, 0% risk-free)", a.sharpe !== null ? a.sharpe.toFixed(2) : "—", b.sharpe !== null ? b.sharpe.toFixed(2) : "—"],
    ["Circulating Supply", a.supply ? Math.round(a.supply).toLocaleString() : "—", b.supply ? Math.round(b.supply).toLocaleString() : "—"],
  ];

  const table = el("table", { class: "w-full text-left" }, [
    el("thead", {}, el("tr", { class: "border-b border-white/10" }, [
      el("th", { class: "p-4 text-[10px] uppercase font-black text-slate-500 tracking-widest" }, "Metric"),
      el("th", { class: "p-4 text-[10px] uppercase font-black text-cyan-400 tracking-widest" }, a.coin.name),
      el("th", { class: "p-4 text-[10px] uppercase font-black text-blue-400 tracking-widest" }, b.coin.name),
    ])),
    el("tbody", {}, rows.map(([label, va, vb]) =>
      el("tr", { class: "border-b border-white/5" }, [
        el("td", { class: "p-4 text-slate-400 text-sm" }, label),
        el("td", { class: "p-4 text-white font-bold text-sm" }, String(va)),
        el("td", { class: "p-4 text-white font-bold text-sm" }, String(vb)),
      ])
    )),
  ]);

  const card = el("div", { class: "glass-card rounded-2xl overflow-hidden" }, [
    el("div", { class: "flex items-center gap-4 p-6 border-b border-white/10" }, [
      a.image ? el("img", { src: a.image, class: "w-10 h-10 rounded-full" }) : el("div", { class: "w-10 h-10 rounded-full bg-white/5" }),
      el("span", { class: "text-slate-500 font-black" }, "VS"),
      b.image ? el("img", { src: b.image, class: "w-10 h-10 rounded-full" }) : el("div", { class: "w-10 h-10 rounded-full bg-white/5" }),
    ]),
    table,
    (a.marketCap === null || b.marketCap === null)
      ? el("p", { class: "px-6 py-4 text-[10px] text-slate-600 italic border-t border-white/5" }, "Market cap/supply unavailable for one or both assets right now — everything else above is from Binance and unaffected.")
      : null,
  ]);

  if (a.candles && b.candles) {
    const overlayWrap = el("div", { class: "p-8 border-t border-white/10" }, [
      el("div", { class: "flex items-center justify-between mb-3" }, [
        el("h5", { class: "text-xs font-black uppercase tracking-widest text-slate-500" }, "90-Day Price Overlay"),
        el("span", { class: "text-[10px] text-slate-600 italic" }, "Both series normalized to % change from day 1, so scale doesn't distort the comparison"),
      ]),
      el("div", { class: "overlay-chart h-64 rounded-xl overflow-hidden border border-white/5" }),
    ]);
    card.appendChild(overlayWrap);

    const radarWrap = el("div", { class: "p-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center" }, [
      el("div", {}, [
        el("h5", { class: "text-xs font-black uppercase tracking-widest text-slate-500 mb-2" }, "Relative Profile"),
        el("p", { class: "text-slate-500 text-xs leading-relaxed" }, "Each axis is scaled between the two assets being compared (not an absolute 0–100 scale) — it shows which asset leads on that metric right now, not a universal ranking."),
      ]),
      el("div", { class: "radar-chart flex justify-center" }),
    ]);
    card.appendChild(radarWrap);
  }

  requestAnimationFrame(() => {
    if (a.candles && b.candles) {
      mountOverlayChart(card.querySelector(".overlay-chart"), a, b);
      mountRadarChart(card.querySelector(".radar-chart"), a, b);
    }
  });

  return card;
}

function mountOverlayChart(target, a, b) {
  if (!target || !window.LightweightCharts) return;
  const chart = window.LightweightCharts.createChart(target, {
    layout: { background: { color: "transparent" }, textColor: "#7A7F88" },
    grid: { vertLines: { color: "#2B2D33" }, horzLines: { color: "#2B2D33" } },
    rightPriceScale: { borderColor: "#2B2D33" },
    timeScale: { borderColor: "#2B2D33" },
    autoSize: true,
  });
  const seriesA = chart.addLineSeries({ color: "#D4AF37", lineWidth: 2 });
  const seriesB = chart.addLineSeries({ color: "#E6C65B", lineWidth: 2 });
  seriesA.setData(normalizedSeries(a.candles));
  seriesB.setData(normalizedSeries(b.candles));
  chart.timeScale().fitContent();
}

function normalizedSeries(candles) {
  const base = candles[0].close;
  return candles.map((c) => ({ time: Math.floor(c.time / 1000), value: base ? ((c.close - base) / base) * 100 : 0 }));
}

function mountRadarChart(target, a, b) {
  if (!target) return;
  const axes = ["24h Return", "7d Return", "30d Return", "Volatility", "24h Volume"];
  const rawA = [a.r24, a.r7, a.r30, a.volatility, a.volume24h];
  const rawB = [b.r24, b.r7, b.r30, b.volatility, b.volume24h];

  const size = 300, center = size / 2, radius = 100;
  const angleStep = (Math.PI * 2) / axes.length;

  const normA = [], normB = [];
  axes.forEach((_, i) => {
    const va = rawA[i] ?? 0, vb = rawB[i] ?? 0;
    const max = Math.max(Math.abs(va), Math.abs(vb), 0.0001);
    normA.push(50 + (va / max) * 50);
    normB.push(50 + (vb / max) * 50);
  });

  const toXY = (value, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const ringPath = (pct) =>
    axes.map((_, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = (pct / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");

  const polyA = axes.map((_, i) => toXY(normA[i], i).join(",")).join(" ");
  const polyB = axes.map((_, i) => toXY(normB[i], i).join(",")).join(" ");

  const labels = axes.map((label, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const lx = center + (radius + 26) * Math.cos(angle);
    const ly = center + (radius + 26) * Math.sin(angle);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#7A7F88" font-size="10" font-weight="700" style="text-transform:uppercase;letter-spacing:0.05em">${label}</text>`;
  }).join("");

  const svg = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <polygon points="${ringPath(100)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <polygon points="${ringPath(66)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <polygon points="${ringPath(33)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <polygon points="${polyA}" fill="rgba(212,175,55,0.15)" stroke="#D4AF37" stroke-width="2"/>
      <polygon points="${polyB}" fill="rgba(230,198,91,0.15)" stroke="#E6C65B" stroke-width="2"/>
      ${labels}
    </svg>`;
  target.innerHTML = svg;
}