#!/usr/bin/env python3
"""validate.py fp32.onnx quant.onnx [song.wav] [--min-sdr DB]
Runs both models on one 7.8 s chunk (a real song if given, else a synthetic music-like signal) and reports
SDR(quantised vs fp32) per stem, the null test (sum of stems vs input) and per-chunk CPU latency.
Exits non-zero if the vocals SDR is below --min-sdr."""
import argparse
import time

import numpy as np
import onnxruntime as ort

SEG = 343_980
ap = argparse.ArgumentParser()
ap.add_argument("fp32"); ap.add_argument("quant"); ap.add_argument("wav", nargs="?"); ap.add_argument("--min-sdr", type=float, default=None)
a = ap.parse_args()

if a.wav:
    import soundfile as sf
    x, sr = sf.read(a.wav, dtype="float32", always_2d=True)
    assert sr == 44100, "resample to 44.1 kHz first"
    x = x[:SEG].T
    x = np.pad(x, ((0, 0), (0, SEG - x.shape[1])))
else:
    t = np.arange(SEG) / 44100
    rng = np.random.default_rng(0)
    note = lambda f: sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 6))
    x = np.stack([0.15 * note(220) * (np.sin(2 * np.pi * 2 * t) > 0) + 0.1 * rng.standard_normal(SEG) * 0.3,
                  0.15 * note(330) + 0.1 * rng.standard_normal(SEG) * 0.3]).astype(np.float32)
x = x[None].astype(np.float32)

def run(p):
    s = ort.InferenceSession(p, providers=["CPUExecutionProvider"])
    t0 = time.time(); o = s.run(None, {"mix": x})[0]; return o, time.time() - t0

fp, t_fp = run(a.fp32)
q, t_q = run(a.quant)
sdr = lambda ref, est: 10 * np.log10((ref ** 2).sum() / (((ref - est) ** 2).sum() + 1e-12))
names = ["drums", "bass", "other", "vocals"]
res = {n: sdr(fp[0, i], q[0, i]) for i, n in enumerate(names)}
print("SDR(int8 vs fp32): " + ", ".join(f"{n} {v:.1f} dB" for n, v in res.items()))
print("null test fp32 (sum stems vs input): %.1f dB" % (10 * np.log10(((fp[0].sum(0) - x[0]) ** 2).sum() / (x[0] ** 2).sum() + 1e-20)))
print(f"latency per 7.8 s chunk on this CPU: fp32 {t_fp:.1f}s, int8 {t_q:.1f}s")
if a.min_sdr is not None and res["vocals"] < a.min_sdr:
    raise SystemExit(f"vocals SDR {res['vocals']:.1f} dB < {a.min_sdr} dB")
