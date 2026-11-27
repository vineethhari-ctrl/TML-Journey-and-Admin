"""Real-valued (ONNX-exportable) htdemucs: replaces the complex STFT / iSTFT with conv1d DFT / conv_transpose1d iDFT.

htdemucs only touches complex tensors in `_spec`, `_magnitude`, `_mask` and `_ispec`; everything else is real.
We keep the complex dimension as an explicit axis [B, C, 2, F, T] (re/im) instead of a complex dtype.
Equivalence with the original is asserted by `test_equivalence.py` (max abs error ~1e-5 on the full model).
"""
import math

import torch
import torch.nn as nn
import torch.nn.functional as F
from demucs.htdemucs import HTDemucs


class RealSTFT(nn.Module):
    """== torch.stft(x, n_fft, hop, window=hann(n_fft), normalized=True, center=True, pad_mode='reflect', return_complex)
    returns [N, 2, F, T] (re, im) for x [N, L]."""

    def __init__(self, n_fft: int, hop: int):
        super().__init__()
        self.n_fft, self.hop = n_fft, hop
        self.scale = 1.0 / math.sqrt(n_fft)  # normalized=True

    def _basis(self, ref):
        # Generated from aranges (exact integer phase k*n mod N) so the exported graph stays tiny when
        # constant folding is disabled; ONNX Runtime folds it once at session creation.
        N = self.n_fft
        k = torch.arange(N // 2 + 1, device=ref.device, dtype=torch.int64)[:, None]
        n = torch.arange(N, device=ref.device, dtype=torch.int64)[None, :]
        ang = (2 * math.pi / N) * ((k * n) % N).to(ref.dtype)
        win = 0.5 - 0.5 * torch.cos((2 * math.pi / N) * n.to(ref.dtype))        # periodic hann
        return (torch.cos(ang) * win * self.scale).unsqueeze(1), (-torch.sin(ang) * win * self.scale).unsqueeze(1)

    def forward(self, x):
        cos, sin = self._basis(x)
        x = F.pad(x.unsqueeze(1), (self.n_fft // 2, self.n_fft // 2), mode="reflect")
        re = F.conv1d(x, cos, stride=self.hop)
        im = F.conv1d(x, sin, stride=self.hop)
        return torch.stack([re, im], dim=1)


class RealISTFT(nn.Module):
    """== torch.istft(z, n_fft, hop, window=hann(n_fft), normalized=True, center=True, length) for z [N, 2, F, T]."""

    def __init__(self, n_fft: int, hop: int):
        super().__init__()
        self.n_fft, self.hop = n_fft, hop
        self.scale = math.sqrt(n_fft) / n_fft  # normalized=True multiplies by sqrt(n_fft); irfft divides by n_fft

    def _basis(self, ref):
        N = self.n_fft
        k = torch.arange(N // 2 + 1, device=ref.device, dtype=torch.int64)[:, None]
        n = torch.arange(N, device=ref.device, dtype=torch.int64)[None, :]
        ang = (2 * math.pi / N) * ((k * n) % N).to(ref.dtype)
        win = 0.5 - 0.5 * torch.cos((2 * math.pi / N) * n.to(ref.dtype))
        w = torch.full((N // 2 + 1, 1), 2.0, dtype=ref.dtype, device=ref.device)
        w[0, 0] = 1.0
        w[-1, 0] = 1.0
        return (w * torch.cos(ang) * win * self.scale).unsqueeze(1), (-w * torch.sin(ang) * win * self.scale).unsqueeze(1), (win ** 2).view(1, 1, N)

    def forward(self, z, length: int):
        cos, sin, win2 = self._basis(z)
        re, im = z[:, 0], z[:, 1]                                          # [N,F,T]
        y = F.conv_transpose1d(re, cos, stride=self.hop) + F.conv_transpose1d(im, sin, stride=self.hop)  # [N,1,L']
        t = z.shape[-1]
        env = F.conv_transpose1d(torch.ones(1, 1, t, dtype=z.dtype, device=z.device), win2, stride=self.hop)
        y = y / env.clamp_min(1e-11)
        y = y[..., self.n_fft // 2:]
        return y[..., :length].squeeze(1)


class RealHTDemucs(HTDemucs):
    """Drop-in HTDemucs whose spectral helpers use real tensors (cac=True configuration, i.e. htdemucs)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        assert self.cac, "only the complex-as-channels (cac) variant is supported"
        self._rstft = RealSTFT(self.nfft, self.hop_length)
        self._ristft = RealISTFT(self.nfft, self.hop_length)
        self._ristft_cache = {}

    @classmethod
    def from_pretrained_instance(cls, model: HTDemucs) -> "RealHTDemucs":
        """Build a RealHTDemucs with the same hyper-parameters and weights as `model`."""
        new = cls(*model._init_args_kwargs[0], **model._init_args_kwargs[1])
        missing, unexpected = new.load_state_dict(model.state_dict(), strict=False)
        assert not unexpected and all(m.startswith("_r") for m in missing), (missing, unexpected)
        return new.eval()

    def _spec(self, x):
        hl, nfft = self.hop_length, self.nfft
        le = int(math.ceil(x.shape[-1] / hl))
        pad = hl // 2 * 3
        x = F.pad(x, (pad, pad + le * hl - x.shape[-1]), mode="reflect")
        b, c, l = x.shape
        z = self._rstft(x.reshape(b * c, l))                          # [N,2,F+1... ,T]
        z = z.reshape(b, c, 2, z.shape[-2], z.shape[-1])[..., :-1, :]
        return z[..., 2: 2 + le]                                      # [B,C,2,F,T]

    def _magnitude(self, z):
        b, c, two, fr, t = z.shape
        return z.reshape(b, c * 2, fr, t)

    def _mask(self, z, m):
        b, s, c, fr, t = m.shape
        return m.reshape(b, s, c // 2, 2, fr, t)                      # [B,S,C,2,F,T]

    def _ispec(self, z, length=None, scale=0):
        hl = self.hop_length // (4 ** scale)
        b, s, c, two, fr, t = z.shape
        z = z.reshape(b * s * c, two, fr, t)
        z = F.pad(z, (2, 2, 0, 1))                                    # +1 freq bin, +2 frames each side
        pad = hl // 2 * 3
        le = hl * int(math.ceil(length / hl)) + 2 * pad
        x = self._ristft(z, le)
        x = x[..., pad: pad + length]
        return x.reshape(b, s, c, length)
