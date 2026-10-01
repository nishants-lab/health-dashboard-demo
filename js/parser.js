// parser.js, positional PDF lab-report parser.
// v1 flattened the whole PDF into one string and grabbed the first number
// within 400 chars of a marker name, which routinely captured reference-range
// bounds or unrelated columns. v2 reconstructs table ROWS from PDF.js text
// coordinates and only reads numbers from the matched row (or its direct
// continuation line), which is how lab tables are actually laid out:
// [Test name] [Result] [Unit] [Reference interval].

const MARKERS = [
  { id: "tsh",        names: ["Thyroid Stimulating Hormone", "TSH"] },
  { id: "ft3",        names: ["Free T3", "FT3", "Free Triiodothyronine"] },
  { id: "ft4",        names: ["Free T4", "FT4", "Free Thyroxine"] },
  { id: "tt3",        names: ["T3.{0,3}Total", "Total T3", "Triiodothyronine"], exclude: ["Free", "FT3", "Uptake", "Interpretation"] },
  { id: "tt4",        names: ["T4.{0,3}Total", "Total T4", "Thyroxine"], exclude: ["Free", "FT4", "Interpretation"] },
  { id: "tc",         names: ["Cholesterol.{0,4}Total", "Total Cholesterol"], exclude: ["HDL", "Ratio"] },
  { id: "hdl",        names: ["HDL Cholesterol", "Cholesterol.{0,4}HDL", "High.?Density Lipoprotein"], exclude: ["Ratio", "Non"] },
  { id: "ldl",        names: ["LDL Cholesterol", "Cholesterol.{0,4}\\bLDL\\b", "Low.?Density Lipoprotein"], exclude: ["Ratio", "VLDL"] },
  { id: "tg",         names: ["Triglycerides"] },
  { id: "vldl",       names: ["VLDL", "Very Low.?Density"] },
  { id: "cholratio",  names: ["Cholesterol.{0,30}HDL.{0,20}?(\\d+(?:\\.\\d+)?)\\s*Ratio", "CHOL\\s*/\\s*HDL", "CHO/HDL RATIO", "TC/ ?HDL"], exclude: ["LDL\\s*/\\s*HDL", "HDL\\s*/\\s*LDL"] },
  { id: "vitd",       names: ["Vitamin D.{0,10}25", "\\bVitamin D\\b", "25.?OH Vitamin D", "25.?Hydroxy"] },
  { id: "vitb12",     names: ["Vitamin B.?12", "Cyanocobalamin"] },
  { id: "hba1c",      names: ["HbA1c", "Glycated H(a?)emoglobin"], exclude: ["Mean", "Average"] },
  { id: "glucose",    names: ["Glucose.{0,10}Fasting", "Fasting.{0,10}Glucose", "Fasting Blood Sugar", "\\bFBS\\b"], exclude: ["Random", "RBS", "Urine", "Post", "\\bPP\\b", "2 hr", "average", "eAG", "tolerance"] },
  { id: "hb",         names: ["H(a?)emoglobin"], exclude: ["Glycated", "Mean Corp", "MCHC", "MCH", "HbA1c", "A1c"] },
  { id: "platelets",  names: ["Platelet Count"] },
  { id: "wbc",        names: ["Total Leu(k|c)ocyte Count", "Total White Blood Cell", "WBC Count", "\\bTotal Count\\b"], exclude: ["Platelet", "RBC", "Red Blood", "Differential", "Absolute"] },
  { id: "esr",        names: ["Erythrocyte Sedimentation Rate", "ESR"] },
  { id: "ast",        names: ["Aspartate (Amino)?[Tt]ransferase", "SGOT"], exclude: ["Ratio", "SGOT/SGPT", "AST/ALT", "ALT \\(SG"] },
  { id: "alt",        names: ["Alanine (Amino)?[Tt]ransferase", "Alanine Transaminase", "SGPT"], exclude: ["Ratio", "SGOT/SGPT", "AST/ALT"] },
  { id: "bilirubin",  names: ["Bilirubin.{0,4}Total", "Total Bilirubin"], exclude: ["Direct", "Indirect"] },
  { id: "albumin",    names: ["Albumin"], exclude: ["Globulin", "Microalbumin", "Ratio", "A/G", "Creatinine"] },
  { id: "creatinine", names: ["Creatinine"], exclude: ["Ratio", "eGFR", "Urine", "Albumin"] },
  { id: "uricacid",   names: ["Uric Acid"] },
  { id: "egfr",       names: ["eGFR", "Estimated Glomerular"] },
  { id: "urea",       names: ["\\bUrea\\b"], exclude: ["BUN", "Nitrogen", "Ratio"] },
  { id: "sodium",     names: ["Sodium"], exclude: ["Urine"] },
  { id: "potassium",  names: ["Potassium"], exclude: ["Urine"] },
];

