// Face detection with face-api's tiny detector (vendor/), fully offline. Returns the largest face or null.
let ready = null;

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

export async function detectFace(img) {
  try {
    await init();
    const opts = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 });
    const faces = await window.faceapi.detectAllFaces(img, opts);
    if (!faces.length) return null;
    const b = faces.reduce((a, f) => (f.box.width * f.box.height > a.box.width * a.box.height ? f : a)).box;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch (e) {
    ready = null;
    return null;
  }
}
