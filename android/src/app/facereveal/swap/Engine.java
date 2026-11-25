package app.facereveal.swap;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

import java.io.DataInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Replaces a smiley sticker with a face from a second photo, using four ONNX models:
 * RetinaFace/SCRFD (find the face in photo 2), ArcFace (who it is), inswapper_128 (render that face), GFPGAN (sharpen).
 * The smiley hides the face in photo 1, so the landmarks there are built from the smiley's circle instead of detected.
 * Only the area around the smiley is touched.
 */
public final class Engine {
    public static final String DETECTOR = "retinaface_10g.onnx";
    public static final String ARCFACE = "arcface_w600k_r50.onnx";
    public static final String SWAPPER = "inswapper_128_fp16.onnx";
    public static final String ENHANCER = "gfpgan_1.4.onnx";
    public static final String PARSER = "bisenet_resnet_34.onnx";

    // BiSeNet face-parsing labels kept when cutting the head out of photo 2: skin, brows, eyes, glasses, ears, nose, mouth,
    // lips, neck, hair, hat. Background, clothes and jewellery are left behind.
    private static final int[] HEAD_LABELS = {1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 17, 18};
    private static final double CROP_SCALE = 0.65; // parse a wider area than the face crop so the hair is not cut off

    public interface Progress { void on(String message); }

    public static final class Params {
        public double faceRatio = 0.55;  // face-box width as a share of the smiley's diameter
        public double reach = 1.0;       // how much of the smiley's disc is filled from photo 2's head (0.3 to 1)
        public double tone = 0.6;        // how far to move photo 2's skin tone toward the skin around the smiley (0 to 1)
        public boolean enhance = true;   // run GFPGAN
        public double enhanceWeight = 0.8;
        public double roll = 0;          // tilt of the face in degrees, clockwise positive
        public boolean mirror = false;   // flip the main face photo left to right (turns a 3/4 view the other way)
        public int threads = 4;
    }

    static final double[][] ARC = {{38.2946, 51.6963}, {73.5318, 51.5014}, {56.0252, 71.7366}, {41.5493, 92.3655}, {70.7299, 92.2041}};
    static final double[][] FFHQ512 = {{192.98138, 239.94708}, {318.90277, 240.1936}, {256.63416, 314.01935}, {201.26117, 371.41043}, {313.08905, 371.15118}};

    private final File dir;
    private final float[] emap; // 512 x 512, shipped next to the app (it lives inside the swap model, unused by the runtime)
    private final OrtEnvironment env = OrtEnvironment.getEnvironment();

    public Engine(File modelDir, InputStream emapStream) throws Exception {
        this.dir = modelDir;
        byte[] raw = new byte[512 * 512 * 4];
        new DataInputStream(emapStream).readFully(raw);
        this.emap = new float[512 * 512];
        ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(emap);
    }

    // ---- ONNX plumbing ----------------------------------------------------------------------

    private OrtSession open(String model, int threads) throws Exception {
        OrtSession.SessionOptions o = new OrtSession.SessionOptions();
        o.setIntraOpNumThreads(threads);
        o.setCPUArenaAllocator(false);
        return env.createSession(new File(dir, model).getPath(), o);
    }

