package com.juitar.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient.FileChooserParams;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ConsoleMessage;
import android.util.Log;
import android.content.res.AssetManager;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.io.ByteArrayOutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import android.util.Base64;
import android.database.Cursor;
import android.provider.OpenableColumns;

public final class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private static final int FILE_CHOOSER_REQUEST = 7107;
    private ServerSocket server;
    private Thread serverThread;
    private byte[] incomingBytes;
    private String incomingName = "imported-score";
    private String incomingMime = "application/octet-stream";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(true);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                String path = request.getUrl().getPath();
                if ("appassets.androidplatform.net".equals(host) && path != null && path.startsWith("/assets/")) {
                    return assetResponse(path.substring("/assets/".length()));
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public void onPageFinished(WebView view, String url) { Log.i("JuitarWeb", "page=" + url); view.evaluateJavascript("window.dispatchEvent(new Event('android-incoming-file'))", null); }
            @Override public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) { Log.e("JuitarWeb", errorCode + " " + description + " " + failingUrl); }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) { Log.i("JuitarWeb", message.message() + " @" + message.sourceId() + ":" + message.lineNumber()); return true; }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                try { startActivityForResult(intent, FILE_CHOOSER_REQUEST); return true; }
                catch (Exception error) { Log.e("JuitarWeb", "file chooser=" + error); fileChooserCallback = null; return false; }
            }
        });
        prepareIncomingFile(getIntent());
        webView.addJavascriptInterface(new IncomingFileBridge(), "JuitarAndroid");
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setBackgroundColor(0xFF0D0E11);
        webView.loadUrl("https://appassets.androidplatform.net/assets/dist/index.html");
        setContentView(webView);
    }
    private void prepareIncomingFile(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        try {
            InputStream input = getContentResolver().openInputStream(uri);
            if (input == null) return;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192]; int count;
            while ((count = input.read(chunk)) != -1) buffer.write(chunk, 0, count);
            input.close(); incomingBytes = buffer.toByteArray();
            String name = null;
            Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null) { if (cursor.moveToFirst()) name = cursor.getString(0); cursor.close(); }
            if (name != null && !name.isEmpty()) incomingName = name;
            String mime = getContentResolver().getType(uri); if (mime != null) incomingMime = mime;
            Log.i("JuitarWeb", "incoming=" + incomingName + " bytes=" + incomingBytes.length);
        } catch (Exception error) { Log.e("JuitarWeb", "incoming file=" + error); incomingBytes = null; }
    }
    private final class IncomingFileBridge {
        @JavascriptInterface public boolean hasIncomingFile() { return incomingBytes != null && incomingBytes.length > 0; }
        @JavascriptInterface public String incomingBase64() { return incomingBytes == null ? "" : Base64.encodeToString(incomingBytes, Base64.NO_WRAP); }
        @JavascriptInterface public String incomingName() { return incomingName; }
        @JavascriptInterface public String incomingMime() { return incomingMime; }
        @JavascriptInterface public void consumeIncomingFile() { incomingBytes = null; }
    }
    private WebResourceResponse assetResponse(String path) {
        try {
            String type = contentType(path);
            InputStream input = getAssets().open(path);
            String encoding = type.startsWith("text/") || type.contains("javascript") || type.contains("xml") ? "UTF-8" : null;
            return new WebResourceResponse(type, encoding, input);
        } catch (IOException error) { Log.e("JuitarWeb", "asset=" + path + " " + error); return null; }
    }
    private void startAssetServer() {
        serverThread = new Thread(() -> {
            try {
                server = new ServerSocket(8765);
                while (!server.isClosed()) handle(server.accept());
            } catch (IOException error) { Log.e("JuitarWeb", "server=" + error); }
        }, "juitar-asset-server");
        serverThread.setDaemon(true);
        serverThread.start();
    }
    private void handle(Socket socket) {
        try (Socket s = socket) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.US_ASCII));
            String request = reader.readLine();
            if (request == null) return;
            String[] parts = request.split(" ");
            String path = parts.length > 1 ? URLDecoder.decode(parts[1], "UTF-8") : "/dist/index.html";
            Log.i("JuitarWeb", "request=" + request + " path=" + path);
            String headerLine;
            while ((headerLine = reader.readLine()) != null && !headerLine.isEmpty()) { }
            if (path.contains("..")) { writeResponse(s, 403, "text/plain", new byte[0]); return; }
            String assetPath = path.startsWith("/") ? path.substring(1) : path;
            try (InputStream input = getAssets().open(assetPath)) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192]; int count;
                while ((count = input.read(chunk)) != -1) buffer.write(chunk, 0, count);
                byte[] data = buffer.toByteArray();
                writeResponse(s, 200, contentType(assetPath), data);
            } catch (IOException error) { writeResponse(s, 404, "text/plain", error.toString().getBytes(StandardCharsets.UTF_8)); }
        } catch (IOException error) { Log.e("JuitarWeb", "handle=" + error); }
    }
    private void writeResponse(Socket socket, int status, String type, byte[] data) throws IOException {
        OutputStream out = socket.getOutputStream();
        String header = "HTTP/1.1 " + status + " OK\r\nContent-Type: " + type + "\r\nContent-Length: " + data.length + "\r\nConnection: close\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.US_ASCII)); out.write(data); out.flush();
    }
    private String contentType(String path) {
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".sf2")) return "application/octet-stream";
        if (path.endsWith(".musicxml")) return "application/xml";
        return "application/octet-stream";
    }
    @Override public void onDestroy() {
        try { if (server != null) server.close(); } catch (IOException ignored) { }
        super.onDestroy();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                int count = data.getClipData().getItemCount(); results = new Uri[count];
                for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) results = new Uri[]{ data.getData() };
        }
        fileChooserCallback.onReceiveValue(results); fileChooserCallback = null;
    }
    @Override public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("(window.handleAndroidBack && window.handleAndroidBack()) || false", value -> {
                if (!"true".equals(value)) {
                    if (webView.canGoBack()) webView.goBack(); else MainActivity.super.onBackPressed();
                }
            });
        } else super.onBackPressed();
    }
}
