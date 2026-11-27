#!/usr/bin/env python3
"""Compare fp32 vs quantised model on one song: SDR of quantised vs fp32 stems + null test.  UNVERIFIED – see README."""
import sys

import numpy as np
import onnxruntime as ort
import soundfile as sf

SEG = 343_980
fp32, quant, wav = sys.argv[1:4]
x, sr = sf.read(wav, dtype="float32", always_2d=True)
assert sr == 44100, "resample to 44.1 kHz first"
x = x[: SEG * 1].T[None]
if x.shape[-1] < SEG:
    x = np.pad(x, ((0, 0), (0, 0), (0, SEG - x.shape[-1])))
run = lambda p: ort.InferenceSession(p, providers=["CPUExecutionProvider"]).run(None, {"mix": x})[0]
a, b = run(fp32), run(quant)
sdr = lambda ref, est: 10 * np.log10((ref ** 2).sum() / (((ref - est) ** 2).sum() + 1e-12))
print("SDR(quantised vs fp32), vocals: %.1f dB" % sdr(a[0, 3], b[0, 3]))
print("null test (sum of stems vs input): %.1f dB" % (10 * np.log10(((b[0].sum(0) - x[0]) ** 2).sum() / (x[0] ** 2).sum())))