    private OnnxTensor tensor(float[] data, long... shape) throws Exception {
        FloatBuffer fb = ByteBuffer.allocateDirect(data.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        fb.put(data).rewind();
        return OnnxTensor.createTensor(env, fb, shape);
    }

    private static float[] read(OrtSession.Result r, int i) throws Exception {
        FloatBuffer fb = ((OnnxTensor) r.get(i)).getFloatBuffer();
        float[] a = new float[fb.remaining()];
        fb.get(a);
        return a;
    }

    // ---- detection --------------------------------------------------------------------------

    static final class Face {
        double score, x1, y1, x2, y2;
        double[][] kps = new double[5][2];
        double area() { return (x2 - x1) * (y2 - y1); }
    }

    private List<Face> detect(Img im, int threads, double thr) throws Exception {
        final int size = 640;
        double sc = (double) size / Math.max(im.w, im.h);
        int nw = Math.max(1, (int) Math.round(im.w * sc)), nh = Math.max(1, (int) Math.round(im.h * sc));
        Img small = im.resized(nw, nh);
        float[] blob = new float[3 * size * size];
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            int o = y * size + x;
            if (x < nw && y < nh) {
                int p = (y * nw + x) * 3;
                blob[o] = ((small.bgr[p + 2] & 0xff) - 127.5f) / 128f;                     // R
                blob[size * size + o] = ((small.bgr[p + 1] & 0xff) - 127.5f) / 128f;       // G
                blob[2 * size * size + o] = ((small.bgr[p] & 0xff) - 127.5f) / 128f;       // B
            } else {
                blob[o] = blob[size * size + o] = blob[2 * size * size + o] = -127.5f / 128f; // black padding
            }
        }
        List<Face> faces = new ArrayList<>();
        OrtSession s = open(DETECTOR, threads);
        try (OnnxTensor in = tensor(blob, 1, 3, size, size);
             OrtSession.Result r = s.run(Collections.singletonMap(s.getInputNames().iterator().next(), in))) {
            int[] strides = {8, 16, 32};
            for (int si = 0; si < 3; si++) {
                int stride = strides[si], g = size / stride;
                float[] scores = read(r, si), bbox = read(r, si + 3), kps = read(r, si + 6);
                for (int j = 0; j < scores.length; j++) {
                    if (scores[j] < thr) continue;
                    int cell = j / 2;
                    double cx = (cell % g) * (double) stride, cy = (cell / g) * (double) stride;
                    Face f = new Face();
                    f.score = scores[j];
                    f.x1 = (cx - bbox[j * 4] * stride) / sc;
                    f.y1 = (cy - bbox[j * 4 + 1] * stride) / sc;
                    f.x2 = (cx + bbox[j * 4 + 2] * stride) / sc;
                    f.y2 = (cy + bbox[j * 4 + 3] * stride) / sc;
                    for (int k = 0; k < 5; k++) {
                        f.kps[k][0] = (cx + kps[j * 10 + k * 2] * stride) / sc;
                        f.kps[k][1] = (cy + kps[j * 10 + k * 2 + 1] * stride) / sc;
                    }
                    faces.add(f);
                }
            }
        } finally {
            s.close();
        }
        return nms(faces);
    }

    private static List<Face> nms(List<Face> in) {
        Collections.sort(in, new java.util.Comparator<Face>() {
            @Override
            public int compare(Face a, Face b) { return Double.compare(b.score, a.score); }
        });
        List<Face> keep = new ArrayList<>();
        for (Face f : in) {
            boolean ok = true;
            for (Face k : keep) {
                double ix = Math.max(0, Math.min(f.x2, k.x2) - Math.max(f.x1, k.x1));
                double iy = Math.max(0, Math.min(f.y2, k.y2) - Math.max(f.y1, k.y1));
                double inter = ix * iy;
                if (inter / (f.area() + k.area() - inter + 1e-9) > 0.4) { ok = false; break; }
            }
            if (ok) keep.add(f);
        }
        return keep;
    }

    // ---- identity ---------------------------------------------------------------------------

