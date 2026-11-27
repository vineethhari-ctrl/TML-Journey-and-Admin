#!/usr/bin/env python3
"""shrink_dft.py in.onnx out.onnx
The exported real-valued STFT/iSTFT carries four dense DFT kernels [2049,1,4096] (4 x 33.5 MB = 134 MB). They are
pure functions of (k*n mod N), so we replace each initializer with a tiny subgraph (Range/Mod/Cos/Sin). ONNX Runtime
constant-folds it once at session creation (RAM unchanged at runtime, file ~134 MB smaller)."""
import math
import sys

import numpy as np
import onnx
from onnx import TensorProto as TP, helper as h, numpy_helper as nh

src, dst = sys.argv[1:3]
m = onnx.load(src)
g = m.graph
F_, N = 2049, 4096

k = np.arange(F_)[:, None]; n = np.arange(N)[None, :]
ang = 2 * np.pi / N * ((k * n) % N)
win = 0.5 - 0.5 * np.cos(2 * np.pi / N * n)
w = np.full((F_, 1), 2.0); w[0] = 1; w[-1] = 1
cands = {  # name -> (trig, scale, uses_w, uses_window)   (what the exporter froze into the constant)
    "stft_cos": (np.cos, 1 / math.sqrt(N), False, True), "stft_sin": (np.sin, -1 / math.sqrt(N), False, True),
    "raw_cos": (np.cos, 1.0, False, False), "raw_sin": (np.sin, 1.0, False, False),
}
def formula(trig, scale, use_w, use_win):
    return trig(ang) * (win if use_win else 1.0) * scale * (w if use_w else 1.0)

rng = np.random.default_rng(0)
rows = rng.integers(0, F_, 40); cols = rng.integers(0, N, 40)
replaced = 0
out_nodes = []

def big_constant(node):
    if node.op_type != "Constant": return None
    for at in node.attribute:
        if at.name == "value" and list(at.t.dims) in ([F_, 1, N], [F_, N]): return at.t
    return None

def chain(p, trig, scale, use_w, use_win, out_name, rank3):
    ns = []
    c = lambda nm, a_: ns.append(h.make_node("Constant", [], [p + nm], value=nh.from_array(np.asarray(a_), p + nm + "_v")))
    c("zero", np.int64(0)); c("one", np.int64(1)); c("F", np.int64(F_)); c("N", np.int64(N))
    c("ax0", np.array([1], np.int64)); c("ax1", np.array([0], np.int64)); c("two_pi_n", np.float32(2 * np.pi / N))
    c("scale", np.float32(scale)); c("half", np.float32(0.5)); c("w", w.astype(np.float32)); c("axes_mid", np.array([1], np.int64))
    nd = lambda op, i, o, **kw: ns.append(h.make_node(op, i, [p + o], **kw))
    nd("Range", [p + "zero", p + "F", p + "one"], "kr"); nd("Range", [p + "zero", p + "N", p + "one"], "nr")
    nd("Unsqueeze", [p + "kr", p + "ax0"], "k"); nd("Unsqueeze", [p + "nr", p + "ax1"], "n")                 # [F,1], [1,N]
    nd("Mul", [p + "k", p + "n"], "kn"); nd("Mod", [p + "kn", p + "N"], "knm")
    nd("Cast", [p + "knm"], "knf", to=TP.FLOAT); nd("Mul", [p + "knf", p + "two_pi_n"], "ang")
    nd("Cos" if trig is np.cos else "Sin", [p + "ang"], "trig")
    last = p + "trig"
    if use_win:
        nd("Cast", [p + "n"], "nf", to=TP.FLOAT); nd("Mul", [p + "nf", p + "two_pi_n"], "wa"); nd("Cos", [p + "wa"], "wc")
        nd("Mul", [p + "wc", p + "half"], "wch"); nd("Sub", [p + "half", p + "wch"], "win")                    # 0.5-0.5cos
        nd("Mul", [p + "trig", p + "win"], "t1"); last = p + "t1"
    if use_w: nd("Mul", [last, p + "w"], "t2"); last = p + "t2"
    nd("Mul", [last, p + "scale"], "t3" if rank3 else "t3f")
    if rank3:
        ns.append(h.make_node("Unsqueeze", [p + "t3", p + "axes_mid"], [out_name]))
    else:
        ns[-1].output[0] = out_name
    return ns

for node in g.node:
    t = big_constant(node)
    if t is None: out_nodes.append(node); continue
    arr = nh.to_array(t).reshape(F_, N)
    match = None
    for name, (trig, scale, use_w, use_win) in cands.items():
        if np.allclose(arr[rows, cols], formula(trig, scale, use_w, use_win)[rows, cols], atol=1e-6): match = (trig, scale, use_w, use_win); break
    if match is None:
        print("unrecognised big constant", node.output[0]); out_nodes.append(node); continue
    out_nodes.extend(chain(f"dft{replaced}_", *match, node.output[0], rank3=len(t.dims) == 3))
    replaced += 1
print("replaced", replaced, "DFT kernels")
assert replaced == 4, "expected 4 DFT kernels (stft cos/sin, istft cos/sin)"
del g.node[:]; g.node.extend(out_nodes)
onnx.save(m, dst)
print("wrote", dst)
