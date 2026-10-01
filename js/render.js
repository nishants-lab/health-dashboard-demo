// render.js, dashboard DOM rendering.
import { latest, previous, inRange, model } from "./data.js";
import { scoreSeries, breakdownScores } from "./score.js";
import { markerChart, scoreChart } from "./charts.js";
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

function ringColor(score) {
  const c = getComputedStyle(document.documentElement);
  if (score >= 80) return c.getPropertyValue("--ok").trim();
  if (score >= 60) return c.getPropertyValue("--warn").trim();
  return c.getPropertyValue("--bad").trim();
}

export function renderHero(m) {
  $("#demo-stats").innerHTML = `<span><b>${m.reports.length}</b> reports</span><span><b>${m.markers.length}</b> biomarkers</span>`;
  const labels = m.reports.map(r => r.label);
  const scores = scoreSeries(m.markers, m.reports.length);
  let curIdx = scores.length - 1;
  while (curIdx > 0 && scores[curIdx] === null) curIdx--;
  const score = scores[curIdx];
  let prevIdx = curIdx - 1;
  while (prevIdx >= 0 && scores[prevIdx] === null) prevIdx--;
  const prev = prevIdx >= 0 ? scores[prevIdx] : null;

  // ring
  const R = 74, CIRC = 2 * Math.PI * R;
  const ring = $("#ring-val");
  ring.style.stroke = score === null ? "var(--text-3)" : ringColor(score);
  ring.setAttribute("stroke-dasharray", CIRC.toFixed(1));
  ring.setAttribute("stroke-dashoffset", CIRC.toFixed(1));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ring.setAttribute("stroke-dashoffset", (CIRC * (1 - score / 100)).toFixed(1));
  }));
  $("#ring-num").textContent = score ?? "N/A";
  $("#hero-date").textContent = m.reports[curIdx].label;

  // delta vs previous report
  const deltaEl = $("#hero-delta");
  if (prev !== null && score !== null) {
    deltaEl.hidden = false;
    const d = score - prev;
    deltaEl.className = "delta-chip " + (d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-flat");
    deltaEl.textContent = (d > 0 ? "+" + d : d < 0 ? String(d) : "no change") + " vs " + m.reports[prevIdx].label;
  } else deltaEl.hidden = true;

  // breakdown bars
  const bd = breakdownScores(m.markers, m.breakdown, curIdx);
  $("#breakdown").innerHTML = bd.map(c => {
    const col = c.score >= 80 ? "var(--ok)" : c.score >= 60 ? "var(--warn)" : "var(--bad)";
    return `<div class="bd-item">
      <div class="bd-top"><span>${c.name}</span><b>${c.score ?? "N/A"}</b></div>
      <div class="bd-track"><div class="bd-fill" style="width:${c.score ?? 0}%;background:${col}"></div></div>
    </div>`;
  }).join("");

  scoreChart($("#chart-score"), labels, scores);
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
              <div class="your-status"><b>Sample note:</b> ${mk.status}</div>
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
  $("#hero-sub").textContent = `${m.reports.length} sample reports | 29 biomarkers`;
  $("#note-foot").textContent = "Fictional records only. Shading shows illustrative reference ranges, not personalized targets. Missing tests are not zero; a marker's latest measurement may predate the newest report. Verify real results with a clinician.";
}

export function renderDashboard() {
  const m = model();
  renderHero(m);
  renderDigest(m);
  renderSections(m);
  renderMeta(m);
}