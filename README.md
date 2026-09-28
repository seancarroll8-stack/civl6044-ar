# CIVL6044 Mobile AR Structural Mechanics – Prototype 1.1

A printed, exam-style simply supported beam problem that becomes interactive when viewed through a phone. Students scan the QR code, allow the camera, and a 3D model of the beam appears on the sheet: a steel I-beam on its supports, with the support reactions, shear force diagram, bending moment diagram and exaggerated deflected shape. They can drag the load along the beam, stand the whole model up off the page, make it bigger, and watch everything update.

**New in 1.1:** 3D model (I-beam, 3D arrows and supports, raised diagrams, labels that turn to face the camera); Stand up / Lay flat; Size 1×, 1.5×, 2×; beam shape option Original / Deflected / Both; a 3D model view that works without the camera; camera image fix (the camera feed no longer shows black behind the model).

Live address (once set up): https://seancarroll8-stack.github.io/civl6044-ar/

## What is in this folder

| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/` | The web app (static files, no build step) |
| `js/scene3d.js` | Builds the 3D model (beam, supports, arrows, diagrams, labels) in plain JavaScript |
| `js/figure3d.js` | Turns that model into three.js objects and animates it |
| `js/view3d.js` / `js/ar.js` | The 3D model view (no camera) and the AR camera view |
| `js/overlay.js` | The 2D sheet view |
| `assets/target.png` | The image the AR tracker recognises (the printed sheet above the footer) |
| `assets/targets.mind` | **You create this** from `target.png` (step 3 below) |
| `print/CIVL6044_AR_Beam_Problem.pdf` | The student sheet to print, with the QR code |
| `tools/build_sheet.py` | Regenerates the PDF, `target.png` and `js/geometry.js` together |
| `tests/validate.mjs` | Independent check of the calculations (`node tests/validate.mjs`) |
| `tests/preview.html` | Developer preview of the 3D model without three.js, e.g. `tests/preview.html?a=2.6&beam=both&sfd=1&bmd=1&theta=70` |
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

## Updating from Prototype 1 to 1.1

Your repository already has `assets/targets.mind`. Keep it: the tracked image is unchanged in 1.1, so it does not need recompiling.

1. Unzip the download and open the `civl6044-ar` folder.
2. In the repository on github.com, choose Add file → Upload files.
3. Select everything inside the folder and drag it into the upload area. Files with the same names are replaced; new files are added.
4. Commit changes. The site updates after a minute or two. Phones may keep the old version for up to 10 minutes; if so, wait, or open the link in a private/incognito tab.

## Using it

- **Three views** (tabs at the bottom): **AR camera** puts the 3D model on the printed sheet; **3D model** shows the same model on a virtual sheet, no camera or printout needed (one finger turns it, pinch zooms); **2D sheet** is the flat drawing.
- **Drag the red handle** on the load arrow, or use the slider. The load snaps to 0.1 m steps between 0.1 m and 3.9 m from A, so values can be checked by hand. The reset button returns it to 1.5 m, as printed.
- **Reactions / SFD / BMD** toggle each part; **Show all** turns everything on (and shows both beam shapes).
- **Beam: Original / Deflected / Both** chooses whether the beam is drawn straight, bent (exaggerated), or bent with the straight original shown as a faint outline. The beam bends and straightens smoothly when switched.
- **Stand up / Lay flat** (AR and 3D model): the whole figure rises up off the page on a hinge at the bottom of the bending moment panel, so it faces the student and loads point towards the desk.
- **Size** (AR and 3D model): 1×, 1.5× or 2×. At 1× lying flat, the model sits exactly on the printed drawing.
- **Freeze** (AR only) pauses the camera with the model locked in place, so students can put the phone down and drag comfortably. **Resume** restarts the camera.

Useful links for testing:

- `…/civl6044-ar/?mode=2d` opens straight into the 2D sheet; `?mode=3d` opens the 3D model (handy on a laptop for demonstrating).
- `…/civl6044-ar/?debug=1` draws cyan alignment marks in the 2D sheet on the beam line and at A, B and the printed load.

## Device testing checklist (from the brief)

Test on a recent Android phone (Chrome) and a recent iPhone (Safari):

- [ ] QR code opens the site; no app or account needed
- [ ] Camera permission prompt appears and works; refusing it gives a clear message and the 2D view
- [ ] Sheet is recognised within a few seconds under normal room lighting
- [ ] Camera image shows behind the 3D model (not black)
- [ ] Lying flat at 1×, the 3D beam and supports sit on the printed ones
- [ ] R<sub>A</sub>, R<sub>B</sub>, SFD, BMD and deflected shape all display, individually and with Show all
- [ ] Beam Original / Deflected / Both each look right; the beam bends smoothly
- [ ] Stand up / Lay flat and Size 1× / 1.5× / 2× animate smoothly; labels stay readable
- [ ] 3D model view: turning, zooming and dragging the load all work
- [ ] Dragging the load updates everything; values match `VALIDATION.md`
- [ ] Reset returns to the printed problem
- [ ] Freeze and Resume work
- [ ] Tracking is regained after the sheet leaves and re-enters view
- [ ] Labels are readable with the whole sheet in view; note any that are too small
- [ ] Portrait and landscape both behave acceptably

## How it works

- **Calculations** (`js/beam.js`): closed-form statics for a simply supported beam with one point load. R<sub>A</sub> = Pb/L, R<sub>B</sub> = Pa/L, M<sub>max</sub> = R<sub>A</sub>a under the load. Deflection is the standard elastic curve, normalised by PL³/48EI, because EI is outside the scope of Prototype 1. Only its shape and relative size are meaningful, and the position of maximum deflection is marked.
- **Sign convention** (CIVL6044): positive shear is the resultant acting upward on the left of a cut, plotted above the axis. Sagging moments are positive and plotted below the axis (tension side).
- **3D model** (`js/scene3d.js`): built in the sheet's own millimetre coordinates from the same geometry as the printed drawing, so lying flat at 1× it registers with the print. The I-beam is swept along the span and each section is moved by the exaggerated deflection. Shading is baked into the colours, so the model looks the same on every phone and needs no lights. Labels are drawn onto small images and shown as sprites that always face the camera.
- **Stand up and Size** (`js/figure3d.js`): the figure hangs from a hinge line at the bottom of the bending moment panel. Standing up rotates it 70° about that line; Size scales it about the same line, so it stays planted on the sheet.
- **Dragging in 3D**: a touch is turned into a ray from the camera, transformed into the figure's own coordinates (whatever its angle and size) and intersected with the plane through the beam's mid-width. Touches that start near the beam and load move the load; any other touch turns the model (3D model view).
- **2D sheet** (`js/overlay.js`): the same results drawn flat over the sheet image, with no 3D libraries, as a dependable fallback.
- **Shared geometry** (`js/geometry.js`): generated by the same script that draws the PDF, so the model and the printed beam cannot drift apart.
- **Tracking** (`js/ar.js`): MindAR 1.2.5 image tracking with three.js 0.160, loaded from jsDelivr only when AR or the 3D model starts. The patterned bands at the top and bottom of the sheet give the tracker high-contrast features at both ends of the page.
- Diagram scales are fixed (SFD 0.7 mm/kN, BMD 1.3 mm/kNm on the sheet), so diagrams genuinely grow and shrink as the load moves. Reaction arrow lengths are proportional to their values.

## Troubleshooting

- **Camera shows black behind the model**: make sure the new `css/style.css` was uploaded (it contains the fix).
- **Model offset from the printed beam** (lying flat, Size 1×): make sure the sheet was printed at actual size with nothing cropped, and that `targets.mind` was compiled from the `target.png` in this folder (not a photo or a screenshot).
- **Model jitters**: in `js/ar.js`, increase smoothing by lowering `filterBeta` (e.g. 0.0005), or reduce lag by raising it (e.g. 0.01).
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
