# BiblioTech Scout — App Android

Aplicación Android (teléfonos y tablets) de **BiblioTech Scout**. Envuelve el sitio
oficial con Capacitor y añade funciones que el navegador no puede dar: descargas
selectivas para uso sin conexión y actualización del APK desde GitHub Releases.

- Sitio: <https://ey-liam.github.io/bibliotech-scouts/>
- App: este repositorio
- Paquete Android: `mx.bibliotechscout.app`
- Sitio de referencia: `ey-liam/bibliotech-scouts`

## Qué incluye

- **Preguntas y texto disponibles desde el primer arranque.** El catálogo, el banco
  de preguntas, la base de conocimiento y los textos extraídos de los 650
  documentos viajan dentro del APK (~36 MB).
- **Modo sin conexión selectivo.** Un panel propio permite elegir qué archivos
  originales (PDF, DOCX, XLSX, imágenes) descargar, ver su peso, seguir el
  progreso y borrarlos después.
- **Lectura de archivos guardados.** Los documentos descargados se abren con el
  visor del sistema mediante `@capacitor-community/file-opener`.
- **Contenido actualizable sin publicar un APK.** La app comprueba el ETag de los
  JSON del sitio y guarda las versiones nuevas en Cache Storage. Los textos
  nuevos o modificados se sincronizan desde el árbol del repositorio.
- **Autoactualización del APK.** Consulta la última release del repositorio, avisa
  al usuario y descarga e instala la nueva versión con un plugin nativo propio
  (`NativeUpdater`).
- **Enlaces externos en el navegador del sistema** y botón Atrás controlado.
- **Aviso de sin conexión** y contador de archivos guardados.

## Cómo se arma

```
sitio (GitHub Pages)  ->  scripts/sync-web.mjs  ->  www/  ->  Capacitor  ->  APK
```

`scripts/sync-web.mjs` clona el sitio en modo disperso (`--filter=blob:none
--sparse`) y copia a `www/`:

- `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`
- `data/**` (catálogo, preguntas, textos)
- `img/**`

La carpeta `assets/` (66 MB de fotos) **no** se empaqueta: sus URLs se reescriben
a `https://ey-liam.github.io/bibliotech-scouts/assets/...` y se ven cuando hay
internet. Los archivos originales de `files/` tampoco se empaquetan; se descargan
desde el panel Offline.

Después se inyectan `native.css` y `native-bridge.js`, que son los que añaden la
interfaz nativa sin modificar `app.js` del sitio.

## Desarrollo local

Requisitos: Node 22+, Git y, para compilar, Android Studio o el Android SDK
(compileSdk 36, JDK 21).

```powershell
npm install
npm run sync:web        # copia el sitio a www/
npx cap sync android    # copia www/ al proyecto Android
npx cap open android    # abre Android Studio
```

Para usar una copia local del sitio en lugar de clonarlo:

```powershell
$env:SITE_SOURCE = "C:\Users\liamc\bibliotech-scouts"
npm run sync:web
```

## Compilación y publicación

El workflow `.github/workflows/android.yml` compila en cada push y PR (APK de
prueba como artefacto). Para publicar una versión:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

El workflow:

1. Toma `versionName` del tag (sin la `v`) y `versionCode` del número de ejecución.
2. Firma con el keystore guardado en secretos.
3. Publica `bibliotech-scout.apk` en la release.

### Secretos necesarios

| Secreto | Contenido |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Keystore de publicación codificado en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clave |
| `ANDROID_KEY_PASSWORD` | Contraseña de la clave |

> Guarda una copia del keystore fuera del repositorio. Si se pierde, las
> actualizaciones dejarán de poder instalarse encima de la versión anterior.

## Actualizaciones

### Contenido

El panel **Offline → Actualizar contenido** revisa:

- `data/catalog.json`, `questions_bank.json`, `knowledge_base.json`,
  `chunks.json` y `faq_v3.json` mediante ETag.
- `data/text/**` mediante los SHA del árbol de GitHub (una sola petición).

Lo actualizado se guarda en Cache Storage y se sirve antes que el contenido
incluido en el APK. Al cambiar la versión de la app, la caché vieja se descarta
para no tapar el contenido nuevo del paquete.

### APK

Al abrir la app (como máximo una vez cada 12 horas) se consulta
`releases/latest`. Si hay una versión mayor:

1. Se muestra el diálogo con las notas.
2. Se descarga el APK con `NativeUpdater`.
3. Android pide permiso para instalar apps desconocidas la primera vez.
4. Se abre el instalador del sistema.

## Estructura

| Ruta | Qué contiene |
| --- | --- |
| `scripts/sync-web.mjs` | Copia el sitio a `www/` e inyecta la capa nativa |
| `scripts/make-assets.mjs` | Genera icono y splash desde `img/icon-512.png` |
| `web-overlay/native-bridge.js` | Panel offline, descargas, sincronización y updates |
| `web-overlay/native.css` | Estilos del panel y del botón flotante |
| `android/` | Proyecto Android generado por Capacitor |
| `android/app/src/main/java/mx/bibliotechscout/app/NativeUpdaterPlugin.java` | Descarga e instalación del APK |
| `.github/workflows/android.yml` | Compilación y publicación |

## Limitaciones conocidas

- El APK se distribuye directamente (no Play Store), así que Android muestra el
  aviso de «instalar apps desconocidas».
- Las imágenes de `assets/` y los archivos de `files/` requieren internet salvo
  que se descarguen desde el panel.
- La app no sustituye al sitio: el sitio sigue siendo la fuente de contenido y
  metadatos.
- No se editan a mano los JSON de `data/`; se generan en el repositorio del sitio.
