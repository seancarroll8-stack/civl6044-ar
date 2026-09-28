// CIVL6044 AR Prototype 1 - overlay renderer.
// Draws the analytical layer onto a 2D canvas in sheet coordinates (mm).
// The same canvas becomes a texture on the tracked sheet in AR, and is drawn
// over the sheet image in the 2D view, so both views always show identical results.

import { G } from "./geometry.js";
import { fmt } from "./beam.js";

export const COLORS = {
  navy: "#233441", load: "#B73838", reaction: "#246C9D", grey: "#647480",
  defl: "#6B3FA0", sfdPos: "rgba(36,108,157,0.30)", sfdNeg: "rgba(183,56,56,0.22)",
  bmd: "rgba(35,52,65,0.20)", panel: "rgba(255,255,255,0.86)", guide: "rgba(183,56,56,0.75)",
};
const FONT = '"Barlow", "Helvetica Neue", Arial, sans-serif';

const O = G.overlay;
export const OVERLAY_W_MM = G.pageW;
export const OVERLAY_H_MM = O.y1 - O.y0;

export function createOverlayCanvas(pxPerMM = O.pxPerMM) {
  const c = document.createElement("canvas");
  c.width = Math.round(OVERLAY_W_MM * pxPerMM);
  c.height = Math.round(OVERLAY_H_MM * pxPerMM);
  c.pxPerMM = pxPerMM;
  return c;
}

// sheet mm -> beam coordinate (m) and back
export const xOf = (m) => G.xA + m * G.mmPerM;
export const mOf = (xmm) => (xmm - G.xA) / G.mmPerM;
// Touches in this band (load, beam, supports, dimensions) move the load.
export const inDragBand = (ymm) => ymm >= O.y0 && ymm <= 165;