    private float[] latent(Img face, double[][] kps, int threads) throws Exception {
        double[] m = Geom.similarity(kps, ARC);
        double[] inv = Geom.invert(m);
        float[] blob = new float[3 * 112 * 112];
        float[] px = new float[3];
        for (int y = 0; y < 112; y++) for (int x = 0; x < 112; x++) {
            face.sample(inv[0] * x + inv[1] * y + inv[2], inv[3] * x + inv[4] * y + inv[5], false, px);
            int o = y * 112 + x;
            blob[o] = (px[2] - 127.5f) / 127.5f;
            blob[112 * 112 + o] = (px[1] - 127.5f) / 127.5f;
            blob[2 * 112 * 112 + o] = (px[0] - 127.5f) / 127.5f;
        }
        float[] e;
        OrtSession s = open(ARCFACE, threads);
        try (OnnxTensor in = tensor(blob, 1, 3, 112, 112);
             OrtSession.Result r = s.run(Collections.singletonMap(s.getInputNames().iterator().next(), in))) {
            e = read(r, 0);
        } finally {
            s.close();
        }
        double n = 0;
        for (float v : e) n += v * v;
        n = Math.sqrt(n);
        float[] l = new float[512];
        double ln = 0;
        for (int j = 0; j < 512; j++) {
            double acc = 0;
            for (int i = 0; i < 512; i++) acc += (e[i] / n) * emap[i * 512 + j];
            l[j] = (float) acc;
            ln += acc * acc;
        }
        ln = Math.sqrt(ln);
        for (int j = 0; j < 512; j++) l[j] /= ln;
        return l;
    }

    /** The photo-2 template for the parsing crop: the FFHQ layout shrunk about its centre so more of the head fits. */
    static double[][] parseTemplate() {
        double mx = 0, my = 0;
        for (double[] p : FFHQ512) { mx += p[0] / 5; my += p[1] / 5; }
        double[][] t = new double[5][2];
        for (int i = 0; i < 5; i++) {
            t[i][0] = (FFHQ512[i][0] - mx) * CROP_SCALE + 256;
            t[i][1] = (FFHQ512[i][1] - my) * CROP_SCALE + 256;
        }
        return t;
    }

    /** 512x512 mask (1 = head, hair or neck) of photo 2 in the parsing-crop frame, softened at the edge. */
    private float[] headMask(Img b, Face bf, int threads) throws Exception {
        double[] inv = Geom.invert(Geom.similarity(bf.kps, parseTemplate()));
        float[] blob = new float[3 * 512 * 512], px = new float[3];
        for (int y = 0; y < 512; y++) for (int x = 0; x < 512; x++) {
            b.sample(inv[0] * x + inv[1] * y + inv[2], inv[3] * x + inv[4] * y + inv[5], true, px);
            int o = y * 512 + x;
            blob[o] = px[2] / 127.5f - 1;
            blob[512 * 512 + o] = px[1] / 127.5f - 1;
            blob[2 * 512 * 512 + o] = px[0] / 127.5f - 1;
        }
        float[] out;
        OrtSession s = open(PARSER, threads);
        try (OnnxTensor in = tensor(blob, 1, 3, 512, 512);
             OrtSession.Result r = s.run(Collections.singletonMap(s.getInputNames().iterator().next(), in))) {
            out = read(r, 0);
        } finally {
            s.close();
        }
        int channels = out.length / (512 * 512);
        boolean[] keep = new boolean[channels];
        for (int l : HEAD_LABELS) if (l < channels) keep[l] = true;
        float[] mask = new float[512 * 512];
        for (int i = 0; i < 512 * 512; i++) {
            int best = 0;
            float bv = out[i];
            for (int c = 1; c < channels; c++) {
                float v = out[c * 512 * 512 + i];
                if (v > bv) { bv = v; best = c; }
            }
            mask[i] = keep[best] ? 1f : 0f;
        }
        // soften the edge, then pull it inward a little so a fringe of photo 2's background is not carried over
        float[] soft = Geom.blur(mask, 512, 512, 17);
        for (int i = 0; i < soft.length; i++) soft[i] = Math.max(0f, Math.min(1f, (soft[i] - 0.6f) / 0.35f));
        return soft;
    }

    // ---- the pipeline -----------------------------------------------------------------------

