"""Builds the bundled English-translation packs (Helsinki-NLP opus-mt hi-en, ml-en) into OUT/opus-mt-<pair>/.
Each pack: encoder.onnx, decoder.onnx (int8 MatMul + fp16 weights), source.spm, target.spm, vocab.json, meta.json.
Needs network (HuggingFace) – runs in CI only."""
import os
import shutil
import tempfile

from marian_export import export
from quantize import fp16_weights, int8_matmul

PAIRS = ["hi-en", "ml-en"]
SAMPLES = {"hi-en": "यह एक बहुत सुंदर गाना है", "ml-en": "ഇത് വളരെ മനോഹരമായ ഒരു പാട്ടാണ്"}


def compress(path):
    tmp = path + ".i8"
    int8_matmul(path, tmp)
    fp16_weights(tmp, path)
    os.remove(tmp)


def build_pair(pair, out):
    from huggingface_hub import snapshot_download
    from transformers import MarianMTModel
    repo = f"Helsinki-NLP/opus-mt-{pair}"
    src = snapshot_download(repo, allow_patterns=["*.spm", "vocab.json", "config.json", "*.safetensors", "pytorch_model.bin", "generation_config.json"])
    model = MarianMTModel.from_pretrained(src, attn_implementation="eager").eval()
    dst = os.path.join(out, f"opus-mt-{pair}")
    with tempfile.TemporaryDirectory() as t:
        export(model, src, t)
        raw = {f: os.path.getsize(os.path.join(t, f)) for f in ("encoder.onnx", "decoder.onnx")}
        sanity(t, pair, "fp32")
        for f in ("encoder.onnx", "decoder.onnx"):
            compress(os.path.join(t, f))
        small = sanity(t, pair, "compressed")
        os.makedirs(dst, exist_ok=True)
        for f in os.listdir(t):
            shutil.copy(os.path.join(t, f), os.path.join(dst, f))
    size = sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst))
    print(f"{pair}: {sum(raw.values())/1e6:.0f} MB fp32 -> {size/1e6:.0f} MB pack; sample -> {small!r}")
    return size


def sanity(d, pair, label):
    """Greedy-translate one sentence through the exported graphs (pure python mirror of the Kotlin loop)."""
    import json
    import numpy as np
    import onnxruntime as ort
    import sentencepiece as spm
    vocab = json.load(open(os.path.join(d, "vocab.json"))); meta = json.load(open(os.path.join(d, "meta.json")))
    sp = spm.SentencePieceProcessor(model_file=os.path.join(d, "source.spm")); tp = spm.SentencePieceProcessor(model_file=os.path.join(d, "target.spm"))
    rev = {v: k for k, v in vocab.items()}
    enc = ort.InferenceSession(os.path.join(d, "encoder.onnx")); dec = ort.InferenceSession(os.path.join(d, "decoder.onnx"))
    ids = [vocab.get(p, vocab["<unk>"]) for p in sp.encode(SAMPLES[pair], out_type=str)] + [meta["eos"]]
    a = np.array([ids], dtype=np.int64); m = np.ones_like(a)
    h = enc.run(None, {"input_ids": a, "attention_mask": m})[0]
    out = [meta["decoder_start"]]
    for _ in range(40):
        lg = dec.run(None, {"decoder_input_ids": np.array([out], dtype=np.int64), "encoder_hidden": h, "attention_mask": m})[0][0]
        lg[meta["pad"]] = -1e9
        n = int(lg.argmax()); out.append(n)
        if n == meta["eos"]: break
    text = tp.decode([tp.piece_to_id(rev[i]) for i in out[1:] if i != meta["eos"] and rev.get(i) in vocab and tp.piece_to_id(rev[i]) != 0])
    print(f"[{pair} {label}] {SAMPLES[pair]} -> {text}")
    assert any(c.isascii() and c.isalpha() for c in text), f"{pair} {label}: translation has no Latin letters: {text!r}"
    return text


def build_all(out):
    sizes = {p: build_pair(p, out) for p in PAIRS}
    return {"packs": [f"opus-mt-{p}" for p in PAIRS], "bytes": sizes}
