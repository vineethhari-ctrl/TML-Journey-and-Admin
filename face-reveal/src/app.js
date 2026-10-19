import { GRID, compareGrids, luminance, verdict } from './similarity.js';
import { buildBundle, requestMessage, CONSENT_STATEMENT } from './bundle.js';

const $ = (id) => document.getElementById(id);
const state = { covered: null, original: null, cmp: null, verdict: null };

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function load(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('That file is not an image the browser can read.'));
    i.src = url;
  });
  const c = document.createElement('canvas');
  c.width = c.height = GRID;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, GRID, GRID);
  return {
    name: file.name, type: file.type, bytes, url,
    width: img.naturalWidth, height: img.naturalHeight,
    sha256: await sha256Hex(bytes),
    lum: luminance(ctx.getImageData(0, 0, GRID, GRID).data),
  };
}

function wireDrop(zone, input, onFile) {
  input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('over');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}

function setStatus(kind, text) {
  const el = $('matchStatus');
  el.className = `status ${kind}`;
  el.textContent = text;
}

const MESSAGES = {
  ok: ['ok', 'Match: same photo, the covered area is outlined.'],
  identical: ['bad', 'No difference found. This looks like the covered image again, not an original.'],
  mismatch: ['warn', 'These do not look like the same photo.'],
  aspect: ['warn', 'Different proportions. The original may be cropped or from another photo.'],
};

function refresh() {
  const { covered, original } = state;
  $('step2').hidden = !covered;
  if (!covered || !original) { $('step3').hidden = true; return; }
  state.cmp = compareGrids(original.lum, covered.lum);
  state.verdict = verdict(original, covered, state.cmp);
  const [kind, text] = MESSAGES[state.verdict];
  setStatus(kind, text);
  $('step3').hidden = state.verdict === 'identical';
  $('outOriginal').src = original.url;
  $('outCovered').src = covered.url;
  const r = state.cmp.region;
  const box = $('regionBox');
  box.hidden = !r || state.verdict === 'aspect';
  if (r) Object.assign(box.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
  const needsOverride = state.verdict === 'mismatch' || state.verdict === 'aspect';
  $('override').hidden = $('overrideText').hidden = !needsOverride;
  $('override').checked = false;
  updateDownload();
}

function updateDownload() {
  const needsOverride = state.verdict === 'mismatch' || state.verdict === 'aspect';
  $('download').disabled = !($('consent').checked && (!needsOverride || $('override').checked));
}

async function setCovered(file) {
  try {
    state.covered = await load(file);
    state.original = null;
    $('prevCovered').src = state.covered.url;
    $('prevCovered').hidden = false;
    $('dropCovered').classList.add('has');
    $('prevOriginal').hidden = true;
    const ref = state.covered.sha256.slice(0, 12);
    $('refId').textContent = ref;
    $('requestText').value = requestMessage(ref);
    setStatus('', 'Waiting for the original.');
  } catch (e) { alert(e.message); }
  refresh();
}

async function setOriginal(file) {
  try {
    state.original = await load(file);
    $('prevOriginal').src = state.original.url;
    $('prevOriginal').hidden = false;
    $('dropOriginal').classList.add('has');
  } catch (e) { alert(e.message); }
  refresh();
}

$('consentText').textContent = CONSENT_STATEMENT;
$('consent').addEventListener('change', updateDownload);
$('override').addEventListener('change', updateDownload);
$('copyReq').addEventListener('click', () => navigator.clipboard?.writeText($('requestText').value));
$('download').addEventListener('click', () => {
  const { zip } = buildBundle({ original: state.original, covered: state.covered, cmp: state.cmp });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  a.download = `face-reveal-${state.covered.sha256.slice(0, 8)}.zip`;
  a.click();
});
wireDrop($('dropCovered'), $('fileCovered'), setCovered);
wireDrop($('dropOriginal'), $('fileOriginal'), setOriginal);