export function drawOverlay(canvas, st) {
  // st: { sol, a0, layers:{reactions,sfd,bmd}, beam: original|deflected|both, debug, dragging }
  const k = canvas.pxPerMM;
  const ctx = canvas.getContext("2d");
  const X = (mm) => mm * k;
  const Y = (mm) => (mm - O.y0) * k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  const { sol, layers } = st;
  const xa = xOf(sol.a), xA = G.xA, xB = G.xB;

  // ---------- helpers
  const line = (pts, color, wmm, dash) => {
    ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (const p of pts.slice(1)) ctx.lineTo(X(p[0]), Y(p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = wmm * k; ctx.setLineDash(dash ? dash.map((d) => d * k) : []);
    ctx.stroke(); ctx.setLineDash([]);
  };
  const poly = (pts, fill, stroke, wmm) => {
    ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (const p of pts.slice(1)) ctx.lineTo(X(p[0]), Y(p[1]));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = wmm * k; ctx.stroke(); }
  };
  const arrow = (x, yTail, yTip, color, wmm, head = 3.6, half = 1.7) => {
    const dir = Math.sign(yTip - yTail);
    line([[x, yTail], [x, yTip - dir * head * 0.8]], "white", wmm + 1.0);
    line([[x, yTail], [x, yTip - dir * head * 0.8]], color, wmm);
    poly([[x, yTip], [x - half, yTip - dir * head], [x + half, yTip - dir * head]], color, "white", 0.35);
  };
  const panel = (y0, y1) => {
    const r = 1.6 * k, x0 = X(13), x1 = X(197), t = Y(y0), b = Y(y1);
    ctx.beginPath(); ctx.moveTo(x0 + r, t); ctx.arcTo(x1, t, x1, b, r); ctx.arcTo(x1, b, x0, b, r);
    ctx.arcTo(x0, b, x0, t, r); ctx.arcTo(x0, t, x1, t, r); ctx.closePath();
    ctx.fillStyle = COLORS.panel; ctx.fill();
  };
  // Rich text: "R_{A} = 12.5 kN" -> subscript A. Returns width in mm.
  const text = (str, xmm, ymm, size, { align = "left", color = COLORS.navy, weight = 600, halo = true } = {}) => {
    const segs = []; const re = /_\{([^}]*)\}/g; let last = 0, m;
    while ((m = re.exec(str))) { if (m.index > last) segs.push([str.slice(last, m.index), false]); segs.push([m[1], true]); last = re.lastIndex; }
    if (last < str.length) segs.push([str.slice(last), false]);
    const px = size * k, spx = px * 0.68;
    const w = segs.map(([t, sub]) => { ctx.font = `${weight} ${sub ? spx : px}px ${FONT}`; return ctx.measureText(t).width; });
    const total = w.reduce((p, q) => p + q, 0);
    let x = X(xmm) - (align === "center" ? total / 2 : align === "right" ? total : 0);
    const y = Y(ymm);
    for (const pass of halo ? ["halo", "fill"] : ["fill"]) {
      let cx = x;
      segs.forEach(([t, sub], i) => {
        ctx.font = `${weight} ${sub ? spx : px}px ${FONT}`;
        const yy = y + (sub ? px * 0.26 : 0);
        if (pass === "halo") { ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = px * 0.3; ctx.strokeText(t, cx, yy); }
        else { ctx.fillStyle = color; ctx.fillText(t, cx, yy); }
        cx += w[i];
      });
    }
    return total / k;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------- diagram panels (drawn first so everything else sits on top)
  const sfdTop = G.sfdBase - 21, sfdBot = G.sfdBase + 19;
  const bmdTop = G.bmdBase - 7, bmdBot = O.y1 - 1;
  if (layers.sfd) panel(sfdTop, sfdBot);
  if (layers.bmd) panel(bmdTop, bmdBot);

  // ---------- guide line through the load position
  if (layers.sfd || layers.bmd) {
    const yEnd = layers.bmd ? G.bmdBase + sol.Mmax * G.bmdScale : G.sfdBase + sol.RB * G.sfdScale;
    line([[xa, G.beamY + G.beamHalf + 0.8], [xa, yEnd]], COLORS.guide, 0.3, [1.4, 1.2]);
  }

  // ---------- shear force diagram
  if (layers.sfd) {
    const b0 = G.sfdBase, s = G.sfdScale, top = b0 - sol.RA * s, bot = b0 + sol.RB * s;
    text("V (kN)", 15, b0 + 1.3, 3.6, { color: COLORS.grey, weight: 500 });
    poly([[xA, b0], [xA, top], [xa, top], [xa, b0]], COLORS.sfdPos);
    poly([[xa, b0], [xa, bot], [xB, bot], [xB, b0]], COLORS.sfdNeg);
    line([[xA - 2, b0], [xB + 2, b0]], COLORS.grey, 0.3);
    line([[xA, b0], [xA, top], [xa, top], [xa, bot], [xB, bot], [xB, b0]], COLORS.navy, 0.55);
    text("+" + fmt.kN(sol.RA), xA + 1.2, top - 1.5, 4.6);
    text("\u2212" + fmt.kN(sol.RB), xB - 1.2, bot + 5.0, 4.6, { align: "right" });
  }

  // ---------- bending moment diagram (sagging plotted below the axis)
  if (layers.bmd) {
    const b0 = G.bmdBase, s = G.bmdScale, peak = b0 + sol.Mmax * s;
    text("M (kNm)", 15, b0 + 1.3, 3.6, { color: COLORS.grey, weight: 500 });
    text("sagging +", 15, b0 + 5.6, 2.9, { color: COLORS.grey, weight: 500 });
    poly([[xA, b0], [xa, peak], [xB, b0]], COLORS.bmd);
    line([[xA - 2, b0], [xB + 2, b0]], COLORS.grey, 0.3);
    line([[xA, b0], [xa, peak], [xB, b0]], COLORS.navy, 0.55);
    ctx.beginPath(); ctx.arc(X(xa), Y(peak), 0.9 * k, 0, Math.PI * 2); ctx.fillStyle = COLORS.navy; ctx.fill();
    const cx = clamp(xa, 54, 174);
    text(`M_{max} = ${fmt.kNm(sol.Mmax)} kNm`, cx, peak + 5.4, 4.6, { align: "center" });
    text(`at x = ${fmt.m(sol.a)} m`, cx, peak + 10.0, 3.8, { align: "center", weight: 500 });
  }

  // ---------- beam shape: original (printed) / deflected / both
  if (st.beam && st.beam !== "original") {
    const N = 120, depth = 2 * G.beamHalf, ov = 3 / G.mmPerM, e = 1e-4;
    const s0 = sol.defl(e) / e, sL = -sol.defl(sol.L - e) / e;      // end slopes, for the short overhangs
    const d = (x) => (x < 0 ? s0 * x : x > sol.L ? sL * (x - sol.L) : sol.defl(x));
    const yAt = (x) => G.beamY + G.deflScale * d(x);
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = -ov + ((sol.L + 2 * ov) * i) / N; top.push([xOf(x), yAt(x) - depth / 2]); bot.push([xOf(x), yAt(x) + depth / 2]); }
    if (st.beam === "deflected") {
      // hide the printed (original) beam so only the deflected one shows
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillRect(X(xA - 3.6), Y(G.beamY - G.beamHalf - 0.6), X(xB + 3.6) - X(xA - 3.6), Y(G.beamY + G.beamHalf + 0.6) - Y(G.beamY - G.beamHalf - 0.6));
    }
    const band = [...top, ...bot.reverse()];
    poly(band, st.beam === "both" ? "rgba(107,63,160,0.28)" : "rgba(129,150,172,0.95)", COLORS.defl, 0.45);
    const xd = xOf(sol.xDmax), yd = yAt(sol.xDmax) + depth / 2;
    ctx.beginPath(); ctx.arc(X(xd), Y(yd + 1.2), 1.0 * k, 0, Math.PI * 2); ctx.fillStyle = COLORS.defl; ctx.fill();
    text(`\u03B4_{max} at x = ${fmt.m(sol.xDmax)} m`, xd, yd + 6.6, 3.9, { align: "center", color: COLORS.defl });
    text("(exaggerated)", xd, yd + 10.6, 3.3, { align: "center", color: COLORS.defl, weight: 500 });
  }

  // ---------- support reactions (arrow length proportional to magnitude)
  if (layers.reactions) {
    for (const [x, R, name, side] of [[xA, sol.RA, "A", 1], [xB, sol.RB, "B", -1]]) {
      const tail = G.reactTipY + 5 + 9 * (R / sol.P);
      arrow(x, tail, G.reactTipY, COLORS.reaction, 0.9);
      text(`R_{${name}} = ${fmt.kN(R)} kN`, x + side * 2.6, G.reactTipY + 7.8, 4.6,
        { align: side > 0 ? "left" : "right", color: COLORS.reaction, weight: 700 });
    }
  }

  // ---------- applied load (interactive) - always shown, it is the drag handle
  const moved = Math.abs(sol.a - st.a0) > 1e-9;
  const hy = 107;                                   // handle sits on the shaft, clear of the printed "20 kN" label
  if (moved) {
    // position dimensions for the moved load, between the handle and the beam
    const yd = 116;
    line([[xA, yd - 1.4], [xA, yd + 1.4]], COLORS.load, 0.3);
    line([[xB, yd - 1.4], [xB, yd + 1.4]], COLORS.load, 0.3);
    line([[xA, yd], [xB, yd]], COLORS.load, 0.3, [0.9, 0.9]);
    // label inside its segment when it fits, otherwise just outside the support
    const lab = (str, x0, x1, outside) => {
      ctx.font = `600 ${3.6 * k}px ${FONT}`;
      const w = ctx.measureText(str).width / k + 3;
      if (x1 - x0 >= w) text(str, (x0 + x1) / 2, yd - 1.2, 3.6, { align: "center", color: COLORS.load });
      else text(str, outside < 0 ? xA - 2 : xB + 2, yd + 1.2, 3.6, { align: outside < 0 ? "right" : "left", color: COLORS.load });
    };
    lab(`a = ${sol.a.toFixed(1)} m`, xA, xa - 3, -1);
    lab(`b = ${sol.b.toFixed(1)} m`, xa + 3, xB, 1);
  }
  arrow(xa, hy, G.loadTipY, COLORS.load, 1.0, 3.8, 1.8);
  // drag handle with left/right chevrons
  const hr = st.dragging ? 2.9 : 2.4;
  ctx.beginPath(); ctx.arc(X(xa), Y(hy), hr * k, 0, Math.PI * 2);
  ctx.fillStyle = st.dragging ? COLORS.load : "white"; ctx.fill();
  ctx.strokeStyle = COLORS.load; ctx.lineWidth = 0.7 * k; ctx.stroke();
  for (const d of [-1, 1]) poly([[xa + d * (hr + 1.0), hy - 1.4], [xa + d * (hr + 2.8), hy], [xa + d * (hr + 1.0), hy + 1.4]], COLORS.load);
  // label beside the handle, on whichever side has room
  const right = xa < 150;
  text(`P = ${sol.P} kN`, xa + (right ? 1 : -1) * (hr + 4.2), hy + 1.6, 4.4,
    { align: right ? "left" : "right", color: COLORS.load, weight: 700 });

  // ---------- alignment check (?debug=1)
  if (st.debug) {
    ctx.strokeStyle = "rgba(0,200,220,0.9)"; ctx.lineWidth = 0.4 * k;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    line([[xA, G.beamY], [xB, G.beamY]], "rgba(0,200,220,0.9)", 0.4);
    for (const x of [xA, xB, G.printedLoadX]) {
      ctx.beginPath(); ctx.arc(X(x), Y(G.beamY), 2 * k, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