    /** Landmarks for the face hidden under the smiley, laid out like a real face of the assumed size. */
    static double[][] syntheticKps(double cx, double cy, double r, double faceRatio, double rollDeg) {
        double wb = 2 * r * faceRatio, eye = 0.48 * wb;
        double sc = eye / Math.hypot(ARC[1][0] - ARC[0][0], ARC[1][1] - ARC[0][1]);
        double mx = 0, my = 0;
        for (double[] p : ARC) { mx += p[0]; my += p[1]; }
        mx /= 5; my /= 5;
        double[][] k = new double[5][2];
        for (int i = 0; i < 5; i++) {
            k[i][0] = (ARC[i][0] - mx) * sc + cx - 0.011 * wb;
            k[i][1] = (ARC[i][1] - my) * sc + cy + 0.042 * wb;
        }
        if (rollDeg != 0) { // tilt the whole layout about its centre
            double pxc = cx - 0.011 * wb, pyc = cy + 0.042 * wb, c = Math.cos(Math.toRadians(rollDeg)), s = Math.sin(Math.toRadians(rollDeg));
            for (int i = 0; i < 5; i++) {
                double dx = k[i][0] - pxc, dy = k[i][1] - pyc;
                k[i][0] = pxc + c * dx - s * dy;
                k[i][1] = pyc + s * dx + c * dy;
            }
        }
        return k;
    }

    /** As below, with one face photo. */
    public Img swap(Img a, double cx, double cy, double r, Img b, Params p, Progress pr) throws Exception {
        return swap(a, cx, cy, r, b, new ArrayList<Img>(), p, pr);
    }

