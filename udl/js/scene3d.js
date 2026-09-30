// CIVL6044 AR Prototype 1.1 (UDL example) - 3D scene description.
// Pure JavaScript (no three.js), so it can be tested on its own.
//
// Everything is built in "sheet frame" millimetres:
//   x to the right, y up the page, z out of the page towards the viewer,
//   origin at the centre of the tracked target image.
// Output: coloured triangle batches (shading baked into vertex colours, stored
// in linear colour space) plus label specs. figure3d.js turns these into three.js objects.

import { G } from "./geometry.js";
import { fmt, diagramPoints } from "./beam.js";

export const sx = (xmm) => xmm - G.pageW / 2;
export const sy = (ymm) => G.targetH / 2 - ymm;
export const toPage = (x, y) => ({ xmm: x + G.pageW / 2, ymm: G.targetH / 2 - y });

const XA = sx(G.xA), XB = sx(G.xB), AXIS = sy(G.beamY);

export const DIM = {
  h: 3.6, W: 9, tf: 1.4, tw: 1.2, over: 4,   // I-beam: half depth, width (out of page), flange, web
  zMid: 4.5,                                 // arrows and the drag plane sit at mid-width
  deflScale: 12,                             // mm drawn for the largest possible deflection (exaggerated)
  arm: 30,                                   // point load arrow length above the beam
  udlH: 13,                                  // height of the UDL arrows above the beam
  hingeY: sy(252),                           // stand-up hinge line (bottom of the BMD panel)
  dragY0: sy(166), dragY1: sy(76),           // touches in this band can grab a load
  panelX0: -92, panelX1: 92,
  sfdTop: sy(163), sfdBot: sy(203), bmdTop: sy(205), bmdBot: sy(251),
};

export const PAL = {
  steel: "#8196AC", ghost: "#4F6F8F", support: "#A7B6C4", ground: "#5B6D7E", pin: "#233441",
  load: "#C43D3D", reaction: "#2A77AD", sfdPos: "#5D9ACB", sfdNeg: "#D97070", axis: "#7B8994",
  bmdLight: "#D3DEE8", bmdDark: "#27405A", panel: "#FFFFFF", guide: "#D25A5A", defl: "#6B3FA0",
  navy: "#233441", grey: "#5F6E7A", pinMetal: "#5E7285",
};

// ------------------------------------------------------------------ colour + shading
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const LIGHT = norm([-0.32, -0.42, 0.85]);
const shade = (n) => 0.5 + 0.56 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
const lit = (rgb, n) => { const s = shade(n); return rgb.map((c) => lin(Math.min(1, c * s))); };
const flat = (rgb) => rgb.map(lin);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hex(v)]));

// ------------------------------------------------------------------ batches
class Batch {
  constructor(key, opacity, order) { this.key = key; this.opacity = opacity; this.order = order; this.pos = []; this.col = []; this.idx = []; }
  v(p, c) { this.pos.push(p[0], p[1], p[2]); this.col.push(c[0], c[1], c[2]); return this.pos.length / 3 - 1; }
}

class Scene {
  constructor() { this.batches = new Map(); this.labels = []; }
  batch(key, opacity = 1, order = 0) {
    if (!this.batches.has(key)) this.batches.set(key, new Batch(key, opacity, order));
    return this.batches.get(key);
  }
  label(spec) { this.labels.push(spec); }
}

// ------------------------------------------------------------------ primitives
function face(b, pts, n, colorAt) {           // convex planar polygon
  const i0 = b.pos.length / 3;
  pts.forEach((p) => b.v(p, colorAt(p, n)));
  for (let i = 1; i < pts.length - 1; i++) b.idx.push(i0, i0 + i, i0 + i + 1);
}
const solidColor = (rgb) => (p, n) => lit(rgb, n);

function box(b, x0, x1, y0, y1, z0, z1, rgb) {
  const c = solidColor(rgb);
  face(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], c);
  face(b, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1], c);
  face(b, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], c);
  face(b, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], c);
  face(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], c);
  face(b, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], c);
}

