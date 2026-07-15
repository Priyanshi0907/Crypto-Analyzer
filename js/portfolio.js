/**
 * portfolio.js
 * Client-side watchlist + holdings tracker persisted to localStorage.
 * There is no backend/account system (this is a static site), so this
 * is per-browser only — documented honestly in the UI and README.
 */
import { fetchJSON } from "./cache.js";
import { el, clear, fmtUSD, fmtPct } from "./dom.js";
import { findInCatalog } from "./coinlist.js";
import { fetchTicker24hBatch } from "./binance.js";

const WATCHLIST_KEY = "ca_watchlist";
const HOLDINGS_KEY = "ca_holdings";
const API = "https://api.coingecko.com/api/v3";
let sortMode = "name-asc";

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function isWatched(id) {
  return read(WATCHLIST_KEY).some((c) => c.id === id);
}

export function addToWatchlist(coin) {
  const list = read(WATCHLIST_KEY);
  if (list.some((c) => c.id === coin.id)) return;
  list.push(coin);
  write(WATCHLIST_KEY, list);
  renderPortfolio();
}

export function removeFromWatchlist(id) {
  write(WATCHLIST_KEY, read(WATCHLIST_KEY).filter((c) => c.id !== id));
  renderPortfolio();
}

export function addHolding(id, name, symbol, amount, costBasisUSD) {
  const list = read(HOLDINGS_KEY);
  list.push({ id, name, symbol, amount: Number(amount), costBasisUSD: Number(costBasisUSD), addedAt: Date.now() });
  write(HOLDINGS_KEY, list);
  renderPortfolio();
}

export function removeHolding(index) {
  const list = read(HOLDINGS_KEY);
  list.splice(index, 1);
  write(HOLDINGS_KEY, list);
  renderPortfolio();
}

export function initPortfolio() {
  const form = document.getElementById("holding-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("holding-id").value.trim().toLowerCase().replace(/\s+/g, "-");
    const amount = document.getElementById("holding-amount").value;
    const cost = document.getElementById("holding-cost").value;
    if (!id || !amount) return;
    addHolding(id, id, id, amount, cost || 0);
    form.reset();
  });

  const sortSelect = document.getElementById("watchlist-sort");
  sortSelect?.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderPortfolio();
  });

  renderPortfolio();
}

