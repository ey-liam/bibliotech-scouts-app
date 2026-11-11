package mx.bibliotechscout.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Gestor nativo de actualizaciones web y de contenido (OTA) sin permisos invasivos.
 * Aplica archivos validados desde ota_staging/ hacia ota_active/ con proteccion
 * automatica contra fallos de arranque y limpieza al instalar una nueva version del APK.
 */
@CapacitorPlugin(name = "OtaUpdater")
public class OtaUpdaterPlugin extends Plugin {

    public static final String PREFS_NAME = "bt_ota_prefs";
    public static final String KEY_APK_VERSION_CODE = "apk_version_code";
    public static final String KEY_BOOT_ATTEMPTS = "boot_attempts";
    public static final String DIR_ACTIVE = "ota_active";
    public static final String DIR_STAGING = "ota_staging";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Verifica la version del APK al iniciar y limpia capas OTA obsoletas o con fallos repetidos.
     */
    public static void prepareOtaOnStartup(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long currentCode = readApkVersionCode(context);
        long savedCode = prefs.getLong(KEY_APK_VERSION_CODE, -1L);

        File filesDir = context.getFilesDir();
        File activeDir = new File(filesDir, DIR_ACTIVE);
        File stagingDir = new File(filesDir, DIR_STAGING);

        if (currentCode > 0 && savedCode != currentCode) {
            deleteRecursive(activeDir);
            deleteRecursive(stagingDir);
            prefs.edit()
                .putLong(KEY_APK_VERSION_CODE, currentCode)
                .putInt(KEY_BOOT_ATTEMPTS, 0)
                .apply();
            return;
        }

        File activeIndex = new File(activeDir, "index.html");
        if (activeIndex.isFile()) {
            int attempts = prefs.getInt(KEY_BOOT_ATTEMPTS, 0);
            if (attempts >= 2) {
                deleteRecursive(activeDir);
                deleteRecursive(stagingDir);
                prefs.edit().putInt(KEY_BOOT_ATTEMPTS, 0).apply();
            } else {
                prefs.edit().putInt(KEY_BOOT_ATTEMPTS, attempts + 1).apply();
            }
        } else {
            prefs.edit().putInt(KEY_BOOT_ATTEMPTS, 0).apply();
        }
    }

    public static boolean isAllowedOtaPath(String relPath) {
        if (relPath == null || relPath.isEmpty()) return false;
        String clean = relPath.startsWith("/") ? relPath.substring(1) : relPath;
        if (clean.contains("..") || clean.contains("\\") || clean.startsWith(".")) {
            return false;
        }
        if (
            clean.equals("native-early.js") ||
            clean.equals("native-bridge.js") ||
            clean.equals("native.css") ||
            clean.equals("app-build.json") ||
            clean.equals("capacitor.js") ||
            clean.equals("cordova.js")
        ) {
            return false;
        }
        return (
            clean.equals("index.html") ||
            clean.equals("styles.css") ||
            clean.equals("app.js") ||
            clean.startsWith("data/") ||
            clean.startsWith("img/")
        );
    }

    @PluginMethod
    public void confirmBoot(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt(KEY_BOOT_ATTEMPTS, 0).apply();
        JSObject result = buildStatusObject();
        call.resolve(result);
    }

    @PluginMethod
    public void getOtaStatus(PluginCall call) {
        call.resolve(buildStatusObject());
    }

