package app.facereveal;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * The five AI models (about 900 MB). They are downloaded once, on the first swap, then kept in the app's own storage so
 * everything afterwards works with no internet. Downloads resume if interrupted and are checked against a SHA-256.
 */
final class Models {
    static final String BASE = "https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/";

    // name, exact size in bytes, SHA-256
    static final String[][] LIST = {
        {"retinaface_10g.onnx", "16926877", "808399c3d0b40ed340634ed590ae564a7caa09e5659916923a95d4470b54ff5a"},
        {"arcface_w600k_r50.onnx", "174388474", "f1f79dc3b0b79a69f94799af1fffebff09fbd78fd96a275fd8f0cbbea23270d1"},
        {"inswapper_128_fp16.onnx", "277680829", "c4eccca86ad177586c85c28bf1a64a9d9ed237e283a15818d831f7facfd3f420"},
        {"gfpgan_1.4.onnx", "340299087", "accc4757b26bdb89b32b4d3500d4f79c9dff97c1dd7c7104bf9dcb95e3311385"},
        {"bisenet_resnet_34.onnx", "93632546", "4a0b8c958a3c938913bd06a8365dbb3c8761afba6ecbf0d14b3b1f77eb230c96"},
    };

    interface Listener { void progress(String file, long done, long total); }

    static long totalBytes() {
        long t = 0;
        for (String[] m : LIST) t += Long.parseLong(m[1]);
        return t;
    }

    /** Bytes still to download: models that are missing or incomplete. */
    static long missingBytes(File dir) {
        long t = 0;
        for (String[] m : LIST) {
            File f = new File(dir, m[0]);
            if (!f.isFile() || f.length() != Long.parseLong(m[1])) t += Long.parseLong(m[1]);
        }
        return t;
    }

    static boolean ready(File dir) {
        for (String[] m : LIST) {
            File f = new File(dir, m[0]);
            if (!f.isFile() || f.length() != Long.parseLong(m[1])) return false;
        }
        return true;
    }

    static void download(File dir, Listener l) throws Exception {
        dir.mkdirs();
        long grand = totalBytes(), before = 0;
        for (String[] m : LIST) {
            long size = Long.parseLong(m[1]);
            File done = new File(dir, m[0]);
            if (done.isFile() && done.length() == size) { before += size; continue; }
            fetch(m[0], size, m[2], new File(dir, m[0] + ".part"), done, before, grand, l);
            before += size;
        }
        l.progress("", grand, grand);
    }

    private static void fetch(String name, long size, String sha, File part, File dest, long before, long grand, Listener l)
            throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        long have = part.isFile() ? part.length() : 0;
        if (have > size) { part.delete(); have = 0; }
        if (have > 0) { // re-hash what we already have so the final check still covers the whole file
            try (InputStream in = new FileInputStream(part)) {
                byte[] buf = new byte[1 << 16];
                for (int n; (n = in.read(buf)) > 0; ) md.update(buf, 0, n);
            }
        }
        HttpURLConnection c = (HttpURLConnection) new URL(BASE + name).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
        int code = c.getResponseCode();
        if (code == 200 && have > 0) { // server ignored the range: start over
            have = 0;
            md.reset();
            part.delete();
        } else if (code != 200 && code != 206) {
            throw new Exception("Download failed (" + code + ") for " + name);
        }
        long got = have, lastReport = 0;
        try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part, have > 0)) {
            byte[] buf = new byte[1 << 16];
            for (int n; (n = in.read(buf)) > 0; ) {
                out.write(buf, 0, n);
                md.update(buf, 0, n);
                got += n;
                long now = System.currentTimeMillis();
                if (now - lastReport > 300) { lastReport = now; l.progress(name, before + got, grand); }
            }
        } finally {
            c.disconnect();
        }
        if (got != size) throw new Exception("Download of " + name + " was cut short; try again to resume.");
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        if (!hex.toString().equals(sha)) {
            part.delete();
            throw new Exception(name + " did not match its checksum; it was discarded. Try again.");
        }
        if (!part.renameTo(dest)) throw new Exception("Could not save " + name);
    }
}
