# BiblioTech Scout — App Android

Aplicación Android (teléfonos y tablets) de **BiblioTech Scout**. Envuelve el sitio
oficial con Capacitor y añade funciones que el navegador no puede dar: biblioteca
sin conexión, lector de PDF integrado, gestor de archivos descargados y aviso de
nuevas versiones con descarga desde GitHub Releases.

- Sitio: <https://ey-liam.github.io/bibliotech-scouts/>
- App: este repositorio
- Paquete Android: `mx.bibliotechscout.app`
- Versión actual: `0.1.5` — `BETA V4.2 - 1.5 Mobile (10/11/2026)`
- Sitio de referencia: `ey-liam/bibliotech-scouts`

## Descargar la app

El enlace siguiente descarga siempre el APK de la última release publicada:

<https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk>

1. Abre el enlace desde el teléfono y descarga `bibliotech-scout.apk`.
2. Abre el archivo y permite la instalación desde el navegador si Android lo pide.
3. Pulsa **Instalar**. Si ya tenías la app, instala encima para conservar tus
   archivos y descargas.

> **Play Protect:** al instalar fuera de Play Store, Android puede mostrar «Es
> posible que esta app sea dañina». Es el aviso para apps desconocidas. Verifica
> que el archivo venga del enlace oficial y pulsa **Más detalles → Instalar de
> todos modos**. No instales APK de otros sitios. El APK de **Releases** está
> firmado; el artefacto debug de Actions usa otra firma y no debe instalarse.
>
> Desde 1.4 la app ya no solicita `REQUEST_INSTALL_PACKAGES` ni descarga
> instaladores por su cuenta. Aun así, Google no garantiza que Play Protect deje
> de advertir en apps distribuidas fuera de su tienda.

## Qué incluye

- **Todo el contenido de consulta desde el primer arranque.** El catálogo, el
  banco de preguntas, la base de conocimiento, los fragmentos de búsqueda y los
  textos extraídos de los documentos viajan dentro del APK.
- **Preguntas sin conexión desde la primera consulta.** El motor local espera a
  que terminen de cargar el catálogo, el banco de preguntas y los fragmentos
  antes de responder, incluso si la pregunta se hace justo al abrir la app.
- **Mi biblioteca y descargas.** Panel integrado con la interfaz y accesible desde el encabezado principal, el menú lateral y el botón flotante:
  - **Mis descargas:** tus documentos guardados en tarjetas claras con formato, sección, peso y botones directos de «Abrir» y «Borrar».
  - **Explorar catálogo:** los 650 documentos oficiales disponibles para descargar, con búsqueda rápida, filtro por sección y descarga por lotes.
  - **App y estado:** versión, contenido del sitio, estado de conexión, actualización de contenido y verificación de datos sin conexión.
- **Lector de PDF integrado.** Los PDF descargados se abren dentro de la app con
  `PdfRenderer`, sin internet ni apps externas. Incluye navegación de páginas,
  zoom hasta 250 %, deslizamiento horizontal y botón Atrás.
- **Visor de imágenes integrado** para PNG, JPG, WebP, AVIF y GIF. DOCX, XLSX,
  PPTX y otros formatos se abren con el visor del sistema mediante
  `@capacitor-community/file-opener`.
- **Recursos base incluidos.** El APK lleva los ocho recursos visuales que usa la
  página (retrato y fondo del autor, logos y fotos de secciones) y las 433
  portadas del catálogo. La interfaz no depende del sitio para verse completa.
- **Contenido actualizable sin publicar un APK.** La app comprueba el ETag de los
  JSON del sitio y guarda las versiones nuevas en Cache Storage. Los textos
  nuevos o modificados se sincronizan desde el árbol del repositorio.
- **Aviso de nuevas versiones sin instalador interno.** Consulta la última release
  del repositorio y, si hay una versión mayor, abre la descarga en el navegador.
  La app no solicita `REQUEST_INSTALL_PACKAGES` ni descarga o abre instaladores
  por su cuenta. Esto reduce la superficie que Play Protect considera peligrosa
  en apps distribuidas fuera de la tienda.
- **Navegación móvil corregida.** El botón de Mi biblioteca es compacto, está
  abajo a la izquierda y ya no choca con la barra rápida del sitio ni tapa el
  contenido. El menú móvil respeta las safe areas y el pie tiene espacio extra.
- **Enlaces externos en el navegador del sistema** y botón Atrás controlado.
- **Aviso de sin conexión** y contador de archivos guardados.

## Cómo se arma

```
sitio (GitHub Pages)  ->  scripts/sync-web.mjs  ->  www/  ->  Capacitor  ->  APK
```

`scripts/sync-web.mjs` clona el sitio en modo disperso (`--filter=blob:none
--sparse`) y copia a `www/`:

