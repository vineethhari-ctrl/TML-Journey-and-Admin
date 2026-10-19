// Pure helpers that decide whether two images are the same photo, and where
// they differ (the region an emoji covers). Inputs are small luminance grids,
// so the logic runs identically in the browser and under node:test.

export const GRID = 32;
export const CELL_DIFF = 40; // luminance gap (0-255) at which a cell counts as different
export const MATCH_MIN = 0.7; // share of cells that must agree for "same photo"
export const ASPECT_TOLERANCE = 0.02;

export function luminance(rgba) {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
  }
  return out;
}

export function sameAspect(a, b) {
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb <= ASPECT_TOLERANCE;
}

export function compareGrids(lumA, lumB, grid = GRID) {
  if (lumA.length !== lumB.length || lumA.length !== grid * grid) {
    throw new Error('Grids must both be grid x grid');
  }
  let diff = 0;
  let x0 = grid, y0 = grid, x1 = -1, y1 = -1;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (Math.abs(lumA[y * grid + x] - lumB[y * grid + x]) > CELL_DIFF) {
        diff++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  const total = grid * grid;
  return {
    diffCells: diff,
    matchRatio: 1 - diff / total,
    // covered region as fractions of the image (0-1), or null if nothing differs
    region: diff === 0 ? null : { x: x0 / grid, y: y0 / grid, w: (x1 - x0 + 1) / grid, h: (y1 - y0 + 1) / grid },
  };
}

// 'ok' | 'identical' | 'aspect' | 'mismatch'
export function verdict(dimsA, dimsB, cmp) {
  if (!sameAspect(dimsA, dimsB)) return 'aspect';
  if (cmp.diffCells === 0) return 'identical';
  if (cmp.matchRatio < MATCH_MIN) return 'mismatch';
  return 'ok';
}
