import { findEmoji, skinMean, ringSkin, toneGain, pastePlan, inpaintDisc } from './composite.js';
import { detectFace } from './detect.js';
import { buildBundle, CONSENT_STATEMENT, AI_NOTE } from './bundle.js';

const $ = (id) => document.getElementById(id);
// Inside the Android app the swap runs natively with AI models; in a browser the paste-based version is used.
const AI = !!(window.AndroidBridge && window.AndroidBridge.hasEngine && window.AndroidBridge.hasEngine());
// A = photo with the smiley, B = photo with the face.
// circle: smiley position in A pixels. face: crop box in B pixels (its proportions stay fixed).
const state = { A: null, B: null, circle: null, face: null, aiResult: null };

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

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
    i.onerror = () => rej(new Error('That file is not an image this device can read.'));
    i.src = url;
  });
  return { name: file.name, type: file.type, bytes, img, w: img.naturalWidth, h: img.naturalHeight, sha256: await sha256Hex(bytes) };
}

// ---- detection -------------------------------------------------------------------------------

function detectSmiley(A) {
  const k = Math.min(1, 256 / Math.max(A.w, A.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(A.w * k));
  c.height = Math.max(1, Math.round(A.h * k));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(A.img, 0, 0, c.width, c.height);
  const f = findEmoji(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  return f && { cx: f.cx * A.w, cy: f.cy * A.h, r: f.r * A.w };
}

async function analyse() {
  const { A, B } = state;
  const smiley = detectSmiley(A);
  const face = AI ? null : await detectFace(B.img, (m) => { $('detectStatus').textContent = m; });
  state.circle = smiley || { cx: A.w / 2, cy: A.h / 2, r: A.w * 0.12 };
  // No face found: start from a centred box and ask the user to place it.
  state.face = face ? { x: face.x, y: face.y, w: face.w, h: face.h } : { x: B.w * 0.3, y: B.h * 0.2, w: B.w * 0.4, h: B.w * 0.5 };
  $('sizeA').value = Math.round((state.circle.r / A.w) * 100);
  $('sizeB').value = Math.round((state.face.w / B.w) * 100);
  $('faceScale').value = 100;
  // The face box is sized by the detector; only when it failed does the user size it by hand.
  $('sizeBRow').hidden = !!face;
  const shaky = face && face.score < 0.65;
  if (AI) {
    const el = $('detectStatus');
    el.className = `status ${smiley ? 'ok' : 'warn'}`;
    el.textContent = smiley
      ? 'Smiley found. Check the circle covers it, then tap "Swap with AI".'
      : 'Could not find the smiley automatically: drag the circle onto it, then tap "Swap with AI".';
    return;
  }
  const msgs = [
    smiley ? 'Smiley found.' : 'Could not find the smiley automatically: drag the circle onto it.',
    !face ? 'Could not find the face automatically: drag the box onto it and set its size.'
      : shaky ? 'Face found, but not sure: check the box is on the face.' : 'Face found.',
  ];
  const el = $('detectStatus');
  el.className = `status ${smiley && face && !shaky ? 'ok' : 'warn'}`;
  el.textContent = msgs.join(' ');
}

// ---- drawing ---------------------------------------------------------------------------------

function drawEditor(cv, item, shape) {
  const width = cv.parentElement.clientWidth || 320;
  const k = Math.min(1, width / item.w);
  cv.width = Math.round(item.w * k);
  cv.height = Math.round(item.h * k);
  const ctx = cv.getContext('2d');
  ctx.drawImage(item.img, 0, 0, cv.width, cv.height);
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#1b5fd1';
  ctx.beginPath();
  if (shape.circle) ctx.arc(shape.circle.cx * k, shape.circle.cy * k, shape.circle.r * k, 0, Math.PI * 2);
  else ctx.rect(shape.face.x * k, shape.face.y * k, shape.face.w * k, shape.face.h * k);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineDashOffset = 7;
  ctx.stroke();
}

// Draw photo A with the face from B pasted over the smiley, at `scale` of A's size.
function compose(canvas, scale) {
  const { A, B, circle, face } = state;
  const w = Math.round(A.w * scale), h = Math.round(A.h * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(A.img, 0, 0, w, h);

  const c = { cx: circle.cx * scale, cy: circle.cy * scale, r: circle.r * scale };
  // Measure the skin around the smiley first, then blank the smiley out.
  const x0 = Math.max(0, Math.floor(c.cx - c.r * 1.7)), y0 = Math.max(0, Math.floor(c.cy - c.r * 1.7));
  const x1 = Math.min(w, Math.ceil(c.cx + c.r * 1.7)), y1 = Math.min(h, Math.ceil(c.cy + c.r * 1.7));
  const around = x1 > x0 && y1 > y0 ? ctx.getImageData(x0, y0, x1 - x0, y1 - y0) : null;
  const skinAround = around ? ringSkin(around.data, x1 - x0, y1 - y0, c.cx - x0, c.cy - y0, c.r) : null;
  if (around) {
    inpaintDisc(around.data, x1 - x0, y1 - y0, c.cx - x0, c.cy - y0, c.r);
    ctx.putImageData(around, x0, y0);
  }
  const plan = pastePlan(c, face, Number($('faceScale').value) / 100);
  const tw = Math.max(2, Math.round(plan.dst.w)), th = tw;
  const oc = document.createElement('canvas');
  oc.width = tw;
  oc.height = th;
  const octx = oc.getContext('2d', { willReadFrequently: true });
  octx.drawImage(B.img, plan.src.x, plan.src.y, plan.src.w, plan.src.h, 0, 0, tw, th);

  if ($('tone').checked) {
    const px = octx.getImageData(0, 0, tw, th);
    // Skin of the face itself (the detector's box, as it lands in the patch).
    const fx = (face.x - plan.src.x) * (tw / plan.src.w), fy = (face.y - plan.src.y) * (th / plan.src.h);
    const fw = face.w * (tw / plan.src.w), fh = face.h * (th / plan.src.h);
    const src = skinMean(px.data, tw, th, (x, y) => x > fx + fw * 0.2 && x < fx + fw * 0.8 && y > fy + fh * 0.3 && y < fy + fh * 0.9);
    const dst = skinAround;
    const gain = toneGain(src, dst);
    if (gain) {
      for (let i = 0; i < px.data.length; i += 4) {
        for (let k = 0; k < 3; k++) px.data[i + k] = Math.min(255, px.data[i + k] * gain[k]);
      }
      octx.putImageData(px, 0, 0);
    }
  }

  // Keep only the face and as much of its surroundings as the "Pasted area" slider allows; feather the rim.
  const soft = Number($('soft').value) / 100;
  const faceW = face.w * plan.scale; // the face's width on the photo
  const reach = Number($('reach').value) / 100;
  const R = Math.max(tw / 2 * reach, Math.min(tw / 2, faceW * 0.56));
  octx.globalCompositeOperation = 'destination-in';
  octx.save();
  octx.translate(tw / 2, th / 2);
  const g = octx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1 - soft, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  octx.fillStyle = g;
  octx.fillRect(-tw / 2, -th / 2, tw, th);
  octx.restore();
  ctx.drawImage(oc, Math.round(plan.dst.x), Math.round(plan.dst.y));
}

function clearAI() {
  if (!state.aiResult) return;
  state.aiResult = null;
  $('out').hidden = true;
  syncSave();
}
function changed() { if (AI) clearAI(); render(); }

let queued = false;
function render() {
  if (queued || !state.A || !state.B || !state.circle) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    drawEditor($('edA'), state.A, { circle: state.circle });
    if (AI) return;
    drawEditor($('edB'), state.B, { face: state.face });
    compose($('out'), Math.min(1, 1000 / Math.max(state.A.w, state.A.h)));
    $('out').hidden = false;
  });
}

// ---- interaction -----------------------------------------------------------------------------

function wireDrag(cv, item, move) {
  let down = false;
  const at = (e) => {
    const r = cv.getBoundingClientRect();
    move(((e.clientX - r.left) / r.width) * item().w, ((e.clientY - r.top) / r.height) * item().h);
    changed();
  };
  cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); at(e); });
  cv.addEventListener('pointermove', (e) => down && at(e));
  cv.addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('pointercancel', () => { down = false; });
}