// Extruded convex polygon (counter-clockwise in xy). baseAt(x, y) gives the sRGB base colour.
function prism(b, pts2, z0, z1, baseAt) {
  const c = (p, n) => lit(baseAt(p[0], p[1]), n);
  face(b, pts2.map(([x, y]) => [x, y, z1]), [0, 0, 1], c);
  face(b, pts2.map(([x, y]) => [x, y, z0]).reverse(), [0, 0, -1], c);
  for (let i = 0; i < pts2.length; i++) {
    const [x0, y0] = pts2[i], [x1, y1] = pts2[(i + 1) % pts2.length];
    face(b, [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], norm([y1 - y0, -(x1 - x0), 0]), c);
  }
}

function basis(a) {
  const t = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(a, t)); return [u, cross(a, u)];
}
function disc(b, c, n, r, u, v, rgb, seg) {
  const col = lit(rgb, n); const i0 = b.v(c, col);
  for (let i = 0; i <= seg; i++) { const t = (i / seg) * 2 * Math.PI; b.v(add(c, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t)))), col); }
  for (let i = 0; i < seg; i++) b.idx.push(i0, i0 + 1 + i, i0 + 2 + i);
}
function cylinder(b, p0, p1, r, rgb, seg = 18) {
  const a = norm(sub(p1, p0)); const [u, v] = basis(a); const i0 = b.pos.length / 3;
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * 2 * Math.PI; const d = add(mul(u, Math.cos(t)), mul(v, Math.sin(t))); const c = lit(rgb, d);
    b.v(add(p0, mul(d, r)), c); b.v(add(p1, mul(d, r)), c);
  }
  for (let i = 0; i < seg; i++) { const k = i0 + 2 * i; b.idx.push(k, k + 2, k + 3, k, k + 3, k + 1); }
  disc(b, p0, mul(a, -1), r, u, v, rgb, seg); disc(b, p1, a, r, u, v, rgb, seg);
}
function cone(b, pBase, pTip, r, rgb, seg = 20) {
  const ax = sub(pTip, pBase); const hgt = Math.hypot(...ax); const a = norm(ax); const [u, v] = basis(a); const i0 = b.pos.length / 3;
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * 2 * Math.PI; const d = add(mul(u, Math.cos(t)), mul(v, Math.sin(t)));
    const c = lit(rgb, norm(add(mul(d, hgt), mul(a, r))));
    b.v(add(pBase, mul(d, r)), c); b.v(pTip, c);
  }
  for (let i = 0; i < seg; i++) { const k = i0 + 2 * i; b.idx.push(k, k + 2, k + 1); }
  disc(b, pBase, mul(a, -1), r, u, v, rgb, seg);
}
function sphere(b, c, r, rgb, seg = 20, rings = 12) {
  const i0 = b.pos.length / 3;
  for (let j = 0; j <= rings; j++) {
    const ph = (j / rings) * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * 2 * Math.PI; const n = [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)];
      b.v(add(c, mul(n, r)), lit(rgb, n));
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = i0 + j * (seg + 1) + i, d = a + seg + 1; b.idx.push(a, d, a + 1, a + 1, d, d + 1);
  }
}
function roundedRect(b, x0, x1, y0, y1, r, z, rgb) {
  const pts = []; const cs = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= 6; i++) { const t = ((a0 + i * 15) * Math.PI) / 180; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]); }
  const col = flat(rgb); face(b, pts, [0, 0, 1], () => col);
}

