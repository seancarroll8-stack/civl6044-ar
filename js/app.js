// CIVL6044 AR Prototype 1.1 - application controller.
// Three views share one state: AR camera (3D model on the printed sheet),
// 3D model (no camera, virtual sheet) and 2D sheet (flat drawing, no 3D libraries).
import { G } from "./geometry.js";
import { solve, snapLoad, fmt } from "./beam.js";
import { createOverlayCanvas, drawOverlay, inDragBand, mOf } from "./overlay.js";

const P = G.problem;
const params = new URLSearchParams(location.search);
const TARGET_SRC = "assets/targets.mind";
const SHEET_SRC = "assets/target.png";
const SIZES = [1, 1.5, 2];

const state = {
  a: P.a0,
  layers: { reactions: true, sfd: false, bmd: false },
  beam: "original",                 // original | deflected | both
  standUp: false,
  size: 1,
  mode: null,                       // ar | 3d | 2d
  dragging: false,
  frozen: false,
  tracking: false,
  debug: params.get("debug") === "1",
};

const $ = (id) => document.getElementById(id);
const el = {
  start: $("start"), stage: $("stage"), arBox: $("ar-container"), box3d: $("view3d-container"), c2d: $("view2d"),
  hint: $("hint"), status: $("status"), deflNote: $("defl-note"),
  a: $("v-a"), ra: $("v-ra"), rb: $("v-rb"), m: $("v-m"),
  slider: $("load"), sliderOut: $("load-out"), reset: $("btn-reset"),
  all: $("btn-all"), stand: $("btn-stand"), size: $("btn-size"), freeze: $("btn-freeze"),
  msg: $("message"), msgTitle: $("msg-title"), msgText: $("msg-text"), msgPrimary: $("msg-primary"), msgSecondary: $("msg-secondary"),
  views: document.querySelectorAll("[data-view]"), beams: document.querySelectorAll("[data-beam]"), layers: document.querySelectorAll("[data-layer]"),
};

const overlay = createOverlayCanvas();
const sheetImg = new Image();
sheetImg.src = SHEET_SRC;
let sol = solve(P.L, P.P, state.a);
let fig = null;          // shared 3D figure (created the first time a 3D view opens)
let view = null;         // active AR or 3D-model session
let view2d = null;       // 2D layout
let lostAt = -Infinity;
let dragId = null;

// ------------------------------------------------------------------ rendering
let pending = false;
function render() {
  if (fig) fig.setState({ sol, layers: state.layers, beam: state.beam, standUp: state.standUp, size: state.size, dragging: state.dragging });
  if (view && view.frame) view.frame(state.standUp, state.size);
  if (state.mode !== "2d" || pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawOverlay(overlay, { sol, a0: P.a0, layers: state.layers, beam: state.beam, debug: state.debug, dragging: state.dragging });
    draw2d();
  });
}

function updateReadouts() {
  el.a.textContent = fmt.m(sol.a);
  el.ra.textContent = fmt.kN(sol.RA);
  el.rb.textContent = fmt.kN(sol.RB);
  el.m.textContent = fmt.kNm(sol.Mmax);
  el.slider.value = sol.a.toFixed(1);
  el.sliderOut.textContent = `${sol.a.toFixed(1)} m`;
  el.slider.setAttribute("aria-valuetext", `${sol.a.toFixed(1)} metres from A`);
  el.reset.disabled = Math.abs(sol.a - P.a0) < 1e-9;
}

function setLoad(a) {
  const s = snapLoad(a, P);
  if (Math.abs(s - state.a) < 1e-9) return;
  state.a = s;
  sol = solve(P.L, P.P, s);
  updateReadouts();
  render();
}

const allOn = () => Object.values(state.layers).every(Boolean) && state.beam === "both";

function syncControls() {
  el.layers.forEach((b) => b.setAttribute("aria-pressed", String(state.layers[b.dataset.layer])));
  el.beams.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.beam === state.beam)));
  el.views.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.mode)));
  el.all.setAttribute("aria-pressed", String(allOn()));
  el.all.querySelector("span").textContent = allOn() ? "Hide all" : "Show all";
  el.stand.textContent = state.standUp ? "Lay flat" : "Stand up";
  el.stand.setAttribute("aria-pressed", String(state.standUp));
  el.size.textContent = `Size ${state.size}\u00D7`;
  el.freeze.textContent = state.frozen ? "Resume" : "Freeze";
  el.freeze.setAttribute("aria-pressed", String(state.frozen));
  el.deflNote.hidden = state.beam === "original";
}

