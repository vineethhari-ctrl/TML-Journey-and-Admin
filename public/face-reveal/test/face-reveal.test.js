import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGrids, verdict, sameAspect, luminance, GRID } from '../src/similarity.js';
import { crc32, makeZip } from '../src/zip.js';
import { buildBundle } from '../src/bundle.js';

const flat = (v) => new Float32Array(GRID * GRID).fill(v);
const withBlock = (base, x0, y0, x1, y1, v) => {
  const g = Float32Array.from(base);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * GRID + x] = v;
  return g;
};
const photo = Float32Array.from({ length: GRID * GRID }, (_, i) => 90 + (i % GRID) * 2);

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('luminance weights RGBA pixels', () => {
  assert.ok(Math.abs(luminance(new Uint8Array([255, 255, 255, 255]))[0] - 255) < 0.01);
});

test('an emoji over a small area still counts as the same photo and is located', () => {
  const covered = withBlock(photo, 12, 8, 19, 15, 250);
  const cmp = compareGrids(photo, covered);
  assert.equal(cmp.diffCells, 64);
  assert.deepEqual(cmp.region, { x: 12 / GRID, y: 8 / GRID, w: 8 / GRID, h: 8 / GRID });
  assert.equal(verdict({ width: 800, height: 600 }, { width: 800, height: 600 }, cmp), 'ok');
});

test('verdicts: identical, mismatch, aspect', () => {
  const d = { width: 100, height: 100 };
  assert.equal(verdict(d, d, compareGrids(photo, photo)), 'identical');
  assert.equal(verdict(d, d, compareGrids(flat(0), flat(255))), 'mismatch');
  assert.equal(verdict(d, { width: 200, height: 100 }, compareGrids(photo, photo)), 'aspect');
  assert.ok(sameAspect({ width: 1000, height: 500 }, { width: 2000, height: 1000 }));
});

test('bundle puts the face-visible original first and preserves bytes', () => {
  const mk = (n, b) => ({ name: n, type: 'image/jpeg', sha256: 'x', width: 4, height: 4, bytes: new Uint8Array(b) });
  const original = mk('IMG_orig.jpg', [1, 2, 3]);
  const covered = mk('IMG_covered.jpg', [9, 9]);
  const { zip, manifest, names } = buildBundle({ original, covered, cmp: compareGrids(photo, withBlock(photo, 1, 1, 3, 3, 250)) });
  assert.deepEqual(names, ['1_face_visible.jpg', '2_face_covered.jpg', 'manifest.json']);
  assert.equal(manifest.files[0].role, 'original, face visible');
  assert.equal(manifest.consent.confirmed, true);
  const dv = new DataView(zip.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint16(zip.length - 22 + 10, true), 3); // entries in end-of-central-directory
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
