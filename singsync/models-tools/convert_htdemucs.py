#!/usr/bin/env python3
"""Export htdemucs to ONNX with the app's tensor contract (see README):  mix [1,2,343980] -> sources [1,4,2,343980].

The complex STFT/iSTFT is replaced by real-valued conv DFT (real_htdemucs.py), verified equal to the original
(test_equivalence.py).  `--random-init` skips the weight download (used to test the toolchain without network access).
"""
import argparse
from fractions import Fraction

import torch
from demucs.htdemucs import HTDemucs

from real_htdemucs import RealHTDemucs

SEGMENT = 343_980  # frames @ 44.1 kHz = 7.8 s (htdemucs training segment)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--random-init", action="store_true")
    a = ap.parse_args()

    if a.random_init:
        base = HTDemucs(sources=["drums", "bass", "other", "vocals"], audio_channels=2, samplerate=44100, segment=Fraction(39, 5)).eval()
    else:
        from demucs.pretrained import get_model
        bag = get_model("htdemucs")
        base = bag.models[0].eval()
    assert list(base.sources) == ["drums", "bass", "other", "vocals"], base.sources
    model = RealHTDemucs.from_pretrained_instance(base)

    dummy = torch.randn(1, 2, SEGMENT) * 0.1
    with torch.no_grad():
        err = (model(dummy) - base(dummy)).abs().max().item()
    print(f"real-valued vs original max abs err: {err:.2e}")
    assert err < 1e-3, "STFT replacement diverged from the original model"

    torch.onnx.export(model, dummy, a.out, opset_version=a.opset, input_names=["mix"], output_names=["sources"],
                      dynamo=False, do_constant_folding=False)  # fixed chunk = fixed shapes: faster and smaller on mobile
    print("wrote", a.out)


if __name__ == "__main__":
    main()
