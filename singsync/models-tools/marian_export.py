"""Export a Marian (opus-mt) model to two small ONNX graphs the app runs with ONNX Runtime, no KV cache
(lyric lines are short, so re-running the decoder per step is cheap and the graphs stay simple):

  encoder.onnx  input_ids [1,S] int64, attention_mask [1,S] int64          -> hidden [1,S,D]
  decoder.onnx  decoder_input_ids [1,T] int64, encoder_hidden [1,S,D], attention_mask [1,S] -> logits [1,V] (last position)

Also copies source.spm / target.spm / vocab.json and writes meta.json (ids the decode loop needs).
"""
import json
import os
import shutil

import torch
import torch.nn as nn
from transformers import MarianMTModel


class Enc(nn.Module):
    def __init__(self, m):
        super().__init__(); self.enc = m.get_encoder()

    def forward(self, input_ids, attention_mask):
        return self.enc(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state


class Dec(nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, decoder_input_ids, encoder_hidden, attention_mask):
        h = self.m.model.decoder(input_ids=decoder_input_ids, encoder_hidden_states=encoder_hidden,
                                 encoder_attention_mask=attention_mask, use_cache=False).last_hidden_state[:, -1]
        return self.m.lm_head(h) + self.m.final_logits_bias[0]


def export(model: MarianMTModel, src_dir: str, out_dir: str, opset: int = 17):
    """`src_dir` must contain source.spm, target.spm, vocab.json."""
    os.makedirs(out_dir, exist_ok=True)
    model = model.eval()
    cfg = model.config
    ids = torch.tensor([[5, 6, 7, 8, 0]]); mask = torch.ones_like(ids)
    with torch.no_grad():
        hid = Enc(model)(ids, mask)
    torch.onnx.export(Enc(model), (ids, mask), os.path.join(out_dir, "encoder.onnx"), opset_version=opset, dynamo=False,
                      input_names=["input_ids", "attention_mask"], output_names=["hidden"],
                      dynamic_axes={"input_ids": {1: "s"}, "attention_mask": {1: "s"}, "hidden": {1: "s"}})
    dec_ids = torch.tensor([[cfg.decoder_start_token_id, 9]])
    torch.onnx.export(Dec(model), (dec_ids, hid, mask), os.path.join(out_dir, "decoder.onnx"), opset_version=opset, dynamo=False,
                      input_names=["decoder_input_ids", "encoder_hidden", "attention_mask"], output_names=["logits"],
                      dynamic_axes={"decoder_input_ids": {1: "t"}, "encoder_hidden": {1: "s"}, "attention_mask": {1: "s"}})
    for f in ("source.spm", "target.spm", "vocab.json"):
        if os.path.abspath(src_dir) != os.path.abspath(out_dir): shutil.copy(os.path.join(src_dir, f), os.path.join(out_dir, f))
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump({"eos": cfg.eos_token_id, "pad": cfg.pad_token_id, "decoder_start": cfg.decoder_start_token_id,
                   "vocab_size": cfg.vocab_size, "max_length": min(int(getattr(cfg, "max_length", 128) or 128), 128)}, f)
