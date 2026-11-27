#!/usr/bin/env python3
"""Export htdemucs to ONNX with the contract documented in README.md.  UNVERIFIED – see README."""
import argparse
import math

import torch
import torch.nn as nn

SEGMENT = 343_980  # frames @ 44.1 kHz  (7.8 s, the training segment of htdemucs)


class RealSTFT(nn.Module):
    """Real-valued STFT via conv1d (hann window, centre/reflect padding) -> [B, C, F, T, 2]. ONNX-exportable."""

    def __init__(self, n_fft: int, hop: int):
        super().__init__()
        self.n_fft, self.hop = n_fft, hop
        k = torch.arange(n_fft // 2 + 1)[:, None]
        n = torch.arange(n_fft)[None, :]
        ang = 2 * math.pi * k * n / n_fft
        win = torch.hann_window(n_fft, periodic=True)
        self.register_buffer("cos", (torch.cos(ang) * win).unsqueeze(1))
        self.register_buffer("sin", (-torch.sin(ang) * win).unsqueeze(1))

    def forward(self, x):  # x: [B, C, L]
        b, c, l = x.shape
        x = nn.functional.pad(x.reshape(b * c, 1, l), (self.n_fft // 2, self.n_fft // 2), mode="reflect")
        re = nn.functional.conv1d(x, self.cos, stride=self.hop)
        im = nn.functional.conv1d(x, self.sin, stride=self.hop)
        return torch.stack([re, im], dim=-1).reshape(b, c, re.shape[1], re.shape[2], 2)


class Wrapper(nn.Module):
    """mix [1,2,L] -> sources [1,4,2,L]; does Demucs' own mean/std normalisation so callers pass raw audio."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, mix):
        ref = mix.mean(dim=1, keepdim=True)
        mean, std = ref.mean(dim=(1, 2), keepdim=True), ref.std(dim=(1, 2), keepdim=True) + 1e-8
        out = self.model((mix - mean) / std)
        return out * std.unsqueeze(1) + mean.unsqueeze(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--opset", type=int, default=17)
    args = ap.parse_args()

    from demucs.pretrained import get_model

    model = get_model("htdemucs").models[0].eval()
    assert model.sources == ["drums", "bass", "other", "vocals"], model.sources
    # TODO(first real run): patch model._spec / model._ispec to use RealSTFT + its inverse (overlap-add conv_transpose1d).
    wrapper = Wrapper(model).eval()
    dummy = torch.randn(1, 2, SEGMENT)
    with torch.no_grad():
        ref = wrapper(dummy)
    print("pytorch output", tuple(ref.shape))
    torch.onnx.export(
        wrapper, dummy, args.out, opset_version=args.opset,
        input_names=["mix"], output_names=["sources"], dynamic_axes=None,  # fixed chunk size = fixed shapes = faster mobile inference
    )
    print("wrote", args.out)


if __name__ == "__main__":
    main()