// I-section swept along the beam. dyAt(x) = vertical displacement of the axis (mm).
function ibeam(b, x0, x1, dyAt, rgb, grow = 0, N = 96) {
  const h = DIM.h + grow, tf = DIM.tf + grow * 0.5, tw = DIM.tw + grow;
  const v0 = -grow, v1 = DIM.W + grow, c = (v0 + v1) / 2;
  const sec = [[-h, v0], [-h + tf, v0], [-h + tf, c - tw / 2], [h - tf, c - tw / 2], [h - tf, v0], [h, v0],
    [h, v1], [h - tf, v1], [h - tf, c + tw / 2], [-h + tf, c + tw / 2], [-h + tf, v1], [-h, v1]];   // CCW in (y, z)
  const xs = Array.from({ length: N + 1 }, (_, j) => x0 + ((x1 - x0) * j) / N);
  const dys = xs.map(dyAt);
  for (let e = 0; e < sec.length; e++) {
    const [u0, w0] = sec[e], [u1, w1] = sec[(e + 1) % sec.length];
    const col = lit(rgb, norm([0, w1 - w0, -(u1 - u0)]));
    const i0 = b.pos.length / 3;
    for (let j = 0; j <= N; j++) { const y = AXIS + dys[j]; b.v([xs[j], y + u0, w0], col); b.v([xs[j], y + u1, w1], col); }
    for (let j = 0; j < N; j++) { const k = i0 + 2 * j; b.idx.push(k, k + 2, k + 3, k, k + 3, k + 1); }
  }
  for (const [j, nx] of [[0, -1], [N, 1]]) {
    const y = AXIS + dys[j], x = xs[j];
    for (const [ua, ub, wa, wb] of [[-h, -h + tf, v0, v1], [-h + tf, h - tf, c - tw / 2, c + tw / 2], [h - tf, h, v0, v1]]) {
      face(b, [[x, y + ua, wa], [x, y + ub, wa], [x, y + ub, wb], [x, y + ua, wb]], [nx, 0, 0], solidColor(rgb));
    }
  }
}

function arrow(b, tail, tip, rgb, shaftR = 0.9, headR = 2.3, headL = 5.5) {
  const d = norm(sub(tip, tail)); const headBase = sub(tip, mul(d, headL));
  cylinder(b, tail, add(headBase, mul(d, 0.3)), shaftR, rgb);
  cone(b, headBase, tip, headR, rgb);
}

// Area between a curve and its base line, extruded from z0 to z1.
// pts: [[x, y], ...] in mm, left to right (repeated x = vertical jump), starting and ending on the base.
// colorAt(x, y, side) -> sRGB base colour; side = +1 above the base, -1 below.
function area(b, pts, base, z0, z1, colorAt) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const side = (y0 + y1) / 2 - base >= 0 ? 1 : -1;
    const c = (p, n) => lit(colorAt(p[0], p[1], side), n);
    if (x1 - x0 > 1e-9) face(b, [[x0, base, z1], [x1, base, z1], [x1, y1, z1], [x0, y0, z1]], [0, 0, 1], c);
    const dx = x1 - x0, dy = y1 - y0;
    if (Math.hypot(dx, dy) < 1e-9) continue;
    const n = side > 0 ? norm([-dy, dx, 0]) : norm([dy, -dx, 0]);     // outward from the filled area
    face(b, [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], n, c);
  }
}

// Rough label width in mm (for placing labels so they do not collide).
const labelWidth = (str, h) => str.replace(/_\{|\}/g, "").length * h * 0.5 + h * 1.1;

