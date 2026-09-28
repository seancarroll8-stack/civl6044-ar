// CIVL6044 AR Prototype 1.1 - 3D scene description.
// Pure JavaScript (no three.js), so it can be tested on its own.
//
// Everything is built in "sheet frame" millimetres:
//   x to the right, y up the page, z out of the page towards the viewer,
//   origin at the centre of the tracked target image.
// Output: coloured triangle batches (shading baked into vertex colours, stored
// in linear colour space) plus label specs. figure3d.js turns these into three.js objects.

import { G } from "./geometry.js";
import { fmt } from "./beam.js";

export const sx = (xmm) => xmm - G.pageW / 2;
export const sy = (ymm) => G.targetH / 2 - ymm;
export const toPage = (x, y) => ({ xmm: x + G.pageW / 2, ymm: G.targetH / 2 - y });

const XA = sx(G.xA), XB = sx(G.xB), AXIS = sy(G.beamY);

export const DIM = {
  h: 3.6, W: 9, tf: 1.4, tw: 1.2, over: 4,   // I-beam: half depth, width (out of page), flange, web
  zMid: 4.5,                                 // arrows and the drag plane sit at mid-width
  deflScale: 9,                              // mm drawn for PL^3/48EI (exaggerated)
  arm: 22,                                   // load arrow length above the beam
  hingeY: sy(252),                           // stand-up hinge line (bottom of the BMD panel)
  dragY0: sy(166), dragY1: sy(86),           // touches in this band move the load
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

// ------------------------------------------------------------------ the figure
// st: { sol, layers: {reactions, sfd, bmd}, beam: "original"|"deflected"|"both", defl: 0..1 (animated), dragging }
export function buildScene(st) {
  const S = new Scene();
  const { sol } = st;
  const solid = S.batch("solid");
  const z = DIM.zMid;
  const amount = st.defl;                       // animated 0..1 (0 = straight)
  const showDefl = st.beam !== "original" && amount > 0.02;
  const eps = 1e-4;
  const slope0 = sol.defl(eps) / eps, slopeL = -sol.defl(sol.L - eps) / eps;
  const deflAt = (x) => {
    const m = (x - XA) / G.mmPerM;
    const d = m <= 0 ? slope0 * m : m >= sol.L ? slopeL * (m - sol.L) : sol.defl(m);
    return -DIM.deflScale * d * amount;
  };
  const xa = XA + sol.a * G.mmPerM;
  const bx0 = XA - DIM.over, bx1 = XB + DIM.over;

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

  // ---- applied load (drag handle at the tail)
  const top = AXIS + DIM.h + deflAt(xa);
  const tailY = AXIS + DIM.h + DIM.arm, hy = tailY + 3.3;
  arrow(solid, [xa, tailY, z], [xa, top + 0.3, z], C.load, 0.95, 2.5, 6);
  sphere(solid, [xa, hy, z], st.dragging ? 4.0 : 3.3, C.load);
  for (const d of [-1, 1]) cone(solid, [xa + d * 5.4, hy, z], [xa + d * 8.6, hy, z], 1.5, C.load, 12);
  const right = xa < 45;
  S.label({ id: "P", lines: [{ t: `P = ${fmt.kN(sol.P).replace(".0", "")} kN`, s: 1, w: 700 }, { t: `a = ${fmt.m(sol.a)} m`, s: 0.78, w: 600 }],
    color: PAL.load, pos: [xa + (right ? 10.5 : -10.5), hy, z], h: 4.6, anchor: right ? "left" : "right" });

  // ---- reactions (arrow length proportional to magnitude)
  if (st.layers.reactions) {
    for (const [x, R, n] of [[XA, sol.RA, "A"], [XB, sol.RB, "B"]]) {
      const tip = bot - 12.2, tail = tip - (6.5 + 10 * (R / sol.P));
      arrow(solid, [x, tail, z], [x, tip, z], C.reaction, 0.95, 2.4, 5.2);
      S.label({ id: "R" + n, lines: [{ t: `R_{${n}} = ${fmt.kN(R)} kN`, w: 700 }], color: PAL.reaction,
        pos: [x, tail - 4.4, z], h: 4.4, anchor: "center" });
    }
  }

  // ---- deflection marker
  if (showDefl) {
    const xd = XA + sol.xDmax * G.mmPerM, yb = bot + deflAt(xd);
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
    const b0 = sy(G.sfdBase), s = G.sfdScale, t = b0 + sol.RA * s, u = b0 - sol.RB * s;
    box(solid, XA, xa, b0, t, 0.6, 2.8, C.sfdPos);
    box(solid, xa, XB, u, b0, 0.6, 2.8, C.sfdNeg);
    box(solid, XA - 3, XB + 3, b0 - 0.22, b0 + 0.22, 0.6, 3.0, C.axis);
    S.label({ id: "sfdT", lines: [{ t: "Shear force  V (kN)", w: 600 }], color: PAL.grey, pos: [DIM.panelX1 - 2.5, DIM.sfdTop - 4, 0.5], h: 3.6, anchor: "right", style: "plain", halo: false, flat: true });
    S.label({ id: "sfd+", lines: [{ t: "+" + fmt.kN(sol.RA), w: 700 }], color: PAL.navy, pos: [XA + 1, t + 4.2, 3], h: 4.0, anchor: "left" });
    S.label({ id: "sfd-", lines: [{ t: "\u2212" + fmt.kN(sol.RB), w: 700 }], color: PAL.navy, pos: [XB - 1, u - 4.2, 3], h: 4.0, anchor: "right" });
    guideEnd = u;
  }
  if (st.layers.bmd) {
    drawPanel(DIM.bmdBot, DIM.bmdTop);
    const b0 = sy(G.bmdBase), s = G.bmdScale, peak = b0 - sol.Mmax * s, full = 20 * s;
    const shadeAt = (x, y) => mix(C.bmdLight, C.bmdDark, Math.min(1, Math.max(0, (b0 - y) / full)));
    prism(solid, [[XA, b0], [xa, peak], [XB, b0]].reverse(), 0.6, 3.2, shadeAt);
    box(solid, XA - 3, XB + 3, b0 - 0.22, b0 + 0.22, 0.6, 3.4, C.axis);
    sphere(solid, [xa, peak, 3.2], 1.2, C.navy, 14, 8);
    S.label({ id: "bmdT", lines: [{ t: "Bending moment  M (kNm), sagging below axis", w: 600 }], color: PAL.grey, pos: [DIM.panelX1 - 2.5, DIM.bmdTop - 4, 0.5], h: 3.6, anchor: "right", style: "plain", halo: false, flat: true });
    const lx = Math.min(Math.max(xa, -52), 52);
    S.label({ id: "mmax", lines: [{ t: `M_{max} = ${fmt.kNm(sol.Mmax)} kNm`, w: 700 }, { t: `at x = ${fmt.m(sol.a)} m`, s: 0.8, w: 600 }],
      color: PAL.navy, pos: [lx, peak - 7.2, 3.4], h: 4.2, anchor: "center" });
    guideEnd = peak;
  }

  // ---- dashed guide from the load down through the diagrams
  if (guideEnd !== null) {
    const g = S.batch("guide", 0.9, 3);
    for (let y = bot + deflAt(xa) - 1.5; y > guideEnd + 1; y -= 3.6) box(g, xa - 0.28, xa + 0.28, Math.max(guideEnd + 1, y - 2), y, 3.4, 3.9, C.guide);
  }
  return S;
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
