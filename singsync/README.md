# SingSync (working name)

Offline-first karaoke for Android: import a song, remove the singer on-device, sing along with synced lyrics, record, mix, duet.
Nothing leaves the phone (except peer-to-peer during a duet, later milestone).

**Status: Milestone 1** – import → separate → save stems, with progress UI. See `docs/ARCHITECTURE.md` for the roadmap and `DECISIONS.md` for every assumption.

## Get the APK without Android Studio
Every push touching `singsync/` runs **Actions → "SingSync Android"**. Open the run → **Artifacts → singsync-debug-apk**, unzip, sideload `app-debug.apk` (enable "Install unknown apps").

## Important: the AI model is not bundled yet
Until `app/src/main/assets/models/htdemucs_int8.onnx` exists, the app uses a **basic centre-channel fallback** (clearly labelled in the UI). To get real separation, convert Demucs with `models-tools/` (currently unverified scripts, see its README) and drop the file in `assets`. The app picks it up automatically.

## Build locally
```bash
./gradlew :common:test -PjvmOnly            # pure-Kotlin core, no Android SDK needed (chunking, overlap-add, resume, FLAC, resampler)
cmake -S core-audio/src/main/cpp -B build-host -G Ninja && cmake --build build-host && ctest --test-dir build-host   # C++ core
./gradlew :app:assembleDebug                # needs Android SDK + NDK (JDK 17)
```

## What is verified (Milestone 1)
| Check | How | Result |
|---|---|---|
| Chunk planning / cross-fade overlap-add reproduces the signal | JVM unit tests (odd lengths, 1 chunk, < 1 chunk, no overlap) | passing |
| Cancel → resume gives identical output and skips finished chunks; stale checkpoints discarded | JVM unit tests | passing |
| Null test (instrumental + vocal ≈ original) | JVM + C++ tests; also computed per song in-app | passing (< −100 dB for Classic) |
| FLAC encoder is lossless and standards-compliant | bit-exact decode through ffmpeg with CRC checking | passing |
| Resampler (48k/96k/22.05k → 44.1k) | sine-tone error < 2e-3 | passing |
| Android app compiles & runs | GitHub Actions | see CI run |
| Not yet measured | real Demucs SDR, speed/RAM/heat on a 4 GB phone, 4-minute-song battery | needs the converted model + a device |
