# Face Reveal

Replaces a smiley that hides a person's face with their real face from a second photo of them.

## How it works

1. Choose the photo where a smiley covers the face.
2. Choose another photo of the same person with the face visible.
3. The app finds the smiley (the biggest round yellow shape) and the face (face-api's tiny detector, bundled in `vendor/`).
   The face is **sized to the covered face automatically**: stickers are bigger than the face under them, so the face's
   width is set to 72% of the smiley's diameter, whatever its size in its own photo. The patch cut from photo 2 includes the
   hair and neck around the face and covers the smiley; the colours under the smiley are first filled in from around it, and
   the skin tone is matched to the skin around the smiley.
   The app can't see the hidden face, so this size is a guess. Tune it with the sliders: **Face size** (bigger/smaller face),
   **Pasted area** (paste only the face and a little around it, so photo 2's hair and background stay out), soft edge, and
   drag the circle or box to place them.
4. Tick the consent box, then **Save image** (the edited JPG) or **Save all (.zip)**:
   `1_face_restored.jpg` (edited), `2_covered_original.*` and `3_face_source.*` (both untouched), `manifest.json`
   (checksums, regions, consent, and a note that image 1 is a composite).

It is an edited image: the face comes from the second photo, so head angle and lighting may not match, and it will look
pasted when they differ a lot. A smiley far bigger than the head also can't be hidden well: the area it covered beyond the
head is filled from the surroundings, not generated. A natural result in those cases needs an AI model, which this app does
not have. Nothing is uploaded;
it works offline and has no server.

The face can't be recovered from the covered photo itself, only taken from another photo.

## Notes

- The Android app (`android/`) runs real AI face-swap models instead of the paste steps above; see its README.

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
