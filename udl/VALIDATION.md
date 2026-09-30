# Validation – UDL example

`node tests/validate.mjs` checks `js/beam.js` independently of the way it calculates:

- Vertical equilibrium and moments about A for every case.
- Shear and moment at 399 sections against a free-body diagram in which the UDL is split into 4000 small point loads (shear to 0.005 kN, moment to 0.001 kNm).
- The maximum moment against a search of 40 001 points, and the shear changing sign at that position.
- dM/dx = V away from the load discontinuities.
- Deflection: zero at both supports, downward everywhere, zero slope at the reported maximum; point load alone against the textbook elastic curve; full-span UDL alone against 5wL⁴/384EI; superposition of the two loads.

| a (m) | UDL (m) | R_A (kN) | R_B (kN) | M_max (kNm) | at x (m) | shear changes sign | δ_max at x (m) |
|---|---|---|---|---|---|---|---|
| 1.5 | 2.0–4.0 | 17.50 | 22.50 | 26.25 | 1.500 | under P | 1.979 |
| 1.5 | 0.0–4.0 | 32.50 | 27.50 | 37.50 | 1.500 | under P | 1.938 |
| 2.0 | 0.0–4.0 | 30.00 | 30.00 | 40.00 | 2.000 | under P | 2.000 |
| 3.5 | 0.0–2.5 | 19.69 | 25.31 | 19.38 | 1.969 | in UDL | 2.011 |
| 0.5 | 1.0–1.5 | 20.94 | 4.06 | 10.98 | 1.094 | in UDL | 1.748 |
| 2.6 | 2.0–3.0 | 10.75 | 19.25 | 26.15 | 2.600 | under P | 2.149 |
| 1.0 | 0.5–3.5 | 30.00 | 20.00 | 30.00 | 1.500 | in UDL | 1.914 |
| 3.9 | 3.0–4.0 | 1.75 | 28.25 | 5.40 | 3.175 | in UDL | 2.283 |
| 0.1 | 0.0–0.5 | 24.19 | 0.81 | 2.88 | 0.419 | in UDL | 1.695 |
| 2.2 | 1.0–3.0 | 19.00 | 21.00 | 34.60 | 2.200 | under P | 2.034 |

All checks passed (10 load cases, plus deflection against textbook formulas).
