import { initSearch } from "./search.js";
import { initPredict } from "./predict.js";
import { initNews } from "./news.js";
import { initPortfolio } from "./portfolio.js";
import { initCompare } from "./compare.js";
import { initTheme, initMobileMenu } from "./theme.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMobileMenu();
  initSearch();
  initPredict();
  initNews();
  initPortfolio();
  initCompare();

  // Footer year
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});
