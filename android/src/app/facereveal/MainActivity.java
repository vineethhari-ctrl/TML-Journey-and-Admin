package app.facereveal;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.json.JSONObject;
import app.facereveal.swap.Engine;
import app.facereveal.swap.Img;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Hosts the Face Reveal web app from the APK's own assets, so it runs with no network.
 * Every request is served from assets/face-reveal; anything else is refused.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.facereveal";
    private static final int PICK_IMAGE = 1;

    private WebView web;
    private ValueCallback<Uri[]> chooser;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serve(r.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !HOST.equals(r.getUrl().getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                startActivityForResult(Intent.createChooser(pick, "Choose image"), PICK_IMAGE);
                return true;
            }
        });

        if (state == null) web.loadUrl("https://" + HOST + "/index.html");
        else web.restoreState(state);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != PICK_IMAGE || chooser == null) return;
        chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
        chooser = null;
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private WebResourceResponse serve(Uri uri) {
        if (HOST.equals(uri.getHost())) {
            String path = uri.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            try {
                InputStream in = getAssets().open("face-reveal" + path);
                return new WebResourceResponse(mime(path), "utf-8", in);
            } catch (Exception e) {
                // fall through to 404
            }
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null,
                new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".css")) return "text/css";
        return "application/octet-stream";
    }

    // ---- AI face swap (runs on the phone; models are downloaded once) ------------------------------

    private volatile boolean busy = false;

    private void post(final JSONObject o) {
        runOnUiThread(new Runnable() {
            public void run() { web.evaluateJavascript("window.__native && window.__native(" + o.toString() + ")", null); }
        });
    }

    private void post(String type, String key, Object value) {
        try { post(new JSONObject().put("type", type).put(key, value)); } catch (Exception ignored) { }
    }

    private File modelDir() { return new File(getFilesDir(), "models"); }

    /** Called from app.js: saves the zip to Downloads/FaceReveal, then opens the share sheet. */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String mimeType, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/FaceReveal");
                final Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                OutputStream out = getContentResolver().openOutputStream(uri);
                out.write(bytes);
                out.close();
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this, "Saved to Downloads/FaceReveal/" + name,
                                Toast.LENGTH_LONG).show();
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(mimeType);
                        send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, "Share"));
                    }
                });
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this, "Could not save: " + e.getMessage(),
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public boolean hasEngine() { return true; }

        @JavascriptInterface
        public boolean modelsReady() { return Models.ready(modelDir()); }

        @JavascriptInterface
        public double modelsMegabytes() { return Models.totalBytes() / 1048576.0; }

        @JavascriptInterface
        public void downloadModels() {
            if (busy) return;
            busy = true;
            new Thread(new Runnable() {
                public void run() {
                    try {
                        Models.download(modelDir(), new Models.Listener() {
                            public void progress(String file, long done, long total) {
                                try { post(new JSONObject().put("type", "dl").put("done", done).put("total", total).put("file", file)); }
                                catch (Exception ignored) { }
                            }
                        });
                        post("dlDone", "ok", true);
                    } catch (Exception e) {
                        post("error", "text", String.valueOf(e.getMessage()));
                    } finally {
                        busy = false;
                    }
                }
            }).start();
        }

        /** Photo 1 (smiley) and photo 2 (face) as base64 JPEGs; the circle is in photo 1's pixels. */
        @JavascriptInterface
        public void startSwap(final String aB64, final String bB64, final String extrasJson, final double cx, final double cy,
                              final double r, final double faceRatio, final double reach, final double tone,
                              final double roll, final boolean mirror, final boolean enhance) {
            if (busy) return;
            busy = true;
            new Thread(new Runnable() {
                public void run() {
                    try {
                        Img a = decode(aB64), b = decode(bB64);
                        java.util.List<Img> extras = new java.util.ArrayList<Img>();
                        org.json.JSONArray more = new org.json.JSONArray(extrasJson);
                        for (int i = 0; i < more.length(); i++) extras.add(decode(more.getString(i)));
                        Engine e = new Engine(modelDir(), getAssets().open("emap.bin"));
                        Engine.Params p = new Engine.Params();
                        p.faceRatio = faceRatio;
                        p.reach = reach;
                        p.tone = tone;
                        p.enhance = enhance;
                        p.roll = roll;
                        p.mirror = mirror;
                        Img out = e.swap(a, cx, cy, r, b, extras, p, new Engine.Progress() {
                            public void on(String m) { post("progress", "text", m); }
                        });
                        Bitmap bmp = Bitmap.createBitmap(out.toArgb(), out.w, out.h, Bitmap.Config.ARGB_8888);
                        ByteArrayOutputStream jpg = new ByteArrayOutputStream();
                        bmp.compress(Bitmap.CompressFormat.JPEG, 92, jpg);
                        post(new JSONObject().put("type", "done").put("w", out.w).put("h", out.h)
                                .put("b64", Base64.encodeToString(jpg.toByteArray(), Base64.NO_WRAP)));
                    } catch (Throwable t) {
                        post("error", "text", String.valueOf(t.getMessage() != null ? t.getMessage() : t));
                    } finally {
                        busy = false;
                    }
                }
            }).start();
        }

        private Img decode(String b64) {
            byte[] raw = Base64.decode(b64, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length);
            int[] px = new int[bmp.getWidth() * bmp.getHeight()];
            bmp.getPixels(px, 0, bmp.getWidth(), 0, 0, bmp.getWidth(), bmp.getHeight());
            Img im = Img.fromArgb(px, bmp.getWidth(), bmp.getHeight());
            bmp.recycle();
            return im;
        }
    }
}
