package app.facereveal.swap;

/** Similarity transforms as 2x3 matrices {m00, m01, m02, m10, m11, m12}, and small float-image helpers. */
final class Geom {
    private Geom() {}

    /** Least-squares scale + rotation + translation taking src points onto dst points. */
    static double[] similarity(double[][] src, double[][] dst) {
        int n = src.length;
        double msx = 0, msy = 0, mdx = 0, mdy = 0;
        for (int i = 0; i < n; i++) {
            msx += src[i][0]; msy += src[i][1]; mdx += dst[i][0]; mdy += dst[i][1];
        }
        msx /= n; msy /= n; mdx /= n; mdy /= n;
        double re = 0, im = 0, den = 0;
        for (int i = 0; i < n; i++) {
            double sx = src[i][0] - msx, sy = src[i][1] - msy, dx = dst[i][0] - mdx, dy = dst[i][1] - mdy;
            re += sx * dx + sy * dy;
            im += sx * dy - sy * dx;
            den += sx * sx + sy * sy;
        }
        double a = re / den, b = im / den;
        return new double[] {a, -b, mdx - (a * msx - b * msy), b, a, mdy - (b * msx + a * msy)};
    }

    static double[] invert(double[] m) {
        double det = m[0] * m[4] - m[1] * m[3];
        double i00 = m[4] / det, i01 = -m[1] / det, i10 = -m[3] / det, i11 = m[0] / det;
        return new double[] {i00, i01, -(i00 * m[2] + i01 * m[5]), i10, i11, -(i10 * m[2] + i11 * m[5])};
    }


    static double[][] scale(double[][] pts, double k) {
        double[][] o = new double[pts.length][2];
        for (int i = 0; i < pts.length; i++) { o[i][0] = pts[i][0] * k; o[i][1] = pts[i][1] * k; }
        return o;
    }

    /** Gaussian blur of a w x h float plane, OpenCV's sigma rule for a given odd kernel size. */
    static float[] blur(float[] a, int w, int h, int ksize) {
        ksize |= 1;
        double sigma = 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8;
        int r = ksize / 2;
        float[] k = new float[ksize];
        double s = 0;
        for (int i = 0; i < ksize; i++) { k[i] = (float) Math.exp(-((i - r) * (double) (i - r)) / (2 * sigma * sigma)); s += k[i]; }
        for (int i = 0; i < ksize; i++) k[i] /= s;
        float[] t = new float[a.length], o = new float[a.length];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            float acc = 0;
            for (int i = -r; i <= r; i++) acc += k[i + r] * a[y * w + Math.max(0, Math.min(w - 1, x + i))];
            t[y * w + x] = acc;
        }
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            float acc = 0;
            for (int i = -r; i <= r; i++) acc += k[i + r] * t[Math.max(0, Math.min(h - 1, y + i)) * w + x];
            o[y * w + x] = acc;
        }
        return o;
    }

    /** A square mask that is 1 inside `pad` pixels of the edge, fading to 0 at the rim. */
    static float[] feather(int size, int pad, int blurK) {
        float[] m = new float[size * size];
        for (int y = pad; y < size - pad; y++) for (int x = pad; x < size - pad; x++) m[y * size + x] = 1;
        return blur(m, size, size, blurK);
    }

    static float bilinear(float[] a, int w, int h, double x, double y) {
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        double fx = x - x0, fy = y - y0, v = 0;
        for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++) {
            int xx = x0 + dx, yy = y0 + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            v += (dx == 0 ? 1 - fx : fx) * (dy == 0 ? 1 - fy : fy) * a[yy * w + xx];
        }
        return (float) v;
    }

    /** Is this (r, g, b) pixel skin-like? Same rule as the web version. */
    static boolean isSkin(int r, int g, int b) {
        int mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
        double d = mx - mn, v = mx / 255.0, s = mx == 0 ? 0 : d / mx, h = 0;
        if (d > 0) {
            if (mx == r) h = ((g - b) / d) % 6;
            else if (mx == g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        return h <= 50 && s >= 0.15 && s <= 0.75 && v >= 0.25;
    }
}
