#include "singcore.h"
#include <algorithm>
#include <cmath>

namespace singcore {

double nullTestResidualDb(const float* origL, const float* origR, const float* aL, const float* aR,
                          const float* bL, const float* bR, size_t n) {
    double num = 0.0, den = 0.0;
    for (size_t i = 0; i < n; ++i) {
        const double rl = static_cast<double>(aL[i]) + bL[i] - origL[i];
        const double rr = static_cast<double>(aR[i]) + bR[i] - origR[i];
        num += rl * rl + rr * rr;
        den += static_cast<double>(origL[i]) * origL[i] + static_cast<double>(origR[i]) * origR[i];
    }
    if (den == 0.0) return -1000.0;
    if (num == 0.0) return -300.0;
    return 10.0 * std::log10(num / den);
}

float peakAbs(const float* x, size_t n) {
    float p = 0.f;
    for (size_t i = 0; i < n; ++i) p = std::max(p, std::fabs(x[i]));
    return p;
}

double rmsDb(const float* x, size_t n) {
    if (n == 0) return -1000.0;
    double s = 0.0;
    for (size_t i = 0; i < n; ++i) s += static_cast<double>(x[i]) * x[i];
    return s == 0.0 ? -1000.0 : 10.0 * std::log10(s / static_cast<double>(n));
}

}  // namespace singcore
