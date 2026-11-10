# Traspaso para Antigravity / Gemini — Mobile 1.3

> Documento de trabajo para que otro agente pueda continuar sin reconstruir el
> contexto. Se actualiza al final de cada bloque de cambios.
>
> Última actualización: 2026-11-10
> Rama de trabajo: `agent/opencode/mobile-1.3`
> Versión: `0.1.3` — `BETA V4 - 1.3 Mobile (10/11/2026)`
> Última release publicada: `v0.1.2`

## 1. Qué es este repositorio

App Android de **BiblioTech Scout**, construida con **Capacitor 8** sobre el
sitio estático que vive en `ey-liam/bibliotech-scouts`.

- App: <https://github.com/ey-liam/bibliotech-scouts-app>
- Sitio: <https://github.com/ey-liam/bibliotech-scouts>
- Sitio publicado: <https://ey-liam.github.io/bibliotech-scouts/>
- Paquete Android: `mx.bibliotechscout.app`
- APK actual: `v0.1.2` (18.5 MB)

La app no usa Play Store. Publica el APK en GitHub Releases y se actualiza con
un plugin nativo propio (`NativeUpdater`).

## 2. Arquitectura actual

```
sitio (GitHub Pages)
  -> scripts/sync-web.mjs  (copia data/, img/, covers/ y recursos base;
                            parchea la versión e inyecta la capa nativa)
  -> www/
  -> Capacitor
  -> APK
```

### Archivos que se empaquetan

- `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`.
- `data/**` completo: catálogo, preguntas, base de conocimiento, chunks y texto
  extraído de los documentos.
- `img/**`.
- `covers/**`: las 433 portadas (~11 MB).
- Ocho recursos visuales de `assets/` que la página usa de verdad:
  - `assets/Liam.png`, `assets/Liam.webp`, `assets/LiamFondo.jpg`
  - `assets/scouts/logo_biblioteca_centenario.png`
  - `assets/scouts/foto_secciones_nac.png`
  - `assets/scouts/foros_extra_2.jpg`
  - `assets/scouts/foros_evento_3.jpg`
  - `assets/scouts/wosm_photo2.jpg`
- `web-overlay/native-early.js`: intercepta `fetch` antes de `app.js` para usar
  el contenido actualizado guardado en Cache Storage.
- `web-overlay/native-bridge.js`: Mi biblioteca, descargas, lectores, contenido
  sin conexión y actualizaciones.
- `web-overlay/native.css`: estilos del botón, panel y visores.

`www/` pesa unos 60.7 MB. La lista de recursos base está en `BASE_ASSETS` dentro
de `scripts/sync-web.mjs`; si el sitio referencia una imagen nueva de
`assets/`, hay que añadirla allí.

### Archivos que se quedan en el sitio (no viajan en el APK)

- `assets/**` completo (galerías de 66 MB que no usa la interfaz).
- `files/**` (originales PDF/DOCX/XLSX/imágenes). Se descargan desde Mi
  biblioteca; 301 de los documentos tienen archivo.

## 3. Cambios de Mobile 1.3

### 3.1 Menú «Mi biblioteca»

`native-bridge.js` construye un panel con tres pestañas:

- **Descargar:** catálogo de los 301 documentos con archivo, búsqueda por título,
  año o sección, filtro por sección, selección múltiple, peso estimado, progreso
  y descarga a `Directory.DATA/offline/<sha12>.<ext>`.
- **Mis archivos:** solo lo descargado, con búsqueda, fecha, tamaño y acciones de
  abrir o borrar. Incluye «Borrar todos».
- **App:** versión instalada, commit del sitio, conexión, espacio guardado,
  actualización de contenido, búsqueda de APK nuevo y verificación de los JSON
  sin conexión.

El botón flotante es ahora un círculo compacto de 56 px abajo a la izquierda,
con contador de archivos. La barra rápida del sitio se mantiene abajo a la
derecha. Al abrir el panel o un visor, la barra rápida se oculta.

### 3.2 Lector de PDF integrado

`android/app/src/main/java/mx/bibliotechscout/app/PdfViewerPlugin.java`:

- Abre el PDF con `PdfRenderer` desde `files/` o `cache/` de la app.
- Renderiza una página a JPEG y la devuelve al WebView como data URL.
- Métodos: `open`, `renderPage`, `close`.
- Valida rutas canónicas para no salir del almacenamiento privado.

