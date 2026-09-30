// CIVL6044 AR Prototype 1.1 (UDL example) - calculation layer.
// Simply supported beam, span L, with a point load P at a from A and a
// uniformly distributed load w (kN/m) acting from s to e (metres from A).
// Sign convention (CIVL6044): +V = resultant acting upward on the left of the cut;
// +M = sagging. Units: m, kN, kNm.

export function solve({ L, P, a, w, s, e }) {
  if (!(L > 0) || !(a > 0) || !(a < L)) throw new RangeError("Point load must lie strictly between the supports");
  if (!(s >= 0) || !(e <= L) || !(e > s)) throw new RangeError("UDL must lie on the beam with its end after its start");
  const c = e - s, W = w * c, xc = (s + e) / 2;
  const RB = (P * a + W * xc) / L;            // moments about A
  const RA = P + W - RB;                      // vertical equilibrium

  const loaded = (x) => Math.min(Math.max(x - s, 0), c);       // UDL length to the left of x
  // Shear force. At x = a it is two-valued; side = -1 (just left) / +1 (just right).
  const V = (x, side = 0) => RA - (x > a || (x === a && side > 0) ? P : 0) - w * loaded(x);
  // Bending moment (sagging positive), taking moments of the loads left of the cut.
  const M = (x) => RA * x - (x > a ? P * (x - a) : 0) - w * loaded(x) * (x - s - loaded(x) / 2);

  // Maximum moment: where the shear changes sign (under the point load, or inside the UDL).
  const cands = [a, s, e];
  if (w > 0) {
    const x1 = s + RA / w;             if (x1 > s && x1 < e && x1 <= a) cands.push(x1);   // zero shear left of P
    const x2 = s + (RA - P) / w;       if (x2 > s && x2 < e && x2 >= a) cands.push(x2);   // zero shear right of P
  }
  let xM = a, Mmax = -Infinity;
  for (const x of cands) { const m = M(x); if (m > Mmax + 1e-9) { Mmax = m; xM = x; } }
  const shearJump = Math.abs(xM - a) < 1e-9;   // shear changes sign by jumping under the point load

  // Deflected shape (downward positive): EI d2(delta)/dx2 = -M, delta(0) = delta(L) = 0,
  // found by integrating M twice. EI is outside the scope of the prototype, so it is
  // normalised by the largest possible case (20 kN at midspan + 10 kN/m over the whole span):
  // 1.0 = the biggest deflection students can produce.
  const N = 800, h = L / N, xs = new Float64Array(N + 1), I1 = new Float64Array(N + 1), I2 = new Float64Array(N + 1);
  let mPrev = 0;
  for (let i = 0; i <= N; i++) {
    xs[i] = i * h; const m = M(xs[i]);
    if (i) { I1[i] = I1[i - 1] + (h * (mPrev + m)) / 2; I2[i] = I2[i - 1] + (h * (I1[i - 1] + I1[i])) / 2; }
    mPrev = m;
  }
  const ref = (20 * L ** 3) / 48 + (5 * 10 * L ** 4) / 384;
  const d = Float64Array.from(xs, (x, i) => ((x * I2[N]) / L - I2[i]) / ref);
  const defl = (x) => {
    const t = Math.min(Math.max(x / h, 0), N); const i = Math.min(Math.floor(t), N - 1);
    return d[i] + (d[i + 1] - d[i]) * (t - i);
  };
  let im = 0; for (let i = 1; i <= N; i++) if (d[i] > d[im]) im = i;
  let xDmax = xs[im];
  if (im > 0 && im < N) {                     // refine with a parabola through the three nearest points
    const y0 = d[im - 1], y1 = d[im], y2 = d[im + 1], den = y0 - 2 * y1 + y2;
    if (den < 0) xDmax += (h * (y0 - y2)) / (2 * den);
  }

  return { L, P, a, w, s, e, c, W, xc, RA, RB, V, M, Mmax, xM, shearJump, defl, xDmax, dmax: defl(xDmax) };
}

// Points for drawing the diagrams, in beam units: [x (m), value].
// Exact breakpoints are included, and the shear curve gets explicit zero crossings,
// so each piece can be filled with one colour.
export function diagramPoints(sol, step = 0.05) {
  const { L, a, s, e, V, M } = sol;
  const set = new Set([0, L, a, s, e, sol.xM]);
  for (let i = 1; i * step < L - 1e-9; i++) set.add(Number((i * step).toFixed(6)));
  const X = [...set].filter((x) => x >= 0 && x <= L).sort((p, q) => p - q);

  const v = [[0, 0]];
  for (const x of X) {
    if (x === a) v.push([x, V(x, -1)], [x, V(x, +1)]);
    else v.push([x, V(x, x === L ? -1 : +1)]);
  }
  v.push([L, 0]);
  const vz = [v[0]];                          // insert zero crossings
  for (let i = 1; i < v.length; i++) {
    const [x0, v0] = v[i - 1], [x1, v1] = v[i];
    if ((v0 > 1e-12 && v1 < -1e-12) || (v0 < -1e-12 && v1 > 1e-12)) vz.push([x0 === x1 ? x0 : x0 + ((x1 - x0) * v0) / (v0 - v1), 0]);
    vz.push(v[i]);
  }
  const m = [[0, 0], ...X.map((x) => [x, M(x)]), [L, 0]];
  return { v: vz, m };
}

// Snap to the teaching grid and clamp.
export function snap(x, step, lo, hi) {
  const s = Math.round(x / step) * step;
  return Math.min(hi, Math.max(lo, Number(s.toFixed(6))));
}

// Number formatting used everywhere (screen and overlay) so values always match.
export const fmt = {
  kN: (v) => (Math.abs(v) < 5e-7 ? "0.0" : v.toFixed(1)),
  kNm: (v) => (Math.abs(v) < 5e-7 ? "0.00" : v.toFixed(2)),
  m: (v) => v.toFixed(2),
  signed: (v, f) => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + f(Math.abs(v)),
};
