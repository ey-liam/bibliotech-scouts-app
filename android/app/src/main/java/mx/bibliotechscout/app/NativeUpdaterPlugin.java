package mx.bibliotechscout.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarga un APK de actualización y abre el instalador del sistema.
 * Pensado para distribución directa (GitHub Releases), fuera de Play Store.
 */
@CapacitorPlugin(name = "NativeUpdater")
public class NativeUpdaterPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.trim().isEmpty()) {
            call.reject("Falta la URL del APK");
            return;
        }
        if (getActivity() == null) {
            call.reject("La aplicación no está en primer plano");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new Exception("No se pudo crear la carpeta de actualizaciones");
                }
                File apk = new File(dir, "update.apk");

                HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(120000);
                connection.setRequestProperty("User-Agent", "BiblioTechScoutApp");
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new Exception("HTTP " + status);
                }

                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                    }
                }

                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                apk
                        );
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);

                        JSObject result = new JSObject();
                        result.put("path", apk.getAbsolutePath());
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("No se pudo abrir el instalador: " + error.getMessage());
                    }
                });
            } catch (Exception error) {
                String message = error.getMessage() != null ? error.getMessage() : "Error desconocido";
                if (getActivity() != null) {
                    getActivity().runOnUiThread(() ->
                            call.reject("No se pudo descargar la actualización: " + message));
                } else {
                    call.reject("No se pudo descargar la actualización: " + message);
                }
            }
        }).start();
    }
}
