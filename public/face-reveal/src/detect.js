// Face detection with face-api's tiny detector (vendor/), fully offline. Returns the most confident clear face or null.
// The tiny detector only sees faces within a range of sizes, so a small face (small photo, or a small part of a big
// photo) is searched for at several detector sizes and then in zoomed-in tiles.
let ready = null;

const SIZES = [320, 512, 224, 416, 608];
const GOOD = 0.6; // stop searching once a face scores at least this
const KEEP = 0.5; // faces scoring below this are ignored

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('face detector missing'));
    document.head.appendChild(s);
  });
}

function init() {
  if (!ready) {
    ready = (async () => {
      await loadScript('vendor/face-api.js');
      await window.faceapi.nets.tinyFaceDetector.loadFromUri('vendor/models');
    })();
  }
  return ready;
}

async function run(input, size, dx = 0, dy = 0) {
  const opts = new window.faceapi.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.3 });
  const found = await window.faceapi.detectAllFaces(input, opts);
  return found.map((f) => ({ score: f.score, x: f.box.x + dx, y: f.box.y + dy, w: f.box.width, h: f.box.height }));
}

// The most confident clear face. Weaker hits (a round badge, a patch of fabric) are ignored rather than guessed at,
// so the user is asked to place the box instead of getting a wrong crop.
export function pickFace(faces) {
  const clear = faces.filter((f) => f.score >= KEEP);
  return clear.length ? clear.reduce((a, f) => (f.score > a.score ? f : a)) : null;
}

// Overlapping square tiles that together cover a w x h photo, `side` px wide.
export function tiles(w, h, side) {
  const step = Math.max(1, Math.round(side * 0.6));
  const out = [];
  for (let y = 0; ; y += step) {
    const sy = Math.min(y, Math.max(0, h - side));
    for (let x = 0; ; x += step) {
      const sx = Math.min(x, Math.max(0, w - side));
      out.push({ sx, sy, side: Math.min(side, w, h) });
      if (sx >= w - side) break;
    }
    if (sy >= h - side) break;
  }
  return out;
}

export async function detectFace(img, onProgress = () => {}) {
  try {
    await init();
    const all = [];
    for (const size of SIZES) {
      all.push(...(await run(img, size)));
      const best = pickFace(all);
      if (best && best.score >= GOOD) return best;
    }
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    for (const g of [2, 3]) {
      onProgress(`Zooming in (${g}×${g})…`);
      const side = Math.ceil((Math.max(W, H) / g) * 1.4);
      for (const t of tiles(W, H, side)) {
        const c = document.createElement('canvas');
        c.width = c.height = t.side;
        c.getContext('2d').drawImage(img, t.sx, t.sy, t.side, t.side, 0, 0, t.side, t.side);
        all.push(...(await run(c, 320, t.sx, t.sy)));
      }
      const best = pickFace(all);
      if (best && best.score >= GOOD) return best;
    }
    return pickFace(all);
  } catch (e) {
    ready = null;
    return null;
  }
}
