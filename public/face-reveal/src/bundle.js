import { makeZip } from './zip.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const extOf = (type, name) => EXT[type] || (name.split('.').pop() || 'img').toLowerCase();

export const CONSENT_STATEMENT =
  'I confirm the person in this photo consents to their unmasked face being shared.';

// Face-visible original is ALWAYS entry 1; the covered version follows.
export function buildBundle({ original, covered, cmp, now = new Date() }) {
  const enc = new TextEncoder();
  const originalName = `1_face_visible.${extOf(original.type, original.name)}`;
  const coveredName = `2_face_covered.${extOf(covered.type, covered.name)}`;
  const manifest = {
    created: now.toISOString(),
    consent: { confirmed: true, statement: CONSENT_STATEMENT },
    files: [
      { order: 1, role: 'original, face visible', name: originalName, sourceName: original.name, sha256: original.sha256, width: original.width, height: original.height },
      { order: 2, role: 'covered by emoji', name: coveredName, sourceName: covered.name, sha256: covered.sha256, width: covered.width, height: covered.height },
    ],
    match: { ratio: Number(cmp.matchRatio.toFixed(3)), coveredRegion: cmp.region },
    note: 'Images are delivered byte-for-byte as received; no pixels were reconstructed or altered.',
  };
  const zip = makeZip(
    [
      { name: originalName, data: original.bytes },
      { name: coveredName, data: covered.bytes },
      { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) },
    ],
    now,
  );
  return { zip, manifest, names: [originalName, coveredName, 'manifest.json'] };
}

export function requestMessage(refId) {
  return `Hello,

I received a photo (reference ${refId}) in which the face is covered by an emoji.
Please send me the original, unedited photo with the face visible, as the same image file.
The person pictured has agreed to their face being shared.

Thank you.`;
}
