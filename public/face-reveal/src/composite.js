// Pure helpers for the face swap: find the smiley sticker, match skin tone, place the face.
// Everything works on plain RGBA arrays so it runs the same in the browser and under node:test.

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

export function isEmojiYellow(r, g, b) {
  const [h, s, v] = hsv(r, g, b);
  return h >= 38 && h <= 64 && s >= 0.5 && v >= 0.65;
}

export function isSkin(r, g, b) {
  const [h, s, v] = hsv(r, g, b);
  return h <= 50 && s >= 0.15 && s <= 0.75 && v >= 0.25;
}

// Largest roughly round yellow blob = the smiley. Returns centre and radius as fractions of the width, or null.
export function findEmoji(rgba, w, h) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = isEmojiYellow(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) ? 1 : 0;
  const seen = new Uint8Array(w * h);
  let best = null;
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let area = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const round = area / (bw * bh) >= 0.5 && Math.max(bw, bh) / Math.min(bw, bh) <= 1.6;
    if (area >= 0.004 * w * h && round && (!best || area > best.area)) best = { area, x0, y0, bw, bh };
  }
  if (!best) return null;
  return {
    cx: (best.x0 + best.bw / 2) / w,
    cy: (best.y0 + best.bh / 2) / h,
    r: (Math.max(best.bw, best.bh) / 2) * 1.05 / w,
  };
}

// Mean colour of the skin-like pixels for which inRegion(x, y) is true.
export function skinMean(rgba, w, h, inRegion) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inRegion(x, y)) continue;
      const i = (y * w + x) * 4;
      if (!isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) continue;
      r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
    }
  }
  return n ? { mean: [r / n, g / n, b / n], count: n } : null;
}

// Skin around the smiley (a ring just outside it), in pixel coordinates.
export function ringSkin(rgba, w, h, cx, cy, r) {
  return skinMean(rgba, w, h, (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d > r * 1.05 && d < r * 1.7;
  });
}

export const MIN_SKIN_PIXELS = 30;

// Per-channel gain that moves the face's skin tone toward the target's; null if either side has too little skin.
export function toneGain(src, dst) {
  if (!src || !dst || src.count < MIN_SKIN_PIXELS || dst.count < MIN_SKIN_PIXELS) return null;
  return src.mean.map((s, i) => Math.min(1.3, Math.max(0.75, dst.mean[i] / (s || 1))));
}

// Where the face lands on the photo: width = the smiley's diameter times `scale`, height keeps the face's proportions.
export function targetRect(circle, face, scale = 1) {
  const w = circle.r * 2 * scale;
  const h = w * (face.h / face.w);
  return { x: circle.cx - w / 2, y: circle.cy - h / 2, w, h };
}

// Detector boxes are tight; add forehead and cheeks so the swap covers the whole smiley.
export function expandFace(b) {
  const w = b.w * 1.16, h = b.h * 1.25;
  return { x: b.x - (w - b.w) / 2, y: b.y - (h - b.h) * 0.7, w, h };
}

// Paint over the smiley before the face goes on, so its yellow can't show through the soft edge.
// Each pixel inside takes a blend of colours sampled around the disc, nearer samples counting more.
export function inpaintDisc(rgba, w, h, cx, cy, r) {
  const N = 48, ringR = r * 1.12;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const sx = cx + Math.cos(a) * ringR, sy = cy + Math.sin(a) * ringR;
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.round(sx) + dx, y = Math.round(sy) + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        sr += rgba[p]; sg += rgba[p + 1]; sb += rgba[p + 2]; n++;
      }
    }
    if (n) samples.push([sx, sy, sr / n, sg / n, sb / n]);
  }
  if (!samples.length) return;
  const fillR = r * 1.06;
  for (let y = Math.max(0, Math.floor(cy - fillR)); y <= Math.min(h - 1, Math.ceil(cy + fillR)); y++) {
    for (let x = Math.max(0, Math.floor(cx - fillR)); x <= Math.min(w - 1, Math.ceil(cx + fillR)); x++) {
      if (Math.hypot(x - cx, y - cy) > fillR) continue;
      let wr = 0, wg = 0, wb = 0, ws = 0;
      for (const [sx, sy, sr, sg, sb] of samples) {
        const d2 = (x - sx) * (x - sx) + (y - sy) * (y - sy) + 1;
        const k = 1 / (d2 * d2);
        wr += sr * k; wg += sg * k; wb += sb * k; ws += k;
      }
      const p = (y * w + x) * 4;
      rgba[p] = Math.round(wr / ws); rgba[p + 1] = Math.round(wg / ws); rgba[p + 2] = Math.round(wb / ws); rgba[p + 3] = 255;
    }
  }
}
