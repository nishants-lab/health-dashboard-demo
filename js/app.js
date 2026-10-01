// app.js, entry point: theme, tab routing, scroll-spy, boot.
import { loadModel } from "./data.js";
import { renderDashboard } from "./render.js";
import { initUpload } from "./upload.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* ---------- theme ---------- */
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
  $("#theme-btn").textContent = currentIsDark() ? "Light" : "Dark";
}
function currentIsDark() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function toggleTheme() {
  const next = currentIsDark() ? "light" : "dark";
  localStorage.setItem("hd.theme", next);
  applyTheme(next);
  renderDashboard(); // charts pick up new colors
}

/* ---------- tabs / routing ---------- */
const TABS = ["dashboard", "plan", "upload"];
function currentTab() {
  const h = location.hash.replace(/^#\/?/, "");
  const base = h.split("/")[0];
  return TABS.includes(base) ? base : "dashboard";
}
function switchTab(tab, push = true) {
  const doSwitch = () => {
    TABS.forEach(t => {
      $("#tab-" + t).hidden = t !== tab;
      $$(`[data-tab="${t}"]`).forEach(b => b.setAttribute("aria-selected", String(t === tab)));
    });
    $("#chips-row").style.display = tab === "dashboard" ? "" : "none";
    if (push && currentTab() !== tab) history.pushState(null, "", "#/" + tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  doSwitch();
}

/* ---------- scroll-spy ---------- */
let spy = null;
function initScrollSpy() {
  if (spy) spy.disconnect();
  const sections = $$(".section");
  if (!sections.length) return;
  spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      $$(".chip").forEach(c => c.classList.toggle("active", c.dataset.sec === e.target.id));
    }
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach(s => spy.observe(s));
}

/* ---------- boot ---------- */
async function boot() {
  applyTheme(localStorage.getItem("hd.theme"));
  $("#theme-btn").addEventListener("click", toggleTheme);
  $$("[data-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  window.addEventListener("popstate", () => switchTab(currentTab(), false));

  try {
    await loadModel();
  } catch (err) {
    $("#sections").innerHTML = `<p style="color:var(--bad)">Failed to load data: ${err.message}</p>`;
    return;
  }
  renderDashboard();
  initScrollSpy();
  initUpload();
  $("#reset-demo").addEventListener("click", () => location.reload());
  switchTab(currentTab(), false);

  // re-render observers: rebuild spy after dashboard re-renders (upload save)
  new MutationObserver(() => initScrollSpy()).observe($("#sections"), { childList: true });


}

if (typeof Chart !== "undefined") Chart.defaults.font.size = 11;
boot();