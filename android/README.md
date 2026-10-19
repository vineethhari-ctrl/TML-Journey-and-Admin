# Face Reveal for Android

A native Android app (`app.facereveal`) that bundles the web app from `public/face-reveal/` and runs it in a WebView.
It needs no network at all: every file is served from inside the APK, and requests to anything else are refused.

- Install: copy `release/FaceReveal.apk` to the phone, open it, and allow "install unknown apps" for the app you opened it from.
  Android 10 or newer.
- Pick the covered image and the original from the phone's gallery or Files.
- The result zip is saved to `Downloads/FaceReveal/` and the share sheet opens.

## Rebuilding

    pip install pyaxml cryptography
    python3 android/build_apk.py        # writes android/build/FaceReveal.apk

Needs a JDK and network access to Maven Central only; no Android SDK. The build downloads the Android framework jar
(Robolectric `android-all`) and the `dx` dexer, compiles `src/`, packs the manifest with `pyaxml`, adds the web files as
assets and signs with APK Signature Scheme v2 (implemented in the script).

The signing key is created once in `~/.cache/face-reveal-apk` (override with `FR_CACHE`). Keep it: an update signed with a
different key will not install over an existing copy, and the old app has to be uninstalled first. `release/FaceReveal.apk`
was signed with a key that is not stored in this repo.

## Verification status

Checked off-device: the signature verifies with the apksig verifier, the manifest parses with typed attributes, the
dex loads, and the web bridge hands over a valid zip. **Not yet run on a real phone or emulator**; no Android runtime was available.
No app icon yet (Android's default is used). iPhone is not covered; use the web version there.
