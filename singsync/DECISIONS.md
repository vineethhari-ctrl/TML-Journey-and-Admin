# SingSync – Decisions & assumptions

Format: **ID – decision** · why · (status). Anything the brief left open is recorded here instead of asked.

## Repository & process
- **D-00 – Lives in `/singsync` of `TML-Journey-and-Admin`, not a new repository.** The build session could only push to the already-attached repo and was not allowed to create repositories. The folder is self-contained (own Gradle wrapper, own CI workflow) so `git subtree split -P singsync` moves it to a fresh repo with history. The CI workflow stays in the repo-root `.github/workflows/` (GitHub only reads that location) and is path-filtered to `singsync/**`, so it runs on every push that touches SingSync and not on unrelated pushes.
- **D-01 – Milestone verification split.** The build sandbox has no Android SDK (Google's hosts are blocked), so Android modules cannot be compiled locally. Pure-Kotlin (`:common`) and C++ (`core-audio`) are built and tested locally on every change (`./gradlew :common:test -PjvmOnly`, host CMake/ctest); the Android app is compiled by GitHub Actions. A milestone counts as "builds" when CI is green.

## Architecture
- **D-02 – Module layout.** `common` (pure Kotlin/JVM: chunk planner, overlap-add, resampler, FLAC encoder, separator interface, resumable pipeline – unit-testable off-device), `core-audio` (C++17 core + JNI + Android decoder/exporter), `ml` (ONNX Runtime separator, model factory), `ui` (Compose theme/components), `duet` (placeholder until M6), `app`. The portable C++ target `singcore_static` has no Android dependencies for the future iOS port.
- **D-03 – Library storage = one JSON file + folders, not Room.** M1's data is a few fields per song; avoids KSP/annotation-processing in the build. Revisit (Room) when lyrics/takes/duet sessions add relational data.
- **D-04 – No DI framework.** Manual container in `Application`.
- **D-05 – The source file is copied into app storage on import** (not just referenced by URI) so resume after process death works and stems can be re-derived. Costs disk (one copy of the song).

## Audio
- **D-06 – Pure-Kotlin FLAC encoder** (fixed predictors, Rice coding, 24-bit). `MediaCodec` has no FLAC encoder before API 27 and the minimum is API 26; libFLAC would add an NDK dependency that could not be fetched here. Verified bit-exact (24-bit) against ffmpeg's decoder with CRC checking (`FlacEncoderTest`). Compression is a bit worse than libFLAC `-5`; acceptable for stems.
- **D-07 – Demucs ONNX export strategy.** `htdemucs` uses complex STFT inside `forward`, which `torch.onnx.export` rejects. Plan A (in `models-tools`): replace with real-valued conv1d DFT so the whole model is one graph with the simple `mix → sources` contract. Plan B: STFT in the C++ core. **Not yet executed/verified** (no PyTorch in the sandbox).
- **D-08 – "Classic" fallback separator when no model is bundled.** Band-passed centre channel (150 Hz–6.5 kHz) as the vocal, instrumental = mix − vocal. Poor isolation, but exactly reconstructive and lets the full pipeline, resume, FLAC export, UI and null test run on any build. The UI flags it ("basic quality") so it is never mistaken for the real thing. **Release builds must bundle the model.**
- **D-09 – Fast/Best = chunk overlap (10 % / 25 %)** on the same Demucs model. The MDX-Net `Kim_Vocal_2` fallback is **not** bundled: weight licence unclear (needs a legal check) and its STFT-outside-graph layout needs the C++ core work from D-07 Plan B.
- **D-10 – Chunking.** 343 980 frames (7.8 s @ 44.1 kHz = htdemucs training segment), hop = chunk − overlap, last chunk zero-padded, sin²/cos² cross-fades (sum to exactly 1), result normalised by accumulated weight. Resume = per-chunk checkpoint files keyed by `model|chunkLen|overlap`.
- **D-11 – Everything is held in RAM as float** (4-min stereo = 21 MB per copy; ~4 copies peak ≈ 100 MB plus model) – far below the 1.2 GB budget; revisit for >20-min files.
- **D-12 – Thermal handling.** `PowerManager.currentThermalStatus` (API 29+): MODERATE → 1.2 s pause per chunk, SEVERE+ → wait up to 60 s. Below API 29 no throttling.

## Android
- **D-13 – No `INTERNET` permission until the duet milestone.** Makes "works in airplane mode / never phones home" structurally true for M1–M5.
- **D-14 – Foreground service type `dataSync`** for separation; one song at a time (RAM budget); cancel keeps checkpoints.
- **D-15 – compile/target SDK 35, min 26.** `MediaStore.Audio` + `RELATIVE_PATH` on API 29+, legacy path + `WRITE_EXTERNAL_STORAGE(maxSdk 28)` on 26–28.

## Milestone 2 – lyrics
- **D-16 – Whisper recogniser deferred behind `WordRecognizer`.** whisper.cpp source and the multilingual model could not be fetched in the build sandbox (GitHub archives / HuggingFace blocked), and JNI code that was never compiled against the real library is not worth shipping blind. Everything around it is done and tested: JSON model with word timings, LRC / Enhanced-LRC, ID3 SYLT/USLT, editor, transliteration, UI. Next step (M2b): CI downloads whisper.cpp (pinned tag) + `ggml-small-q5_1` at **build time**, bundles the model as an APK asset, and implements `WordRecognizer` via JNI (still no runtime download). Malayalam accuracy will need the editor.
- **D-17 – Plain text without timings gets "rough sync"**, not forced alignment: lines are spread over the vocal stem's singing regions (energy VAD) by text length. Tagged `TEXT_ROUGH` and flagged in the UI. Real forced alignment needs the ASR model (M2b).
- **D-18 – Transliteration via `android.icu.text.Transliterator("Any-Latin; Latin-ASCII")`** (API 24+, bundled with Android, offline). Diacritics are dropped for readability. English meaning needs the optional NMT pack: the chip is present but disabled until M2b/pack decision.
- **D-19 – Lyrics stored as `lyrics.json` per song**; display mode remembered per song in the library index.

## Not yet decided (later milestones)
Whisper model size/quantisation, translation pack size, signalling backend (leaning Cloudflare Workers + Durable Objects), Oboe vs ExoPlayer player core.