    /**
     * Returns a copy of `a` with the smiley (circle cx, cy, r in a's pixels) replaced by the face found in `b`.
     * `b` sets the face's angle and look; any `extras` (more photos of the same person) only sharpen who it is.
     */
    public Img swap(Img a, double cx, double cy, double r, Img b, List<Img> extras, Params p, Progress pr) throws Exception {
        if (pr == null) pr = new Progress() { @Override public void on(String message) { } };
        if (p.mirror) b = b.flipped();
        pr.on("Finding the face in photo 2…");
        List<Face> found = detect(b, p.threads, 0.5);
        if (found.isEmpty()) found = detect(b, p.threads, 0.3);
        if (found.isEmpty()) throw new Exception("No face found in photo 2. Use a clearer, front-facing photo.");
        Face bf = found.get(0);
        for (Face f : found) if (f.area() > bf.area() && f.score >= 0.5) bf = f;
        pr.on("Learning the face…");
        float[] lat = latent(b, bf.kps, p.threads);
        int used = 1;
        for (Img x : extras) { // more photos of the same person: average who they are
            List<Face> fx = detect(x, p.threads, 0.5);
            if (fx.isEmpty()) continue;
            Face best = fx.get(0);
            for (Face f : fx) if (f.area() > best.area()) best = f;
            float[] l2 = latent(x, best.kps, p.threads);
            for (int i = 0; i < 512; i++) lat[i] += l2[i];
            used++;
        }
        if (used > 1) {
            double n = 0;
            for (float v : lat) n += v * v;
            n = Math.sqrt(n);
            for (int i = 0; i < 512; i++) lat[i] /= n;
        }

        double[][] sk = syntheticKps(cx, cy, r, p.faceRatio, p.roll);
        Img out = a.copy();
        double[] mBA = Geom.similarity(bf.kps, sk);      // photo 2 -> photo 1
        double[] iBA = Geom.invert(mBA);
        float[] gain = toneGain(a, b, bf, cx, cy, r, p.tone);

        // 1. base layer: fill the smiley's disc from around it, then lay photo 2's head (hair, ears, neck) over it
        pr.on("Replacing the smiley…");
        int rx0 = Math.max(0, (int) Math.floor(cx - 1.6 * r)), ry0 = Math.max(0, (int) Math.floor(cy - 1.6 * r));
        int rx1 = Math.min(a.w, (int) Math.ceil(cx + 1.6 * r)), ry1 = Math.min(a.h, (int) Math.ceil(cy + 1.6 * r));
        double[][] ring = ringColors(a, cx, cy, r);
        float[] head = headMask(b, bf, p.threads);
        double[] toCrop = Geom.similarity(sk, parseTemplate()); // photo 1 -> parsing-crop frame
        double limit = 1.3 * r * p.reach, softLimit = 0.1 * r;
        float[] bp = new float[3];
        for (int y = ry0; y < ry1; y++) for (int x = rx0; x < rx1; x++) {
            double d = Math.hypot(x - cx, y - cy);
            double lim = Math.max(0, Math.min(1, (limit - d) / softLimit));
            double u = toCrop[0] * x + toCrop[1] * y + toCrop[2], v = toCrop[3] * x + toCrop[4] * y + toCrop[5];
            double w = lim <= 0 ? 0 : lim * Geom.bilinear(head, 512, 512, u, v);
            if (w <= 0 && d > 1.12 * r) continue;
            int o = (y * a.w + x) * 3;
            float ob = a.bgr[o] & 0xff, og = a.bgr[o + 1] & 0xff, orr = a.bgr[o + 2] & 0xff;
            if (d <= 1.12 * r) { // blank the smiley
                double[] f = fillColor(ring, x, y);
                ob = (float) f[0]; og = (float) f[1]; orr = (float) f[2];
            }
            if (w > 0) {
                b.sample(iBA[0] * x + iBA[1] * y + iBA[2], iBA[3] * x + iBA[4] * y + iBA[5], true, bp);
                ob = (float) (ob * (1 - w) + bp[0] * gain[0] * w);
                og = (float) (og * (1 - w) + bp[1] * gain[1] * w);
                orr = (float) (orr * (1 - w) + bp[2] * gain[2] * w);
            }
            out.set(x, y, ob, og, orr);
        }

        // 2. the face itself, re-rendered by the swap model (its target is photo 2's face, tone-matched)
        pr.on("Rendering the face…");
        double[][] arc128 = Geom.scale(ARC, 128 / 112.0);
        double[] mT = Geom.similarity(bf.kps, arc128), iT = Geom.invert(mT);
        float[] blob = new float[3 * 128 * 128];
        for (int y = 0; y < 128; y++) for (int x = 0; x < 128; x++) {
            b.sample(iT[0] * x + iT[1] * y + iT[2], iT[3] * x + iT[4] * y + iT[5], false, bp);
            int o = y * 128 + x;
            blob[o] = Math.min(255f, bp[2] * gain[2]) / 255f;
            blob[128 * 128 + o] = Math.min(255f, bp[1] * gain[1]) / 255f;
            blob[2 * 128 * 128 + o] = Math.min(255f, bp[0] * gain[0]) / 255f;
        }
        float[] fake;
        OrtSession sw = open(SWAPPER, p.threads);
        try (OnnxTensor tin = tensor(blob, 1, 3, 128, 128); OnnxTensor sin = tensor(lat, 1, 512);
             OrtSession.Result res = sw.run(inputs(sw, tin, sin))) {
            fake = read(res, 0);
        } finally {
            sw.close();
        }
        float[] crop = new float[128 * 128 * 3]; // BGR 0..255
        for (int i = 0; i < 128 * 128; i++) {
            crop[i * 3] = clamp255(fake[2 * 128 * 128 + i] * 255f);
            crop[i * 3 + 1] = clamp255(fake[128 * 128 + i] * 255f);
            crop[i * 3 + 2] = clamp255(fake[i] * 255f);
        }
        paste(out, crop, 128, Geom.similarity(sk, arc128), Geom.feather(128, 10, 21), 1f);

        // 3. sharpen
        if (p.enhance) {
            pr.on("Sharpening the face…");
            double[] mG = Geom.similarity(sk, FFHQ512), iG = Geom.invert(mG);
            float[] gb = new float[3 * 512 * 512];
            for (int y = 0; y < 512; y++) for (int x = 0; x < 512; x++) {
                out.sample(iG[0] * x + iG[1] * y + iG[2], iG[3] * x + iG[4] * y + iG[5], false, bp);
                int o = y * 512 + x;
                gb[o] = (bp[2] - 127.5f) / 127.5f;
                gb[512 * 512 + o] = (bp[1] - 127.5f) / 127.5f;
                gb[2 * 512 * 512 + o] = (bp[0] - 127.5f) / 127.5f;
            }
            float[] fo;
            OrtSession gs = open(ENHANCER, p.threads);
            try (OnnxTensor gin = tensor(gb, 1, 3, 512, 512);
                 OrtSession.Result res = gs.run(Collections.singletonMap(gs.getInputNames().iterator().next(), gin))) {
                fo = read(res, 0);
            } finally {
                gs.close();
            }
            float[] gcrop = new float[512 * 512 * 3];
            for (int i = 0; i < 512 * 512; i++) {
                gcrop[i * 3] = clamp255((fo[2 * 512 * 512 + i] + 1) * 127.5f);
                gcrop[i * 3 + 1] = clamp255((fo[512 * 512 + i] + 1) * 127.5f);
                gcrop[i * 3 + 2] = clamp255((fo[i] + 1) * 127.5f);
            }
            paste(out, gcrop, 512, mG, Geom.feather(512, 60, 51), (float) p.enhanceWeight);
        }
        return out;
    }