wireDrag($('edA'), () => state.A, (x, y) => { state.circle.cx = x; state.circle.cy = y; });
wireDrag($('edB'), () => state.B, (x, y) => { state.face.x = x - state.face.w / 2; state.face.y = y - state.face.h / 2; });

$('sizeA').addEventListener('input', () => { state.circle.r = (Number($('sizeA').value) / 100) * state.A.w; changed(); });
$('sizeB').addEventListener('input', () => {
  const f = state.face, ratio = f.h / f.w, cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  f.w = (Number($('sizeB').value) / 100) * state.B.w;
  f.h = f.w * ratio;
  f.x = cx - f.w / 2;
  f.y = cy - f.h / 2;
  render();
});
$('soft').addEventListener('input', changed);
$('faceScale').addEventListener('input', changed);
$('reach').addEventListener('input', changed);
$('toneAI').addEventListener('input', changed);
$('tone').addEventListener('change', changed);
window.addEventListener('resize', render);

async function pick(which, file) {
  try {
    state[which] = await load(file);
    $(which === 'A' ? 'dropA' : 'dropB').classList.add('has');
    $(which === 'A' ? 'dropA' : 'dropB').querySelector('span').textContent = `${file.name} ✓`;
  } catch (e) { alert(e.message); return; }
  if (state.A && state.B) {
    $('step3').hidden = false;
    clearAI();
    $('detectStatus').className = 'status';
    $('detectStatus').textContent = 'Looking for the smiley and the face…';
    await analyse();
    render();
    if (AI) setRunning(false);
  }
}
$('fileA').addEventListener('change', () => $('fileA').files[0] && pick('A', $('fileA').files[0]));
$('fileB').addEventListener('change', () => $('fileB').files[0] && pick('B', $('fileB').files[0]));

