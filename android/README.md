# Face Reveal for Android

A native Android app (`app.facereveal`) that replaces a smiley covering someone's face with their face from a second photo,
using AI face-swap models that run on the phone.

- Install: copy `release/FaceReveal.apk` to the phone, open it, allow "install unknown apps". Android 10 or newer, 64-bit ARM.
- **First use:** the app downloads four AI models (about 810 MB, from GitHub) once, with a progress bar and resume. Use Wi-Fi.
  After that everything works with no internet.
- Pick the photo with the smiley, then a photo of the same person with the face visible. **The AI keeps the angle of the face
  photo; it cannot turn a head** (a swap model copies the pose of the face it is given, and the face under a smiley is hidden).
  So add more photos at other angles (optional) and tick the one that matches the head in photo 1; all of them are averaged
  for the likeness. **Tilt** rotates the face in the picture, and **Mirror** flips the chosen photo (a three-quarter view turns
  the other way). I tried warping a frontal photo to fake a turn: the model draws it frontal again, so that is not offered. Check the circle sits on the
  smiley, then **Swap with AI**. Expect roughly half a minute per photo on a mid-range phone (not measured on a phone yet).
- The blue oval and dots on the photo show where the face, eyes, nose and mouth will go, live as you move the circle or drag
  **Face size**, so you can fit them to the visible head (hair, ears, neck) before the half-minute AI run.
- Sliders: **Face size**, **Pasted area** (how much of the other photo's hair and neck is used), **Match lighting**.
- Save the image, or a zip with the edited image first and both originals untouched plus a manifest that labels it as AI-made.

## How it works (`src/app/facereveal/swap/`)

RetinaFace finds the face in photo 2, ArcFace reads its identity, inswapper_128 renders that face and GFPGAN 1.4 sharpens it,
all through ONNX Runtime. The smiley hides the face in photo 1, so there is nothing to detect there: landmarks are laid out
inside the smiley's circle instead, photo 2's head is placed under the face for hair and neck, and the skin tone is nudged
toward the skin around the smiley. Only the area around the smiley is touched. The Java engine is plain Java (no Android
classes), so it is tested on a desktop JVM against a Python prototype (`test/Desktop.java`).

Models (personal, non-commercial use: inswapper and the insightface models are not licensed for commercial use):
`retinaface_10g`, `arcface_w600k_r50`, `inswapper_128_fp16`, `gfpgan_1.4`, from the FaceFusion assets release
`models-3.0.0`; sizes and SHA-256 checksums are in `src/app/facereveal/Models.java` and every download is checked.
`assets-swap/emap.bin` is a 512x512 matrix extracted from the swap model (it is not used by the model at runtime but the
pipeline needs it).

## Rebuilding

    pip install pyaxml cryptography
    python3 android/build_apk.py        # writes android/build/FaceReveal.apk

Needs a JDK and network access to Maven Central only; no Android SDK. The build downloads the Android framework jar
(Robolectric `android-all`), the `dx` dexer and ONNX Runtime 1.20.0 for Android (the newest with Java 8 classes, which `dx`
can read), compiles `src/`, packs the manifest with `pyaxml`, adds the web files and native libraries, and signs with APK
Signature Scheme v2 (implemented in the script).

The signing key is created once in `~/.cache/face-reveal-apk` (override with `FR_CACHE`). Keep it: an update signed with a
different key will not install over an existing copy, and the old app has to be uninstalled first.

Desktop check of the engine (needs the models, `emap.bin`, and the ONNX Runtime desktop jar):

    javac -cp onnxruntime-1.20.0.jar -d out src/app/facereveal/swap/*.java test/Desktop.java
    java -cp out:onnxruntime-1.20.0.jar Desktop models assets-swap/emap.bin smiley.jpg face.jpg CX CY R out.png

## Verification status

Checked off-device: the Java engine matches the Python prototype (35.9 dB), runs in about 6 s on a desktop CPU, and the page
flow (model gate, download progress, swap, stale-result clearing, labelled zip) works in Chromium with the real engine
behind a stand-in bridge. The APK signature verifies, the manifest types are checked, and the dex contains ONNX Runtime
and the engine. The first AI build was run on a real phone: the page, the model download and the Swap button worked, but the swap stopped at once with "No static method metafactory" (the code used Java lambdas, which the `dx` tool in this build can't convert for Android). That is fixed and the build now refuses any lambda; the fixed build has **not yet been run on a phone**, so ONNX Runtime on arm64, the speed and the memory use are still unverified. A smiley much bigger than the head still can't be
hidden well, and a very different pose or lighting between the two photos will still show.
