package mx.bibliotechscout.app;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Lector de PDF integrado, sin apps externas ni internet.
 * Abre un archivo guardado en el almacenamiento privado de la app, renderiza
 * una página a JPEG y la devuelve al WebView como data URL.
 */
@CapacitorPlugin(name = "PdfViewer")
public class PdfViewerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private PdfRenderer renderer;
    private ParcelFileDescriptor descriptor;
    private String currentPath;

    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Falta la ruta del PDF");
            return;
        }
        executor.execute(() -> {
            try {
                closeRenderer();
                File file = resolveFile(path);
                if (!file.exists()) {
                    call.reject("El archivo no existe");
                    return;
                }
                descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
                renderer = new PdfRenderer(descriptor);
                currentPath = file.getAbsolutePath();

                JSObject result = new JSObject();
                result.put("pages", renderer.getPageCount());
                result.put("name", file.getName());
                call.resolve(result);
            } catch (Exception error) {
                closeRenderer();
                call.reject("No se pudo abrir el PDF: " + message(error));
            }
        });
    }

    @PluginMethod
    public void renderPage(PluginCall call) {
        Integer requestedPage = call.getInt("page");
        Integer requestedWidth = call.getInt("width");
        executor.execute(() -> {
            try {
                if (renderer == null) {
                    call.reject("No hay un PDF abierto");
                    return;
                }

                int pages = renderer.getPageCount();
                int pageIndex = requestedPage == null ? 0 : Math.max(0, Math.min(pages - 1, requestedPage));
                int targetWidth = requestedWidth == null ? 1400 : requestedWidth;
                targetWidth = Math.max(480, Math.min(2048, targetWidth));

                try (PdfRenderer.Page page = renderer.openPage(pageIndex)) {
                    int sourceWidth = Math.max(1, page.getWidth());
                    int sourceHeight = Math.max(1, page.getHeight());
                    float scale = (float) targetWidth / (float) sourceWidth;
                    int width = Math.max(1, Math.round(sourceWidth * scale));
                    int height = Math.max(1, Math.round(sourceHeight * scale));

                    Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(Color.WHITE);
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 86, output);
                    bitmap.recycle();
                    String base64 = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);

                    JSObject result = new JSObject();
                    result.put("page", pageIndex);
                    result.put("pages", pages);
                    result.put("width", width);
                    result.put("height", height);
                    result.put("dataUrl", "data:image/jpeg;base64," + base64);
                    call.resolve(result);
                }
            } catch (Exception error) {
                call.reject("No se pudo mostrar la página: " + message(error));
            }
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        if (executor.isShutdown()) {
            call.resolve();
            return;
        }
        executor.execute(() -> {
            closeRenderer();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (!executor.isShutdown()) {
            executor.execute(this::closeRenderer);
            executor.shutdown();
        }
        super.handleOnDestroy();
    }

    private File resolveFile(String path) throws IOException {
        String raw = path.trim();
        if (raw.startsWith("file://")) {
            String parsed = Uri.parse(raw).getPath();
            if (parsed != null && !parsed.isEmpty()) {
                raw = parsed;
            }
        }

        File file = new File(raw);
        if (!file.isAbsolute()) {
            file = new File(getContext().getFilesDir(), raw);
        }
        file = file.getCanonicalFile();

        File filesDir = getContext().getFilesDir().getCanonicalFile();
        File cacheDir = getContext().getCacheDir().getCanonicalFile();
        String canonical = file.getPath();
        boolean allowed =
                canonical.equals(filesDir.getPath())
                        || canonical.startsWith(filesDir.getPath() + File.separator)
                        || canonical.equals(cacheDir.getPath())
                        || canonical.startsWith(cacheDir.getPath() + File.separator);
        if (!allowed) {
            throw new IOException("Ruta no permitida");
        }
        return file;
    }

    private void closeRenderer() {
        if (renderer != null) {
            try {
                renderer.close();
            } catch (Exception ignored) {
            }
            renderer = null;
        }
        if (descriptor != null) {
            try {
                descriptor.close();
            } catch (Exception ignored) {
            }
            descriptor = null;
        }
        currentPath = null;
    }

    private String message(Exception error) {
        return error.getMessage() != null ? error.getMessage() : "error desconocido";
    }
}
