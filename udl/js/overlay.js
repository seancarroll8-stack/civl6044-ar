// CIVL6044 AR Prototype 1.1 (UDL example) - 2D sheet renderer.
// Draws the results onto a canvas in sheet coordinates (mm); the 2D view draws
// this over the sheet image.

import { G } from "./geometry.js";
import { fmt, diagramPoints } from "./beam.js";

export const COLORS = {
  navy: "#233441", load: "#B73838", reaction: "#246C9D", grey: "#647480",
  defl: "#6B3FA0", sfdPos: "rgba(36,108,157,0.30)", sfdNeg: "rgba(183,56,56,0.22)",
  bmd: "rgba(35,52,65,0.20)", panel: "rgba(255,255,255,0.86)", guide: "rgba(183,56,56,0.75)",
};
const FONT = '"Barlow", "Helvetica Neue", Arial, sans-serif';
const O = G.overlay;
const HANDLE_P_Y = 104;                      // point-load handle (clear of the printed "20 kN")

export function createOverlayCanvas(pxPerMM = O.pxPerMM) {
  const c = document.createElement("canvas");
  c.width = Math.round(G.pageW * pxPerMM);
  c.height = Math.round((O.y1 - O.y0) * pxPerMM);
  c.pxPerMM = pxPerMM;
  return c;
}

// sheet mm <-> beam coordinate (m)
export const xOf = (m) => G.xA + m * G.mmPerM;
export const mOf = (xmm) => (xmm - G.xA) / G.mmPerM;

// Where the drag handles are in the 2D sheet (page mm), for hit testing.
export function handles2d(sol) {
  const xa = xOf(sol.a), xs = xOf(sol.s), xe = xOf(sol.e);
  return {
    P: [xa, HANDLE_P_Y], s: [xs, G.udlTopY], e: [xe, G.udlTopY],
    udlBox: [xs, xe, G.udlTopY, G.loadTipY], pShaft: [xa, HANDLE_P_Y, G.loadTipY],
  };
}