- `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`
- `data/**` (catálogo, preguntas, base de conocimiento, chunks y textos)
- `img/**`
- `covers/**` (433 portadas, ~11 MB)
- Los ocho recursos de `assets/` que la página usa de verdad: `Liam.png`,
  `Liam.webp`, `LiamFondo.jpg` y las imágenes de `assets/scouts/` referenciadas
  en el HTML.

La carpeta `assets/` completa (66 MB de galerías) **no** se empaqueta. Los
archivos originales de `files/` tampoco: se descargan desde Mi biblioteca. El
contenido web resultante pesa unos 60.7 MB.

El sincronizador también:

- Parchea la leyenda del pie con `versionLabel` de `package.json`, para que la
  web y la app muestren la misma versión.
- Inyecta `native-early.js` en `<head>`, antes de `app.js`, para que el catálogo
  y las preguntas actualizadas se lean de la caché.
- Inyecta `native.css` y `native-bridge.js` sin modificar el `app.js` del sitio.
- Genera `www/app-build.json` con la versión, el commit del sitio y los recursos
  incluidos.

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

### Probar la capa nativa en el navegador

```powershell
npx --yes http-server www -p 8766 -a 127.0.0.1 -c-1
node scripts/make-native-test.mjs
```

Abre <http://127.0.0.1:8766/native-test.html>. La página carga
`native-mock.js` para simular Capacitor, descargas y el lector PDF. No forma
parte del APK. Después de probar, vuelve a ejecutar `npm run sync:web` antes de
`npx cap sync android` para que las páginas de prueba no entren en la compilación.

## Compilación y publicación

El workflow `.github/workflows/android.yml` compila en cada push y PR (APK de
prueba como artefacto). Para publicar una versión:

```powershell
git tag v0.1.4
git push origin v0.1.4
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

El panel **Mi biblioteca → App → Actualizar contenido** revisa:

- `data/catalog.json`, `questions_bank.json`, `knowledge_base.json`,
  `chunks.json` y `faq_v3.json` mediante ETag.
- `data/text/**` mediante los SHA del árbol de GitHub (una sola petición).

Lo actualizado se guarda en Cache Storage y se sirve antes que el contenido
incluido en el APK. Al cambiar la versión de la app, la caché vieja se descarta
para no tapar el contenido nuevo del paquete.

### APK

Al abrir la app (como máximo una vez cada 24 horas) se consulta
`releases/latest`. Si hay una versión mayor:

1. Se muestra un aviso con las notas de la release.
2. Al aceptar, se abre en el navegador la descarga directa del APK más reciente.
3. El usuario descarga el archivo y lo abre desde el navegador o la carpeta de
   descargas.
4. Android pide permiso para instalar apps desconocidas la primera vez y abre su
   instalador. La app no descarga ni ejecuta instaladores por su cuenta.

También se puede entrar a **Mi biblioteca → App → Buscar actualización** o usar
el enlace de descarga de este README.

## Estructura

| Ruta | Qué contiene |
| --- | --- |
| `scripts/sync-web.mjs` | Copia el sitio, portadas y recursos base; parchea la versión e inyecta la capa nativa |
| `scripts/make-assets.mjs` | Genera icono y splash desde `img/icon-512.png` |
| `scripts/make-native-test.mjs` | Crea la página de prueba con el mock de Capacitor |
| `web-overlay/native-early.js` | Usa la caché de contenido antes de que arranque `app.js` |
| `web-overlay/native-bridge.js` | Mi biblioteca, descargas, lector PDF, imágenes y updates |
| `web-overlay/native.css` | Estilos del panel, botón flotante y visores |
| `web-overlay/native-mock.js` | Mock de Capacitor para probar en navegador |
| `android/` | Proyecto Android generado por Capacitor |
| `android/app/src/main/java/mx/bibliotechscout/app/MainActivity.java` | Registra `PdfViewer` |
| `android/app/src/main/java/mx/bibliotechscout/app/PdfViewerPlugin.java` | Renderiza páginas de PDF con `PdfRenderer` |
| `.github/workflows/android.yml` | Compilación y publicación |

## Limitaciones conocidas

- El APK se distribuye directamente (no Play Store), así que Android muestra el
  aviso de «instalar apps desconocidas» y Play Protect puede advertir que la app
  es desconocida o «posiblemente dañina». La app ya no pide instalar otros APK;
  instala siempre el archivo de **Releases** y nunca el APK debug de Actions.
- DOCX, XLSX y PPTX necesitan una app compatible instalada; el lector propio solo
  cubre PDF e imágenes.
- Las galerías completas de `assets/` requieren internet. Los recursos de la
  interfaz y las portadas sí están incluidos en el APK.
- Los cambios de interfaz del sitio (`index.html`, `styles.css`, `app.js`)
  requieren publicar una versión nueva del APK. El contenido de `data/**` y los
  textos sí se actualizan desde el panel.
- La app no sustituye al sitio: el sitio sigue siendo la fuente de contenido y
  metadatos.
- No se editan a mano los JSON de `data/`; se generan en el repositorio del sitio.