// st: { sol, layers: {reactions, sfd, bmd}, beam: "original"|"deflected"|"both", defl: 0..1 (animated), dragging: null|"P"|"s"|"e"|"udl" }
export function buildScene(st) {
  const S = new Scene();
  const { sol } = st;
  const solid = S.batch("solid");
  const z = DIM.zMid;
  const amount = st.defl;                       // animated 0..1 (0 = straight)
  const showDefl = st.beam !== "original" && amount > 0.02;
  const eps = 1e-3;
  const slope0 = sol.defl(eps) / eps, slopeL = -sol.defl(sol.L - eps) / eps;
  const deflAt = (x) => {
    const m = (x - XA) / G.mmPerM;
    const d = m <= 0 ? slope0 * m : m >= sol.L ? slopeL * (m - sol.L) : sol.defl(m);
    return -DIM.deflScale * d * amount;
  };
  const X = (m) => XA + m * G.mmPerM;
  const xa = X(sol.a), xs = X(sol.s), xe = X(sol.e), xM = X(sol.xM);
  const bx0 = XA - DIM.over, bx1 = XB + DIM.over;
  const pts = diagramPoints(sol);

  // ---- beam (deflected or straight) + ghost of the original when showing both
  ibeam(solid, bx0, bx1, deflAt, C.steel);
  if (st.beam === "both" && amount > 0.01) ibeam(S.batch("ghost", 0.3, 4), bx0, bx1, () => 0, C.ghost, 0.25);

  // ---- supports
  const bot = AXIS - DIM.h;                                  // underside of the undeflected beam
  prism(solid, [[XA, bot], [XA - 5.5, bot - 9], [XA + 5.5, bot - 9]], 1, 8, () => C.support);
  cylinder(solid, [XA, bot - 1.3, 0.4], [XA, bot - 1.3, 8.6], 1.05, C.pinMetal);
  box(solid, XA - 8, XA + 8, bot - 10.8, bot - 9, 0, 10, C.ground);
  prism(solid, [[XB, bot], [XB - 5.5, bot - 6.2], [XB + 5.5, bot - 6.2]], 1, 8, () => C.support);
  for (const dx of [-2.8, 2.8]) cylinder(solid, [XB + dx, bot - 7.6, 0.5], [XB + dx, bot - 7.6, 8.5], 1.35, C.pin);
  box(solid, XB - 8, XB + 8, bot - 10.8, bot - 9, 0, 10, C.ground);

  // ---- UDL: arrows from a top bar down to the (deflected) beam, a handle at each end
  const topAt = (x) => AXIS + DIM.h + deflAt(x);
  const ut = AXIS + DIM.h + DIM.udlH;
  box(solid, xs, xe, ut - 0.5, ut + 0.5, z - 0.9, z + 0.9, C.load);
  const n = Math.max(1, Math.round((xe - xs) / 7));
  for (let i = 0; i <= n; i++) {
    const x = xs + ((xe - xs) * i) / n, tip = topAt(x) + 0.2;
    cylinder(solid, [x, ut - 0.4, z], [x, tip + 2.6, z], 0.45, C.load, 10);
    cone(solid, [x, tip + 2.9, z], [x, tip, z], 1.3, C.load, 12);
  }
  const drag = st.dragging;
  for (const [x, id] of [[xs, "s"], [xe, "e"]]) {
    sphere(solid, [x, ut, z], drag === id || drag === "udl" ? 3.4 : 2.8, C.load, 16, 10);
    for (const d of [-1, 1]) cone(solid, [x + d * 4.4, ut, z], [x + d * 6.9, ut, z], 1.15, C.load, 10);
  }

  // ---- point load (drag handle at the tail)
  const tailY = AXIS + DIM.h + DIM.arm, hy = tailY + 3.3;
  arrow(solid, [xa, tailY, z], [xa, topAt(xa) + 0.3, z], C.load, 0.95, 2.5, 6);
  sphere(solid, [xa, hy, z], drag === "P" ? 4.0 : 3.3, C.load);
  for (const d of [-1, 1]) cone(solid, [xa + d * 5.4, hy, z], [xa + d * 8.6, hy, z], 1.5, C.load, 12);
  const pRight = xa < 45;
  S.label({ id: "P", lines: [{ t: `P = ${sol.P} kN`, s: 1, w: 700 }, { t: `a = ${fmt.m(sol.a)} m`, s: 0.78, w: 600 }],
    color: PAL.load, pos: [xa + (pRight ? 10.5 : -10.5), hy, z], h: 4.6, anchor: pRight ? "left" : "right" });

  // UDL label: above the bar, moved aside if the point load arrow runs through it
  const uh = 3.9, uLines = [`w = ${sol.w} kN/m`, `${sol.s.toFixed(1)} m to ${sol.e.toFixed(1)} m`];
  const uw = labelWidth(uLines[1], uh) + 1, uy = ut + 7.2, mid = (xs + xe) / 2;
  const free = (x0, x1) => x0 > -103 && x1 < 103 && (x1 < xa - 4 || x0 > xa + 4);
  const place = [[mid - uw / 2, mid + uw / 2, "center", mid, uy], [xs - 9 - uw, xs - 9, "right", xs - 9, ut], [xe + 9, xe + 9 + uw, "left", xe + 9, ut],
    [xa - 5 - uw, xa - 5, "right", xa - 5, uy], [xa + 5, xa + 5 + uw, "left", xa + 5, uy]]      // last two: either side of the P arrow
    .find(([x0, x1]) => free(x0, x1)) ?? [0, 0, "center", mid, uy];
  S.label({ id: "udl", lines: [{ t: uLines[0], w: 700 }, { t: uLines[1], s: 0.8, w: 600 }], color: PAL.load,
    pos: [place[3], place[4], z], h: uh, anchor: place[2] });

  // ---- reactions (arrow length proportional to magnitude; 40 kN = longest)
  if (st.layers.reactions) {
    for (const [x, R, nm] of [[XA, sol.RA, "A"], [XB, sol.RB, "B"]]) {
      const tip = bot - 12.2, tail = tip - (6.5 + 10 * (R / 40));
      arrow(solid, [x, tail, z], [x, tip, z], C.reaction, 0.95, 2.4, 5.2);
      S.label({ id: "R" + nm, lines: [{ t: `R_{${nm}} = ${fmt.kN(R)} kN`, w: 700 }], color: PAL.reaction,
        pos: [x, tail - 4.4, z], h: 4.4, anchor: "center" });
    }
  }

  // ---- deflection marker
  if (showDefl) {
    const xd = X(sol.xDmax), yb = bot + deflAt(xd);
    sphere(solid, [xd, yb - 1.8, z], 1.3, C.defl, 14, 8);
    S.label({ id: "dmax", lines: [{ t: `\u03B4_{max} at x = ${fmt.m(sol.xDmax)} m`, w: 700 }, { t: "deflection exaggerated", s: 0.78, w: 600 }],
      color: PAL.defl, pos: [xd, yb - 9.5, z], h: 3.9, anchor: "center" });
  }

  // ---- diagram panels
  const panels = S.batch("panels", 0.84, -1), shadows = S.batch("panelShadow", 0.14, -2);
  const drawPanel = (y0, y1) => {
    roundedRect(shadows, DIM.panelX0 + 0.8, DIM.panelX1 + 0.8, y0 - 1.4, y1 - 1.4, 3, 0.1, C.navy);
    roundedRect(panels, DIM.panelX0, DIM.panelX1, y0, y1, 3, 0.3, C.panel);
  };

  let guideEnd = null;
  if (st.layers.sfd) {
    drawPanel(DIM.sfdBot, DIM.sfdTop);
    const b0 = sy(G.sfdBase), s = G.sfdScale;
    area(solid, pts.v.map(([x, v]) => [X(x), b0 + v * s]), b0, 0.6, 2.8, (x, y, side) => (side > 0 ? C.sfdPos : C.sfdNeg));
    box(solid, XA - 3, XB + 3, b0 - 0.22, b0 + 0.22, 0.6, 3.0, C.axis);
    sphere(solid, [xM, b0, 3.0], 1.1, C.navy, 12, 8);
    S.label({ id: "sfdT", lines: [{ t: "Shear force  V (kN)", w: 600 }], color: PAL.grey, pos: [DIM.panelX1 - 2.5, DIM.sfdTop - 4, 0.5], h: 3.6, anchor: "right", style: "plain", halo: false, flat: true });
    S.label({ id: "sfd+", lines: [{ t: "+" + fmt.kN(sol.RA), w: 700 }], color: PAL.navy, pos: [XA + 1, Math.min(b0 + sol.RA * s + 4.2, DIM.sfdTop - 3.2), 3], h: 4.0, anchor: "left" });
    S.label({ id: "sfd-", lines: [{ t: "\u2212" + fmt.kN(sol.RB), w: 700 }], color: PAL.navy, pos: [XB - 1, Math.max(b0 - sol.RB * s - 4.2, DIM.sfdBot + 3.2), 3], h: 4.0, anchor: "right" });
    const vRight = xM < 40;
    S.label({ id: "v0", lines: [{ t: sol.shearJump ? "V changes sign" : "V = 0", w: 700 }], color: PAL.navy,
      pos: [xM + (vRight ? 3 : -3), b0 - 4.2, 3], h: 3.4, anchor: vRight ? "left" : "right" });
    guideEnd = b0;
  }
  if (st.layers.bmd) {
    drawPanel(DIM.bmdBot, DIM.bmdTop);
    const b0 = sy(G.bmdBase), s = G.bmdScale, peak = b0 - sol.Mmax * s, full = 40 * s;
    const shadeAt = (x, y) => mix(C.bmdLight, C.bmdDark, Math.min(1, Math.max(0, (b0 - y) / full)));
    area(solid, pts.m.map(([x, m]) => [X(x), b0 - m * s]), b0, 0.6, 3.2, shadeAt);
    box(solid, XA - 3, XB + 3, b0 - 0.22, b0 + 0.22, 0.6, 3.4, C.axis);
    sphere(solid, [xM, peak, 3.2], 1.2, C.navy, 14, 8);
    S.label({ id: "bmdT", lines: [{ t: "Bending moment  M (kNm), sagging below axis", w: 600 }], color: PAL.grey, pos: [DIM.panelX1 - 2.5, DIM.bmdTop - 4, 0.5], h: 3.6, anchor: "right", style: "plain", halo: false, flat: true });
    const lines = [{ t: `M_{max} = ${fmt.kNm(sol.Mmax)} kNm`, w: 700 }, { t: `at x = ${fmt.m(sol.xM)} m`, s: 0.8, w: 600 }];
    if (peak - 12 > DIM.bmdBot) S.label({ id: "mmax", lines, color: PAL.navy, pos: [Math.min(Math.max(xM, -52), 52), peak - 7.2, 3.4], h: 4.2, anchor: "center" });
    else { const r = xM < 0; S.label({ id: "mmax", lines, color: PAL.navy, pos: [xM + (r ? 4 : -4), peak + 3, 3.4], h: 4.2, anchor: r ? "left" : "right" }); }
    guideEnd = peak;
  }

  // ---- dashed guide from the beam down to the maximum moment (through V = 0)
  if (guideEnd !== null) {
    const g = S.batch("guide", 0.9, 3);
    for (let y = bot + deflAt(xM) - 1.5; y > guideEnd + 1; y -= 3.6) box(g, xM - 0.28, xM + 0.28, Math.max(guideEnd + 1, y - 2), y, 3.4, 3.9, C.guide);
  }
  return S;
}