    private static Map2 inputs(OrtSession s, OnnxTensor target, OnnxTensor source) {
        Map2 m = new Map2();
        m.put("target", target);
        m.put("source", source);
        return m;
    }

    /** HashMap<String, OnnxTensor> without spelling the generics at every call. */
    private static final class Map2 extends java.util.HashMap<String, OnnxTensor> { }

    private static float clamp255(float v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

    /** Blend a square crop (BGR) back into `out` through mask. m maps photo coordinates to crop coordinates. */
    private static void paste(Img out, float[] crop, int size, double[] m, float[] mask, float strength) {
        double[] inv = Geom.invert(m);
        double[][] corners = {{0, 0}, {size - 1, 0}, {0, size - 1}, {size - 1, size - 1}};
        double minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
        for (double[] c : corners) {
            double x = inv[0] * c[0] + inv[1] * c[1] + inv[2], y = inv[3] * c[0] + inv[4] * c[1] + inv[5];
            minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
        }
        int x0 = Math.max(0, (int) Math.floor(minx)), x1 = Math.min(out.w - 1, (int) Math.ceil(maxx));
        int y0 = Math.max(0, (int) Math.floor(miny)), y1 = Math.min(out.h - 1, (int) Math.ceil(maxy));
        for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) {
            double u = m[0] * x + m[1] * y + m[2], v = m[3] * x + m[4] * y + m[5];
            if (u < 0 || v < 0 || u > size - 1 || v > size - 1) continue;
            float wt = Geom.bilinear(mask, size, size, u, v) * strength;
            if (wt <= 0) continue;
            int ux = (int) Math.floor(u), uy = (int) Math.floor(v);
            double fx = u - ux, fy = v - uy;
            int ux1 = Math.min(size - 1, ux + 1), uy1 = Math.min(size - 1, uy + 1);
            float[] c = new float[3];
            for (int k = 0; k < 3; k++) {
                c[k] = (float) ((1 - fy) * ((1 - fx) * crop[(uy * size + ux) * 3 + k] + fx * crop[(uy * size + ux1) * 3 + k])
                        + fy * ((1 - fx) * crop[(uy1 * size + ux) * 3 + k] + fx * crop[(uy1 * size + ux1) * 3 + k]));
            }
            int o = (y * out.w + x) * 3;
            out.set(x, y, (out.bgr[o] & 0xff) * (1 - wt) + c[0] * wt, (out.bgr[o + 1] & 0xff) * (1 - wt) + c[1] * wt,
                    (out.bgr[o + 2] & 0xff) * (1 - wt) + c[2] * wt);
        }
    }

    // ---- colour helpers ---------------------------------------------------------------------

