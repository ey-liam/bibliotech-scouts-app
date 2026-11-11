package mx.bibliotechscout.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private File otaActiveDir;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        OtaUpdaterPlugin.prepareOtaOnStartup(this);
        otaActiveDir = new File(getFilesDir(), OtaUpdaterPlugin.DIR_ACTIVE);
        registerPlugin(PdfViewerPlugin.class);
        registerPlugin(OtaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void load() {
        super.load();
        if (bridge == null) return;

        bridge.setWebViewClient(new OtaWebViewClient(bridge, otaActiveDir));
        File activeIndex = new File(otaActiveDir, "index.html");
        if (activeIndex.isFile() && activeIndex.length() > 10240) {
            bridge.getWebView().stopLoading();
            bridge.reload();
        }
    }

    private static class OtaWebViewClient extends BridgeWebViewClient {

        private final Bridge appBridge;
        private final File activeDir;

        OtaWebViewClient(Bridge bridge, File activeDir) {
            super(bridge);
            this.appBridge = bridge;
            this.activeDir = activeDir;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request != null && request.getUrl() != null && "GET".equalsIgnoreCase(request.getMethod())) {
                WebResourceResponse otaResponse = tryServeOtaAsset(request);
                if (otaResponse != null) {
                    return otaResponse;
                }
            }
            return super.shouldInterceptRequest(view, request);
        }

        private WebResourceResponse tryServeOtaAsset(WebResourceRequest request) {
            try {
                if (activeDir == null || !activeDir.isDirectory()) return null;

                Uri url = request.getUrl();
                String host = url.getHost();
                String bridgeHost = appBridge.getHost();
                if (host == null || bridgeHost == null || !host.equalsIgnoreCase(bridgeHost)) {
                    return null;
                }

                String rawPath = url.getPath();
                if (rawPath == null || rawPath.isEmpty() || rawPath.equals("/")) {
                    rawPath = "index.html";
                } else if (rawPath.startsWith("/")) {
                    rawPath = rawPath.substring(1);
                }

                if (!OtaUpdaterPlugin.isAllowedOtaPath(rawPath)) {
                    return null;
                }

                File canonicalRoot = activeDir.getCanonicalFile();
                String prefix = canonicalRoot.getPath() + File.separator;
                File candidate = new File(canonicalRoot, rawPath).getCanonicalFile();
                if (!candidate.getPath().startsWith(prefix) || !candidate.isFile() || candidate.length() <= 0) {
                    return null;
                }

                String mimeType = resolveMimeType(rawPath);
                if (mimeType == null) {
                    return null;
                }

                InputStream stream = new FileInputStream(candidate);
                if (rawPath.equals("index.html")) {
                    try {
                        stream = appBridge.getLocalServer().getJavaScriptInjectedStream(stream);
                    } catch (Exception wrapError) {
                        try {
                            stream.close();
                        } catch (Exception ignored) {}
                        return null;
                    }
                }

                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                headers.put("Access-Control-Allow-Origin", "*");

                return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, stream);
            } catch (Exception ignored) {
                return null;
            }
        }

        private static String resolveMimeType(String path) {
            String lower = path.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".js")) return "application/javascript";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".txt")) return "text/plain";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".avif")) return "image/avif";
            if (lower.endsWith(".gif")) return "image/gif";
            return null;
        }
    }
}
