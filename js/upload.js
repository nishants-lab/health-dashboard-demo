import { parsePDF } from "./parser.js";
import { loadModel, model, setModel, mergeReport, labelForISO, latest } from "./data.js";
import { renderDashboard } from "./render.js";

const $ = sel => document.querySelector(sel);
let parsed = null;

export function initUpload() {
  const dz = $("#dropzone");
  const input = $("#file-input");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => {
    e.preventDefault(); dz.classList.remove("drag");
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") handleFile(f);
    else toast("Please drop a PDF file");
  });
  dz.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  $("#btn-save").addEventListener("click", saveParsed);
  $("#btn-export").addEventListener("click", exportJSON);
  $("#btn-clear").addEventListener("click", () => { parsed = null; $("#review").hidden = true; });

  $("#load-sample").addEventListener("click", async () => {
    try {
      const response=await fetch("samples/synthetic-lab-report.pdf");
      if(!response.ok) throw new Error("Sample PDF unavailable");
      await handleFile(new File([await response.blob()],"synthetic-lab-report.pdf",{type:"application/pdf"}));
    } catch(err) { toast(err.message); }
  });
}

async function handleFile(file) {
  $("#parse-status").hidden = false;
  $("#review").hidden = true;
  $("#parse-status").textContent = "Reading " + file.name + " ...";
  try {
    parsed = await parsePDF(file);
    $("#parse-status").hidden = true;
    renderReview();
  } catch (err) {
    $("#parse-status").textContent = "Could not parse this PDF: " + err.message;
  }
}

function renderReview() {
  const m = model();
  $("#review").hidden = false;
  $("#rv-lab").textContent = parsed.lab;
  $("#rv-file").textContent = parsed.fileName;
  $("#rv-date").value = parsed.date || "";

  const found = Object.keys(parsed.values).length;
  $("#rv-count").textContent = found + " of " + m.markers.length + " tracked markers";

  const rows = m.markers.map(mk => {
    const hit = parsed.values[mk.id];
    const conf = hit ? hit.confidence : null;
    const confBadge = !hit
      ? `<span class="conf conf-miss">not found</span>`
      : conf === "high"
        ? `<span class="conf conf-high">high</span>`
        : `<span class="conf conf-low">${conf}, check</span>`;
    const prev = latest(mk.series);
    const suspicious = hit && prev.value !== null && Math.abs(hit.value - prev.value) / (prev.value || 1) > 0.5;
    return `<tr>
      <td>${mk.name} <span style="color:var(--text-3)">${mk.unit}</span></td>
      <td><input type="number" step="any" inputmode="decimal" data-marker="${mk.id}"
        value="${hit ? hit.value : ""}" class="${suspicious ? "suspect" : ""}"
        aria-label="${mk.name} value"></td>
      <td>${confBadge}${suspicious ? ` <span class="conf conf-low">big jump vs last</span>` : ""}</td>
      <td style="color:var(--text-3)">${prev.value ?? "n/a"}</td>
    </tr>`;
  }).join("");
  $("#rv-tbody").innerHTML = rows;
}

function reviewedReport() {
  if (!parsed) return null;
  const date = $("#rv-date").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Set a valid report date first"); return null; }
  const values = {};
  document.querySelectorAll("#rv-tbody input[data-marker]").forEach(inp => {
    if (inp.value.trim() !== "" && Number.isFinite(Number(inp.value))) values[inp.dataset.marker] = Number(inp.value);
  });
  if (!Object.keys(values).length) { toast("No values to save"); return null; }
  return {id:date,label:labelForISO(date),values};
}
function saveParsed() {
  const report=reviewedReport();
  if (!report) return;
  setModel(mergeReport(model(),report));
  renderDashboard();
  parsed=null;
  $("#review").hidden=true;
  toast("Added to this page session. Reset or refresh to clear.");
}
function exportJSON() {
  const report=reviewedReport();
  if (!report) return;
  const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=report.id+"_reviewed.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

let toastTimer = null;
export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
