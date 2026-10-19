import test from 'node:test';
import assert from 'node:assert/strict';
import { findEmoji, isSkin, isEmojiYellow, skinMean, ringSkin, toneGain, targetRect, expandFace, inpaintDisc } from '../src/composite.js';
import { crc32, makeZip } from '../src/zip.js';
// detect.js touches the DOM only inside detectFace, so the pure helpers import fine under node.
import { pickFace, tiles } from '../src/detect.js';
import { buildBundle } from '../src/bundle.js';

// RGBA canvas: grey background with optional discs painted as [cx, cy, radius, [r,g,b]].
function image(w, h, discs = []) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = [90, 110, 130];
      for (const [cx, cy, r, col] of discs) if (Math.hypot(x - cx, y - cy) <= r) c = col;
      d.set([...c, 255], (y * w + x) * 4);
    }
  }
  return d;
}
const YELLOW = [255, 205, 0];
const SKIN = [224, 172, 140];

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('colour classes: emoji yellow is not skin, skin is not emoji yellow', () => {
  assert.ok(isEmojiYellow(...YELLOW) && !isSkin(...YELLOW));
  assert.ok(isSkin(...SKIN) && !isEmojiYellow(...SKIN));
});

test('findEmoji locates a yellow disc', () => {
  const f = findEmoji(image(200, 150, [[70, 60, 25, YELLOW]]), 200, 150);
  assert.ok(Math.abs(f.cx - 70 / 200) < 0.02 && Math.abs(f.cy - 60 / 150) < 0.02);
  assert.ok(Math.abs(f.r - (25 * 1.05) / 200) < 0.01);
});

test('findEmoji picks the largest disc and ignores skin, thin strips and tiny specks', () => {
  const d = image(200, 150, [[60, 60, 12, YELLOW], [140, 80, 22, YELLOW], [100, 20, 30, SKIN]]);
  for (let x = 0; x < 200; x++) d.set([...YELLOW, 255], (140 * 200 + x) * 4); // 1px strip
  const f = findEmoji(d, 200, 150);
  assert.ok(Math.abs(f.cx - 140 / 200) < 0.02);
  assert.equal(findEmoji(image(200, 150, [[30, 30, 3, YELLOW]]), 200, 150), null);
  assert.equal(findEmoji(image(200, 150, [[100, 70, 30, SKIN]]), 200, 150), null);
});

test('skin tone gain moves the face toward the photo and is clamped', () => {
  const face = skinMean(image(60, 60, [[30, 30, 40, [180, 140, 110]]]), 60, 60, () => true);
  const photo = skinMean(image(60, 60, [[30, 30, 40, [224, 172, 140]]]), 60, 60, () => true);
  const g = toneGain(face, photo);
  assert.ok(g[0] > 1.2 && g[0] <= 1.3 && g[1] > 1.1 && g[2] > 1.1);
  const dark = skinMean(image(60, 60, [[30, 30, 40, [90, 60, 40]]]), 60, 60, () => true);
  assert.equal(toneGain(dark, photo)[0], 1.3);
  assert.equal(toneGain(null, photo), null);
  assert.equal(toneGain({ mean: [1, 1, 1], count: 5 }, photo), null);
});

test('ringSkin only samples the band just outside the smiley', () => {
  const d = image(200, 200, [[100, 100, 30, SKIN], [100, 100, 14, [0, 0, 255]]]);
  assert.equal(ringSkin(d, 200, 200, 100, 100, 14)?.count > 0, true);
  assert.equal(ringSkin(d, 200, 200, 100, 100, 60), null); // ring lies entirely on the plain background
});

test('geometry: face lands centred on the smiley with its own proportions; detector box grows upward', () => {
  const t = targetRect({ cx: 100, cy: 80, r: 20 }, { x: 0, y: 0, w: 50, h: 75 });
  assert.deepEqual(t, { x: 80, y: 50, w: 40, h: 60 });
  assert.deepEqual(targetRect({ cx: 100, cy: 80, r: 20 }, { x: 0, y: 0, w: 50, h: 75 }, 1.5), { x: 70, y: 35, w: 60, h: 90 });
  const e = expandFace({ x: 100, y: 100, w: 100, h: 100 });
  assert.ok(e.w > 100 && e.h > 100 && e.y < 100 && e.y + e.h > 200 - 1);
});

