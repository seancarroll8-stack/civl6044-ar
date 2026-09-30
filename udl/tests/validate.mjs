// Independent checks of js/beam.js for the point load + UDL example.
// Run: node tests/validate.mjs     (writes the results table used in VALIDATION.md)
import { solve } from "../js/beam.js";

const L = 4, P = 20, w = 10;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL:", msg); } };
const near = (x, y, tol) => Math.abs(x - y) <= tol;

// Free-body diagram of the part left of a cut, with the UDL split into 4000 small point loads
// (a different method from the solver's closed-form expressions). Its shear steps by w*dx,
// so shear is compared to 0.005 kN and moment to 0.001 kNm.
function freeBody(c, x) {
  let V = c.RA, M = c.RA * x;
  if (c.a < x) { V -= P; M -= P * (x - c.a); }
  const n = 4000, dx = (c.e - c.s) / n;
  for (let i = 0; i < n; i++) {
    const xi = c.s + (i + 0.5) * dx;
    if (xi < x) { V -= w * dx; M -= w * dx * (x - xi); }
  }
  return { V, M };
}

const cases = [
  [1.5, 2.0, 4.0], [1.5, 0.0, 4.0], [2.0, 0.0, 4.0], [3.5, 0.0, 2.5], [0.5, 1.0, 1.5],
  [2.6, 2.0, 3.0], [1.0, 0.5, 3.5], [3.9, 3.0, 4.0], [0.1, 0.0, 0.5], [2.2, 1.0, 3.0],
];
const rows = [];
for (const [a, s, e] of cases) {
  const c = solve({ L, P, a, w, s, e });
  const W = w * (e - s);
  // equilibrium
  check(near(c.RA + c.RB, P + W, 1e-9), `vertical equilibrium a=${a} s=${s} e=${e}`);
  check(near(c.RB * L - P * a - W * (s + e) / 2, 0, 1e-9), `moments about A a=${a}`);
  // shear and moment against the free-body diagram at 399 sections
  let maxV = 0, maxM = 0, gridMax = -Infinity, gridX = 0;
  for (let i = 1; i < 400; i++) {
    const x = (L * i) / 400; if (Math.abs(x - a) < 1e-9) continue;
    const fb = freeBody(c, x);
    maxV = Math.max(maxV, Math.abs(fb.V - c.V(x))); maxM = Math.max(maxM, Math.abs(fb.M - c.M(x)));
  }
  for (let i = 0; i <= 40000; i++) { const x = (L * i) / 40000; const m = c.M(x); if (m > gridMax) { gridMax = m; gridX = x; } }
  check(maxV < 5e-3, `shear vs free body a=${a} s=${s} e=${e} (${maxV})`);
  check(maxM < 1e-3, `moment vs free body a=${a} s=${s} e=${e} (${maxM})`);
  check(near(c.Mmax, gridMax, 1e-4), `Mmax vs fine search a=${a} (${c.Mmax} vs ${gridMax})`);
  check(near(c.xM, gridX, 2e-4) || near(c.M(gridX), c.Mmax, 1e-6), `Mmax position a=${a}`);
  // dM/dx = V away from the point load and UDL ends
  for (const x of [0.37, 1.13, 2.71, 3.33]) {
    if ([a, s, e].some((k) => Math.abs(x - k) < 0.01)) continue;
    const h = 1e-5, dM = (c.M(x + h) - c.M(x - h)) / (2 * h);
    check(near(dM, c.V(x), 1e-4), `dM/dx = V at x=${x}, a=${a}`);
  }
  // shear sign change located at Mmax
  const vl = c.V(c.xM - 1e-6, -1), vr = c.V(c.xM + 1e-6, +1);
  check(vl >= -1e-6 && vr <= 1e-6, `shear changes sign at Mmax a=${a}`);
  // deflection: supports fixed, all downward, maximum where the slope is zero
  check(Math.abs(c.defl(0)) < 1e-9 && Math.abs(c.defl(L)) < 1e-9, `deflection zero at supports a=${a}`);
  let minD = Infinity; for (let i = 0; i <= 200; i++) minD = Math.min(minD, c.defl((L * i) / 200));
  check(minD > -1e-9, `deflection downward everywhere a=${a}`);
  const sl = (c.defl(c.xDmax + 1e-3) - c.defl(c.xDmax - 1e-3)) / 2e-3;
  check(Math.abs(sl) < 2e-3, `slope zero at max deflection a=${a} (${sl})`);
  rows.push(`| ${a.toFixed(1)} | ${s.toFixed(1)}\u2013${e.toFixed(1)} | ${c.RA.toFixed(2)} | ${c.RB.toFixed(2)} | ${c.Mmax.toFixed(2)} | ${c.xM.toFixed(3)} | ${c.shearJump ? "under P" : "in UDL"} | ${c.xDmax.toFixed(3)} |`);
}

// Deflection against textbook closed forms (EI = 1, compared through the solver's normalisation).
const ref = (20 * L ** 3) / 48 + (5 * 10 * L ** 4) / 384;
{ // full-span UDL alone (P = 0 via w only): 5wL^4/384 at midspan
  const c = solve({ L, P: 0, a: 1, w, s: 0, e: L });
  check(near(c.dmax * ref, (5 * w * L ** 4) / 384, 1e-3), `full UDL deflection ${c.dmax * ref}`);
  check(near(c.xDmax, 2, 1e-3), "full UDL max at midspan");
}
for (const a of [0.5, 1.5, 2, 3.3]) { // point load alone: textbook elastic curve
  const c = solve({ L, P, a, w: 0, s: 0, e: 1 }), b = L - a;
  for (const x of [0.4, 1.2, 2.5, 3.6]) {
    const exact = x <= a ? (P * b * x * (L * L - b * b - x * x)) / (6 * L) : (P * a * (L - x) * (L * L - a * a - (L - x) ** 2)) / (6 * L);
    check(near(c.defl(x) * ref, exact, 2e-3 * exact + 1e-6), `point load deflection a=${a} x=${x}`);
  }
  const xd = a <= b ? L - Math.sqrt((L * L - a * a) / 3) : Math.sqrt((L * L - b * b) / 3);
  check(near(c.xDmax, xd, 2e-3), `point load max deflection position a=${a} (${c.xDmax} vs ${xd})`);
}
{ // superposition: P + UDL = P alone + UDL alone
  const both = solve({ L, P, a: 1.5, w, s: 2, e: 4 }), pOnly = solve({ L, P, a: 1.5, w: 0, s: 2, e: 4 }), uOnly = solve({ L, P: 0, a: 1.5, w, s: 2, e: 4 });
  for (const x of [0.8, 2.0, 3.1]) check(near(both.defl(x), pOnly.defl(x) + uOnly.defl(x), 1e-9), `superposition x=${x}`);
}
// the largest case students can make normalises to 1.0
check(near(solve({ L, P, a: 2, w, s: 0, e: 4 }).dmax, 1, 1e-4), "normalisation: largest case = 1.0");

console.log("| a (m) | UDL (m) | R_A (kN) | R_B (kN) | M_max (kNm) | at x (m) | shear changes sign | \u03B4_max at x (m) |");
console.log("|---|---|---|---|---|---|---|---|");
rows.forEach((r) => console.log(r));
console.log(fails ? `\n${fails} check(s) FAILED` : `\nAll checks passed (${cases.length} load cases, plus deflection against textbook formulas).`);
process.exit(fails ? 1 : 0);
