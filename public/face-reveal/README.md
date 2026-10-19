# Face Reveal

Replaces a smiley that hides a person's face with their real face from a second photo of them.

## How it works

1. Choose the photo where a smiley covers the face.
2. Choose another photo of the same person with the face visible.
3. The app finds the smiley (the biggest round yellow shape) and the face (face-api's tiny detector, bundled in `vendor/`).
   The face is **scaled to the smiley automatically**, whatever size it is in its own photo, so a small face is enlarged
   and a big one reduced. It then fills the smiley's circle with colours blended in from around it, pastes the face over it
   with a soft edge, and matches the skin tone to the neck/forehead around it. Drag the circle or box and use the sliders
   (smiley size, **face size** relative to the smiley, soft edge) if the automatic result is off.
4. Tick the consent box, then **Save image** (the edited JPG) or **Save all (.zip)**:
   `1_face_restored.jpg` (edited), `2_covered_original.*` and `3_face_source.*` (both untouched), `manifest.json`
   (checksums, regions, consent, and a note that image 1 is a composite).

It is an edited image: the face comes from the second photo, so head angle and lighting may not match. Nothing is uploaded;
it works offline and has no server.

The face can't be recovered from the covered photo itself, only taken from another photo.

## Notes

- Small faces: the detector only sees faces in a range of sizes, so the face photo is searched at several detector sizes and
  then in zoomed-in tiles (tested with the face from 6% to 100% of the photo width). A weak match is ignored rather than
  guessed at: the app then asks you to drag the box onto the face and set its size.

- Smiley detection looks for yellow emoji. A smiley in another colour, or a yellow object that is round, needs the circle
  moved by hand.
- `vendor/face-api.js` and `vendor/models/` are from `@vladmandic/face-api` 1.7.15 (MIT, see `vendor/FACE-API-LICENSE.txt`).
- Installable as a PWA and bundled into the Android app in `android/`.
- If you change any file, bump `CACHE` in `sw.js` so installed copies update.

## Run / test

    python3 -m http.server 8000     # then open http://localhost:8000
    node --test public/face-reveal/test/face-reveal.test.js