    @PluginMethod
    public void promoteStaging(PluginCall call) {
        final String siteCommit = call.getString("siteCommit", "");
        final String updatedAt = call.getString("updatedAt", "");
        executor.execute(() -> {
            try {
                File filesDir = getContext().getFilesDir().getCanonicalFile();
                File stagingDir = new File(filesDir, DIR_STAGING).getCanonicalFile();
                File activeDir = new File(filesDir, DIR_ACTIVE).getCanonicalFile();

                if (!stagingDir.isDirectory()) {
                    call.reject("No existe el directorio temporal de actualizacion.");
                    return;
                }

                File stagedIndex = new File(stagingDir, "index.html");
                if (stagedIndex.isFile()) {
                    String html = readTextFile(stagedIndex, 2 * 1024 * 1024);
                    if (
                        html.length() < 10240 ||
                        !html.contains("contenido-principal") ||
                        !html.contains("native-bridge.js") ||
                        !html.contains("app.js")
                    ) {
                        deleteRecursive(stagingDir);
                        call.reject("La actualizacion de index.html no paso la validacion de integridad.");
                        return;
                    }
                }

                File stagedCss = new File(stagingDir, "styles.css");
                if (stagedCss.isFile() && stagedCss.length() < 10240) {
                    deleteRecursive(stagingDir);
                    call.reject("styles.css incompleto en actualizacion.");
                    return;
                }

                File stagedApp = new File(stagingDir, "app.js");
                if (stagedApp.isFile() && stagedApp.length() < 10240) {
                    deleteRecursive(stagingDir);
                    call.reject("app.js incompleto en actualizacion.");
                    return;
                }

                if (!activeDir.exists() && !activeDir.mkdirs()) {
                    call.reject("No se pudo crear el directorio ota_active.");
                    return;
                }

                int promotedCount = copyAllowedFiles(stagingDir, stagingDir, activeDir);
                if (promotedCount > 0) {
                    JSONObject meta = new JSONObject();
                    meta.put("siteCommit", siteCommit);
                    meta.put("updatedAt", updatedAt);
                    meta.put("apkVersionCode", readApkVersionCode(getContext()));
                    writeAtomic(new File(activeDir, "meta.json"), meta.toString().getBytes(StandardCharsets.UTF_8));
                }

                deleteRecursive(stagingDir);

                SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putInt(KEY_BOOT_ATTEMPTS, 0).apply();

                JSObject result = buildStatusObject();
                result.put("promotedFiles", promotedCount);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Error al aplicar actualizacion: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void clearOta(PluginCall call) {
        executor.execute(() -> {
            File filesDir = getContext().getFilesDir();
            deleteRecursive(new File(filesDir, DIR_ACTIVE));
            deleteRecursive(new File(filesDir, DIR_STAGING));
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putInt(KEY_BOOT_ATTEMPTS, 0).apply();
            call.resolve(buildStatusObject());
        });
    }

    @PluginMethod
    public void reloadApp(PluginCall call) {
        if (getBridge() != null) {
            getBridge().reload();
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (!executor.isShutdown()) {
            executor.shutdown();
        }
        super.handleOnDestroy();
    }

    private JSObject buildStatusObject() {
        JSObject obj = new JSObject();
        File activeDir = new File(getContext().getFilesDir(), DIR_ACTIVE);
        File activeIndex = new File(activeDir, "index.html");
        File metaFile = new File(activeDir, "meta.json");
        boolean active = activeDir.isDirectory() && (activeIndex.isFile() || hasAnyFile(activeDir));
        String siteCommit = "";
        String updatedAt = "";
        if (metaFile.isFile()) {
            try {
                JSONObject meta = new JSONObject(readTextFile(metaFile, 64 * 1024));
                siteCommit = meta.optString("siteCommit", "");
                updatedAt = meta.optString("updatedAt", "");
            } catch (Exception ignored) {}
        }
        obj.put("active", active);
        obj.put("hasHtmlOverride", activeIndex.isFile());
        obj.put("siteCommit", siteCommit);
        obj.put("updatedAt", updatedAt);
        obj.put("apkVersionCode", readApkVersionCode(getContext()));
        return obj;
    }

    private static int copyAllowedFiles(File rootStaging, File current, File activeDir) throws IOException {
        File[] children = current.listFiles();
        if (children == null) return 0;
        int count = 0;
        String rootPrefix = rootStaging.getCanonicalPath() + File.separator;
        String activePrefix = activeDir.getCanonicalPath() + File.separator;

        for (File item : children) {
            File canonicalItem = item.getCanonicalFile();
            if (!canonicalItem.getPath().startsWith(rootPrefix)) {
                continue;
            }
            if (canonicalItem.isDirectory()) {
                count += copyAllowedFiles(rootStaging, canonicalItem, activeDir);
                continue;
            }
            String rel = canonicalItem.getPath().substring(rootPrefix.length()).replace(File.separatorChar, '/');
            if (!isAllowedOtaPath(rel) || canonicalItem.length() <= 0) {
                continue;
            }
            File dest = new File(activeDir, rel).getCanonicalFile();
            if (!dest.getPath().startsWith(activePrefix)) {
                continue;
            }
            File parent = dest.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("No se pudo crear carpeta destino: " + parent.getPath());
            }
            copyFileAtomic(canonicalItem, dest);
            count += 1;
        }
        return count;
    }

    private static void copyFileAtomic(File src, File dest) throws IOException {
        File temp = new File(dest.getParentFile(), dest.getName() + ".tmp");
        byte[] buffer = new byte[16384];
        try (FileInputStream in = new FileInputStream(src); FileOutputStream out = new FileOutputStream(temp)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
        if (dest.exists() && !dest.delete()) {
            temp.delete();
            throw new IOException("No se pudo reemplazar " + dest.getName());
        }
        if (!temp.renameTo(dest)) {
            temp.delete();
            throw new IOException("No se pudo mover archivo temporal a " + dest.getName());
        }
    }

    private static void writeAtomic(File dest, byte[] bytes) throws IOException {
        File temp = new File(dest.getParentFile(), dest.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) {
            out.write(bytes);
            out.flush();
        }
        if (dest.exists() && !dest.delete()) {
            temp.delete();
            throw new IOException("No se pudo reemplazar " + dest.getName());
        }
        if (!temp.renameTo(dest)) {
            temp.delete();
            throw new IOException("No se pudo escribir " + dest.getName());
        }
    }

    private static String readTextFile(File file, int maxBytes) throws IOException {
        if (file.length() > maxBytes) {
            throw new IOException("Archivo excede tamano permitido");
        }
        byte[] buffer = new byte[8192];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (FileInputStream in = new FileInputStream(file)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
        }
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private static boolean hasAnyFile(File dir) {
        File[] list = dir.listFiles();
        if (list == null) return false;
        for (File item : list) {
            if (item.isFile() && !item.getName().equals("meta.json")) return true;
            if (item.isDirectory() && hasAnyFile(item)) return true;
        }
        return false;
    }

    private static void deleteRecursive(File target) {
        if (target == null || !target.exists()) return;
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        target.delete();
    }

    private static long readApkVersionCode(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return PackageInfoCompat.getLongVersionCode(info);
        } catch (Exception ignored) {
            return 0L;
        }
    }
}
