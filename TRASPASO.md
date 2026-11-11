# Traspaso para Antigravity / Gemini — Mobile 1.4

> Documento de trabajo para que otro agente pueda continuar sin reconstruir el
> contexto. Se actualiza al final de cada bloque de cambios.
>
> Última actualización: 2026-11-10
> Rama de trabajo: `agent/opencode/mobile-1.4`
> Versión: `0.1.4` — `BETA V4.1 - 1.4 Mobile (10/11/2026)`
> Última release publicada: `v0.1.3` (próxima: `v0.1.4`)

## 1. Qué es este repositorio

App Android de **BiblioTech Scout**, construida con **Capacitor 8** sobre el
sitio estático que vive en `ey-liam/bibliotech-scouts`.

- App: <https://github.com/ey-liam/bibliotech-scouts-app>
- Sitio: <https://github.com/ey-liam/bibliotech-scouts>
- Sitio publicado: <https://ey-liam.github.io/bibliotech-scouts/>
- Paquete Android: `mx.bibliotechscout.app`
- APK actual: `v0.1.3` (45.6 MB)
- Descarga directa:
  <https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk>

El proyecto es creado y mantenido por **Liam Durán**. No se debe presentar a
ningún agente de IA como autor ni como contribuyente en GitHub, en la web ni en
los créditos. Las ramas `agent/...` son solo una convención técnica de trabajo.

La app no usa Play Store. Publica el APK en GitHub Releases. Desde 1.4 la
actualización se descarga y se instala **manualmente desde el navegador**; la app
ya no descarga ni abre instaladores de APK por su cuenta.

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
  sin conexión y aviso de actualizaciones.
- `web-overlay/native.css`: estilos del botón, panel y visores.

`www/` pesa unos 60.7 MB. La lista de recursos base está en `BASE_ASSETS` dentro
de `scripts/sync-web.mjs`; si el sitio referencia una imagen nueva de
`assets/`, hay que añadirla allí.

### Archivos que se quedan en el sitio (no viajan en el APK)

- `assets/**` completo (galerías de 66 MB que no usa la interfaz).
- `files/**` (originales PDF/DOCX/XLSX/imágenes). Se descargan desde Mi
  biblioteca; 301 de los documentos tienen archivo.

## 3. Mobile 1.3 — ya publicado

La release `v0.1.3` quedó publicada con estas funciones:

- **Mi biblioteca** con tres pestañas: Descargar (301 documentos), Mis archivos
  y App.
- **Lector PDF integrado** con `PdfRenderer`, páginas, zoom hasta 250 %,
  deslizamiento, teclado y botón Atrás.
- **Visor de imágenes integrado**; DOCX, XLSX, PPTX y otros formatos se abren
  con el visor del sistema mediante `FileOpener`.
- **Preguntas sin conexión desde la primera consulta** gracias a
  `waitForAppReady()` / `markAppReady()` y a la espera de
  `loadQuestionBank()` y `loadWebChunks()`.
- **Recursos base y 433 portadas dentro del APK**.
- **Botón Offline compacto** abajo a la izquierda, sin solaparse con la barra
  rápida ni con el contenido.
- **Versión 1.3** en la web y en la app.
- APK de 45,567,768 bytes y SHA-256
  `bbbe1b8135c920cb339e77538bd97218cf5b4d8b9403961598a0c01fc435359e`.

## 4. Mobile 1.4 — Play Protect y descarga desde la web

### 4.1 Por qué aparecía el aviso

Google Play Protect muestra «Se bloqueó la app dañina» o «Es posible que esta
app sea dañina» cuando sus heurísticas ven un patrón de riesgo, aunque el APK
esté firmado y no contenga código malicioso. En 1.3 confluían varios factores:

1. El APK se instala fuera de Play Store y no tiene reputación acumulada.
2. La app declaraba `REQUEST_INSTALL_PACKAGES`, el permiso pensado para
   instalar otros APK.