El visor de `native-bridge.js` incluye:

- navegación anterior/siguiente y contador de páginas,
- zoom de 100 % a 250 %,
- deslizamiento horizontal cuando no hay zoom,
- teclas de flecha, `+`, `-` y `Escape`,
- botón Atrás de Android,
- caché de hasta 8 páginas renderizadas,
- apertura con el visor del sistema como respaldo si `PdfRenderer` falla.

Las imágenes se abren en un visor propio; DOCX, XLSX, PPTX y otros formatos usan
`FileOpener`.

### 3.3 Preguntas sin conexión desde la primera consulta

En `app.js` del sitio:

- `loadQuestionBank()` y `loadWebChunks()` se esperan antes de responder.
- Se añadió `waitForAppReady()` / `markAppReady()`: la respuesta espera a que
  `initApp()` termine de cargar catálogo y base de conocimiento.
- `submitQuestion()` hace
  `await Promise.all([waitForAppReady(), loadQuestionBank(), loadWebChunks()])`
  antes de `answerLocallyInBrowser()`.

Probado con una página que retrasa el catálogo y la base de conocimiento 5 s:
la primera pregunta tardó lo retrasado y respondió con texto y 6 fuentes, en
lugar de devolver «Información no disponible».

### 3.4 Recursos base y portadas

`scripts/sync-web.mjs` copia `data`, `img`, `covers` y `BASE_ASSETS`. Ya no
reescribe las rutas de `assets/` ni de `covers/` al sitio: esos archivos existen
dentro del APK. Las galerías grandes siguen fuera.

### 3.5 Versión y leyenda

- `package.json`: `version: "0.1.3"` y
  `versionLabel: "BETA V4 - 1.3 Mobile (10/11/2026)"`.
- `index.html` del sitio: el pie ahora muestra
  `Base de datos: 03/11/2026 · BETA V4 - 1.3 Mobile (10/11/2026)`.
- `sync-web.mjs` vuelve a parchear la leyenda desde `package.json` al construir
  `www/`, para que no se desincronice.
- `www/app-build.json` guarda versión, commit del sitio, fecha de build y lista
  de recursos base.

Se usa 1.3 (no 1.2) para coincidir con `package.json`; sustituye la leyenda 1.2
pedida originalmente.

### 3.6 Interfaz móvil

- `styles.css` del sitio:
  - menú móvil con enlaces de 48 px y padding inferior con safe area,
  - pie con espacio para la barra rápida y el botón nativo,
  - barra rápida oculta al abrir el lector o un modal,
  - botones de la barra rápida más compactos en pantallas de 480 px o menos.
- `native.css`:
  - panel a pantalla completa en móvil y centrado en escritorio,
  - pestañas, listas, progreso y visores adaptados a safe areas,
  - respeto a `prefers-reduced-motion`.

## 4. Cómo se compila y publica

### Local

```powershell
cd C:\Users\liamc\bibliotech-scouts-app
npm install
npm run sync:web
npx cap sync android
```

No hay Android SDK instalado en esta máquina. La compilación real ocurre en
GitHub Actions.

### Publicar una versión

1. Cambiar `version` y `versionLabel` en `package.json`.
2. Hacer PR a `main` y fusionarlo con squash.
3. Crear y subir el tag:

```powershell
git tag v0.1.3
git push origin v0.1.3
```

4. El workflow `.github/workflows/android.yml` firma el APK con los secretos y
   publica `bibliotech-scout.apk` en la release.

### Secretos de firma

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

No hay copia local del keystore. Si se pierden esos secretos, las versiones
nuevas no podrán instalarse encima de las anteriores.

## 5. Qué funciona ya

- Catálogo, preguntas y textos disponibles sin conexión desde el primer arranque.
- Primera pregunta sin conexión con espera a la inicialización completa.
- Mi biblioteca con descarga, progreso, apertura y borrado.
- Lector de PDF integrado con páginas, zoom y gestos.
- Visor de imágenes integrado.
- Actualización de contenido por ETag/Last-Modified y SHA del árbol de GitHub.
- Autoactualización del APK desde `releases/latest`.
- Portadas y recursos de interfaz dentro del APK.
- Firma estable entre `v0.1.0`, `v0.1.1` y `v0.1.2` (mismo certificado).

## 6. Validación realizada

