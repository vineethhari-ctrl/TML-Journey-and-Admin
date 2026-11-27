#!/usr/bin/env python3
"""build_all.py --out DIR [--only demucs,whisper,translate] [--random-init]
Builds every bundled model into DIR (becomes app/src/main/assets/models). Each model is independent: a failure is
reported (and written to manifest.json) but does not stop the others, so the APK still builds – with that feature
visibly degraded in the app's Settings screen. Used by CI; can be run locally.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
WHISPER_MODEL = "ggml-small-q5_1.bin"
WHISPER_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/" + WHISPER_MODEL


def sh(*cmd, cwd=HERE):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def build_demucs(out, random_init):
    work = os.path.join(HERE, "work"); os.makedirs(work, exist_ok=True)
    fp32, small, final = (os.path.join(work, n) for n in ("fp32.onnx", "small.onnx", "htdemucs.onnx"))
    sh(sys.executable, "test_equivalence.py")                                   # real-valued STFT == original (fails the build if not)
    sh(sys.executable, "convert_htdemucs.py", "--out", fp32, *(["--random-init"] if random_init else []))
    sh(sys.executable, "shrink_dft.py", fp32, small)
    sh(sys.executable, "quantize.py", small, final)
    sh(sys.executable, "validate.py", small, final, "--min-sdr", "40")          # fp16-weights vs fp32 must stay > 40 dB
    os.replace(final, os.path.join(out, "htdemucs.onnx"))
    return {"file": "htdemucs.onnx", "id": "htdemucs-fp16w", "random_init": random_init}


def build_whisper(out):
    dst = os.path.join(out, WHISPER_MODEL)
    print("downloading", WHISPER_URL, flush=True)
    urllib.request.urlretrieve(WHISPER_URL, dst)
    size = os.path.getsize(dst)
    assert size > 100_000_000, f"whisper model looks truncated ({size} bytes)"
    with open(dst, "rb") as f:
        assert f.read(4) == b"lmgg", "not a ggml model file"   # ggml magic 0x67676d6c, little endian
    return {"file": WHISPER_MODEL, "size": size}


def build_translate(out):
    from build_translation import build_all
    return build_all(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="demucs,whisper,translate")
    ap.add_argument("--random-init", action="store_true")
    a = ap.parse_args()
    out = os.path.abspath(a.out); os.makedirs(out, exist_ok=True)
    manifest = {}
    jobs = {"demucs": lambda: build_demucs(out, a.random_init), "whisper": lambda: build_whisper(out), "translate": lambda: build_translate(out)}
    for name in a.only.split(","):
        t0 = time.time()
        try:
            manifest[name] = {"status": "ok", **jobs[name]()}
        except Exception as e:  # noqa
            manifest[name] = {"status": "failed", "error": f"{type(e).__name__}: {e}"}
            print(f"::warning title=model '{name}' FAILED::{e}", flush=True)
        manifest[name]["seconds"] = round(time.time() - t0)
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
