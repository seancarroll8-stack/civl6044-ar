// CIVL6044 AR Prototype 1 - calculation layer.
// Simply supported beam, span L, single point load P at distance a from A.
// Sign convention (CIVL6044): +V = resultant acting upward on the left of the cut;
// +M = sagging. Units: m, kN, kNm.

export function solve(L, P, a) {
  if (!(L > 0) || !(a > 0) || !(a < L)) throw new RangeError("Load must lie strictly between the supports");
  const b = L - a;
  const RA = (P * b) / L;
  const RB = (P * a) / L;

  // Shear force. At x = a the value is two-valued; callers pass side = -1 / +1.
  const V = (x, side = 0) => {
    if (x < a || (x === a && side < 0)) return RA;
    return RA - P;
  };

  // Bending moment (sagging positive).
  const M = (x) => (x <= a ? RA * x : RA * x - P * (x - a));
  const Mmax = RA * a;            // = RB * b, under the load

  // Deflected shape, downward positive, normalised by PL^3/(48EI)
  // (= 1.0 for a central load at midspan). EI is not part of Prototype 1,
  // so only the shape and relative size are meaningful.
  const L4 = L ** 4;
  const defl = (x) => (x <= a
    ? (8 * b * x * (L * L - b * b - x * x)) / L4
    : (8 * a * (L - x) * (L * L - a * a - (L - x) ** 2)) / L4);

  // Position of maximum deflection: always in the longer segment.
  const xDmax = a <= b ? L - Math.sqrt((L * L - a * a) / 3) : Math.sqrt((L * L - b * b) / 3);

  return { L, P, a, b, RA, RB, V, M, Mmax, xMmax: a, defl, xDmax, dmax: defl(xDmax) };
}

// Snap and clamp a load position to the teaching grid.
export function snapLoad(a, { step, aMin, aMax }) {
  const s = Math.round(a / step) * step;
  return Math.min(aMax, Math.max(aMin, Number(s.toFixed(6))));
}

// Number formatting used everywhere (screen and overlay) so values always match.
export const fmt = {
  kN: (v) => (Math.abs(v) < 5e-7 ? "0.0" : v.toFixed(1)),
  kNm: (v) => (Math.abs(v) < 5e-7 ? "0.00" : v.toFixed(2)),
  m: (v) => v.toFixed(2),
  signed: (v, f) => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + f(Math.abs(v)),
};
