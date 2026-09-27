# CIVL6044 Mobile AR Structural Mechanics – Prototype 1

A printed, exam-style simply supported beam problem that becomes interactive when viewed through a phone. Students scan the QR code, allow the camera, and see the support reactions, shear force diagram, bending moment diagram and exaggerated deflected shape drawn on the sheet. They can drag the load along the beam and watch everything update.

Live address (once set up): https://seancarroll8-stack.github.io/civl6044-ar/

## What is in this folder

| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/` | The web app (static files, no build step) |
| `assets/target.png` | The image the AR tracker recognises (the printed sheet above the footer) |
| `assets/targets.mind` | **You create this** from `target.png` (step 3 below) |
| `print/CIVL6044_AR_Beam_Problem.pdf` | The student sheet to print, with the QR code |
| `tools/build_sheet.py` | Regenerates the PDF, `target.png` and `js/geometry.js` together |
| `tests/validate.mjs` | Independent check of the calculations (`node tests/validate.mjs`) |
| `VALIDATION.md` | Results of that check |

## Setting it up (about 10 minutes, easiest on a computer)

1. **Create the repository.** On github.com, choose New repository. Name it exactly `civl6044-ar` (the QR code on the sheet points to this name). Make it Public, then Create repository.
2. **Upload the files.** On the empty repository page, choose "uploading an existing file". Unzip the download and drag everything *inside* the `civl6044-ar` folder (not the folder itself) into the upload area, so `index.html` sits at the top level. Commit changes.
3. **Create the AR target file.**
   - Open the MindAR image target compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
   - Upload `assets/target.png`, press Start, and download the result (`targets.mind`).
   - In your repository, open the `assets` folder, choose Add file → Upload files, upload `targets.mind` and commit.
4. **Turn on GitHub Pages.** Settings → Pages → Build and deployment → Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`, Save. After a minute or two the site is live at the address above.
5. **Print the sheet.** Print `print/CIVL6044_AR_Beam_Problem.pdf` on A4 at actual size. For quick testing you can also display the PDF full-screen on a laptop and point the phone at the screen.

Until step 3 is done, the AR button shows a message explaining that the target file is missing; the 2D view works regardless.

## Using it

- **Start AR camera**: point the phone at the whole sheet, held upright. Once the sheet is recognised, the analysis appears on it.
- **Drag the red handle** on the load arrow, or use the slider. The load snaps to 0.1 m steps between 0.1 m and 3.9 m from A, so values can be checked by hand.
- **Freeze view** pauses the camera with the overlay locked in place, so students can put the phone down and drag comfortably. Resume tracking restarts the camera.
- **Reactions / SFD / BMD / Deflection** toggle each layer; **Show all** turns every layer on; **Reset load** returns the load to 1.5 m, as printed.
- **2D view** shows the same sheet and results without the camera.

Useful links for testing:

- `…/civl6044-ar/?mode=2d` opens straight into the 2D view.
- `…/civl6044-ar/?debug=1` draws cyan alignment marks on the beam line and at A, B and the printed load. In AR these should sit on the printed drawing; if they do not, see Troubleshooting.

## Device testing checklist (from the brief)

Test on a recent Android phone (Chrome) and a recent iPhone (Safari):

- [ ] QR code opens the site; no app or account needed
- [ ] Camera permission prompt appears and works; refusing it gives a clear message and the 2D view
- [ ] Sheet is recognised within a few seconds under normal room lighting
- [ ] Overlay sits on the printed beam (check with `?debug=1`)
- [ ] R<sub>A</sub>, R<sub>B</sub>, SFD, BMD and deflected shape all display, individually and with Show all
- [ ] Dragging the load updates everything; values match `VALIDATION.md`
- [ ] Reset returns to the printed problem
- [ ] Freeze view and Resume tracking work
- [ ] Tracking is regained after the sheet leaves and re-enters view
- [ ] Labels are readable with the whole sheet in view; note any that are too small
- [ ] Portrait and landscape both behave acceptably

## How it works

- **Calculations** (`js/beam.js`): closed-form statics for a simply supported beam with one point load. R<sub>A</sub> = Pb/L, R<sub>B</sub> = Pa/L, M<sub>max</sub> = R<sub>A</sub>a under the load. Deflection is the standard elastic curve, normalised by PL³/48EI, because EI is outside the scope of Prototype 1. Only its shape and relative size are meaningful, and the position of maximum deflection is marked.
- **Sign convention** (CIVL6044): positive shear is the resultant acting upward on the left of a cut, plotted above the axis. Sagging moments are positive and plotted below the axis (tension side).
- **One drawing, two views** (`js/overlay.js`): the analysis is drawn once onto a canvas in the sheet's own millimetre coordinates. In AR, that canvas is a Three.js texture on a plane placed exactly over the tracked sheet. In the 2D view it is drawn over the sheet image. Both views therefore always show identical results.
- **Shared geometry** (`js/geometry.js`): generated by the same script that draws the PDF, so the overlay and the printed beam cannot drift apart.
- **Tracking** (`js/ar.js`): MindAR 1.2.5 image tracking with Three.js 0.160, loaded from jsDelivr only when AR starts. The patterned bands at the top and bottom of the sheet give the tracker high-contrast features at both ends of the page.
- Diagram scales are fixed (SFD 0.7 mm/kN, BMD 1.3 mm/kNm on the sheet), so diagrams genuinely grow and shrink as the load moves. Reaction arrow lengths are proportional to their values.

## Troubleshooting

- **Overlay offset from the printed beam**: make sure the sheet was printed at actual size with nothing cropped, and that `targets.mind` was compiled from the `target.png` in this folder (not a photo or a screenshot).
- **Overlay jitters**: in `js/ar.js`, increase smoothing by lowering `filterBeta` (e.g. 0.0005), or reduce lag by raising it (e.g. 0.01).
- **Sheet not recognised**: improve lighting, avoid glare on glossy paper, and hold the phone so the whole sheet fills most of the screen.

## Changing the problem

Edit `tools/build_sheet.py` (problem values, question text and printed labels), then run:

```
python3 tools/build_sheet.py --url https://seancarroll8-stack.github.io/civl6044-ar/
```

This regenerates the PDF, `assets/target.png` and `js/geometry.js`. Any change to the sheet above the footer means recompiling `targets.mind`. Changing only the QR code does not, because it sits outside the tracked area.

## Credits and licences

- MindAR by HiuKim Yuen, MIT licence – https://github.com/hiukim/mind-ar-js
- three.js, MIT licence – https://threejs.org
- Barlow typeface by Jeremy Tribby, SIL Open Font Licence (Google Fonts)
- Vetin Beam Analysis (MIT) by Rasim Temur was reviewed as a reference; no code is copied from it. It can serve as an independent cross-check of results: https://www.rasimtemur.com/vetin/beam/
