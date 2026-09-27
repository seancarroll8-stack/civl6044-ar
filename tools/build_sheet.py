"""
CIVL6044 AR Prototype 1 - printed problem sheet generator.

Produces, from ONE set of geometry constants:
  print/CIVL6044_AR_Beam_Problem.pdf   printable A4 exam-style sheet
  assets/target.png                    image target for MindAR (sheet minus footer/QR)
  js/geometry.js                       the same constants for the web app

Usage:
  python3 tools/build_sheet.py                         # QR placeholder
  python3 tools/build_sheet.py --url https://USER.github.io/REPO/

The QR code sits in the footer, OUTSIDE the tracked target area, so adding
or changing it never requires the MindAR target to be recompiled.
"""
import argparse, json, random, subprocess, os
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- geometry (mm, origin top-left of A4, y down)
G = {
    "pageW": 210.0, "pageH": 297.0,
    "targetH": 263.0,                 # tracked area = top 263 mm of the page
    "xA": 40.0, "xB": 170.0,          # support positions
    "beamY": 122.0, "beamHalf": 1.5,  # beam centreline and half-depth
    "loadTipY": 120.5, "loadTailY": 101.0,
    "dimChainY": 152.0, "dimSpanY": 160.0,
    "reactTipY": 134.5, "reactTailY": 149.0,
    "sfdBase": 184.0, "sfdScale": 0.7,      # mm per kN
    "bmdBase": 212.0, "bmdScale": 1.3,      # mm per kNm (sagging plotted below)
    "deflScale": 7.0,                        # mm drawn for PL^3/(48EI)
    "overlay": {"y0": 92.0, "y1": 252.0, "pxPerMM": 6},
    "view2d": {"x0": 12.0, "x1": 198.0, "y0": 92.0, "y1": 252.0},
    "problem": {"L": 4.0, "P": 20.0, "a0": 1.5, "step": 0.1, "aMin": 0.1, "aMax": 3.9},
    "targetPxPerMM": 5,
}
G["mmPerM"] = (G["xB"] - G["xA"]) / G["problem"]["L"]
G["printedLoadX"] = G["xA"] + G["problem"]["a0"] * G["mmPerM"]

NAVY, BLUE, RED, GREY = HexColor("#233441"), HexColor("#246C9D"), HexColor("#B73838"), HexColor("#647480")
INK = HexColor("#1A1A1A")
PAGE_H_PT = G["pageH"] * mm


def X(xmm): return xmm * mm
def Y(ymm): return PAGE_H_PT - ymm * mm


def arrow_down(c, x, y_tail, y_tip, head=3.2, half=1.4, lw=0.9, col=INK):
    c.setStrokeColor(col); c.setFillColor(col); c.setLineWidth(lw)
    c.line(X(x), Y(y_tail), X(x), Y(y_tip - head + 0.2))
    p = c.beginPath(); p.moveTo(X(x), Y(y_tip)); p.lineTo(X(x - half), Y(y_tip - head)); p.lineTo(X(x + half), Y(y_tip - head)); p.close()
    c.drawPath(p, fill=1, stroke=0)


def dim_line(c, x1, x2, y, label, size=9):
    c.setStrokeColor(INK); c.setFillColor(INK); c.setLineWidth(0.4)
    c.line(X(x1), Y(y), X(x2), Y(y))
    for xe, d in ((x1, 1), (x2, -1)):          # small closed arrowheads pointing outwards to extension lines
        p = c.beginPath(); p.moveTo(X(xe), Y(y)); p.lineTo(X(xe + d * 2.2), Y(y - 0.7)); p.lineTo(X(xe + d * 2.2), Y(y + 0.7)); p.close()
        c.drawPath(p, fill=1, stroke=0)
    c.setFont("Helvetica", size)
    c.drawCentredString(X((x1 + x2) / 2), Y(y - 1.2), label)


def hatch(c, x_left, x_right, y, depth=2.6, pitch=1.6):
    c.setLineWidth(0.35); c.setStrokeColor(INK)
    c.line(X(x_left), Y(y), X(x_right), Y(y))
    x = x_left + 0.6
    while x < x_right:
        c.line(X(x), Y(y), X(x - depth * 0.8), Y(y + depth)); x += pitch


def pin(c, x, top):
    c.setStrokeColor(INK); c.setFillColor(white); c.setLineWidth(0.7)
    p = c.beginPath(); p.moveTo(X(x), Y(top)); p.lineTo(X(x - 4.5), Y(top + 7)); p.lineTo(X(x + 4.5), Y(top + 7)); p.close()
    c.drawPath(p, fill=1, stroke=1)
    c.setFillColor(INK); c.circle(X(x), Y(top + 1.1), 0.6 * mm, fill=1, stroke=0)
    hatch(c, x - 7, x + 7, top + 7)