const SANE = {
  tsh: [0.01, 100], ft3: [0.5, 10], ft4: [0.1, 5], tt3: [0.3, 4], tt4: [2, 20], tc: [80, 400], hdl: [10, 120],
  ldl: [30, 300], tg: [30, 1000], vldl: [5, 100], cholratio: [1, 15], vitd: [3, 150],
  vitb12: [50, 2000], hba1c: [3, 15], glucose: [40, 500], hb: [5, 22], platelets: [50, 800],
  wbc: [1, 30], esr: [0, 100], ast: [5, 500], alt: [5, 500], bilirubin: [0.05, 15],
  albumin: [1, 7], creatinine: [0.2, 10], uricacid: [1, 15], egfr: [10, 150],
  urea: [5, 150], sodium: [110, 170], potassium: [2, 7],
};

// Only explicitly supported source units are accepted; never infer units from magnitude.
const UNITS = {
 tsh:{"uiu/ml":1,"miu/l":1},ft3:{"pg/ml":1},ft4:{"ng/dl":1},tt3:{"ng/ml":1,"ng/dl":0.01},tt4:{"ug/dl":1},
 tc:{"mg/dl":1},hdl:{"mg/dl":1},ldl:{"mg/dl":1},tg:{"mg/dl":1},vldl:{"mg/dl":1},cholratio:{ratio:1},
 vitd:{"ng/ml":1},vitb12:{"pg/ml":1},hba1c:{"%":1},glucose:{"mg/dl":1},hb:{"g/dl":1},
 platelets:{"10^3/ul":1,"cells/ul":0.001,"cells/cumm":0.001,"lakhs/cumm":100},
 wbc:{"10^3/ul":1,"cells/ul":0.001,"cells/cumm":0.001},esr:{"mm/hr":1,"mm/h":1},ast:{"u/l":1},alt:{"u/l":1},
 bilirubin:{"mg/dl":1},albumin:{"g/dl":1},creatinine:{"mg/dl":1},uricacid:{"mg/dl":1},egfr:{"ml/min/1.73m2":1},
 urea:{"mg/dl":1},sodium:{"mmol/l":1},potassium:{"mmol/l":1}
};
function normalize(id,v,unit) {
 const factor=UNITS[id]?.[unit];
 return factor === undefined ? NaN : v*factor;
}

function sane(id, v) {
  const r = SANE[id];
  return !r || (v >= r[0] && v <= r[1]);
}

async function extractRows(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const rows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // bucket items by rounded y (PDF user units); tolerance via 2-unit buckets
    const buckets = new Map();
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4];
      let key = null;
      for (const k of buckets.keys()) if (Math.abs(k - y) <= 2.5) { key = k; break; }
      if (key === null) { key = y; buckets.set(key, []); }
      buckets.get(key).push({ x, str: it.str });
    }
    const pageRows = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, items]) => {
        items.sort((a, b) => a.x - b.x);
        return { page: p, y, text: items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim() };
      });
    rows.push(...pageRows);
  }
  return rows;
}

// A real lab RESULT is a number immediately followed by a unit token.
// Reference ranges, thresholds and prose digits are NOT, this is what
// separates a true value from a hallucinated one. We refuse to guess.
function unitAfter(text,endIdx) {
 return text.slice(endIdx).trim().replace(/^(high|low|normal|h|l)\s+/i,"").split(/\s+/)[0]
   .toLowerCase().replace(/[µμ]/g,"u").replace(/³/g,"^3").replace(/²/g,"2").replace(/^×/,"");
}

// Range qualifier immediately before the number => it is a range bound, not a result.
const QUAL_BEFORE = /(?:[<>\u2264\u2265]|normal|optimal|desirable|insufficient|sufficient|borderline|deficient|to|near|range|reference|risk|between|upto|up\s*to)\s*[:=]?\s*$/i;

// Number is the start of a range ("70 to 100", "150-410", "20 - 30").
function isRangeStart(text, endIdx) {
  const after = text.slice(endIdx, endIdx + 8);
  return /^\s*(?:[-\u2013\u2014]\s*\d|to\s+\d)/i.test(after);
}

