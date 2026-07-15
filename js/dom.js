/**
 * dom.js
 * Small helper for building DOM nodes with createElement/textContent
 * instead of innerHTML. This avoids injecting untrusted API text
 * (coin names, news headlines, etc.) as raw HTML.
 *
 * Usage: el("div", { class: "card" }, [ el("span", {}, "Hello") ])
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "class") node.className = val;
    else if (key.startsWith("on") && typeof val === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (val !== null && val !== undefined) {
      node.setAttribute(key, val);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmtUSD(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  // Sub-$1 assets (common for lower-cap coins) round to "$0.00" with the
  // default 2 decimal places. Scale precision to the value's magnitude
  // instead, so e.g. $0.0000034 shows as $0.0000034, not $0.00.
  if (abs > 0 && abs < 1 && !opts.forceStandard) {
    const decimals = Math.min(10, Math.max(4, -Math.floor(Math.log10(abs)) + 3));
    return `$${n.toFixed(decimals)}`;
  }
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", ...opts });
}

/**
 * Compact $ formatter for large aggregate figures (market cap, volume)
 * that scales the unit (K/M/B/T) to the value instead of assuming
 * everything is in the billions — a $400M coin was previously shown as
 * a misleading "0.00B".
 */
export function fmtCompactUSD(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return fmtUSD(n);
}

export function fmtPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}