def roller(c, x, top):
    c.setStrokeColor(INK); c.setFillColor(white); c.setLineWidth(0.7)
    p = c.beginPath(); p.moveTo(X(x), Y(top)); p.lineTo(X(x - 4.5), Y(top + 5)); p.lineTo(X(x + 4.5), Y(top + 5)); p.close()
    c.drawPath(p, fill=1, stroke=1)
    for dx in (-2.4, 2.4):
        c.circle(X(x + dx), Y(top + 6), 1.0 * mm, fill=1, stroke=1)
    hatch(c, x - 7, x + 7, top + 7)


def mosaic(c, x0, x1, y0, y1, seed, cols=34):
    """Irregular low-poly strip in the module palette: decorative, and gives the
    image tracker plenty of high-contrast, non-repeating corners."""
    rnd = random.Random(seed)
    palette = ["#233441", "#246C9D", "#647480", "#8FB3CF", "#D5DEE6", "#F2F5F8", "#3E5566", "#B9CCDB"]
    w = (x1 - x0) / cols
    top = [(x0 + i * w + (rnd.uniform(-0.35, 0.35) * w if 0 < i < cols else 0), y0) for i in range(cols + 1)]
    mid = [(x0 + i * w + (rnd.uniform(-0.35, 0.35) * w if 0 < i < cols else 0), (y0 + y1) / 2 + rnd.uniform(-0.25, 0.25) * (y1 - y0)) for i in range(cols + 1)]
    bot = [(x0 + i * w + (rnd.uniform(-0.35, 0.35) * w if 0 < i < cols else 0), y1) for i in range(cols + 1)]
    mid[0] = (x0, (y0 + y1) / 2); mid[-1] = (x1, (y0 + y1) / 2)
    last = None
    for r1, r2 in ((top, mid), (mid, bot)):
        for i in range(cols):
            tris = [(r1[i], r1[i + 1], r2[i]), (r1[i + 1], r2[i + 1], r2[i])] if rnd.random() < 0.5 else \
                   [(r1[i], r2[i + 1], r2[i]), (r1[i], r1[i + 1], r2[i + 1])]
            for t in tris:
                col = rnd.choice([p for p in palette if p != last]); last = col
                c.setFillColor(HexColor(col)); c.setStrokeColor(HexColor(col)); c.setLineWidth(0.1)
                p = c.beginPath(); p.moveTo(X(t[0][0]), Y(t[0][1]))
                for q in t[1:]: p.lineTo(X(q[0]), Y(q[1]))
                p.close(); c.drawPath(p, fill=1, stroke=1)


def text_sub(c, x, y, parts, size, font="Helvetica"):
    """parts: list of (text, is_subscript). Left-aligned at x (mm), baseline y (mm)."""
    cx = X(x)
    for t, sub in parts:
        f, s = (font, size * 0.7) if sub else (font, size)
        c.setFont(f, s)
        c.drawString(cx, Y(y) - (s * 0.35 if sub else 0), t)
        cx += c.stringWidth(t, f, s)


