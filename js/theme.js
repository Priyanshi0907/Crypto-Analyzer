/**
 * theme.js
 * Working dark/light theme toggle (persisted to localStorage) and a
 * functional mobile hamburger menu — both were non-functional in the
 * original build (fixed dark theme only, inert hamburger button).
 */
const THEME_KEY = "ca_theme";

export function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);

  toggleBtn?.addEventListener("click", () => {
    const current = document.documentElement.classList.contains("light") ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) icon.className = theme === "light" ? "fas fa-moon" : "fas fa-sun";
}

export function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-button");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    const isOpen = !menu.classList.contains("hidden");
    menu.classList.toggle("hidden", isOpen);
    btn.setAttribute("aria-expanded", String(!isOpen));
    btn.querySelector("i").className = isOpen ? "fas fa-bars text-xl" : "fas fa-times text-xl";
  });

  menu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      menu.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
      btn.querySelector("i").className = "fas fa-bars text-xl";
    })
  );
}
