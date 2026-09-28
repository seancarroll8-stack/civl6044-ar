// CIVL6044 AR Prototype 1.1 - label images for the 3D views.
// A label spec is plain data (see scene3d.js); this turns it into a canvas.
// "R_{A}" style markup gives subscripts.

const FONT = '"Barlow", "Helvetica Neue", Arial, sans-serif';

function parse(str) {
  const segs = []; const re = /_\{([^}]*)\}/g; let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) segs.push([str.slice(last, m.index), false]);
    segs.push([m[1], true]); last = re.lastIndex;
  }
  if (last < str.length) segs.push([str.slice(last), false]);
  return segs;
}

function measure(ctx, segs, px, weight) {
  let w = 0;
  for (const [t, sub] of segs) { ctx.font = `${weight} ${sub ? px * 0.68 : px}px ${FONT}`; w += ctx.measureText(t).width; }
  return w;
}

function drawRich(ctx, segs, x, y, px, weight, color) {
  let cx = x;
  for (const [t, sub] of segs) {
    ctx.font = `${weight} ${sub ? px * 0.68 : px}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(t, cx, y + (sub ? px * 0.26 : 0));
    cx += ctx.measureText(t).width;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Returns { canvas, width, height, margin } in pixels. basePx = font size of a size-1 line.
export function renderLabel(spec, basePx = 64) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const pill = spec.style !== "plain";
  const lines = spec.lines.map((l) => ({ segs: parse(l.t), px: basePx * (l.s ?? 1), w: l.w ?? 600, c: l.c ?? spec.color }));
  const widths = lines.map((l) => measure(ctx, l.segs, l.px, l.w));
  const lineH = lines.map((l) => l.px * 1.12);
  const padX = pill ? basePx * 0.45 : basePx * 0.1, padY = pill ? basePx * 0.2 : basePx * 0.05;
  const margin = Math.ceil(basePx * 0.3);
  const innerW = Math.max(...widths) + padX * 2;
  const innerH = lineH.reduce((a, b) => a + b, 0) + padY * 2;
  canvas.width = Math.ceil(innerW + margin * 2);
  canvas.height = Math.ceil(innerH + margin * 2);
  ctx.textBaseline = "alphabetic";

  if (pill) {
    ctx.save();
    ctx.shadowColor = "rgba(15, 25, 35, 0.28)"; ctx.shadowBlur = basePx * 0.22; ctx.shadowOffsetY = basePx * 0.05;
    roundRect(ctx, margin, margin, innerW, innerH, Math.min(innerH / 2, basePx * 0.5));
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fill();
    ctx.restore();
    roundRect(ctx, margin, margin, innerW, innerH, Math.min(innerH / 2, basePx * 0.5));
    ctx.lineWidth = basePx * 0.06; ctx.strokeStyle = spec.color; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
  } else {
    // plain text gets a soft white halo so it stays readable on any background
    ctx.lineJoin = "round";
  }

  let y = margin + padY;
  lines.forEach((l, i) => {
    y += lineH[i];
    const w = widths[i];
    const align = spec.textAlign ?? (lines.length > 1 ? "center" : "left");
    const x = align === "center" ? margin + (innerW - w) / 2 : align === "right" ? margin + innerW - padX - w : margin + padX;
    const baseline = y - l.px * 0.26;
    if (!pill && spec.halo !== false) {
      let cx = x;
      for (const [t, sub] of l.segs) {
        const px = sub ? l.px * 0.68 : l.px;
        ctx.font = `${l.w} ${px}px ${FONT}`;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = l.px * 0.22;
        ctx.strokeText(t, cx, baseline + (sub ? l.px * 0.26 : 0));
        cx += ctx.measureText(t).width;
      }
    }
    drawRich(ctx, l.segs, x, baseline, l.px, l.w, l.c);
  });
  return { canvas, width: canvas.width, height: canvas.height, margin };
}

// Size and anchor of a rendered label in scene units (mm).
// spec.h = height in mm of a size-1 line of text.
export function labelGeometry(spec, img, basePx = 64) {
  const k = spec.h / basePx;
  const w = img.width * k, h = img.height * k, m = img.margin * k;
  const cx = spec.anchor === "left" ? m / w : spec.anchor === "right" ? 1 - m / w : 0.5;
  return { w, h, centerX: cx, centerY: 0.5 };
}