def build(url=None):
    pdf_path = os.path.join(ROOT, "print", "CIVL6044_AR_Beam_Problem.pdf")
    c = canvas.Canvas(pdf_path, pagesize=(G["pageW"] * mm, PAGE_H_PT))
    c.setTitle("CIVL6044 Structural Mechanics - Simply supported beam (AR Prototype 1)")
    c.setAuthor("CIVL6044 Structural Mechanics, MTU")

    # ---- header band + mosaic
    c.setFillColor(NAVY); c.rect(X(15), Y(30), 180 * mm, 18 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14); c.drawString(X(20), Y(20.5), "CIVL6044 Structural Mechanics")
    c.setFont("Helvetica", 10);      c.drawString(X(20), Y(26.3), "Tutorial problem: statically determinate beams")
    c.setFont("Helvetica-Bold", 16); c.drawRightString(X(190), Y(22.5), "MTU")
    c.setFont("Helvetica", 7.5);     c.drawRightString(X(190), Y(26.3), "Munster Technological University")
    mosaic(c, 15, 195, 30, 37, seed=6044)

    # ---- question text
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12); c.drawString(X(15), Y(47), "Question 1")
    body = [
        "The beam AB shown in Figure Q1 is simply supported by a pin at A and a roller at B.",
        "The beam has a span of 4.0 m and carries a single vertical point load of 20 kN",
        "located 1.5 m from support A. The self-weight of the beam may be ignored.",
    ]
    c.setFont("Helvetica", 10.5)
    for i, line in enumerate(body): c.drawString(X(15), Y(54 + i * 5.2), line)
    parts = [
        ("(a)", "Determine the vertical support reactions at A and B."),
        ("(b)", "Draw the shear force diagram, showing all significant values."),
        ("(c)", "Draw the bending moment diagram, stating the maximum bending moment and its position."),
        ("(d)", "Sketch the deflected shape of the beam."),
    ]
    for i, (k, t) in enumerate(parts):
        yy = 72 + i * 5.2
        c.drawString(X(15), Y(yy), k); c.drawString(X(23), Y(yy), t)

    # ---- Figure Q1
    c.setFont("Helvetica-Oblique", 9.5); c.setFillColor(GREY); c.drawString(X(15), Y(100), "Figure Q1")
    xA, xB, yb, h = G["xA"], G["xB"], G["beamY"], G["beamHalf"]
    c.setFillColor(HexColor("#E9EEF2")); c.setStrokeColor(INK); c.setLineWidth(0.9)
    c.rect(X(xA - 3), Y(yb + h), (xB - xA + 6) * mm, 2 * h * mm, fill=1, stroke=1)
    pin(c, xA, yb + h); roller(c, xB, yb + h)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 12)
    c.drawRightString(X(xA - 8), Y(yb + 7), "A"); c.drawString(X(xB + 8), Y(yb + 7), "B")

    xl = G["printedLoadX"]
    arrow_down(c, xl, G["loadTailY"], G["loadTipY"], head=3.4, half=1.5, lw=1.0)
    c.setFont("Helvetica-Bold", 10.5); c.drawCentredString(X(xl), Y(G["loadTailY"] - 1.8), "20 kN")

    # extension lines + dimensions
    c.setLineWidth(0.3); c.setStrokeColor(INK)
    for xe in (xA, xB): c.line(X(xe), Y(137.5), X(xe), Y(G["dimSpanY"] + 1.5))
    c.line(X(xl), Y(G["dimChainY"] - 3), X(xl), Y(G["dimChainY"] + 1.5))
    dim_line(c, xA, xl, G["dimChainY"], "1.5 m")
    dim_line(c, xl, xB, G["dimChainY"], "2.5 m")
    dim_line(c, xA, xB, G["dimSpanY"], "4.0 m")

    # ---- bottom mosaic (keeps tracking features at both ends of the target)
    mosaic(c, 15, 195, 255, 261, seed=4460)

    # ---- footer (outside the tracked target)
    c.setFillColor(GREY); c.setFont("Helvetica", 8.5)
    c.drawString(X(15), Y(274), "Interactive view: scan the QR code with your phone camera, allow camera access,")
    c.drawString(X(15), Y(278.2), "then point the phone at this sheet. Hold it so the whole sheet is in view.")
    c.setFont("Helvetica", 7); c.drawString(X(15), Y(286), "CIVL6044 AR Prototype 1")
    qx, qy, qs = 173.0, 267.0, 22.0
    if url:
        w = qr.QrCodeWidget(url); b = w.getBounds(); bw, bh = b[2] - b[0], b[3] - b[1]
        d = Drawing(qs * mm, qs * mm, transform=[qs * mm / bw, 0, 0, qs * mm / bh, 0, 0]); d.add(w)
        renderPDF.draw(d, c, X(qx), Y(qy + qs))
    else:
        c.setStrokeColor(GREY); c.setDash(1.5, 1.5); c.setLineWidth(0.5)
        c.rect(X(qx), Y(qy + qs), qs * mm, qs * mm, fill=0, stroke=1); c.setDash()
        c.setFont("Helvetica", 6.5)
        for i, t in enumerate(["QR code", "added once the", "web address", "is confirmed"]):
            c.drawCentredString(X(qx + qs / 2), Y(qy + 7 + i * 3.2), t)
    c.showPage(); c.save()

    # ---- target image = rasterised sheet cropped above the footer
    ppm = G["targetPxPerMM"]; dpi = ppm * 25.4
    tmp = os.path.join(ROOT, "tools", "_page")
    subprocess.run(["pdftoppm", "-png", "-r", f"{dpi:.2f}", "-singlefile", pdf_path, tmp], check=True)
    from PIL import Image
    im = Image.open(tmp + ".png").convert("RGB")
    W = round(G["pageW"] * ppm); H = round(G["targetH"] * ppm)
    im = im.resize((W, round(G["pageH"] * ppm)), Image.LANCZOS) if im.size[0] != W else im
    im.crop((0, 0, W, H)).save(os.path.join(ROOT, "assets", "target.png"), optimize=True)
    os.remove(tmp + ".png")
    G["targetPx"] = {"w": W, "h": H}

    with open(os.path.join(ROOT, "js", "geometry.js"), "w") as f:
        f.write("// Generated by tools/build_sheet.py - do not edit by hand.\n")
        f.write("// Page coordinates in mm, origin at the top-left of the A4 sheet, y downwards.\n")
        f.write("export const G = " + json.dumps(G, indent=2) + ";\n")
    print("PDF:", pdf_path); print("target.png:", W, "x", H)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--url", default=None)
    build(ap.parse_args().url)
