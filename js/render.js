// render.js, dashboard DOM rendering.
import { latest, previous, inRange, model } from "./data.js";
import { markerChart } from "./charts.js";
import { computeDigest, digestCopy } from "./digest.js";

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function fmt(v) {
  if (v === null || v === undefined) return "-";
  return Math.abs(v) >= 100 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100);
}

export function renderHero(m) {
  $("#demo-stats").innerHTML = `<span><b>${m.reports.length}</b> reports</span><span><b>${m.markers.length}</b> biomarkers</span><span>Fictional profile: Demo User</span>`;
}

export function renderDigest(m) {
  const items = computeDigest(m.markers);
  const wrap = $("#digest");
  if (!items.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  $("#digest-chips").innerHTML = items.map(it => {
    const c = digestCopy[it.kind];
    const arrow = it.rising ? "up" : "down";
    return `<a class="digest-chip neutral" href="#card-${it.marker.id}">
      <span class="arrow">${arrow}</span>
      <span>${it.marker.name}</span>
      <span class="muted">${fmt(it.from)} to ${fmt(it.to)} · ${c.text}</span>
    </a>`;
  }).join("");
}

function statusPill(m) {
  const cur = latest(m.series);
  const ok = inRange(cur.value, m.ref);
  if (ok === null) return "";
  if (ok) return `<span class="status-pill pill-ok">in range</span>`;
  const low = m.ref.min != null && cur.value < m.ref.min;
  return `<span class="status-pill pill-bad">${low ? "low" : "high"}</span>`;
}

function deltaPill(m) {
  const cur = latest(m.series);
  if (cur.value === null) return "";
  const prev = previous(m.series, cur.index);
  if (prev.value === null) return "";
  const d = cur.value - prev.value;
  if (d === 0) return `<span class="status-pill" style="background:var(--bg-inset);color:var(--text-3)">no change</span>`;
  const sign = d > 0 ? "+" : "-";
  return `<span class="status-pill" style="background:var(--bg-inset);color:var(--text-2)">${sign}${fmt(Math.abs(d))} vs prev</span>`;
}

function refText(ref) {
  if (ref.min != null && ref.max != null) return `Range ${ref.min}-${ref.max}`;
  if (ref.max != null) return `Example upper limit ${ref.max}`;
  if (ref.min != null) return `Example lower limit ${ref.min}`;
  return "";
}

export function renderSections(m) {
  const container = $("#sections");
  container.innerHTML = "";
  const labels = m.reports.map(r => r.label);
  const bySection = {};
  for (const mk of m.markers) (bySection[mk.section] ??= []).push(mk);

  for (const sec of m.sections) {
    const section = el("section", "section");
    section.id = "sec-" + sec.id;
    section.innerHTML = `<div class="section-head">
      <h2>${sec.title}</h2>
      <span class="badge badge-${sec.priority}"><span class="dot dot-${sec.priority}"></span>${sec.badge}</span>
    </div>`;
    const grid = el("div", "cards-grid");
    for (const mk of bySection[sec.id] || []) {
      const cur = latest(mk.series);
      const card = el("article", "marker-card");
      card.id = "card-" + mk.id;
      card.innerHTML = `
        <div class="mc-head">
          <div class="mc-title">${mk.name}<small>${mk.unit}</small></div>
          <div class="mc-value"><span class="v">${fmt(cur.value)}</span><span class="u">${mk.unit}</span></div>
        </div>
        <div class="mc-sub">${statusPill(mk)}${deltaPill(mk)}<span>${refText(mk.ref)}</span></div>
        <div class="chart-box"><canvas id="chart-${mk.id}" role="img" aria-label="${mk.name} trend chart"></canvas></div>
        <div class="mc-expand">
          <button class="mc-expand-btn" aria-expanded="false" aria-controls="detail-${mk.id}">
            <span>What is ${mk.name}?</span><span class="chev" aria-hidden="true"></span>
          </button>
          <div class="mc-detail" id="detail-${mk.id}">
            <div>
              <p>${mk.explain}</p>
              <div class="your-status"><b>Demo note:</b> ${mk.status}</div>
            </div>
          </div>
        </div>`;
      const btn = card.querySelector(".mc-expand-btn");
      const detail = card.querySelector(".mc-detail");
      btn.addEventListener("click", () => {
        const open = detail.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
      });
      grid.appendChild(card);
    }
    section.appendChild(grid);
    container.appendChild(section);
  }

  // charts after DOM insertion
  for (const mk of m.markers) {
    const canvas = document.getElementById("chart-" + mk.id);
    if (canvas) markerChart(canvas, labels, mk.series, mk.ref, { label: mk.name, unit: mk.unit });
  }

  // section chips
  $("#chips").innerHTML = m.sections.map(s =>
    `<a class="chip" data-sec="sec-${s.id}" href="#sec-${s.id}"><span class="dot dot-${s.priority}"></span>${s.title}</a>`
  ).join("");
}

export function renderMeta(m) {
  $("#hero-sub").textContent = `${m.reports.length} fictional reports | 29 biomarkers`;
  $("#note-foot").textContent = "Synthetic data only. Shading shows illustrative reference ranges, not personalized targets. Missing tests are not zero; a marker's latest measurement may predate the newest report. Verify real results with a clinician.";
}

export function renderDashboard() {
  const m = model();
  renderHero(m);
  renderDigest(m);
  renderSections(m);
  renderMeta(m);
}