export async function renderPortfolio() {
  const watchlistEl = document.getElementById("watchlist-container");
  const holdingsEl = document.getElementById("holdings-container");
  const summaryEl = document.getElementById("portfolio-summary");
  if (!watchlistEl && !holdingsEl) return;

  const watchlist = read(WATCHLIST_KEY);
  const holdings = read(HOLDINGS_KEY);
  const ids = [...new Set([...watchlist.map((c) => c.id), ...holdings.map((h) => h.id)])];

  let live = {};
  if (ids.length) {
    const binanceIds = [], otherIds = [];
    const catalogEntries = {};
    ids.forEach((id) => {
      const entry = findInCatalog(id);
      if (entry?.binance) { binanceIds.push(id); catalogEntries[id] = entry; }
      else otherIds.push(id);
    });

    if (binanceIds.length) {
      try {
        const symbols = binanceIds.map((id) => catalogEntries[id].binance);
        const tickers = await fetchTicker24hBatch(symbols);
        tickers.forEach((t) => {
          const id = binanceIds.find((bid) => catalogEntries[bid].binance === t.symbol);
          if (id) live[id] = { current_price: parseFloat(t.lastPrice), price_change_percentage_24h: parseFloat(t.priceChangePercent), image: "" };
        });
      } catch { /* fall through — those coins just show cached/last-known values */ }
    }
    if (otherIds.length) {
      try {
        const data = await fetchJSON(`${API}/coins/markets?vs_currency=usd&ids=${otherIds.join(",")}`, { ttlMs: 30_000, retries: 1, timeoutMs: 6_000 });
        data.forEach((d) => (live[d.id] = d));
      } catch { /* show cached/last-known values below if this fails */ }
    }
  }

  if (watchlistEl) {
    clear(watchlistEl);
    if (!watchlist.length) {
      watchlistEl.appendChild(el("p", { class: "text-slate-500 text-sm italic" }, "No coins watched yet — search a coin above and hit “+ Watchlist”."));
    } else {
      const sorted = [...watchlist].sort((x, y) => {
        const dx = live[x.id], dy = live[y.id];
        const priceX = dx ? dx.current_price : x.price, priceY = dy ? dy.current_price : y.price;
        const chgX = dx ? dx.price_change_percentage_24h : 0, chgY = dy ? dy.price_change_percentage_24h : 0;
        switch (sortMode) {
          case "name-desc": return y.name.localeCompare(x.name);
          case "price-desc": return (priceY ?? 0) - (priceX ?? 0);
          case "price-asc": return (priceX ?? 0) - (priceY ?? 0);
          case "change-desc": return (chgY ?? 0) - (chgX ?? 0);
          case "change-asc": return (chgX ?? 0) - (chgY ?? 0);
          default: return x.name.localeCompare(y.name); // name-asc
        }
      });
      sorted.forEach((coin) => {
        const d = live[coin.id];
        const price = d ? d.current_price : coin.price;
        const change = d ? d.price_change_percentage_24h : null;
        watchlistEl.appendChild(
          el("div", { class: "flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5" }, [
            el("div", { class: "flex items-center gap-3" }, [
              el("img", { src: coin.image || (d && d.image) || "", class: "w-8 h-8 rounded-full" }),
              el("div", {}, [
                el("div", { class: "text-white font-bold text-sm" }, coin.name),
                el("div", { class: "text-slate-500 text-[10px] uppercase" }, coin.symbol),
              ]),
            ]),
            el("div", { class: "text-right" }, [
              el("div", { class: "text-white font-bold text-sm" }, fmtUSD(price)),
              change !== null
                ? el("div", { class: `text-xs font-semibold ${change >= 0 ? "text-emerald-400" : "text-rose-400"}` }, fmtPct(change))
                : null,
            ]),
            removeBtn(() => removeFromWatchlist(coin.id)),
          ])
        );
      });
    }
  }

  if (holdingsEl) {
    clear(holdingsEl);
    let totalValue = 0, totalCost = 0;
    if (!holdings.length) {
      holdingsEl.appendChild(el("p", { class: "text-slate-500 text-sm italic" }, "No holdings logged yet — add one below to track profit/loss."));
    } else {
      holdings.forEach((h, i) => {
        const d = live[h.id];
        const price = d ? d.current_price : null;
        const value = price !== null ? price * h.amount : null;
        const pl = value !== null ? value - h.costBasisUSD : null;
        const plPct = h.costBasisUSD > 0 && pl !== null ? (pl / h.costBasisUSD) * 100 : null;
        if (value !== null) totalValue += value;
        totalCost += h.costBasisUSD;
        holdingsEl.appendChild(
          el("div", { class: "flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5" }, [
            el("div", {}, [
              el("div", { class: "text-white font-bold text-sm" }, `${h.amount} ${h.id.toUpperCase()}`),
              el("div", { class: "text-slate-500 text-[10px]" }, `Cost basis ${fmtUSD(h.costBasisUSD)}`),
            ]),
            el("div", { class: "text-right" }, [
              el("div", { class: "text-white font-bold text-sm" }, value !== null ? fmtUSD(value) : "—"),
              pl !== null
                ? el("div", { class: `text-xs font-semibold ${pl >= 0 ? "text-emerald-400" : "text-rose-400"}` }, `${fmtUSD(pl)} (${fmtPct(plPct)})`)
                : null,
            ]),
            removeBtn(() => removeHolding(i)),
          ])
        );
      });
    }
    if (summaryEl) {
      clear(summaryEl);
      const totalPl = totalValue - totalCost;
      summaryEl.appendChild(
        el("div", { class: "grid grid-cols-3 gap-4 text-center" }, [
          statBox("Portfolio Value", fmtUSD(totalValue)),
          statBox("Total Cost Basis", fmtUSD(totalCost)),
          statBox("Unrealized P/L", fmtUSD(totalPl), totalPl >= 0 ? "text-emerald-400" : "text-rose-400"),
        ])
      );
    }
  }
}

function statBox(label, value, colorClass = "text-white") {
  return el("div", { class: "p-4 rounded-xl bg-white/[0.03] border border-white/5" }, [
    el("div", { class: "text-[9px] uppercase font-black text-slate-500 tracking-widest mb-1" }, label),
    el("div", { class: `text-lg font-bold ${colorClass}` }, value),
  ]);
}

function removeBtn(onClick) {
  const btn = el("button", { class: "ml-3 text-slate-600 hover:text-rose-400 transition-colors", title: "Remove" }, "✕");
  btn.addEventListener("click", onClick);
  return btn;
}