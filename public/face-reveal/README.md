# Face Reveal

Pairs an emoji-covered image with its original and delivers the **face-visible original first**, then the covered one.

## Why it doesn't "remove" the emoji

Pixels under an opaque emoji are destroyed. Nothing can recover the real face from the covered image alone; an AI
inpainting tool would only invent a face. So the app works from the original file instead and delivers it unchanged.

## Flow

1. Drop the covered image.
2. Drop the original. If you don't have it, copy the generated request message and send it to whoever shared the image.
3. The app checks both are the same photo (32x32 luminance comparison), outlines the covered area, and refuses an
   identical or unrelated file unless you explicitly confirm.
4. Tick the consent box and download `face-reveal-<id>.zip`:
   `1_face_visible.*`, `2_face_covered.*`, `manifest.json` (SHA-256 checksums, consent, match score).

Images are delivered byte-for-byte. Everything runs in the browser; nothing is uploaded and there are no dependencies.

## Mobile app (installable, works offline)

Face Reveal is a Progressive Web App. Host the folder over HTTPS (any static host, e.g. GitHub Pages), open it on the phone,
then **Add to Home Screen** (Android Chrome: menu > Install app; iPhone Safari: Share > Add to Home Screen). It opens full
screen like a native app. The first visit caches everything (`sw.js`), after which it works with no connection at all.
On phones the bundle is delivered through the share sheet (save to Files, WhatsApp, email), with a plain download as fallback.
If you change any app file, bump `CACHE` in `sw.js` so installed copies update.

## Run / test

    python3 -m http.server 8000     # then open http://localhost:8000
    node --test public/face-reveal/test/face-reveal.test.js