3. La app descargaba un APK y abría el instalador del sistema
   (`NativeUpdater`), un patrón habitual en troyanos que se camuflan de
   actualizadores.
4. Si se instalaba el APK **debug** de los artefactos de Actions en lugar del
   APK **release** de la sección Releases, la firma era distinta y el riesgo
   aumentaba.

Play Protect no publica sus umbrales, así que no se puede garantizar al 100 %
que deje de advertir en una app distribuida fuera de la tienda. Lo que sí se
puede hacer es eliminar la superficie sensible y dejar el proceso de
actualización en manos del navegador y del instalador del sistema.

### 4.2 Cambios en la app

- Se retira `android.permission.REQUEST_INSTALL_PACKAGES` del manifiesto.
- Se elimina `NativeUpdaterPlugin.java` y su registro en `MainActivity.java`.
- Se elimina el `FileProvider` propio y `res/xml/file_paths.xml`, que solo
  existían para compartir el APK descargado. `FileOpener` sigue usando su
  propio provider para abrir documentos.
- «Buscar nueva versión» deja de descargar el APK. Consulta la última release y,
  si hay una más nueva, ofrece **abrir la descarga en el navegador**.
- La comprobación automática sigue existiendo como máximo una vez al día, pero
  solo avisa y abre el navegador; nunca instala nada por su cuenta.
- Se mantiene la firma histórica de release y el APK se sigue publicando como
  `bibliotech-scout.apk` en cada tag.

### 4.3 Cambios en el sitio

- Nueva sección visible **«Descargar la app Android»** (`id="app"`), enlazada
  desde el menú principal; se añadió `app` a `spyIds` en `app.js` para que el
  enlace se marque como activo al llegar al final de la página.
- Botón de descarga que apunta siempre al activo de la última release:
  `https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk`
- Pasos de instalación y explicación del aviso de Play Protect.
- Aviso claro de que solo se debe instalar el APK de **Releases**, no el
  artefacto debug de Actions.
- Estilos adaptados a móvil y escritorio, con foco visible y texto legible.

### 4.4 Versión y leyenda

- `package.json`: `version: "0.1.4"` y
  `versionLabel: "BETA V4.1 - 1.4 Mobile (10/11/2026)"`.
- `index.html` del sitio: el pie muestra
  `Base de datos: 03/11/2026 • BETA V4.1 - 1.4 Mobile (10/11/2026)`.
- `sync-web.mjs` vuelve a parchear la leyenda desde `package.json` al construir
  `www/`, para que no se desincronice.
- `www/app-build.json` guarda versión, commit del sitio, fecha de build y lista
  de recursos base.

## 5. Cómo se compila y publica

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
git tag v0.1.4
git push origin v0.1.4
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

## 6. Qué funciona ya

- Catálogo, preguntas y textos disponibles sin conexión desde el primer arranque.
- Primera pregunta sin conexión con espera a la inicialización completa.
- Mi biblioteca con descarga, progreso, apertura y borrado.
- Lector de PDF integrado con páginas, zoom y gestos.
- Visor de imágenes integrado.
- Actualización de contenido por ETag/Last-Modified y SHA del árbol de GitHub.
- Aviso de nueva versión con apertura de la descarga en el navegador.
- Portadas y recursos de interfaz dentro del APK.
- Firma estable entre `v0.1.0`, `v0.1.1`, `v0.1.2` y `v0.1.3`.
- Sección de descarga de la app en la web.

## 7. Validación realizada

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
- APK 1.3: 1,147 archivos en `assets/public`, 433 portadas, 8 recursos base, sin
  páginas de prueba.
- Firma 1.3: SHA-256 del certificado
  `8edff83b5e7b3271efedb4f9df2c96121d75ebf180c9e49576c6027f492282bd`.
- Falta probar en dispositivo real y validar el APK de la release 1.4.

## 8. Archivos clave

