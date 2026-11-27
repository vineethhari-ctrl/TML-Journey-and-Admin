#!/usr/bin/env python3
"""quantize.py in.onnx out.onnx   – weight-only fp16 compression (default).

Why not int8? htdemucs is >95 % convolutions and ONNX Runtime's CPU provider (the one the app ships, 1.20) has no
kernel for dynamic-quantised Conv ("ConvInteger not implemented" – verified, the model would fail to load on the
phone). So large float weights are STORED as fp16 and cast back to fp32 by a Cast node that ORT constant-folds at
session creation: file size /2, compute stays fp32 (fast + accurate on CPU), error ~1e-3 relative per weight.
`--int8` is kept for future runtimes but is NOT usable with onnxruntime-android 1.20."""
import argparse

import numpy as np
import onnx
from onnx import TensorProto as TP, helper as h, numpy_helper as nh

def fp16_weights(src, dst):
    m = onnx.load(src); g = m.graph
    keep, casts, saved = [], [], 0
    for init in g.initializer:
        if init.data_type == TP.FLOAT and int(np.prod(init.dims)) >= 1024:
            arr = nh.to_array(init); half = arr.astype(np.float16)
            if np.isfinite(half).all():
                stored = nh.from_array(half, init.name + "__fp16"); keep.append(stored)
                casts.append(h.make_node("Cast", [stored.name], [init.name], to=TP.FLOAT, name=init.name + "__cast"))
                saved += arr.nbytes - half.nbytes; continue
        keep.append(init)
    nodes = list(g.node); del g.node[:]; g.node.extend(casts + nodes)
    del g.initializer[:]; g.initializer.extend(keep)
    m.ir_version = min(m.ir_version, 9)   # onnxruntime-android 1.20 reads IR <= 10
    onnx.save(m, dst)
    return len(casts), saved


def int8_matmul(src, dst):
    """Dynamic int8 for MatMul/Gemm only (Marian is MatMul-dominated; ORT 1.20 has MatMulInteger on CPU)."""
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(src, dst, weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gemm"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst"); ap.add_argument("--int8", action="store_true")
    a = ap.parse_args()
    if a.int8:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        quantize_dynamic(a.src, a.dst, weight_type=QuantType.QInt8)
    else:
        n, saved = fp16_weights(a.src, a.dst)
        print(f"{n} tensors stored as fp16, saved {saved / 1e6:.0f} MB")
    print("wrote", a.dst)
