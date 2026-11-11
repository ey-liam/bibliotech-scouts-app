# BiblioTech Scout — App Android

Aplicación Android (teléfonos y tablets) de **BiblioTech Scout**. Envuelve el sitio
oficial con Capacitor y añade funciones que el navegador no puede dar: biblioteca
sin conexión, lector de PDF integrado, gestor de archivos descargados y aviso de
nuevas versiones con descarga desde GitHub Releases.

- Sitio: <https://ey-liam.github.io/bibliotech-scouts/>
- App: este repositorio
- Paquete Android: `mx.bibliotechscout.app`
- Versión actual: `2.2.3` — `V2.2.3 Mobile - Web V7.1 (11/11/2026)`
- Creador: Liam Durán - Provincia TLXH (Instagram: [@liaadurg3](https://www.instagram.com/liaadurg3/))
- Sitio de referencia: `ey-liam/bibliotech-scouts`

## Capturas de pantalla y uso en teléfono

| Inicio en la App con Dock Inferior | Consulta Offline (Ejes y Metodologías) | Panel Nativo y Verificación de Datos |
| :---: | :---: | :---: |
| ![Inicio móvil de BiblioTech Scout App](docs/screenshots/app-inicio-movil.png) | ![Consulta de Ejes Temáticos en la app](docs/screenshots/app-consulta-movil.png) | ![Estado offline verificado en v2.2.3](docs/screenshots/app-estado-offline.png) |

**Cómo usar la app:**
1. En la parte inferior dispones del dock flotante con acceso rápido a **Inicio**, **Consultar**, **Biblioteca**, **Agentes**, **Guardados** y **Noche** (modo oscuro).
2. Puedes buscar entre **12,264 preguntas y respuestas oficiales sin conexión** (incluidos proyectos SMART, PPV del Clan de Rovers, ciclo PER, Ejes Temáticos, las 18 Especialidades FES de Comunidad, 46 plantillas RECME/CNAMS, Help Desk SISAS/CONECTA, Reglamento 2023 y Manual del Uniforme junio 2026).
3. El botón flotante **Descargas** (en la esquina inferior izquierda) y el acceso del menú abren **Mi biblioteca**, donde puedes:
   - Consultar los PDFs, guías HTML autónomas e imágenes ya guardados sin internet con los lectores integrados.
   - Explorar los **599 documentos oficiales accesibles** (de **751** totales en catálogo) filtrando por sección, **11 categorías y sus subcategorías**, o descargar los que necesites.
   - Entrar a **App y estado** para comprobar tus 5 bancos de preguntas sin conexión o buscar actualizaciones automáticas al instante.

## Novedades de la Versión 2.2.3 (Acervo RECME/FES/Help Desk, Subcategorías y Lector HTML Offline)

- **Acervo RECME, Especialidades FES y Help Desk Sin Conexión (12,264 Preguntas):** Incorpora **65 nuevos PDFs canónicos** (18 FES Comunidad, 46 plantillas P1–P10 de Diagnóstico/Evaluación/Mapas/FAES/Insignia Final Obsidiana y Jade/CNAMS y Formato de Proyecto v1.1), **32 guías HTML autónomas** (25 guías Help Desk SISAS/CONECTA con capturas embebidas, directorio de 11 departamentos, instructivos Genially *Masterchefsito* y *Primer Respondiente Junior*, y catálogos RECME) y **4 emblemas oficiales**, sumando **6,807 preguntas en `faq_v4.json`** (10 a 30 por cada PDF nuevo).
- **Lector HTML Integrado Offline:** Los documentos HTML autónomos descargados en **Mi biblioteca** se abren directamente dentro de la app (`#bt-html-viewer`) sin depender de apps externas ni conexión.
- **Filtro por 11 Categorías y Subcategorías en Mi Biblioteca:** Nuevo selector dinámico de **Categoría** y **Subcategoría** en *Explorar catálogo* replicando la estructura completa de la web.
- **Auto-actualización Web y de Contenido (OTA sin re-instalar APK):** Incorpora `OtaUpdaterPlugin` y `OtaWebViewClient` en Java para actualizar base de datos e interfaz web en segundo plano con verificación de integridad y reversión automática.
- **Compatibilidad Total de Modo Oscuro y Estabilidad:** Modo oscuro limpio de alto contraste con sincronización completa de versiones y recursos empaquetados (504 portadas).

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
- **Mi biblioteca y descargas.** Panel integrado con la interfaz y accesible desde el botón flotante en la esquina inferior izquierda y desde el menú lateral:
  - **Mis descargas:** tus documentos guardados en tarjetas claras con formato, sección, peso y botones directos de «Abrir» y «Borrar».
  - **Explorar catálogo:** los 650 documentos oficiales disponibles para descargar, con búsqueda rápida, filtro por sección y descarga por lotes.
  - **App y estado:** versión, contenido del sitio, estado de conexión, actualización de contenido y verificación de datos sin conexión.
- **Lector de PDF integrado.** Los PDF descargados se abren dentro de la app con
  `PdfRenderer`, sin internet ni apps externas. Incluye navegación de páginas,
  modo de 2 páginas (pliego tipo libro) en horizontal y tablets con ajuste
  perfecto a pantalla, zoom desde 40 % hasta 250 %, deslizamiento táctil y botón Atrás.
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
contenido web resultante pesa unos 68.5 MB.

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

### Auto-actualización de web y contenido (sin publicar APK)

La app revisa automáticamente cada 2 horas (cuando hay conexión) o al pulsar **Mi biblioteca → App → Actualizar web y contenido ahora**:

- **Capa web (`index.html`, `styles.css`, `app.js`):** Si detecta cambios mediante ETag, descarga el paquete nuevo a `ota_staging/`, parchea el HTML conservando la capa nativa, verifica su integridad y lo aplica atómicamente en `ota_active/` mediante `OtaUpdaterPlugin` y `OtaWebViewClient` (incluye reversión automática de seguridad ante fallos y limpieza automática si se instala un APK nuevo).
- **Datos y textos (`data/*.json` y `data/text/**`):** Actualiza `catalog.json`, `questions_bank.json`, `knowledge_base.json`, `chunks.json`, `faq_v3.json` y `faq_v4.json` mediante ETag en Cache Storage, más los textos modificados desde GitHub.

### Actualización nativa del APK

Al abrir la app (como máximo una vez cada 12 horas) se consulta `releases/latest`. Si hay una versión nativa mayor (por ejemplo cambios en Java, plugins o permisos):

1. Se muestra un aviso con las notas de la release.
2. Al aceptar, se abre en el navegador la descarga directa del APK más reciente.
3. El usuario descarga el archivo y lo abre desde el navegador o la carpeta de descargas.
4. Android pide permiso para instalar apps desconocidas la primera vez y abre su instalador. Instalar encima conserva todos los documentos descargados.

También se puede entrar a **Mi biblioteca → App → Buscar actualización de APK** o usar el enlace de descarga de este README.

## Estructura

| Ruta | Qué contiene |
| --- | --- |
| `scripts/sync-web.mjs` | Copia el sitio, portadas y recursos base; parchea la versión e inyecta la capa nativa |
| `scripts/make-assets.mjs` | Genera icono y splash desde `img/icon-512.png` |
| `scripts/make-native-test.mjs` | Crea la página de prueba con el mock de Capacitor |
| `web-overlay/native-early.js` | Usa la caché de contenido antes de que arranque `app.js` |
| `web-overlay/native-bridge.js` | Mi biblioteca, descargas, lector PDF, auto-actualización OTA e integración nativa |
| `web-overlay/native.css` | Estilos del panel, botón flotante, banner OTA y visores |
| `web-overlay/native-mock.js` | Mock de Capacitor para probar en navegador |
| `android/` | Proyecto Android generado por Capacitor |
| `android/app/src/main/java/mx/bibliotechscout/app/MainActivity.java` | Registra `PdfViewer` y `OtaUpdater` e intercepta recursos OTA locales |
| `android/app/src/main/java/mx/bibliotechscout/app/OtaUpdaterPlugin.java` | Gestor atómico y seguro de actualizaciones web OTA con rollback |
| `android/app/src/main/java/mx/bibliotechscout/app/PdfViewerPlugin.java` | Renderiza páginas de PDF con `PdfRenderer` |
| `.github/workflows/android.yml` | Compilación y publicación |

## Limitaciones conocidas

- El APK se distribuye directamente (no Play Store), así que Android muestra el
  aviso de «instalar apps desconocidas» y Play Protect puede advertir que la app
  es desconocida o «posiblemente dañina». La app no solicita `REQUEST_INSTALL_PACKAGES` ni pide instalar otros APK;
  instala siempre el archivo de **Releases** y nunca el APK debug de Actions.
- DOCX, XLSX y PPTX necesitan una app compatible instalada; el lector propio solo
  cubre PDF e imágenes.
- Las galerías completas de `assets/` requieren internet. Los recursos de la
  interfaz y las portadas sí están incluidos en el APK.
- Cambios en la interfaz web (`index.html`, `styles.css`, `app.js`) y contenido
  (`data/**`) ahora se actualizan automáticamente en segundo plano; solo cambios en código nativo Android/Capacitor requieren publicar un nuevo APK.
- La app no sustituye al sitio: el sitio sigue siendo la fuente de contenido y
  metadatos.
- No se editan a mano los JSON de `data/`; se generan en el repositorio del sitio.