export function drawOverlay(canvas, st) {
  // st: { sol, layers:{reactions,sfd,bmd}, beam: original|deflected|both, debug, dragging: null|"P"|"s"|"e"|"udl" }
  const k = canvas.pxPerMM;
  const ctx = canvas.getContext("2d");
  const X = (mm) => mm * k;
  const Y = (mm) => (mm - O.y0) * k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  const { sol, layers } = st;
  const xA = G.xA, xB = G.xB, xa = xOf(sol.a), xs = xOf(sol.s), xe = xOf(sol.e), xM = xOf(sol.xM);
  const pts = diagramPoints(sol);

  // ---------- helpers
  const line = (p, color, wmm, dash) => {
    ctx.beginPath(); ctx.moveTo(X(p[0][0]), Y(p[0][1]));
    for (const q of p.slice(1)) ctx.lineTo(X(q[0]), Y(q[1]));
    ctx.strokeStyle = color; ctx.lineWidth = wmm * k; ctx.setLineDash(dash ? dash.map((d) => d * k) : []);
    ctx.stroke(); ctx.setLineDash([]);
  };
  const poly = (p, fill, stroke, wmm) => {
    ctx.beginPath(); ctx.moveTo(X(p[0][0]), Y(p[0][1]));
    for (const q of p.slice(1)) ctx.lineTo(X(q[0]), Y(q[1]));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = wmm * k; ctx.stroke(); }
  };
  const arrow = (x, yTail, yTip, color, wmm, head = 3.6, half = 1.7, halo = true) => {
    const dir = Math.sign(yTip - yTail);
    if (halo) line([[x, yTail], [x, yTip - dir * head * 0.8]], "white", wmm + 1.0);
    line([[x, yTail], [x, yTip - dir * head * 0.8]], color, wmm);
    poly([[x, yTip], [x - half, yTip - dir * head], [x + half, yTip - dir * head]], color, halo ? "white" : null, 0.35);
  };
  const dot = (x, y, r, color) => { ctx.beginPath(); ctx.arc(X(x), Y(y), r * k, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  const panel = (y0, y1) => {
    const r = 1.6 * k, x0 = X(13), x1 = X(197), t = Y(y0), b = Y(y1);
    ctx.beginPath(); ctx.moveTo(x0 + r, t); ctx.arcTo(x1, t, x1, b, r); ctx.arcTo(x1, b, x0, b, r);
    ctx.arcTo(x0, b, x0, t, r); ctx.arcTo(x0, t, x1, t, r); ctx.closePath();
    ctx.fillStyle = COLORS.panel; ctx.fill();
  };
  const segsOf = (str) => {
    const segs = []; const re = /_\{([^}]*)\}/g; let last = 0, m;
    while ((m = re.exec(str))) { if (m.index > last) segs.push([str.slice(last, m.index), false]); segs.push([m[1], true]); last = re.lastIndex; }
    if (last < str.length) segs.push([str.slice(last), false]);
    return segs;
  };
  const measure = (str, size, weight = 600) => segsOf(str).reduce((acc, [t, sub]) => {
    ctx.font = `${weight} ${(sub ? 0.68 : 1) * size * k}px ${FONT}`; return acc + ctx.measureText(t).width / k;
  }, 0);
  // Rich text: "R_{A} = 12.5 kN" -> subscript A. Returns width in mm.
  const text = (str, xmm, ymm, size, { align = "left", color = COLORS.navy, weight = 600, halo = true } = {}) => {
    const segs = segsOf(str);
    const px = size * k, spx = px * 0.68;
    const w = segs.map(([t, sub]) => { ctx.font = `${weight} ${sub ? spx : px}px ${FONT}`; return ctx.measureText(t).width; });
    const total = w.reduce((p, q) => p + q, 0);
    const x = X(xmm) - (align === "center" ? total / 2 : align === "right" ? total : 0);
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

  // ---------- diagram panels
  const sfdTop = G.sfdBase - 21, sfdBot = G.sfdBase + 19;
  const bmdTop = G.bmdBase - 7, bmdBot = O.y1 - 1;
  if (layers.sfd) panel(sfdTop, sfdBot);
  if (layers.bmd) panel(bmdTop, bmdBot);

  // ---------- guide line through the position of maximum moment
  if (layers.sfd || layers.bmd) {
    const yEnd = layers.bmd ? G.bmdBase + sol.Mmax * G.bmdScale : G.sfdBase + 2;
    line([[xM, G.beamY + G.beamHalf + 0.8], [xM, yEnd]], COLORS.guide, 0.3, [1.4, 1.2]);
  }

  // ---------- shear force diagram (positive above the axis)
  if (layers.sfd) {
    const b0 = G.sfdBase, s = G.sfdScale;
    const P = pts.v.map(([x, v]) => [xOf(x), b0 - v * s]);
    poly(pts.v.map(([x, v]) => [xOf(x), b0 - Math.max(v, 0) * s]), COLORS.sfdPos);
    poly(pts.v.map(([x, v]) => [xOf(x), b0 - Math.min(v, 0) * s]), COLORS.sfdNeg);
    text("V (kN)", 15, b0 + 1.3, 3.6, { color: COLORS.grey, weight: 500 });
    line([[xA - 2, b0], [xB + 2, b0]], COLORS.grey, 0.3);
    line(P, COLORS.navy, 0.55);
    text("+" + fmt.kN(sol.RA), xA + 1.2, Math.max(b0 - sol.RA * s - 1.5, sfdTop + 3.6), 4.6);
    text("\u2212" + fmt.kN(sol.RB), xB - 1.2, Math.min(b0 + sol.RB * s + 5.0, sfdBot - 1.2), 4.6, { align: "right" });
    dot(xM, b0, 0.9, COLORS.navy);
    const lab = sol.shearJump ? "V changes sign" : "V = 0";
    const right = xM < 150;
    text(lab, xM + (right ? 1.8 : -1.8), b0 + (sol.V(sol.xM - 1e-6, -1) > 8 || sol.shearJump ? 4.4 : -1.8), 3.4,
      { align: right ? "left" : "right", color: COLORS.navy, weight: 600 });
  }

  // ---------- bending moment diagram (sagging plotted below the axis)
  if (layers.bmd) {
    const b0 = G.bmdBase, s = G.bmdScale, peak = b0 + sol.Mmax * s;
    const P = pts.m.map(([x, m]) => [xOf(x), b0 + m * s]);
    text("M (kNm)", 15, b0 + 1.3, 3.6, { color: COLORS.grey, weight: 500 });
    text("sagging +", 15, b0 + 5.6, 2.9, { color: COLORS.grey, weight: 500 });
    poly(P, COLORS.bmd);
    line([[xA - 2, b0], [xB + 2, b0]], COLORS.grey, 0.3);
    line(P, COLORS.navy, 0.55);
    dot(xM, peak, 0.9, COLORS.navy);
    const l1 = `M_{max} = ${fmt.kNm(sol.Mmax)} kNm`, l2 = `at x = ${fmt.m(sol.xM)} m`;
    if (peak + 10.5 <= bmdBot) {                                  // below the peak
      const cx = clamp(xM, 54, 174);
      text(l1, cx, peak + 5.4, 4.6, { align: "center" });
      text(l2, cx, peak + 10.0, 3.8, { align: "center", weight: 500 });
    } else {                                                      // deep diagram: beside the peak
      const right = xM < 110, lx = xM + (right ? 3 : -3), al = right ? "left" : "right";
      text(l1, lx, peak - 4.2, 4.6, { align: al });
      text(l2, lx, peak + 0.4, 3.8, { align: al, weight: 500 });
    }
  }

  // ---------- beam shape: original (printed) / deflected / both
  if (st.beam && st.beam !== "original") {
    const N = 160, depth = 2 * G.beamHalf, ov = 3 / G.mmPerM, e = 1e-3;
    const s0 = sol.defl(e) / e, sL = -sol.defl(sol.L - e) / e;      // end slopes, for the short overhangs
    const d = (x) => (x < 0 ? s0 * x : x > sol.L ? sL * (x - sol.L) : sol.defl(x));
    const yAt = (x) => G.beamY + G.deflScale * d(x);
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = -ov + ((sol.L + 2 * ov) * i) / N; top.push([xOf(x), yAt(x) - depth / 2]); bot.push([xOf(x), yAt(x) + depth / 2]); }
    if (st.beam === "deflected") {
      ctx.fillStyle = "rgba(255,255,255,0.96)";                  // hide the printed (original) beam
      ctx.fillRect(X(xA - 3.6), Y(G.beamY - G.beamHalf - 0.6), X(xB + 3.6) - X(xA - 3.6), Y(G.beamY + G.beamHalf + 0.6) - Y(G.beamY - G.beamHalf - 0.6));
    }
    poly([...top, ...bot.reverse()], st.beam === "both" ? "rgba(107,63,160,0.28)" : "rgba(129,150,172,0.95)", COLORS.defl, 0.45);
    const xd = xOf(sol.xDmax), yd = yAt(sol.xDmax) + depth / 2;
    dot(xd, yd + 1.2, 1.0, COLORS.defl);
    text(`\u03B4_{max} at x = ${fmt.m(sol.xDmax)} m`, xd, yd + 6.6, 3.9, { align: "center", color: COLORS.defl });
    text("(exaggerated)", xd, yd + 10.6, 3.3, { align: "center", color: COLORS.defl, weight: 500 });
  }

  // ---------- support reactions (arrow length proportional to magnitude, 40 kN = longest)
  if (layers.reactions) {
    for (const [x, R, name, side] of [[xA, sol.RA, "A", 1], [xB, sol.RB, "B", -1]]) {
      const tail = G.reactTipY + 5 + 9 * (R / 40);
      arrow(x, tail, G.reactTipY, COLORS.reaction, 0.9);
      text(`R_{${name}} = ${fmt.kN(R)} kN`, x + side * 2.6, G.reactTipY + 7.8, 4.6,
        { align: side > 0 ? "left" : "right", color: COLORS.reaction, weight: 700 });
    }
  }

  // ---------- UDL (interactive): arrows, top line, a handle at each end
  const ut = G.udlTopY, drag = st.dragging;
  const n = Math.max(1, Math.round((xe - xs) / 6.5));
  line([[xs, ut], [xe, ut]], "white", 1.7); line([[xs, ut], [xe, ut]], COLORS.load, 0.75);
  for (let i = 0; i <= n; i++) arrow(xs + ((xe - xs) * i) / n, ut, G.loadTipY, COLORS.load, 0.45, 2.3, 1.05, false);
  if (drag === "udl") line([[xs, ut - 1.6], [xe, ut - 1.6]], COLORS.load, 0.35, [1, 1]);
  const handle = (x, y, active) => {
    const r = active ? 2.8 : 2.2;
    ctx.beginPath(); ctx.arc(X(x), Y(y), r * k, 0, Math.PI * 2);
    ctx.fillStyle = active ? COLORS.load : "white"; ctx.fill();
    ctx.strokeStyle = COLORS.load; ctx.lineWidth = 0.7 * k; ctx.stroke();
    for (const d of [-1, 1]) poly([[x + d * (r + 0.9), y - 1.2], [x + d * (r + 2.5), y], [x + d * (r + 0.9), y + 1.2]], COLORS.load);
    return r;
  };
  handle(xs, ut, drag === "s" || drag === "udl");
  handle(xe, ut, drag === "e" || drag === "udl");

  // ---------- point load (interactive)
  arrow(xa, HANDLE_P_Y, G.loadTipY, COLORS.load, 1.0, 3.8, 1.8);
  const hr = handle(xa, HANDLE_P_Y, drag === "P");

  // ---------- labels, placed so they do not collide
  const pLab = `P = ${sol.P} kN at ${sol.a.toFixed(1)} m`;
  const pW = measure(pLab, 4.2, 700);
  // point-load label goes on the side away from the UDL, if it fits there
  const fitsL = xa - hr - 3.8 - pW >= 13, fitsR = xa + hr + 3.8 + pW <= 197;
  const pRight = (xs + xe) / 2 > xa ? !fitsL : fitsR;
  const pBox = pRight ? [xa + hr + 3.8, xa + hr + 3.8 + pW] : [xa - hr - 3.8 - pW, xa - hr - 3.8];
  text(pLab, pRight ? pBox[0] : pBox[1], HANDLE_P_Y + 1.5, 4.2, { align: pRight ? "left" : "right", color: COLORS.load, weight: 700 });
  const uLab = `w = ${sol.w} kN/m, ${sol.s.toFixed(1)}\u2013${sol.e.toFixed(1)} m`;
  const uW = measure(uLab, 3.9, 700), uy = ut - 6.4;          // above the printed "10 kN/m"
  const clear = (x0, x1) => x0 >= 13 && x1 <= 197 && (x1 < pBox[0] - 2 || x0 > pBox[1] + 2) && (x1 < xa - 3 || x0 > xa + 3);
  const mid = (xs + xe) / 2;
  const options = [[mid - uW / 2, mid + uW / 2], [xs - 5 - uW, xs - 5], [xe + 5, xe + 5 + uW],
    [xa - 3.5 - uW, xa - 3.5], [xa + 3.5, xa + 3.5 + uW]];                  // last two: either side of the P arrow
  const pick = options.find(([x0, x1]) => clear(x0, x1));
  if (pick) text(uLab, pick[0], uy, 3.9, { color: COLORS.load, weight: 700 });
  else text(uLab, clamp(mid - uW / 2, 13, 197 - uW), uy - 5.2, 3.9, { color: COLORS.load, weight: 700 });   // raised clear of everything

  // ---------- alignment check (?debug=1)
  if (st.debug) {
    ctx.strokeStyle = "rgba(0,200,220,0.9)"; ctx.lineWidth = 0.4 * k;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    line([[xA, G.beamY], [xB, G.beamY]], "rgba(0,200,220,0.9)", 0.4);
    for (const x of [xA, xB, G.printedLoadX, ...G.printedUdlX]) { ctx.beginPath(); ctx.arc(X(x), Y(G.beamY), 2 * k, 0, Math.PI * 2); ctx.stroke(); }
  }
}
