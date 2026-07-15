/**
 * predict.js
 * The "Trend Analysis" section. Uses a real (if simple) ordinary-least-
 * squares linear regression over recent daily closes, reported with its
 * R² so the confidence level is visible, not just a number. Closes come
 * from Binance where possible (see coinlist.js / binance.js), falling
 * back to CoinGecko for coins outside the curated catalog.
 */
import { fetchJSON } from "./cache.js";
import { resolveCoin } from "./coinlist.js";
import { fetchDailyKlines } from "./binance.js";
import { el, clear, fmtUSD } from "./dom.js";
import { linearRegressionForecast, rsi, macd } from "./indicators.js";

const CG_API = "https://api.coingecko.com/api/v3";

export function initPredict() {
  const btn = document.getElementById("prediction-button");
  const input = document.getElementById("crypto-input-prediction");
  const loader = document.getElementById("predict-loader");
  const result = document.getElementById("crypto-prediction-result");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const raw = input.value.trim();
    if (!raw) return;

    loader.classList.remove("hidden");
    loader.classList.add("flex");
    clear(result);
    try {
      const coin = await resolveCoin(raw);
      const closes = coin.binance
        ? (await fetchDailyKlines(coin.binance, 365)).map((k) => k.close)
        : (await fetchJSON(`${CG_API}/coins/${coin.id}/market_chart?vs_currency=usd&days=365`, { ttlMs: 5 * 60_000 })).prices.map((p) => p[1]);

      const reg = linearRegressionForecast(closes, 30);
      const rsiVal = rsi(closes, 14).filter((v) => v !== null).pop();
      const { histogram } = macd(closes);
      const macdVal = histogram.filter((v) => v !== null && !Number.isNaN(v)).pop();
      const last = closes[closes.length - 1];
      const trendUp = reg.slope >= 0;
      const badgeCls = trendUp ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10";

      result.appendChild(
        el("div", { class: "glass-card rounded-3xl overflow-hidden" }, [
          el("div", { class: "px-8 py-5 border-b border-white/10 flex flex-wrap gap-3 justify-between items-center bg-white/[0.02]" }, [
            el("h5", { class: "text-sm font-black text-white uppercase tracking-widest" }, `Linear Regression Trend — ${coin.name}`),
            el("span", { class: `px-4 py-1.5 ${badgeCls} border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest` }, trendUp ? "Upward Trend" : "Downward Trend"),
          ]),
          el("div", { class: "p-10 text-left" }, [
            el("div", { class: "grid grid-cols-2 gap-8 mb-8" }, [
              statBlock("Current Price", fmtUSD(last)),
              statBlock("Fitted Next-Day Value", fmtUSD(reg.nextValue)),
              statBlock("R² (fit quality, 0–1)", reg.r2.toFixed(3)),
              statBlock("RSI (14)", rsiVal !== undefined ? rsiVal.toFixed(1) : "—"),
            ]),
            el("div", { class: "p-6 rounded-2xl bg-white/[0.03] text-center border border-white/5 text-slate-400 text-sm leading-relaxed" }, [
              `This is an ordinary least-squares line fit to the last ${reg.lookback} daily closes — plain statistics, not a trained AI/ML model. `,
              `An R² of ${reg.r2.toFixed(2)} means the line explains about ${(Math.max(reg.r2, 0) * 100).toFixed(0)}% of recent price variation; `,
              `the rest is noise a straight line can't capture. MACD histogram is currently ${macdVal >= 0 ? "positive" : "negative"} `,
              `(${macdVal >= 0 ? "supports" : "conflicts with"} the trend direction above). Nothing here is financial advice.`,
            ]),
          ]),
        ])
      );
    } catch (err) {
      result.appendChild(el("div", { class: "p-6 glass-card text-rose-400 text-center rounded-2xl" }, `Couldn't load data for that asset (${err.message}).`));
    } finally {
      loader.classList.remove("flex");
      loader.classList.add("hidden");
    }
  });
}

function statBlock(label, value) {
  return el("div", { class: "space-y-1" }, [
    el("span", { class: "text-[10px] uppercase font-black text-slate-500 tracking-widest" }, label),
    el("div", { class: "text-2xl font-black text-white" }, value),
  ]);
}