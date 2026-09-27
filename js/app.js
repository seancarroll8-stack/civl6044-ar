// CIVL6044 AR Prototype 1 - application controller.
import { G } from "./geometry.js";
import { solve, snapLoad, fmt } from "./beam.js";
import { createOverlayCanvas, drawOverlay, inDragBand, mOf } from "./overlay.js";

const P = G.problem;
const params = new URLSearchParams(location.search);
const TARGET_SRC = "assets/targets.mind";

const state = {
  a: P.a0,
  layers: { reactions: true, sfd: false, bmd: false, defl: false },
  mode: null,            // "ar" | "2d"
  dragging: false,
  frozen: false,
  tracking: false,
  debug: params.get("debug") === "1",
};

const $ = (id) => document.getElementById(id);
const el = {
  start: $("start"), stage: $("stage"), arBox: $("ar-container"), c2d: $("view2d"),
  hint: $("hint"), status: $("status"), deflNote: $("defl-note"),
  a: $("v-a"), ra: $("v-ra"), rb: $("v-rb"), m: $("v-m"),
  slider: $("load"), sliderOut: $("load-out"),
  all: $("btn-all"), reset: $("btn-reset"), freeze: $("btn-freeze"), mode: $("btn-mode"),
  msg: $("message"), msgTitle: $("msg-title"), msgText: $("msg-text"), msgPrimary: $("msg-primary"), msgSecondary: $("msg-secondary"),
};

const overlay = createOverlayCanvas();
const sheetImg = new Image();
sheetImg.src = "assets/target.png";
let ar = null;             // AR session handle
let view2d = null;         // 2D view geometry {scale, x0, y0}
let sol = solve(P.L, P.P, state.a);

// ------------------------------------------------------------------ rendering
let pending = false;
function render() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawOverlay(overlay, { sol, a0: P.a0, layers: state.layers, debug: state.debug, dragging: state.dragging });
    if (state.mode === "ar" && ar) ar.refresh();
    if (state.mode === "2d") draw2d();
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
  if (Math.abs(s - state.a) < 1e-9 && sol) return;
  state.a = s;
  sol = solve(P.L, P.P, s);
  updateReadouts();
  render();
}

function syncLayerButtons() {
  document.querySelectorAll("[data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(state.layers[b.dataset.layer])));
  const allOn = Object.values(state.layers).every(Boolean);
  el.all.textContent = allOn ? "Hide all" : "Show all";
  el.deflNote.hidden = !state.layers.defl;
}

function setStatus() {
  let t;
  if (state.mode === "2d") t = "Drag the red handle or use the slider to move the load.";
  else if (state.frozen) t = "View frozen. Drag the load, then tap Resume tracking.";
  else if (!state.tracking) t = "Point the camera at the whole problem sheet.";
  else t = "Drag the red handle on the sheet. Freeze the view to drag more easily.";
  el.status.textContent = t;
  el.hint.hidden = !(state.mode === "ar" && !state.tracking && !state.frozen);
}

// ------------------------------------------------------------------ 2D view
function layout2d() {
  const W = el.stage.clientWidth, H = el.stage.clientHeight;
  const v = G.view2d;
  const wmm = v.x1 - v.x0;
  let scale = W / wmm;
  // Show as much of the question above the figure as the screen allows.
  let yTop = Math.max(10, v.y1 - H / scale);
  yTop = Math.min(yTop, v.y0);
  if ((v.y1 - yTop) * scale > H) scale = H / (v.y1 - yTop);
  const cssW = wmm * scale, cssH = (v.y1 - yTop) * scale;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  el.c2d.width = Math.round(cssW * dpr); el.c2d.height = Math.round(cssH * dpr);
  el.c2d.style.width = `${cssW}px`; el.c2d.style.height = `${cssH}px`;
  view2d = { scale, x0: v.x0, y0: yTop, dpr };
}

function draw2d() {
  if (!view2d) layout2d();
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

function sheetPoint2d(ev) {
  const r = el.c2d.getBoundingClientRect();
  return { x: view2d.x0 + (ev.clientX - r.left) / view2d.scale, y: view2d.y0 + (ev.clientY - r.top) / view2d.scale };
}

// ------------------------------------------------------------------ dragging (both views)
function toSheet(ev) {
  if (state.mode === "2d") return sheetPoint2d(ev);
  if (state.mode === "ar" && ar) return ar.toSheet(ev.clientX, ev.clientY);
  return null;
}
el.stage.addEventListener("pointerdown", (ev) => {
  const p = toSheet(ev);
  if (!p || !inDragBand(p.y)) return;
  state.dragging = true;
  el.stage.setPointerCapture(ev.pointerId);
  setLoad(mOf(p.x));
  render();
});
el.stage.addEventListener("pointermove", (ev) => {
  if (!state.dragging) return;
  const p = toSheet(ev);
  if (p) setLoad(mOf(p.x));
});
const endDrag = () => { if (state.dragging) { state.dragging = false; render(); } };
el.stage.addEventListener("pointerup", endDrag);
el.stage.addEventListener("pointercancel", endDrag);

// ------------------------------------------------------------------ controls
el.slider.min = P.aMin; el.slider.max = P.aMax; el.slider.step = P.step;
el.slider.addEventListener("input", () => setLoad(parseFloat(el.slider.value)));

document.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => {
  state.layers[b.dataset.layer] = !state.layers[b.dataset.layer];
  syncLayerButtons(); render();
}));
el.all.addEventListener("click", () => {
  const allOn = Object.values(state.layers).every(Boolean);
  for (const k of Object.keys(state.layers)) state.layers[k] = !allOn;
  syncLayerButtons(); render();
});
el.reset.addEventListener("click", () => setLoad(P.a0));
el.freeze.addEventListener("click", () => {
  if (!ar) return;
  state.frozen = !state.frozen;
  ar.setFrozen(state.frozen);
  el.freeze.textContent = state.frozen ? "Resume tracking" : "Freeze view";
  el.freeze.setAttribute("aria-pressed", String(state.frozen));
  setStatus();
});
el.mode.addEventListener("click", () => (state.mode === "ar" ? enter2d() : enterAR()));

