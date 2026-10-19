package app.facereveal.swap;

/** An 8-bit BGR image (3 bytes per pixel). Plain Java so the same code runs on a phone and on a desktop JVM. */
public final class Img {
    public final int w, h;
    public final byte[] bgr;

    public Img(int w, int h) {
        this.w = w;
        this.h = h;
        this.bgr = new byte[w * h * 3];
    }

    public Img copy() {
        Img c = new Img(w, h);
        System.arraycopy(bgr, 0, c.bgr, 0, bgr.length);
        return c;
    }

    /** Mirror image left to right. */
    public Img flipped() {
        Img o = new Img(w, h);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                System.arraycopy(bgr, (y * w + x) * 3, o.bgr, (y * w + (w - 1 - x)) * 3, 3);
            }
        }
        return o;
    }

    public static Img fromArgb(int[] argb, int w, int h) {
        Img im = new Img(w, h);
        for (int i = 0, p = 0; i < argb.length; i++) {
            int c = argb[i];
            im.bgr[p++] = (byte) c;
            im.bgr[p++] = (byte) (c >> 8);
            im.bgr[p++] = (byte) (c >> 16);
        }
        return im;
    }

    public int[] toArgb() {
        int[] out = new int[w * h];
        for (int i = 0, p = 0; i < out.length; i++, p += 3) {
            out[i] = 0xff000000 | ((bgr[p + 2] & 0xff) << 16) | ((bgr[p + 1] & 0xff) << 8) | (bgr[p] & 0xff);
        }
        return out;
    }

    /** Area-averaged resize, used to fit a photo into the detector's 640x640 frame. */
    public Img resized(int nw, int nh) {
        Img o = new Img(nw, nh);
        double sx = (double) w / nw, sy = (double) h / nh;
        for (int y = 0; y < nh; y++) {
            int y0 = (int) Math.floor(y * sy), y1 = Math.max(y0 + 1, (int) Math.ceil((y + 1) * sy));
            y1 = Math.min(y1, h);
            for (int x = 0; x < nw; x++) {
                int x0 = (int) Math.floor(x * sx), x1 = Math.max(x0 + 1, (int) Math.ceil((x + 1) * sx));
                x1 = Math.min(x1, w);
                int[] acc = new int[3];
                int n = 0;
                for (int yy = y0; yy < y1; yy++) {
                    for (int xx = x0; xx < x1; xx++) {
                        int p = (yy * w + xx) * 3;
                        acc[0] += bgr[p] & 0xff;
                        acc[1] += bgr[p + 1] & 0xff;
                        acc[2] += bgr[p + 2] & 0xff;
                        n++;
                    }
                }
                int q = (y * nw + x) * 3;
                o.bgr[q] = (byte) (acc[0] / n);
                o.bgr[q + 1] = (byte) (acc[1] / n);
                o.bgr[q + 2] = (byte) (acc[2] / n);
            }
        }
        return o;
    }

    static int reflect(int i, int n) { // OpenCV BORDER_REFLECT: ...cba|abc...|cba...
        if (n == 1) return 0;
        int p = 2 * n;
        i %= p;
        if (i < 0) i += p;
        return i < n ? i : p - 1 - i;
    }

    /** Bilinear sample into out[0..2] (b, g, r). Outside the image: black, or mirrored when `mirror`. */
    public void sample(double x, double y, boolean mirror, float[] out) {
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        double fx = x - x0, fy = y - y0;
        out[0] = out[1] = out[2] = 0;
        for (int dy = 0; dy < 2; dy++) {
            for (int dx = 0; dx < 2; dx++) {
                double wt = (dx == 0 ? 1 - fx : fx) * (dy == 0 ? 1 - fy : fy);
                if (wt == 0) continue;
                int xx = x0 + dx, yy = y0 + dy;
                if (mirror) {
                    xx = reflect(xx, w);
                    yy = reflect(yy, h);
                } else if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
                    continue;
                }
                int p = (yy * w + xx) * 3;
                out[0] += wt * (bgr[p] & 0xff);
                out[1] += wt * (bgr[p + 1] & 0xff);
                out[2] += wt * (bgr[p + 2] & 0xff);
            }
        }
    }

    public void set(int x, int y, float b, float g, float r) {
        int p = (y * w + x) * 3;
        bgr[p] = (byte) Math.max(0, Math.min(255, Math.round(b)));
        bgr[p + 1] = (byte) Math.max(0, Math.min(255, Math.round(g)));
        bgr[p + 2] = (byte) Math.max(0, Math.min(255, Math.round(r)));
    }
}
