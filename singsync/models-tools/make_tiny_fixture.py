#!/usr/bin/env python3
"""Builds a tiny random-weight Marian model + real SentencePiece models + golden outputs, used by the JVM tests to verify
the Kotlin SentencePiece tokenizer and greedy decode loop against Python.  usage: make_tiny_fixture.py OUT_DIR"""
import json
import os
import sys
import tempfile

import numpy as np
import onnxruntime as ort
import sentencepiece as spm
import torch
from transformers import MarianConfig, MarianMTModel

from marian_export import export

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
torch.manual_seed(0)
corpus = """यह एक गाना है
मैं तुमसे प्यार करता हूँ
तुम मेरे साथ चलो
दिल की बात सुनो
ഞാൻ നിന്നെ സ്നേഹിക്കുന്നു
ഇത് ഒരു പാട്ടാണ്
നീ എന്റെ കൂടെ വരൂ
हम साथ साथ हैं
ഹൃദയത്തിന്റെ വാക്ക് കേൾക്കൂ
the love of my life
sing with me tonight""".splitlines() * 20
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, "c.txt"); open(p, "w").write("\n".join(corpus))
    for kind, name in (("unigram", "source"), ("bpe", "target")):   # one unigram, one bpe: both code paths get tested
        spm.SentencePieceTrainer.train(input=p, model_prefix=os.path.join(out, name), vocab_size=90, model_type=kind,
                                       character_coverage=1.0, pad_id=-1, unk_id=1, bos_id=-1, eos_id=0, hard_vocab_limit=False)
        os.replace(os.path.join(out, name + ".model"), os.path.join(out, name + ".spm")); os.remove(os.path.join(out, name + ".vocab"))
# Marian-style shared vocab.json: piece -> id (ids from the source spm, plus <pad> last), same as opus-mt
sp = spm.SentencePieceProcessor(model_file=os.path.join(out, "source.spm"))
vocab = {sp.id_to_piece(i): i for i in range(sp.get_piece_size())}
tp = spm.SentencePieceProcessor(model_file=os.path.join(out, "target.spm"))
for i in range(tp.get_piece_size()):               # target pieces missing from the source vocab get fresh ids
    pc = tp.id_to_piece(i)
    if pc not in vocab: vocab[pc] = len(vocab)
vocab["<pad>"] = len(vocab)
json.dump(vocab, open(os.path.join(out, "vocab.json"), "w"), ensure_ascii=False)
V = len(vocab)
cfg = MarianConfig(vocab_size=V, d_model=32, encoder_layers=1, decoder_layers=1, encoder_attention_heads=2, decoder_attention_heads=2,
                   encoder_ffn_dim=64, decoder_ffn_dim=64, max_position_embeddings=128, pad_token_id=V - 1, eos_token_id=0,
                   decoder_start_token_id=V - 1, share_encoder_decoder_embeddings=True, scale_embedding=True, attn_implementation="eager")
model = MarianMTModel(cfg).eval()
with torch.no_grad():                       # larger weights => input-dependent, non-degenerate outputs (a meaningful test)
    for n, prm in model.named_parameters():
        if 'embed_positions' not in n and prm.dim() > 1: prm.normal_(0, 0.5)
export(model, out, out)

# golden: python tokenisation + greedy decode through the exported graphs
enc = ort.InferenceSession(os.path.join(out, "encoder.onnx")); dec = ort.InferenceSession(os.path.join(out, "decoder.onnx"))
unk = vocab["<unk>"]
def tokenize(text):
    return [vocab.get(p, unk) for p in sp.encode(text, out_type=str)] + [0]
def greedy(ids, max_len=12):
    a = np.array([ids], dtype=np.int64); m = np.ones_like(a)
    h = enc.run(None, {"input_ids": a, "attention_mask": m})[0]
    out_ids = [cfg.decoder_start_token_id]
    for _ in range(max_len):
        logits = dec.run(None, {"decoder_input_ids": np.array([out_ids], dtype=np.int64), "encoder_hidden": h, "attention_mask": m})[0][0]
        logits[cfg.pad_token_id] = -1e9                               # Marian never generates <pad>
        nxt = int(logits.argmax()); out_ids.append(nxt)
        if nxt == cfg.eos_token_id: break
    return out_ids[1:]
texts = ["यह एक गाना है", "ഞാൻ നിന്നെ സ്നേഹിക്കുന്നു", "  तुम   मेरे साथ चलो ", "the love of my life", "xyz ¿? 123", "ഇത് ഒരു പാട്ടാണ്।"]
gold = []
for t in texts:
    ids = tokenize(t)
    gold.append({"text": t, "src_pieces": sp.encode(t, out_type=str), "src_ids": ids, "greedy": greedy(ids),
                 "tgt_decode": tp.decode(tp.encode(t, out_type=int)),               # detokenisation reference for the BPE target model
                 "tgt_pieces": tp.encode(t, out_type=str)})
json.dump(gold, open(os.path.join(out, "golden.json"), "w"), ensure_ascii=False, indent=1)
print("fixture ok:", out, {f: os.path.getsize(os.path.join(out, f)) for f in sorted(os.listdir(out))})
