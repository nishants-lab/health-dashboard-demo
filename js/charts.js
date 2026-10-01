// charts.js, Chart.js wrappers, theme-aware.
const instances = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function themeColors() {
  return {
    grid: cssVar("--border"),
    text: cssVar("--text-3"),
    accent: cssVar("--accent"),
    ok: cssVar("--ok"),
    warn: cssVar("--warn"),
    bad: cssVar("--bad"),
    okBand: "rgba(82, 196, 26, 0.07)",
  };
}

export function destroyAll() {
  Object.values(instances).forEach(c => c.destroy());
  for (const k in instances) delete instances[k];
}

export function markerChart(canvas, labels, series, ref, opts = {}) {
  const c = themeColors();
  const ann = {};
  const refMin = ref.min ?? null, refMax = ref.max ?? null;
  if (refMin !== null && refMax !== null) {
    ann.band = { type: "box", yMin: refMin, yMax: refMax, backgroundColor: c.okBand, borderWidth: 0 };
    ann.lMin = { type: "line", yMin: refMin, yMax: refMin, borderColor: c.grid, borderWidth: 1, borderDash: [4, 4] };
    ann.lMax = { type: "line", yMin: refMax, yMax: refMax, borderColor: c.grid, borderWidth: 1, borderDash: [4, 4] };
  } else if (refMax !== null) {
    ann.band = { type: "box", yMin: 0, yMax: refMax, backgroundColor: c.okBand, borderWidth: 0 };
    ann.lMax = { type: "line", yMin: refMax, yMax: refMax, borderColor: c.grid, borderWidth: 1, borderDash: [4, 4] };
  } else if (refMin !== null) {
    ann.lMin = { type: "line", yMin: refMin, yMax: refMin, borderColor: c.grid, borderWidth: 1, borderDash: [4, 4] };
  }
  const pointColors = series.map(v => {
    if (v === null || v === undefined) return c.accent;
    if ((refMin !== null && v < refMin) || (refMax !== null && v > refMax)) return c.bad;
    return c.ok;
  });
  const id = canvas.id;
  if (instances[id]) instances[id].destroy();
  instances[id] = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{
      label: opts.label || "", data: series,
      borderColor: c.accent, borderWidth: 2, tension: 0.25, spanGaps: true,
      pointBackgroundColor: pointColors, pointBorderColor: pointColors,
      pointRadius: 4.5, pointHoverRadius: 7,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        annotation: { annotations: ann },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.parsed.y;
              let flag = " · in range";
              if (refMin !== null && v < refMin) flag = " · LOW";
              else if (refMax !== null && v > refMax) flag = " · HIGH";
              return `${v}${opts.unit ? " " + opts.unit : ""}${flag}`;
            },
          },
        },
      },
      scales: {
        y: { grid: { color: c.grid }, ticks: { color: c.text, maxTicksLimit: 6 } },
        x: { grid: { display: false }, ticks: { color: c.text, maxRotation: 45, autoSkip: true } },
      },
    },
  });
  return instances[id];
}

export function scoreChart(canvas, labels, scores) {
  const c = themeColors();
  const id = canvas.id;
  if (instances[id]) instances[id].destroy();
  const pc = scores.map(s => (s === null ? c.text : s >= 80 ? c.ok : s >= 60 ? c.warn : c.bad));
  instances[id] = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{
      data: scores, borderColor: c.accent, borderWidth: 2.5, tension: 0.3, spanGaps: true,
      pointBackgroundColor: pc, pointBorderColor: pc, pointRadius: 5, pointHoverRadius: 8,
      fill: { target: "origin", above: "rgba(76, 159, 254, 0.06)" },
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations: {
          good: { type: "box", yMin: 80, yMax: 100, backgroundColor: "rgba(82,196,26,.05)", borderWidth: 0 },
          ok: { type: "box", yMin: 60, yMax: 80, backgroundColor: "rgba(255,169,64,.03)", borderWidth: 0 },
        }},
        tooltip: { callbacks: { label: ctx => `Score: ${ctx.parsed.y}/100` } },
      },
      scales: {
        y: { min: 0, max: 100, grid: { color: c.grid }, ticks: { color: c.text } },
        x: { grid: { display: false }, ticks: { color: c.text } },
      },
    },
  });
  return instances[id];
}