function setStatus() {
  let t = "";
  if (state.mode === "2d") t = "Drag the red handle or use the slider to move the load.";
  else if (state.mode === "3d") t = "Drag the red handle to move the load. Drag anywhere else to turn the model.";
  else if (state.mode === "ar") {
    if (state.frozen) t = "View frozen. Drag the load, then tap Resume.";
    else if (!state.tracking) t = "Point the camera at the whole problem sheet.";
    else t = "Drag the red handle, or use the slider. Freeze makes dragging easier.";
  }
  el.status.textContent = t;
  el.hint.hidden = !(state.mode === "ar" && !state.tracking && !state.frozen);
}

// ------------------------------------------------------------------ 2D view
function layout2d() {
  const W = el.stage.clientWidth, H = el.stage.clientHeight;
  if (!W || !H) return;
  const v = G.view2d, wmm = v.x1 - v.x0;
  let scale = W / wmm;
  let yTop = Math.min(Math.max(10, v.y1 - H / scale), v.y0);   // show as much of the question as fits
  if ((v.y1 - yTop) * scale > H) scale = H / (v.y1 - yTop);
  const cssW = wmm * scale, cssH = (v.y1 - yTop) * scale;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  el.c2d.width = Math.round(cssW * dpr); el.c2d.height = Math.round(cssH * dpr);
  el.c2d.style.width = `${cssW}px`; el.c2d.style.height = `${cssH}px`;
  view2d = { scale, x0: v.x0, y0: yTop, dpr };
}

function draw2d() {
  if (!view2d) layout2d();
  if (!view2d) return;
  const { scale, x0, y0, dpr } = view2d;
  const ctx = el.c2d.getContext("2d");
  const k = scale * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, el.c2d.width, el.c2d.height);
  ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  ctx.imageSmoothingQuality = "high";
  if (sheetImg.complete && sheetImg.naturalWidth) ctx.drawImage(sheetImg, 0, 0, G.pageW, G.targetH);
  ctx.drawImage(overlay, 0, G.overlay.y0, G.pageW, G.overlay.y1 - G.overlay.y0);
}

// ------------------------------------------------------------------ dragging the load (all views)
// Returns page millimetres { xmm, ymm } or null. bounded = only the load band counts.
function toSheet(ev, bounded) {
  if (state.mode === "2d" && view2d) {
    const r = el.c2d.getBoundingClientRect();
    const xmm = view2d.x0 + (ev.clientX - r.left) / view2d.scale, ymm = view2d.y0 + (ev.clientY - r.top) / view2d.scale;
    return bounded && !inDragBand(ymm) ? null : { xmm, ymm };
  }
  if (view) return view.toSheet(ev.clientX, ev.clientY, bounded);
  return null;
}
// Capture phase, so a drag on the load wins over turning the 3D model.
el.stage.addEventListener("pointerdown", (ev) => {
  if (state.dragging) return;
  const p = toSheet(ev, true);
  if (!p) return;
  ev.stopPropagation(); ev.preventDefault();
  state.dragging = true; dragId = ev.pointerId;
  el.stage.setPointerCapture(ev.pointerId);
  setLoad(mOf(p.xmm));
  render();
}, { capture: true });
el.stage.addEventListener("pointermove", (ev) => {
  if (!state.dragging || ev.pointerId !== dragId) return;
  ev.stopPropagation();
  const p = toSheet(ev, false);
  if (p) setLoad(mOf(p.xmm));
}, { capture: true });
const endDrag = (ev) => {
  if (!state.dragging || ev.pointerId !== dragId) return;
  state.dragging = false; dragId = null;
  render();
};
el.stage.addEventListener("pointerup", endDrag, { capture: true });
el.stage.addEventListener("pointercancel", endDrag, { capture: true });

// ------------------------------------------------------------------ controls
el.slider.min = P.aMin; el.slider.max = P.aMax; el.slider.step = P.step;
el.slider.addEventListener("input", () => setLoad(parseFloat(el.slider.value)));
el.reset.addEventListener("click", () => setLoad(P.a0));

el.layers.forEach((b) => b.addEventListener("click", () => {
  state.layers[b.dataset.layer] = !state.layers[b.dataset.layer];
  syncControls(); render();
}));
el.beams.forEach((b) => b.addEventListener("click", () => {
  state.beam = b.dataset.beam;
  syncControls(); render();
}));
el.all.addEventListener("click", () => {
  const on = !allOn();
  for (const k of Object.keys(state.layers)) state.layers[k] = on;
  state.beam = on ? "both" : "original";
  syncControls(); render();
});
el.stand.addEventListener("click", () => { state.standUp = !state.standUp; syncControls(); render(); });
el.size.addEventListener("click", () => {
  state.size = SIZES[(SIZES.indexOf(state.size) + 1) % SIZES.length];
  syncControls(); render();
});
el.freeze.addEventListener("click", () => {
  if (!view || !view.setFrozen) return;
  state.frozen = !state.frozen;
  view.setFrozen(state.frozen);
  syncControls(); setStatus();
});
el.views.forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.view === state.mode) return;
  ({ ar: enterAR, "3d": enter3d, "2d": enter2d })[b.dataset.view]();
}));

