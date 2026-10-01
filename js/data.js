// Demo state is held in memory. No remote writes or health-data persistence.
let _model = null;

export async function loadModel() {
  // cache-bust so a freshly committed report shows up on reload
  const res = await fetch("data/baseline.json?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load baseline data (" + res.status + ")");
  const base = await res.json();
  return setModel(base);
}

// Build the working model (with per-marker `series`) from a raw baseline object.
export function setModel(base) {
  const reports = [...base.reports].sort((a, b) => a.id.localeCompare(b.id));
  const markers = base.markers.map(m => {
    const series = reports.map(r => {
      const bi = base.reports.findIndex(br => br.id === r.id);
      return bi >= 0 ? (m.data[bi] ?? null) : null;
    });
    return { ...m, series };
  });
  _model = { ...base, reports, markers };
  return _model;
}

export function model() { return _model; }

// Merge a new report (id ISO date, label, values{markerId:number}) into a raw
// baseline object, returning a NEW baseline object (does not mutate input).
export function mergeReport(base, report) {
  const b = JSON.parse(JSON.stringify(base));
  // snapshot current values keyed by report id, per marker
  const snap = {};
  b.markers.forEach(m => {
    snap[m.id] = {};
    b.reports.forEach((r, i) => { snap[m.id][r.id] = m.data[i] ?? null; });
  });
  // apply the uploaded values for this report id
  b.markers.forEach(m => {
    const v = report.values[m.id];
    if (v !== undefined && v !== null && !isNaN(v)) snap[m.id][report.id] = Number(v);
    else if (!(report.id in snap[m.id])) snap[m.id][report.id] = null;
  });
  // upsert the report and keep the list chronological
  const ex = b.reports.findIndex(r => r.id === report.id);
  const entry = { id: report.id, label: report.label, source: "upload" };
  if (ex >= 0) b.reports[ex] = entry; else b.reports.push(entry);
  b.reports.sort((a, c) => a.id.localeCompare(c.id));
  // rebuild every marker's data array in the sorted report order
  b.markers.forEach(m => { m.data = b.reports.map(r => snap[m.id][r.id] ?? null); });
  if (b.notes) b.notes.lastReport = `${report.label} (Report #${b.reports.length})`;
  return b;
}

export function labelForISO(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function latest(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null && series[i] !== undefined) return { value: series[i], index: i };
  }
  return { value: null, index: -1 };
}

export function previous(series, beforeIdx) {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (series[i] !== null && series[i] !== undefined) return { value: series[i], index: i };
  }
  return { value: null, index: -1 };
}

export function inRange(v, ref) {
  if (v === null || v === undefined) return null;
  if (ref.min !== null && ref.min !== undefined && v < ref.min) return false;
  if (ref.max !== null && ref.max !== undefined && v > ref.max) return false;
  return true;
}