// Where the drag handles are (page mm, on the load plane), for hit testing.
export function handles3d(sol) {
  const X = (m) => XA + m * G.mmPerM;
  const xa = X(sol.a), xs = X(sol.s), xe = X(sol.e);
  const ut = AXIS + DIM.h + DIM.udlH, hy = AXIS + DIM.h + DIM.arm + 3.3, top = AXIS + DIM.h;
  const P = (x, y) => { const p = toPage(x, y); return [p.xmm, p.ymm]; };
  return {
    P: P(xa, hy), s: P(xs, ut), e: P(xe, ut),
    udlBox: [P(xs, 0)[0], P(xe, 0)[0], G.targetH / 2 - ut, G.targetH / 2 - top],   // x0, x1, top (page y), bottom (page y)
    pShaft: [P(xa, 0)[0], G.targetH / 2 - hy, G.targetH / 2 - top],               // x, top, bottom (page y)
  };
}

// Ray pick in figure-local coordinates: ray {origin:[x,y,z], dir:[x,y,z]} -> page mm or null.
// bounded = true only accepts touches in the load band (used to start a drag).
export function pickLoadPlane(origin, dir, bounded = true) {
  if (Math.abs(dir[2]) < 1e-9) return null;
  const t = (DIM.zMid - origin[2]) / dir[2];
  if (t < 0) return null;
  const x = origin[0] + dir[0] * t, y = origin[1] + dir[1] * t;
  if (bounded && (y < DIM.dragY0 || y > DIM.dragY1)) return null;
  return toPage(x, y);
}
