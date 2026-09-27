// Independent check of js/beam.js (run: node tests/validate.mjs)
// Reactions: hand-calculation formulas. V and M: checked against equilibrium of a free body.
// Deflection: numerical double integration of M/EI (trapezoidal), independent of the closed form.
import { solve } from "../js/beam.js";

const L = 4.0, P = 20.0;
const positions = [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 3.9];
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log("FAIL:", msg); } };
const rows = [];

for (const a of positions) {
  const s = solve(L, P, a);
  const b = L - a;
  // hand calculation
  const RA = P * b / L, RB = P * a / L, Mmax = RA * a;
  check(Math.abs(s.RA - RA) < 1e-9 && Math.abs(s.RB - RB) < 1e-9, `reactions a=${a}`);
  check(Math.abs(s.RA + s.RB - P) < 1e-9, `vertical equilibrium a=${a}`);
  check(Math.abs(s.RB * L - P * a) < 1e-9, `moments about A a=${a}`);
  check(Math.abs(s.Mmax - Mmax) < 1e-9 && Math.abs(s.Mmax - s.RB * b) < 1e-9, `Mmax a=${a}`);

  // free-body check of V and M at many sections (left segment)
  for (let i = 1; i < 400; i++) {
    const x = (L * i) / 400; if (Math.abs(x - a) < 1e-9) continue;
    const Vfb = RA - (x > a ? P : 0);
    const Mfb = RA * x - (x > a ? P * (x - a) : 0);
    check(Math.abs(s.V(x) - Vfb) < 1e-9 && Math.abs(s.M(x) - Mfb) < 1e-9, `V/M free body a=${a} x=${x}`);
  }
  check(s.V(a, -1) === RA && Math.abs(s.V(a, +1) - (RA - P)) < 1e-9, `shear jump of P at load a=${a}`);

  // numerical deflection: y'' = -M/EI with y(0)=y(L)=0 (EI = 1), downward positive
  const n = 20000, h = L / n; const th = [0]; const y = [0];
  for (let i = 1; i <= n; i++) th.push(th[i - 1] + 0.5 * h * (s.M((i - 1) * h) + s.M(i * h)));
  for (let i = 1; i <= n; i++) y.push(y[i - 1] + 0.5 * h * (th[i - 1] + th[i]));
  const c1 = y[n] / L; const yd = y.map((v, i) => -(v - c1 * i * h));      // enforce y(L)=0, flip to downward +
  let imax = 0; yd.forEach((v, i) => { if (v > yd[imax]) imax = i; });
  const xNum = imax * h, dNum = yd[imax] * 48 / (P * L ** 3);
  check(Math.abs(xNum - s.xDmax) < 2e-3, `x of max deflection a=${a}: ${xNum} vs ${s.xDmax}`);
  check(Math.abs(dNum - s.dmax) / s.dmax < 1e-4, `max deflection shape a=${a}: ${dNum} vs ${s.dmax}`);
  for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const i = Math.round(f * n); const num = yd[i] * 48 / (P * L ** 3);
    check(Math.abs(num - s.defl(i * h)) < 1e-4, `deflection shape a=${a} x=${i * h}`);
  }
  rows.push([a, s.b, s.RA, s.RB, s.RA, s.RA - P, s.Mmax, s.xDmax, xNum]);
}

console.log("| a (m) | b (m) | R_A (kN) | R_B (kN) | V left of load (kN) | V right of load (kN) | M_max (kNm) | x of max deflection, formula (m) | x of max deflection, numerical (m) |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r[0].toFixed(1)} | ${r[1].toFixed(1)} | ${r[2].toFixed(2)} | ${r[3].toFixed(2)} | +${r[4].toFixed(2)} | ${r[5].toFixed(2)} | ${r[6].toFixed(2)} | ${r[7].toFixed(3)} | ${r[8].toFixed(3)} |`);
console.log(fails ? `\n${fails} check(s) FAILED` : `\nAll checks passed (${positions.length} load positions).`);
process.exit(fails ? 1 : 0);