// ------------------------------------------------------------------ views
async function stopView() {
  if (view) { const v = view; view = null; await v.stop(); }
  state.frozen = false; state.tracking = false;
}

function showMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  el.start.hidden = true;
  el.arBox.hidden = mode !== "ar";
  el.box3d.hidden = mode !== "3d";
  el.c2d.hidden = mode !== "2d";
  document.querySelectorAll(".only3d").forEach((e) => { e.hidden = mode === "2d"; });
  el.freeze.hidden = mode !== "ar";
  syncControls(); setStatus();
}

async function load3D() {
  if (!fig) {
    const { createFigure3D } = await import("./figure3d.js");
    fig = createFigure3D();
  }
  return fig;
}

async function enter2d() {
  await stopView();
  showMode("2d");
  layout2d(); render();
}

async function enter3d() {
  await stopView();
  showMode("3d");
  el.status.textContent = "Loading the 3D model\u2026";
  try {
    const f = await load3D();
    const { start3DView } = await import("./view3d.js");
    view = start3DView({ container: el.box3d, fig: f, sheetSrc: SHEET_SRC });
    render(); f.playEntrance(); setStatus();
  } catch (err) {
    console.error(err);
    el.box3d.replaceChildren(); view = null;
    await enter2d();
    showMessage("The 3D model could not load",
      "Check your internet connection, then try again. The 2D sheet shows the same results.",
      { primary: "Try again", onPrimary: enter3d });
  }
}

async function enterAR() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return showMessage("Camera not available",
      "This browser cannot open the camera from this page. Open the link in Chrome (Android) or Safari (iPhone), or use the 3D model.",
      { primary: "Open 3D model", onPrimary: enter3d });
  }
  try {
    const head = await fetch(TARGET_SRC, { method: "HEAD", cache: "no-store" });
    if (!head.ok) throw new Error("missing");
  } catch {
    return showMessage("AR target not set up yet",
      "The file assets/targets.mind is missing from the website. Compile assets/target.png with the MindAR target compiler and upload the result (see the README). The 3D model works in the meantime.",
      { primary: "Open 3D model", onPrimary: enter3d });
  }

  await stopView();
  showMode("ar");
  el.hint.textContent = "Starting camera\u2026"; el.hint.hidden = false;
  el.status.textContent = "Allow camera access when your browser asks.";
  try {
    const f = await load3D();
    const { startAR } = await import("./ar.js");
    view = await startAR({
      container: el.arBox, targetSrc: TARGET_SRC, fig: f,
      onFound: () => { if (performance.now() - lostAt > 1500) f.playEntrance(); state.tracking = true; setStatus(); },
      onLost: () => { lostAt = performance.now(); state.tracking = false; setStatus(); },
    });
    el.hint.textContent = "Point the camera at the whole problem sheet";
    render(); setStatus();
  } catch (err) {
    console.error(err);
    el.arBox.replaceChildren(); view = null;
    await enter2d();
    showMessage("The camera could not start",
      "Check that camera access is allowed for this site in your browser settings, then try again. The 3D model and 2D sheet work without the camera.",
      { primary: "Try again", onPrimary: enterAR });
  }
}

function showMessage(title, text, { primary = "Use 2D sheet", onPrimary = enter2d } = {}) {
  el.msgTitle.textContent = title; el.msgText.textContent = text;
  el.msgPrimary.textContent = primary;
  el.msgPrimary.onclick = () => { el.msg.close(); onPrimary(); };
  el.msgSecondary.onclick = () => el.msg.close();
  el.msg.showModal();
}

$("go-ar").addEventListener("click", enterAR);
$("go-3d").addEventListener("click", enter3d);
$("go-2d").addEventListener("click", enter2d);

new ResizeObserver(() => { if (state.mode === "2d") { layout2d(); render(); } }).observe(el.stage);
sheetImg.addEventListener("load", () => render());
document.fonts?.ready.then(() => { if (fig) fig.refreshLabels(); render(); });

// ------------------------------------------------------------------ boot
updateReadouts(); syncControls();
const startMode = params.get("mode");
if (startMode === "2d") enter2d();
else if (startMode === "3d") enter3d();