test('inpaintDisc removes the smiley and blends the surroundings in', () => {
  const d = image(120, 120, [[60, 60, 30, YELLOW]]);
  inpaintDisc(d, 120, 120, 60, 60, 30);
  const at = (x, y) => [...d.slice((y * 120 + x) * 4, (y * 120 + x) * 4 + 3)];
  assert.deepEqual(at(60, 60).map(Math.round), [90, 110, 130]); // centre is now background colour
  assert.ok(!isEmojiYellow(...at(80, 60)));
  assert.deepEqual(at(5, 5), [90, 110, 130]); // outside untouched
  // a half-skin, half-background surround is blended across
  const e = image(120, 120, [[60, 60, 30, YELLOW], [60, 20, 22, SKIN]]);
  inpaintDisc(e, 120, 120, 60, 60, 30);
  const top = [...e.slice((40 * 120 + 60) * 4, (40 * 120 + 60) * 4 + 3)], bottom = [...e.slice((80 * 120 + 60) * 4, (80 * 120 + 60) * 4 + 3)];
  assert.ok(top[0] > bottom[0]); // nearer the skin side is warmer than the far side
});

test('pickFace takes the most confident clear face and ignores weak hits', () => {
  const f = (score, w) => ({ score, x: 0, y: 0, w, h: w });
  assert.equal(pickFace([f(0.9, 50), f(0.7, 120), f(0.4, 300)]).w, 50);
  assert.equal(pickFace([f(0.55, 80), f(0.52, 200)]).w, 80);
  assert.equal(pickFace([f(0.45, 80), f(0.3, 200)]), null); // e.g. a round badge: better to ask than to guess
  assert.equal(pickFace([]), null);
});

test('tiles cover the whole photo with overlap and stay inside it', () => {
  const W = 1600, H = 1200, side = 600;
  const ts = tiles(W, H, side);
  for (const t of ts) assert.ok(t.sx >= 0 && t.sy >= 0 && t.sx + t.side <= W && t.sy + t.side <= H);
  assert.ok(ts.some((t) => t.sx + t.side === W) && ts.some((t) => t.sy + t.side === H));
  for (let x = 0; x < W; x += 50) for (let y = 0; y < H; y += 50) {
    assert.ok(ts.some((t) => x >= t.sx && x < t.sx + t.side && y >= t.sy && y < t.sy + t.side), `uncovered ${x},${y}`);
  }
  assert.equal(tiles(300, 200, 600).length, 1); // photo smaller than a tile
});

test('bundle puts the edited face image first and keeps the sources byte-for-byte', () => {
  const mk = (n, b) => ({ name: n, type: 'image/jpeg', sha256: 'x', width: 4, height: 4, bytes: new Uint8Array(b) });
  const { zip, manifest, names } = buildBundle({
    composite: mk('c.jpg', [7, 7, 7]), covered: mk('IMG_a.jpg', [1, 2]), face: mk('IMG_b.png', [9]),
    regions: { smiley: { cx: 1, cy: 1, r: 1 } },
  });
  assert.deepEqual(names, ['1_face_restored.jpg', '2_covered_original.jpg', '3_face_source.jpg', 'manifest.json']);
  assert.match(manifest.files[0].role, /edited/);
  assert.match(manifest.note, /composite/);
  assert.equal(manifest.consent.confirmed, true);
  assert.equal(new DataView(zip.buffer).getUint16(zip.length - 22 + 10, true), 4);
});

test('makeZip output is readable by unzip', async () => {
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const zip = makeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  writeFileSync(join(dir, 't.zip'), zip);
  let out;
  try { out = execFileSync('unzip', ['-t', join(dir, 't.zip')]).toString(); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  assert.match(out, /No errors detected/);
});
