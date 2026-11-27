# Model conversion (PyTorch → ONNX → int8)

> **Status: UNVERIFIED.** Written in a sandbox with no PyTorch and no access to HuggingFace/PyPI model hosts, so the
> scripts have **not been executed end-to-end**. Treat `convert_htdemucs.py` as a worked starting point; the first real
> run will likely need small fixes (see "Known hard part"). The Android side is wired to the tensor contract below and is
> exercised in CI only with the built-in Classic fallback separator.

## Tensor contract the app expects (`OnnxSeparator`)

| | name | dtype | shape |
|---|---|---|---|
| in  | `mix`     | float32 | `[1, 2, 343980]` – 44.1 kHz stereo, raw (the wrapper normalises internally) |
| out | `sources` | float32 | `[1, 4, 2, 343980]` – order `drums, bass, other, vocals` |

Output file → `app/src/main/assets/models/htdemucs_int8.onnx` (git-ignored; it is 80–300 MB).

## Usage

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python convert_htdemucs.py --out work/htdemucs_fp32.onnx         # export
python quantize.py work/htdemucs_fp32.onnx work/htdemucs_int8.onnx  # dynamic int8 (or --fp16)
python validate.py work/htdemucs_fp32.onnx work/htdemucs_int8.onnx some_song.wav  # SDR vs fp32, null-test
cp work/htdemucs_int8.onnx ../app/src/main/assets/models/
```

## Known hard part
`htdemucs` runs an STFT/iSTFT with complex tensors inside `forward`, which `torch.onnx.export` rejects. The script
replaces them with real-valued, conv1d-based DFT/iDFT (exportable, mathematically identical) – see `RealSTFT` in
`convert_htdemucs.py`. If that patch needs work, the alternative (used by `sevagh/demucs.onnx`) is to keep the STFT
outside the graph and implement it in the C++ core; the Kotlin contract would then gain a `spec` input.

## Licences – check before shipping
* Demucs code **and** pretrained weights: MIT (facebookresearch/demucs). OK to bundle with attribution.
* MDX-Net `Kim_Vocal_2` (fallback "Fast" model idea): weights come from the UVR community; licence is **not clear**.
  Not bundled; do not add without a written licence check.