// ------------------------------------------------------------------ modes
async function enter2d() {
  if (ar) { const s = ar; ar = null; await s.stop(); }
  state.mode = "2d"; state.frozen = false; state.tracking = false;
  document.body.dataset.mode = "2d";
  el.start.hidden = true; el.arBox.hidden = true; el.c2d.hidden = false; el.freeze.hidden = true;
  el.mode.textContent = "AR camera";
  layout2d(); setStatus(); render();
}

async function enterAR() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return showMessage("Camera not available",
      "This browser cannot open the camera from this page. Open the link in Chrome (Android) or Safari (iPhone), or use the 2D view.");
  }
  try {
    const head = await fetch(TARGET_SRC, { method: "HEAD", cache: "no-store" });
    if (!head.ok) throw new Error("missing");
  } catch {
    return showMessage("AR target not set up yet",
      "The file assets/targets.mind is missing from the website. Compile assets/target.png with the MindAR target compiler and upload the result (see the README). The 2D view works in the meantime.");
  }

  state.mode = "ar"; state.tracking = false; state.frozen = false;
  document.body.dataset.mode = "ar";
  el.start.hidden = true; el.c2d.hidden = true; el.arBox.hidden = false; el.freeze.hidden = false;
  el.freeze.textContent = "Freeze view"; el.freeze.setAttribute("aria-pressed", "false");
  el.mode.textContent = "2D view";
  el.hint.textContent = "Starting camera\u2026"; el.hint.hidden = false;
  el.status.textContent = "Allow camera access when your browser asks.";

  try {
    const { startAR } = await import("./ar.js");
    ar = await startAR({
      container: el.arBox, overlayCanvas: overlay, targetSrc: TARGET_SRC,
      onFound: () => { state.tracking = true; setStatus(); },
      onLost: () => { state.tracking = false; setStatus(); },
    });
    el.hint.textContent = "Point the camera at the whole problem sheet";
    setStatus(); render();
  } catch (err) {
    console.error(err);
    el.arBox.replaceChildren();
    ar = null;
    await enter2d();
    showMessage("The camera could not start",
      "Check that camera access is allowed for this site in your browser settings, then try again. You are now in the 2D view, which shows the same results.",
      { primary: "Try again", onPrimary: enterAR });
  }
}

function showMessage(title, text, { primary = "Use 2D view", onPrimary = enter2d } = {}) {
  el.msgTitle.textContent = title; el.msgText.textContent = text;
  el.msgPrimary.textContent = primary;
  el.msgPrimary.onclick = () => { el.msg.close(); onPrimary(); };
  el.msgSecondary.onclick = () => el.msg.close();
  el.msg.showModal();
}

$("go-ar").addEventListener("click", enterAR);
$("go-2d").addEventListener("click", enter2d);

// Re-fit the 2D view whenever the stage changes size (rotation, readout text wrapping, etc.)
new ResizeObserver(() => { if (state.mode === "2d") { layout2d(); render(); } }).observe(el.stage);
sheetImg.addEventListener("load", () => render());
document.fonts?.ready.then(() => render());

// ------------------------------------------------------------------ boot
updateReadouts(); syncLayerButtons();
if (params.get("mode") === "2d") enter2d();