    /** Per-channel (b, g, r) gain moving photo 2's face skin toward the skin around the smiley; 1s if unsure. */
    private static float[] toneGain(Img a, Img b, Face bf, final double cx, final double cy, final double r, double strength) {
        float[] one = {1f, 1f, 1f};
        if (strength <= 0) return one;
        double[] dst = skinMean(a, new Region() {
            @Override
            public boolean in(int x, int y) {
                double d = Math.hypot(x - cx, y - cy);
                return d > 1.05 * r && d < 1.7 * r;
            }
        }, (int) (cx - 1.7 * r), (int) (cy - 1.7 * r), (int) (cx + 1.7 * r) + 1, (int) (cy + 1.7 * r) + 1);
        double mx = 0, my = 0;
        for (double[] k : bf.kps) { mx += k[0] / 5; my += k[1] / 5; }
        double eye = Math.hypot(bf.kps[1][0] - bf.kps[0][0], bf.kps[1][1] - bf.kps[0][1]), rad = 0.53 * eye;
        final double fx = mx, fy = my, frad = rad;
        double[] src = skinMean(b, new Region() {
            @Override
            public boolean in(int x, int y) { return Math.hypot(x - fx, y - fy) < frad; }
        }, (int) (mx - rad), (int) (my - rad), (int) (mx + rad) + 1, (int) (my + rad) + 1);
        if (dst == null || src == null) return one;
        float[] g = new float[3];
        for (int i = 0; i < 3; i++) {
            double raw = Math.max(0.7, Math.min(1.35, dst[i] / Math.max(1, src[i])));
            g[i] = (float) Math.max(0.8, Math.min(1.25, 1 + strength * (raw - 1)));
        }
        return g;
    }

    private interface Region { boolean in(int x, int y); }

    /** Mean (b, g, r) of skin-like pixels inside the region, or null if there are too few. */
    private static double[] skinMean(Img im, Region reg, int x0, int y0, int x1, int y1) {
        double sb = 0, sg = 0, sr = 0;
        int n = 0;
        for (int y = Math.max(0, y0); y < Math.min(im.h, y1); y++) for (int x = Math.max(0, x0); x < Math.min(im.w, x1); x++) {
            if (!reg.in(x, y)) continue;
            int p = (y * im.w + x) * 3, bb = im.bgr[p] & 0xff, gg = im.bgr[p + 1] & 0xff, rr = im.bgr[p + 2] & 0xff;
            if (!Geom.isSkin(rr, gg, bb)) continue;
            sb += bb; sg += gg; sr += rr; n++;
        }
        return n < 30 ? null : new double[] {sb / n, sg / n, sr / n};
    }

    /** 48 colours sampled in a ring just outside the smiley (5x5 averages), with their positions. */
    private static double[][] ringColors(Img a, double cx, double cy, double r) {
        double[][] out = new double[48][5];
        double rr = 1.12 * r * 1.0 + 0;
        for (int i = 0; i < 48; i++) {
            double ang = i * 2 * Math.PI / 48, sx = cx + Math.cos(ang) * rr, sy = cy + Math.sin(ang) * rr;
            double sb = 0, sg = 0, sr = 0;
            int n = 0;
            for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
                int x = (int) Math.round(sx) + dx, y = (int) Math.round(sy) + dy;
                if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
                int p = (y * a.w + x) * 3;
                sb += a.bgr[p] & 0xff; sg += a.bgr[p + 1] & 0xff; sr += a.bgr[p + 2] & 0xff; n++;
            }
            out[i][0] = sx; out[i][1] = sy;
            if (n == 0) { out[i][2] = out[i][3] = out[i][4] = 128; } else { out[i][2] = sb / n; out[i][3] = sg / n; out[i][4] = sr / n; }
        }
        return out;
    }

    /** Colour inside the smiley: a blend of the ring colours, nearer ones counting far more. */
    private static double[] fillColor(double[][] ring, int x, int y) {
        double wb = 0, wg = 0, wr = 0, ws = 0;
        for (double[] s : ring) {
            double d2 = (x - s[0]) * (x - s[0]) + (y - s[1]) * (y - s[1]) + 1, k = 1 / (d2 * d2);
            wb += s[2] * k; wg += s[3] * k; wr += s[4] * k; ws += k;
        }
        return new double[] {wb / ws, wg / ws, wr / ws};
    }
}
