#include <cmath>
#include <cstdio>
#include <vector>
#include "singcore.h"

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); ++failures; } } while (0)

int main() {
    const size_t n = 10000;
    std::vector<float> oL(n), oR(n), vL(n), vR(n), iL(n), iR(n);
    for (size_t i = 0; i < n; ++i) {
        oL[i] = std::sin(0.01f * i); oR[i] = std::cos(0.013f * i);
        vL[i] = 0.3f * oL[i];        vR[i] = 0.3f * oR[i];
        iL[i] = oL[i] - vL[i];       iR[i] = oR[i] - vR[i];
    }
    // Perfect split (up to float rounding) -> far below -100 dB
    const double good = singcore::nullTestResidualDb(oL.data(), oR.data(), vL.data(), vR.data(), iL.data(), iR.data(), n);
    std::printf("null test residual (exact split): %.1f dB\n", good);
    CHECK(good < -120.0);

    // Exactly identical -> sentinel
    CHECK(singcore::nullTestResidualDb(oL.data(), oR.data(), oL.data(), oR.data(), std::vector<float>(n).data(), std::vector<float>(n).data(), n) == -300.0);

    // Dropping the vocal (a only) leaves residual = vocal energy: 0.3^2 -> 20*log10(0.3) = -10.46 dB
    const double bad = singcore::nullTestResidualDb(oL.data(), oR.data(), std::vector<float>(n).data(), std::vector<float>(n).data(), iL.data(), iR.data(), n);
    std::printf("null test residual (vocal dropped): %.2f dB\n", bad);
    CHECK(std::fabs(bad - 20.0 * std::log10(0.3)) < 0.01);

    CHECK(singcore::nullTestResidualDb(std::vector<float>(4).data(), std::vector<float>(4).data(), oL.data(), oR.data(), oL.data(), oR.data(), 4) == -1000.0);
    CHECK(std::fabs(singcore::peakAbs(oL.data(), n) - 1.0f) < 1e-3f);
    std::printf(failures ? "FAILED\n" : "OK\n");
    return failures ? 1 : 0;
}
