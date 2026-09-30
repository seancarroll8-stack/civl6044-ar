# CIVL6044 Mobile AR Structural Mechanics – UDL example (Prototype 1.1)

A second interactive problem sheet, alongside the point-load example. The simply supported beam carries a 20 kN point load **and** a 10 kN/m uniformly distributed load (UDL). Students can drag the point load, drag either end of the UDL to change the length it acts over, or slide the whole UDL along the beam, and watch the reactions, shear force, bending moment and deflected shape update in AR, in 3D or on the flat sheet.

Live address (once uploaded): https://seancarroll8-stack.github.io/civl6044-ar/udl/

It lives in its own `udl` folder inside the existing `civl6044-ar` repository and does not change the point-load example in any way.

## Printed problem

Span 4.0 m; pin at A, roller at B; P = 20 kN at 1.5 m from A; w = 10 kN/m from 2.0 m to 4.0 m.

- R<sub>B</sub> = (20 × 1.5 + 20 × 3.0) / 4 = 22.5 kN, R<sub>A</sub> = 40 − 22.5 = 17.5 kN
- Shear changes sign under the point load (+17.5 → −2.5 kN), so M<sub>max</sub> = 17.5 × 1.5 = 26.25 kNm at 1.5 m
- Print `print/CIVL6044_AR_UDL_Problem.pdf` on A4 at actual size. Its QR code opens the address above.

## Setting it up (about 10 minutes)

1. **Upload the folder.** In the `civl6044-ar` repository choose Add file → Upload files, drag the whole `udl` folder (the folder itself, as one item) into the upload box, and commit. Everything lands inside `udl/`; nothing at the top level changes.
2. **Make its AR target.** This sheet looks different from the first one, so it needs its own target file. Open https://hiukim.github.io/mind-ar-js-doc/tools/compile, upload `udl/assets/target.png`, press Start and download `targets.mind`.
3. **Upload the target.** In the repository open `udl`, then `assets`, choose Add file → Upload files, upload `targets.mind` and commit.

GitHub Pages is already switched on for the repository, so no settings need changing.

## Using it

- **Drag the red handles**: the ball on the point load moves it; the ball at either end of the UDL changes where it starts or ends; touching the UDL between its ends slides it along without changing its length. Everything snaps to 0.1 m. The UDL is always at least 0.5 m long.
- **Sliders**: *Point load* moves the point load; *UDL* has two handles for the start and end. The reset button returns both loads to the printed problem.
- **Reactions / SFD / BMD / Show all**, **Beam: Original / Deflected / Both**, **Stand up**, **Size** and **Freeze** work exactly as in the point-load example.
- The dashed guide line and the "V = 0" / "V changes sign" marker show where the shear changes sign; the maximum bending moment is always there. Depending on where the loads are, that is under the point load or part way along the UDL.

Useful links: `…/civl6044-ar/udl/?mode=3d` opens the 3D model, `?mode=2d` the flat sheet.

## How it works

- **Calculations** (`js/beam.js`): reactions from equilibrium; shear and moment from the loads left of each section; the maximum moment is found where the shear changes sign. The deflected shape is found by integrating the bending moment twice (EI constant), so it works for any combination of loads. EI is outside the scope of the prototype, so the deflection is scaled so the largest case students can make (20 kN at midspan with the UDL over the whole span) is drawn at full size.
- **Scales**: SFD 0.45 mm/kN and BMD 0.9 mm/kNm on the sheet, so the largest possible values (40 kN, 40 kNm) still fit their panels. Reaction arrows are proportional to their values.
- The 3D model, stand-up hinge, labels, touch picking and the three views are shared with the point-load example (see its README).
- `tests/validate.mjs` checks the solver independently (see `VALIDATION.md`); `tests/preview.html?a=2.6&s=0.5&e=3&sfd=1&bmd=1&theta=70` previews the 3D model without three.js.

## Changing the problem

Edit `tools/build_sheet.py`, then run `python3 tools/build_sheet.py --url https://seancarroll8-stack.github.io/civl6044-ar/udl/`. This regenerates the PDF, `assets/target.png` and `js/geometry.js`; any change to the sheet above the footer means compiling a new `targets.mind`.

## Credits and licences

MindAR (MIT), three.js (MIT), Barlow typeface (SIL Open Font Licence).