| Archivo | Responsabilidad |
| --- | --- |
| `scripts/sync-web.mjs` | Copia el sitio, portadas y recursos base; parchea versión; crea `www/` |
| `scripts/make-assets.mjs` | Genera icono y splash |
| `scripts/make-native-test.mjs` | Crea la página de prueba con el mock de Capacitor |
| `web-overlay/native-early.js` | Caché de contenido antes de `app.js` |
| `web-overlay/native-bridge.js` | Mi biblioteca, descargas, lectores, sync y aviso de updates |
| `web-overlay/native.css` | Estilos de la capa nativa |
| `web-overlay/native-mock.js` | Mock de Capacitor para probar en navegador |
| `android/.../MainActivity.java` | Registra `PdfViewerPlugin` |
| `android/.../PdfViewerPlugin.java` | Renderiza PDF con `PdfRenderer` |
| `android/app/src/main/AndroidManifest.xml` | Permisos (solo INTERNET) y activity |
| `.github/workflows/android.yml` | Compilación y release |

## 9. Validación pendiente antes de publicar

- Ejecutar el workflow de Android y confirmar que compila sin
  `NativeUpdaterPlugin`.
- Instalar el APK de **Releases** encima de `v0.1.3` con la misma firma.
- En dispositivo o emulador:
  - abrir Mi biblioteca desde el botón inferior izquierdo,
  - descargar un PDF,
  - abrirlo en el lector integrado,
  - cambiar de página, hacer zoom y volver,
  - descargar una imagen y abrirla,
  - borrar un archivo y comprobar el contador,
  - activar modo avión y hacer una pregunta,
  - actualizar contenido desde la pestaña App,
  - pulsar «Buscar nueva versión» y comprobar que abre el navegador,
  - confirmar si Play Protect sigue mostrando el aviso.
- Verificar que la barra rápida del sitio y el botón nativo no se solapan en
  pantallas de 360 px, 390 px y tablets.
- Verificar el enlace `releases/latest/download/bibliotech-scout.apk` desde la
  web publicada.

## 10. Estado del repositorio

- Rama de la app: `agent/opencode/mobile-1.4`, desde `origin/main` `c9bcb23`.
- Rama del sitio: `agent/opencode/mobile-1.4`, desde `origin/main` `cd8fb83`.
- `main` de la app en `c9bcb23`; `main` del sitio en `cd8fb83`.
- Última release: `v0.1.3`.
- Los cambios de 1.4 se están preparando en esta rama.

## 11. Siguientes pasos recomendados

1. Terminar la sección de descarga y los ajustes de versión 1.4.
2. Commit y PR en ambos repositorios; fusionar con squash.
3. Crear el tag `v0.1.4` y verificar la firma y la release.
4. Instalar el APK de Releases y comprobar si desaparece el aviso de Play
   Protect. Si sigue apareciendo, usar «Más detalles → Instalar de todos modos»
   solo con el APK oficial y reportar el falso positivo a Google.
5. Si en el futuro se quiere eliminar el aviso de forma definitiva, la vía es
   publicar en Play Store (o usar Play App Signing); no basta con cambiar el
   código.

## 12. Instrucciones para el siguiente agente

1. Lee `AGENTS.md` y este archivo.
2. Trabaja en una rama `agent/<agente>/<tema>`.
3. No edites a mano los JSON de `data/`; se generan en el repo del sitio.
4. No subas keystores ni contraseñas.
5. Mantén la capa nativa en `web-overlay/` y no modifiques `app.js` del sitio
   salvo que sea imprescindible; si lo haces, documenta el cambio aquí.
6. Prueba en navegador con el mock antes de pedir compilación.
7. No vuelvas a introducir `REQUEST_INSTALL_PACKAGES` ni un instalador interno:
   es justo lo que se retiró para reducir el aviso de Play Protect.
8. Actualiza este documento al terminar cada bloque.
