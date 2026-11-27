#!/usr/bin/env python3
"""Checks RealHTDemucs == HTDemucs (random weights are fine: it's an arithmetic-equivalence test) and ONNX export/ORT parity."""
import sys
from fractions import Fraction

import numpy as np
import torch
from demucs.htdemucs import HTDemucs

from real_htdemucs import RealHTDemucs, RealISTFT, RealSTFT

torch.manual_seed(0)
SEG = 343_980

# 1) Primitive checks vs torch.stft / torch.istft
x = torch.randn(3, 20_000)
nfft, hop = 4096, 1024
ref = torch.stft(x, nfft, hop, window=torch.hann_window(nfft), win_length=nfft, normalized=True, center=True, return_complex=True, pad_mode="reflect")
mine = RealSTFT(nfft, hop)(x)
print("stft  max err", (torch.view_as_real(ref).permute(0, 3, 1, 2) - mine).abs().max().item())
assert (torch.view_as_real(ref).permute(0, 3, 1, 2) - mine).abs().max() < 1e-4
back_ref = torch.istft(ref, nfft, hop, window=torch.hann_window(nfft), win_length=nfft, normalized=True, length=20_000, center=True)
back = RealISTFT(nfft, hop)(mine, 20_000 + 0)
print("istft max err", (back_ref - back).abs().max().item(), "| roundtrip err", (back - x).abs().max().item())
assert (back_ref - back).abs().max() < 1e-4

# 2) Whole model
orig = HTDemucs(sources=["drums", "bass", "other", "vocals"], audio_channels=2, samplerate=44100, segment=Fraction(39, 5)).eval()
real = RealHTDemucs.from_pretrained_instance(orig)
mix = torch.randn(1, 2, SEG) * 0.1
with torch.no_grad():
    a, b = orig(mix), real(mix)
err = (a - b).abs().max().item()
print("model max abs err", err, "| output scale", a.abs().max().item())
assert err < 1e-3 * max(1.0, a.abs().max().item()), err

if "--onnx" in sys.argv:
    import onnxruntime as ort
    import io
    buf = io.BytesIO()
    torch.onnx.export(real, mix, buf, opset_version=17, input_names=["mix"], output_names=["sources"], dynamo=False, do_constant_folding=False)
    sess = ort.InferenceSession(buf.getvalue(), providers=["CPUExecutionProvider"])
    o = sess.run(None, {"mix": mix.numpy()})[0]
    e = np.abs(o - b.numpy()).max()
    print("onnx vs torch max err", e)
    assert e < 1e-3 * max(1.0, float(np.abs(o).max()))
print("OK")
