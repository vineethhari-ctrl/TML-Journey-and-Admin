# SingSync – architecture plan

```
┌────────────────────────────── :app (Compose, Material 3) ─────────────────────────────┐
│ Library · Import/Processing · Karaoke · Record/Review · Mix/Export · Duet · Settings   │
│ SongStore(JSON) · ProcessingService(FGS) · ProcessingEngine · ThermalGuard             │
└──────┬───────────────┬────────────────┬───────────────────┬───────────────┬───────────┘
       │               │                │                   │               │
   :ui (theme,      :ml (ONNX Runtime,  :core-audio         :duet (M6)     :common (pure Kotlin/JVM, unit-tested)
    components)      SeparatorFactory,   Kotlin: decoder,     signalling,     ChunkPlan · OverlapAdd · Resampler
                     whisper JNI (M2),   exporter, JNI         WebRTC,         FlacEncoder · Separator · Pipeline
                     NMT (M2)            C++17 `singcore`:     clock sync      (resume/cancel) · NullTest
                                         null-test (M1) →
                                         Oboe engine, polish DSP, SoundTouch, LUFS (M3–M5)
```

Principles
* **Shared core:** anything DSP/ML-heavy goes to `singcore` (portable C++17, zero Android deps) so iOS can reuse it. Orchestration stays in Kotlin.
* **Testable off-device:** logic with no Android dependency lives in `:common` and is covered by JVM unit tests that run in CI in seconds.
* **Offline by construction:** no `INTERNET` permission until the duet milestone; models are bundled assets.
* **Resumable by default:** long jobs checkpoint per chunk; the process may die at any time.

## Milestones
| # | Scope | Status |
|---|---|---|
| 1 | Import → decode → chunked separation (resumable, foreground service, thermal guard) → lossless FLAC stems → library/processing UI, export to Music/SingSync, A/B listening, null test | **this commit** (Classic fallback separator; Demucs ONNX wired but model not yet converted) |
| 2 | Lyrics: JSON model, LRC/Enhanced-LRC, ID3 SYLT/USLT, rough alignment to the vocal, editor, ICU transliteration, UI – **done**. Whisper.cpp recogniser + translation pack: **M2b** (needs build-time fetch, see D-16) | partial |
| 3 | Karaoke player: SoundTouch key/tempo, guide-vocal slider, count-in, 60 fps word wipe, language chips | |
| 4 | Recording: Oboe, latency calibration, monitoring, take review | |
| 5 | Voice polish + mixing (-14 LUFS, true-peak limiter), export WAV24/M4A, share | |
| 6 | Duet: signalling worker, App Links, WebRTC, clock sync, dry-take exchange, async mode | |

## Data flow – Milestone 1
`OpenMultipleDocuments` → `SongImporter` (copy + tags + cover) → `ProcessingService` queue → `ProcessingEngine`:
`AudioDecoder` (MediaCodec → float → 44.1 kHz) → `SeparationPipeline` (`ChunkPlan` → `Separator.separate` per chunk → checkpoint → `OverlapAdd`) → `FlacEncoder` ×2 → `NativeCore.nullTestDb` → `SongStore` (UI observes the `StateFlow`).