- `node --check` correcto en `app.js`, `native-bridge.js` y `sync-web.mjs`.
- `npm run sync:web` correcto: `www/` de 60.7 MB, 433 portadas y 8 recursos base.
- `npx cap sync android` correcto: 8 plugins detectados.
- Página de prueba `native-test.html` sin errores de consola.
- Panel abre y lista 301 documentos.
- Descarga simulada: crea `offline/<sha12>.pdf` e índice persistente.
- «Mis archivos» lista el PDF con título, sección, peso y fecha.
- Lector PDF: abre el archivo, muestra página 1 de 5, avanza a página 2, aplica
  zoom 150 %, cierra y limpia la imagen.
- Borrado: elimina el archivo, vacía el índice y actualiza el contador.
- Primera pregunta con inicialización retrasada: responde con fuentes.
- Falta probar en dispositivo real y validar el APK del workflow.

## 7. Archivos clave

| Archivo | Responsabilidad |
| --- | --- |
| `scripts/sync-web.mjs` | Copia el sitio, portadas y recursos base; parchea versión; crea `www/` |
| `scripts/make-assets.mjs` | Genera icono y splash |
| `scripts/make-native-test.mjs` | Crea la página de prueba con el mock de Capacitor |
| `web-overlay/native-early.js` | Caché de contenido antes de `app.js` |
| `web-overlay/native-bridge.js` | Mi biblioteca, descargas, lectores, sync y updates |
| `web-overlay/native.css` | Estilos de la capa nativa |
| `web-overlay/native-mock.js` | Mock de Capacitor para probar en navegador |
| `android/.../MainActivity.java` | Registra `NativeUpdaterPlugin` y `PdfViewerPlugin` |
| `android/.../NativeUpdaterPlugin.java` | Descarga e instala el APK |
| `android/.../PdfViewerPlugin.java` | Renderiza PDF con `PdfRenderer` |
| `android/app/src/main/AndroidManifest.xml` | Permisos y FileProvider |
| `.github/workflows/android.yml` | Compilación y release |

## 8. Validación pendiente antes de publicar

- Ejecutar el workflow de Android y confirmar que compila `PdfViewerPlugin`.
- Instalar el APK encima de `v0.1.2` con la misma firma.
- En dispositivo o emulador:
  - abrir Mi biblioteca desde el botón inferior izquierdo,
  - descargar un PDF,
  - abrirlo en el lector integrado,
  - cambiar de página, hacer zoom y volver,
  - descargar una imagen y abrirla,
  - borrar un archivo y comprobar el contador,
  - activar modo avión y hacer una pregunta,
  - actualizar contenido desde la pestaña App,
  - buscar una actualización de APK.
- Verificar que la barra rápida del sitio y el botón nativo no se solapan en
  pantallas de 360 px, 390 px y tablets.

## 9. Estado del repositorio

- Rama de la app: `agent/opencode/mobile-1.3`.
- Rama del sitio: `agent/opencode/mobile-1.3`.
- Cambios sin commitear al escribir este documento.
- `main` de la app en `0749dac`; `main` del sitio en `13d0e6a`.
- Última release: `v0.1.2`.

## 10. Siguientes pasos recomendados

1. Commit y PR en ambos repositorios; fusionar con squash.
2. Crear el tag `v0.1.3` y verificar la firma y la release.
3. Instalar el APK y completar la lista de la sección 8.
4. Decidir si se implementa un actualizador de interfaz web→móvil. Hoy los
   cambios de `index.html`, `styles.css` y `app.js` requieren una release nueva;
   solo `data/**` y los textos se actualizan sin APK.
5. Si se implementa, descargar la interfaz nueva a Cache Storage, validar su
   integridad y usarla en el siguiente arranque, con opción de volver a la
   versión incluida en el APK.

## 11. Instrucciones para el siguiente agente

1. Lee `AGENTS.md` y este archivo.
2. Trabaja en una rama `agent/<agente>/<tema>`.
3. No edites a mano los JSON de `data/`; se generan en el repo del sitio.
4. No subas keystores ni contraseñas.
5. Mantén la capa nativa en `web-overlay/` y no modifiques `app.js` del sitio
   salvo que sea imprescindible; si lo haces, documenta el cambio aquí.
6. Prueba en navegador con el mock antes de pedir compilación.
7. Actualiza este documento al terminar cada bloque.