// ---- delivery --------------------------------------------------------------------------------

async function exportComposite() {
  if (AI) return state.aiResult;
  const cv = document.createElement('canvas');
  compose(cv, 1);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, width: cv.width, height: cv.height, sha256: await sha256Hex(bytes) };
}

async function deliver(name, type, bytes) {
  if (window.AndroidBridge) { // Android app: save to Downloads and open the share sheet
    window.AndroidBridge.saveFile(name, type, toBase64(bytes));
    return;
  }
  const file = new File([bytes], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Face Reveal' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}

const stamp = () => state.A.sha256.slice(0, 8);

$('consentText').textContent = CONSENT_STATEMENT;
function syncSave() {
  $('saveImg').disabled = $('saveZip').disabled = !($('consent').checked && (!AI || state.aiResult));
}
$('consent').addEventListener('change', syncSave);
$('saveImg').addEventListener('click', async () => {
  const c = await exportComposite();
  await deliver(`face-restored-${stamp()}.jpg`, 'image/jpeg', c.bytes);
});
$('saveZip').addEventListener('click', async () => {
  const composite = await exportComposite();
  const { A, B, circle, face } = state;
  const { zip } = buildBundle({
    composite, covered: A, face: B,
    note: AI ? AI_NOTE : undefined,
    regions: {
      smiley: { cx: Math.round(circle.cx), cy: Math.round(circle.cy), r: Math.round(circle.r) },
      face: { x: Math.round(face.x), y: Math.round(face.y), w: Math.round(face.w), h: Math.round(face.h) },
      softEdge: Number($('soft').value) / 100,
      skinToneMatched: $('tone').checked,
    },
  });
  await deliver(`face-reveal-${stamp()}.zip`, 'application/zip', zip);
});


// ---- AI mode (Android app) -------------------------------------------------------------------

async function toJpeg(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
  return { b64: toBase64(new Uint8Array(await blob.arrayBuffer())), k };
}

function fromBase64(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function setRunning(on) {
  $('runAI').disabled = on || !state.A || !state.B;
  $('dlModels').disabled = on;
}

function showModels() {
  const ready = window.AndroidBridge.modelsReady();
  const mb = Math.round(window.AndroidBridge.modelsMegabytes());
  $('aiNote').textContent = ready
    ? 'AI models are on this phone. Swapping works fully offline.'
    : `The AI models (about ${mb} MB) are downloaded once, then everything works offline. Use Wi-Fi.`;
  $('dlModels').hidden = ready;
  return ready;
}

window.__native = (m) => {
  if (m.type === 'dl') {
    $('dlBar').hidden = false;
    $('dlBar').value = Math.round((m.done / m.total) * 100);
    $('aiStatus').className = 'status';
    $('aiStatus').textContent = `Downloading… ${Math.round(m.done / 1048576)} of ${Math.round(m.total / 1048576)} MB`;
  } else if (m.type === 'dlDone') {
    $('dlBar').hidden = true;
    $('aiStatus').className = 'status ok';
    $('aiStatus').textContent = 'Models downloaded.';
    showModels();
    setRunning(false);
  } else if (m.type === 'progress') {
    $('runStatus').className = 'status';
    $('runStatus').textContent = m.text;
  } else if (m.type === 'error') {
    $('dlBar').hidden = true;
    $('runStatus').className = 'status bad';
    $('runStatus').textContent = m.text;
    $('aiStatus').textContent = '';
    setRunning(false);
  } else if (m.type === 'done') {
    const bytes = fromBase64(m.b64);
    sha256Hex(bytes).then((sha) => {
      state.aiResult = { bytes, width: m.w, height: m.h, sha256: sha };
      const img = new Image();
      img.onload = () => {
        const cv = $('out');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        cv.getContext('2d').drawImage(img, 0, 0);
        cv.hidden = false;
        cv.scrollIntoView({ block: 'nearest' });
      };
      img.src = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      $('runStatus').className = 'status ok';
      $('runStatus').textContent = 'Done. Check the result, then save it.';
      setRunning(false);
      syncSave();
    });
  }
};

if (AI) {
  for (const el of document.querySelectorAll('[data-web]')) el.hidden = true;
  for (const el of document.querySelectorAll('[data-ai]')) el.hidden = false;
  $('aiBox').hidden = false;
  showModels();
  $('dlModels').addEventListener('click', () => {
    $('aiStatus').textContent = 'Starting download…';
    setRunning(true);
    window.AndroidBridge.downloadModels();
  });
  $('runAI').addEventListener('click', async () => {
    if (!state.A || !state.B) return;
    if (!window.AndroidBridge.modelsReady()) {
      $('runStatus').className = 'status warn';
      $('runStatus').textContent = 'Download the AI models first (top of the page).';
      return;
    }
    clearAI();
    setRunning(true);
    $('runStatus').className = 'status';
    $('runStatus').textContent = 'Preparing the photos…';
    const a = await toJpeg(state.A.img, 3000), b = await toJpeg(state.B.img, 2000);
    const { circle } = state;
    window.AndroidBridge.startSwap(
      a.b64, b.b64, circle.cx * a.k, circle.cy * a.k, circle.r * a.k,
      0.55 * (Number($('faceScale').value) / 100), Number($('reach').value) / 100, Number($('toneAI').value) / 100, true,
    );
  });
  setRunning(false);
}

if (window.AndroidBridge) {
  $('offlineStatus').textContent = 'Offline app: everything runs on this phone.';
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(
    () => navigator.serviceWorker.ready.then(() => { $('offlineStatus').textContent = 'Ready to use offline.'; }),
    () => {},
  );
}