// Collect number candidates that look like genuine results (value + unit,
// not preceded by a range qualifier, not the start of a range).
function resultCandidates(text, fromIdx, id, maxStartIdx) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)/g;
  re.lastIndex = fromIdx;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index;
    if (maxStartIdx != null && idx - fromIdx > maxStartIdx) break;
    const endIdx = idx + m[0].length;
    const value = parseFloat(m[1].replace(",", ""));
    if (isNaN(value)) continue;
    const before = text.slice(0, idx);
    if (QUAL_BEFORE.test(before)) continue;      // reference bound
    if (isRangeStart(text, endIdx)) continue;    // start of a range
    if (!unitAfter(text, endIdx)) continue;      // no unit => not a result
    const norm = normalize(id, value, unitAfter(text, endIdx));
    if (!sane(id, norm)) continue;
    out.push({ value, norm, index: idx });
    if (out.length >= 4) break;
  }
  return out;
}

function findMarker(rows, marker) {
  for (const namePat of marker.names) {
    let re;
    try { re = new RegExp(namePat, "i"); } catch { continue; }
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const m = row.text.match(re);
      if (!m) continue;
      if (marker.exclude && marker.exclude.some(ex => {
        try { return new RegExp(ex, "i").test(row.text); } catch { return row.text.toLowerCase().includes(ex.toLowerCase()); }
      })) continue;

      // pattern embeds the value in a capture group (used when the marker
      // name and value are not adjacent, e.g. "Cholesterol ... HDL <val> Ratio")
      if (m[1] !== undefined && /\d/.test(m[1])) {
        const v = parseFloat(m[1].replace(",", ""));
        const norm = normalize(marker.id, v, "unsupported");
        if (!isNaN(v) && sane(marker.id, norm)) return { value: norm, confidence: "medium", row: row.text };
        continue;
      }

      // genuine result candidates in the same row, after the name
      const after = m.index + m[0].length;
      const cands = resultCandidates(row.text, after, marker.id, null);
      if (cands.length) {
        return { value: cands[0].norm, confidence: cands.length === 1 ? "high" : "medium", row: row.text };
      }
      // result may sit on the next 1-2 visual lines (name wrapped across rows).
      // For the row two lines down, the value must sit at the very start of the
      // row (idx<=3) and the intervening row must be a pure name continuation
      // (no digits) so we never skip into an unrelated test's row.
      for (let k = 1; k <= 2 && r + k < rows.length; k++) {
        const maxStart = k === 1 ? 60 : 3;
        const nc = resultCandidates(rows[r + k].text, 0, marker.id, maxStart);
        if (nc.length) return { value: nc[0].norm, confidence: "low", row: rows[r + k].text };
        if (/\d/.test(rows[r + k].text)) break;
      }
    }
  }
  return null;
}

function detectDate(rows) {
  const text = rows.map(r => r.text).join("\n");
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const pats = [
    /(?:Collection|Collected|Sample Collected|Received)[^\n]{0,60}?(\d{1,2})[\/\- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\- ,](\d{2,4})/i,
    /(?:Collection|Collected|Sample Collected|Received)[^\n]{0,60}?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /(\d{1,2})[\/\- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\- ,](\d{2,4})/i,
    /(\d{2})\/(\d{2})\/(\d{4})/,
  ];
  for (const pat of pats) {
    const m = text.match(pat);
    if (!m) continue;
    const day = parseInt(m[1], 10);
    let mon, year = parseInt(m[3], 10);
    if (isNaN(parseInt(m[2], 10))) mon = months[m[2].toLowerCase().slice(0, 3)];
    else mon = parseInt(m[2], 10) - 1;
    if (year < 100) year += 2000;
    if (mon === undefined || isNaN(day) || isNaN(year) || day > 31) continue;
    const d = new Date(Date.UTC(year, mon, day));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function detectLab(rows) {
  const t = rows.map(r => r.text).join(" ").toLowerCase();
  if (t.includes("synthetic lab report")) return "Demo Lab (synthetic)";
  if (t.includes("orange health") || t.includes("orchard healthcare")) return "Orange Health";
  if (t.includes("tata 1mg") || t.includes("1mg bangalore") || t.includes("mgb ")) return "Tata 1mg";
  if (t.includes("thyrocare")) return "Thyrocare";
  if (t.includes("healthians")) return "Healthians";
  if (t.includes("sparsh hospital")) return "Sparsh Hospital";
  if (t.includes("metropolis")) return "Metropolis";
  if (t.includes("dr lal") || t.includes("dr. lal")) return "Dr Lal PathLabs";
  return "Unknown lab";
}

export async function parsePDF(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("PDF engine not loaded yet, retry in a second");
  const rows = await extractRows(file);
  const values = {};
  for (const marker of MARKERS) {
    const hit = findMarker(rows, marker);
    if (hit) values[marker.id] = { value: hit.value, confidence: hit.confidence };
  }
  return {
    date: detectDate(rows),
    lab: detectLab(rows),
    values,
    fileName: file.name,
    parsedAt: new Date().toISOString(),
  };
}

export { MARKERS, SANE, extractRows, findMarker };