# Validation of the calculation layer

`tests/validate.mjs` checks `js/beam.js` independently at nine load positions (P = 20 kN, L = 4.0 m):

- Reactions against the hand-calculation formulas, vertical equilibrium, and moments about A.
- Shear force and bending moment at 399 sections per load position against a free-body diagram of the left-hand segment.
- The shear jump equal to P at the load.
- The deflected shape and the position of maximum deflection against a numerical double integration of M/EI (20,000 steps), which does not use the closed-form deflection equations.

Run it with `node tests/validate.mjs`. Latest result:

| a (m) | b (m) | R_A (kN) | R_B (kN) | V left of load (kN) | V right of load (kN) | M_max (kNm) | x of max deflection, formula (m) | x of max deflection, numerical (m) |
|---|---|---|---|---|---|---|---|---|
| 0.1 | 3.9 | 19.50 | 0.50 | +19.50 | -0.50 | 1.95 | 1.691 | 1.691 |
| 0.5 | 3.5 | 17.50 | 2.50 | +17.50 | -2.50 | 8.75 | 1.709 | 1.709 |
| 1.0 | 3.0 | 15.00 | 5.00 | +15.00 | -5.00 | 15.00 | 1.764 | 1.764 |
| 1.5 | 2.5 | 12.50 | 7.50 | +12.50 | -7.50 | 18.75 | 1.859 | 1.859 |
| 2.0 | 2.0 | 10.00 | 10.00 | +10.00 | -10.00 | 20.00 | 2.000 | 2.000 |
| 2.5 | 1.5 | 7.50 | 12.50 | +7.50 | -12.50 | 18.75 | 2.141 | 2.141 |
| 3.0 | 1.0 | 5.00 | 15.00 | +5.00 | -15.00 | 15.00 | 2.236 | 2.236 |
| 3.5 | 0.5 | 2.50 | 17.50 | +2.50 | -17.50 | 8.75 | 2.291 | 2.291 |
| 3.9 | 0.1 | 0.50 | 19.50 | +0.50 | -19.50 | 1.95 | 2.309 | 2.309 |

**All checks passed (9 load positions).**
