#!/usr/bin/env python3
"""Dynamic int8 (default) or fp16 quantisation of the exported model.  UNVERIFIED – see README."""
import argparse

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst"); ap.add_argument("--fp16", action="store_true")
a = ap.parse_args()

if a.fp16:
    import onnx
    from onnxconverter_common import float16  # pip install onnxconverter-common
    onnx.save(float16.convert_float_to_float16(onnx.load(a.src), keep_io_types=True), a.dst)
else:
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(a.src, a.dst, weight_type=QuantType.QInt8)  # conv-heavy nets: verify SDR drop with validate.py
print("wrote", a.dst)
