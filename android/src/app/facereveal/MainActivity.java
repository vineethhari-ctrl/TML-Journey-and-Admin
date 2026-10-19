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

import java.io.ByteArrayInputStream;
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
    }
}
