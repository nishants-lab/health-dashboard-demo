// score.js, trend-adjusted scoring engine (faithful port of v1 model,
// now driven by per-marker scoring config in baseline.json and computed
// over the merged series so uploaded reports affect the score).

function paramScore(val, optMin, optMax, hardMin, hardMax) {
  if (val >= optMin && val <= optMax) return 100;
  if (val < optMin) { const r = optMin - (hardMin || 0); return Math.max(20, 100 - ((optMin - val) / (r || 1)) * 80); }
  if (val > optMax) { const r = (hardMax || optMax * 2) - optMax; return Math.max(20, 100 - ((val - optMax) / (r || 1)) * 80); }
  return 72;
}

function trendBonus(arr, idx) {
  const vals = [];
  for (let i = idx; i >= 0 && vals.length < 3; i--) {
    if (arr[i] !== null && arr[i] !== undefined) vals.unshift(arr[i]);
  }
  if (vals.length < 2) return 0;
  const first = vals[0], last = vals[vals.length - 1];
  const pctChange = ((last - first) / (first || 1)) * 100;
  return Math.max(-10, Math.min(10, -pctChange * 0.3));
}

function persistencePenalty(arr, idx, refMin, refMax) {
  let count = 0;
  for (let i = idx; i >= 0; i--) {
    if (arr[i] === null || arr[i] === undefined) continue;
    const oor = (refMin != null && arr[i] < refMin) || (refMax != null && arr[i] > refMax);
    if (oor) count++; else break;
  }
  return Math.min(15, Math.max(0, (count - 1) * 4));
}

export function markerScore(series, idx, cfg) {
  let val = null;
  for (let i = idx; i >= 0; i--) { if (series[i] !== null && series[i] !== undefined) { val = series[i]; break; } }
  if (val === null) return null;
  const base = paramScore(val, cfg.optMin, cfg.optMax, cfg.hardMin, cfg.hardMax);
  const trend = trendBonus(series, idx) * (cfg.invertTrend ? -1 : 1);
  const persist = persistencePenalty(series, idx, cfg.refMin, cfg.refMax);
  return Math.max(0, Math.min(100, Math.round(base * 0.60 + (base + trend) * 0.25 + (base - persist) * 0.15)));
}

export function fullScore(markers, idx) {
  let totalW = 0, totalS = 0;
  for (const m of markers) {
    if (!m.scoring) continue;
    const s = markerScore(m.series, idx, m.scoring);
    if (s !== null) { totalW += m.scoring.weight; totalS += s * m.scoring.weight; }
  }
  return totalW > 0 ? Math.round(totalS / totalW) : null;
}

export function scoreSeries(markers, nReports) {
  return Array.from({ length: nReports }, (_, i) => fullScore(markers, i));
}

export function breakdownScores(markers, breakdown, idx) {
  const byId = Object.fromEntries(markers.map(m => [m.id, m]));
  return breakdown.map(cat => {
    const scores = cat.markers
      .map(id => byId[id] && byId[id].scoring ? markerScore(byId[id].series, idx, byId[id].scoring) : null)
      .filter(s => s !== null);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : cat.fallback;
    return { name: cat.name, score };
  });
}