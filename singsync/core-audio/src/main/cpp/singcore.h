// SingSync shared C++ core. Pure C++17, no Android dependencies, so it can be reused by the future iOS port.
#pragma once
#include <cstddef>

namespace singcore {

// Reconstruction ("null") test: residual energy of (a + b - original) relative to original energy, in dB.
// All buffers are mono/planar of length n; call once per channel and pass accumulated sums via the out params,
// or use nullTestResidualDb for two-channel convenience.
// Returns -300 for a perfect reconstruction and -inf-like (-1000) if the original is silent.
double nullTestResidualDb(const float* origL, const float* origR,
                          const float* aL, const float* aR,
                          const float* bL, const float* bR, size_t n);

// Linear-phase-free peak and RMS helpers (used by the gain-staging tests / level meters).
float peakAbs(const float* x, size_t n);
double rmsDb(const float* x, size_t n);

}  // namespace singcore
