/**
 * news.js
 * Streams headlines from public crypto RSS feeds (via rss2json) and tags
 * each one with a *heuristic keyword-based* sentiment label — a simple
 * lexicon match, not a trained sentiment model, labelled honestly rather
 * than presented as "AI sentiment analysis".
 *
 * Also supports topic filter tags (Bitcoin/Ethereum/Regulation/NFT/DeFi):
 * articles are fetched once and filtered client-side, so switching tags
 * doesn't refire any network requests.
 */
import { fetchJSON } from "./cache.js";
import { el, clear } from "./dom.js";

const RSS_FEEDS = ["https://news.bitcoin.com/feed/", "https://cointelegraph.com/rss"];

const POSITIVE_WORDS = ["surge", "rally", "gain", "bullish", "soar", "record", "breakthrough", "adoption", "approve", "growth", "recover", "jump", "high"];
const NEGATIVE_WORDS = ["crash", "plunge", "hack", "lawsuit", "ban", "fraud", "bearish", "slump", "fear", "collapse", "sell-off", "decline", "fall", "loss", "exploit"];

const FILTER_TAGS = [
  { label: "All", matches: () => true },
  { label: "Bitcoin", matches: (s) => /\bbitcoin\b|\bbtc\b/i.test(s) },
  { label: "Ethereum", matches: (s) => /\bethereum\b|\beth\b/i.test(s) },
  { label: "Regulation", matches: (s) => /regulat|\bsec\b|lawsuit|policy|legal/i.test(s) },
  { label: "NFT", matches: (s) => /\bnft\b/i.test(s) },
  { label: "DeFi", matches: (s) => /defi|decentralized finance/i.test(s) },
];

function scoreSentiment(text) {
  const t = text.toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach((w) => { if (t.includes(w)) score += 1; });
  NEGATIVE_WORDS.forEach((w) => { if (t.includes(w)) score -= 1; });
  if (score > 0) return { label: "Positive", cls: "text-emerald-400 bg-emerald-500/10" };
  if (score < 0) return { label: "Negative", cls: "text-rose-400 bg-rose-500/10" };
  return { label: "Neutral", cls: "text-slate-400 bg-white/5" };
}

let allArticles = [];
let activeFilter = "All";

export async function initNews() {
  const newsCont = document.getElementById("news-container");
  const sideNews = document.getElementById("sidebar-news");
  const filterBar = document.getElementById("news-filters");
  if (!newsCont) return;

  renderFilterBar(filterBar);

  try {
    const feeds = await Promise.all(
      RSS_FEEDS.map((u) =>
        fetchJSON(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}`, { ttlMs: 5 * 60_000 })
      )
    );
    allArticles = [];
    feeds.forEach((f) => {
      f.items.slice(0, 6).forEach((item) => {
        allArticles.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          thumbnail: item.thumbnail,
          description: (item.description || "").replace(/<[^>]*>/g, "").slice(0, 120),
          source: f.feed.title.split(" ")[0],
          sentiment: scoreSentiment(item.title + " " + (item.description || "")),
        });
      });
    });
    renderArticles(newsCont, sideNews);
  } catch {
    clear(newsCont);
    newsCont.appendChild(el("div", { class: "p-6 glass-card text-rose-400 rounded-2xl" }, "Failed to stream news feeds."));
  }
}

function renderFilterBar(filterBar) {
  if (!filterBar) return;
  clear(filterBar);
  FILTER_TAGS.forEach(({ label }) => {
    const active = label === activeFilter;
    const btn = el(
      "button",
      {
        type: "button",
        class: `px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
          active ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400" : "border-white/10 text-slate-400 hover:text-white hover:border-white/30"
        }`,
      },
      label
    );
    btn.addEventListener("click", () => {
      activeFilter = label;
      renderFilterBar(filterBar);
      try {
        renderArticles(document.getElementById("news-container"), document.getElementById("sidebar-news"));
      } catch (err) {
        console.error("News filter render failed:", err);
      }
    });
    filterBar.appendChild(btn);
  });
}

function renderArticles(newsCont, sideNews) {
  clear(newsCont);
  clear(sideNews);
  const tag = FILTER_TAGS.find((t) => t.label === activeFilter) || FILTER_TAGS[0];
  const filtered = allArticles.filter((a) => tag.matches(a.title + " " + a.description));

  if (!filtered.length) {
    newsCont.appendChild(el("p", { class: "text-slate-500 text-sm italic" }, `No headlines matched "${activeFilter}" in the current feed — try another tag.`));
    return;
  }

  filtered.forEach((item, i) => {
    const entry = el("div", { class: "glass-card p-6 rounded-2xl group hover:border-cyan-500/30 transition-all text-left" }, [
      el("div", { class: "flex gap-6" }, [
        item.thumbnail ? el("img", { src: item.thumbnail, class: "w-32 h-24 object-cover rounded-xl border border-white/10 hidden md:block" }) : null,
        el("div", { class: "flex-grow" }, [
          el("div", { class: "flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-1" }, [
            el("span", { class: "text-cyan-400" }, item.source),
            el("span", { class: "text-slate-600" }, "•"),
            el("span", { class: "text-slate-600" }, new Date(item.pubDate).toLocaleDateString()),
            el("span", { class: `px-2 py-0.5 rounded-full ${item.sentiment.cls}` }, item.sentiment.label),
          ]),
          el("h5", { class: "text-lg font-bold text-white group-hover:text-cyan-400 transition-colors leading-tight mb-2" }, [
            el("a", { href: item.link, target: "_blank", rel: "noopener noreferrer" }, item.title),
          ]),
          el("p", { class: "text-slate-500 text-sm line-clamp-2 leading-relaxed" }, item.description + "..."),
        ]),
      ]),
    ]);
    newsCont.appendChild(entry);

    if (i < 4) {
      sideNews.appendChild(
        el("div", { class: "p-4 glass-card rounded-xl text-left border-white/5" }, [
          el("span", { class: "text-[9px] text-blue-400 font-black uppercase mb-1 block" }, item.source),
          el("a", { href: item.link, target: "_blank", rel: "noopener noreferrer", class: "text-xs font-bold text-slate-300 hover:text-white line-clamp-2" }, item.title),
        ])
      );
    }
  });
  newsCont.appendChild(
    el("p", { class: "text-[10px] text-slate-600 italic pt-2" }, "Sentiment tags are a simple keyword heuristic, not a trained ML/NLP model.")
  );
}