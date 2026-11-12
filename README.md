# BiblioTech Scout — App Oficial para Android (APK)

Aplicación oficial para **teléfonos y tablets Android** de **BiblioTech Scout**, diseñada para consultar manuales, reglamentos, progresiones, trámites y documentos oficiales del escultismo (ASMAC y World Scouting WOSM) incluso en campamentos y actividades sin acceso a internet.

- **Versión actual:** `2.3.1` (`versionCode 27`) — `2.3.1 Mobile - Web 8.4.1 (12/11/2026)`
- **Creador:** Liam Durán · Comunidad de Caminantes · Provincia Tláhuac-Xochimilco · **Contacto:** `rdc.tlxh@gmail.com`
- **Descarga oficial del APK:** [GitHub Releases (`bibliotech-scouts-app`)](https://github.com/ey-liam/bibliotech-scouts-app/releases/latest)

---

## 1. Convención de Versionado de 3 Dígitos (`MAJOR.MINOR.PATCH`)

Tanto el sitio web (`8.4.1`) como la aplicación Android (`2.3.1`) usan numeración semántica de tres dígitos:

- **Primer dígito (`X.0.0`):** Cambio mayor de arquitectura, plataforma o rediseño completo.
- **Segundo dígito (`X.Y.0`):** Nuevas funciones relevantes dentro de la app, integraciones nativas o ampliaciones importantes del catálogo/preguntas.
- **Tercer dígito (`X.Y.Z`):** Ajustes visuales, correcciones de errores, parches de estabilidad o actualizaciones menores de interfaz.

---

## 2. Comparación: Modo Claro vs Modo Oscuro en Android

La app adapta automáticamente sus superficies, tarjetas, tipografía y lector PDF al cambiar entre **Modo Claro** y **Modo Oscuro** desde el dock inferior (`Noche`) o la barra superior en tablets.

| Teléfono Android — Modo Claro | Teléfono Android — Modo Oscuro |
| :---: | :---: |
| ![App Android en teléfono Modo Claro](docs/screenshots/app-telefono-claro.png) | ![App Android en teléfono Modo Oscuro](docs/screenshots/app-telefono-oscuro.png) |

---

## 3. Vistas y Apartados Dentro de la App (Teléfono y Tablet)

| Apartado / Pantalla | Qué es y qué puedes hacer ahí | Captura |
| :--- | :--- | :---: |
| **Consultas Offline (`Buscador`)** | Pregunta cualquier duda scout o filtra por sección (*Manada*, *Tropa*, *Comunidad*, *Clan*, etc.) sobre las `13,516` preguntas y respuestas empaquetadas sin depender de datos móviles, con lectura en voz alta y citas documentales exactas. | ![Consulta offline en teléfono Android](docs/screenshots/app-consulta-movil.png) |
| **Mi Biblioteca — Explorar Catálogo** | Abre el gestor nativo desde el menú móvil o el botón flotante para buscar entre los `599` documentos, filtrar por categoría/subcategoría/sección y descargar archivos individuales o en bloques de `25` para llevarlos sin conexión. | ![Gestor de descargas offline en teléfono](docs/screenshots/app-panel-descargas.png) |
| **App y Estado (`OTA y Diagnóstico`)** | Verifica la versión instalada del APK, el commit web sincronizado, conectividad, cantidad de documentos guardados, actualización en segundo plano (`Actualizar web y contenido ahora`), revisión de APK nuevo y diagnóstico del banco offline. | ![Estado offline y verificación de datos en la app](docs/screenshots/app-estado-offline.png) |
| **Vista Adaptada para Tablet Android** | Aprovecha pantallas medianas y grandes con diseño de catálogo amplio, barra superior completa y panel gestor lateral/modal cómodo para consulta grupal o de dirigentes. | ![BiblioTech Scout APK en Tablet Android](docs/screenshots/app-tablet.png) |

*(Dentro del contenido de la app también dispones de **Biblioteca completa**, **Guía de Uso** con acordeones por tema, **Agentes de Cambio.MX**, **Secciones Scouts**, **Servicios y Trámites**, **Cambios en Esquemas** y **El Proyecto**).*

---

## 4. Funciones Exclusivas de la App Android (Modo Offline APK)

A diferencia de consultar la página web cuando requiere red constante, la **App Android (APK)** integra capacidades nativas específicas:

1. **Banco de `13,516` preguntas 100% sin conexión (`data/` empaquetado):** El buscador completo (`5,356` base, `101` `faq_v3`, `8,059` `faq_v4`, `110` entradas de base de conocimiento y `7,470` fragmentos de lectura) y las `599` portadas JPG viven dentro del APK desde el primer arranque.
2. **Descarga local persistente de hasta `599` documentos (`Mi biblioteca`):** Permite bajar PDFs, hojas Excel y documentos oficiales en almacenamiento interno mediante `@capacitor/filesystem`, seleccionando archivos uno por uno o en bloques de `25`.
3. **Lector PDF nativo integrado (`PdfViewerPlugin.java`):** Renderiza páginas nítidas con Android `PdfRenderer`, zoom continuo (`40%` a `250%`), modo pliego en tablets, salto rápido de página e inversión visual en Modo Noche sin depender de apps externas.
4. **Visor de hojas de cálculo Excel offline y exportación CSV:** Filtra tablas y exporta vistas directamente desde el almacenamiento interno de la app.
5. **Actualizaciones OTA atómicas de interfaz y contenido (`OtaUpdaterPlugin.java`):** Sincroniza en segundo plano mejoras del sitio web y nuevos archivos JSON sin perder tus PDFs ya descargados ni tus documentos marcados en **Guardados**.
6. **Guardados e historial local persistente:** Conserva documentos favoritos, historial de consultas recientes y notas locales entre sesiones.

---

## 5. Instalación Segura y Aviso de Google Play Protect

1. Descarga el archivo `bibliotech-scout.apk` (de la versión `v2.3.1` o la más reciente) únicamente desde la sección **Releases** de este repositorio. Puedes comprobar su integridad verificando el archivo `bibliotech-scout.apk.sha256` incluido en el mismo Release (`sha256sum -c bibliotech-scout.apk.sha256` o `Get-FileHash bibliotech-scout.apk`).
2. En **Ajustes** de Android, habilita temporalmente *Instalar aplicaciones desconocidas* para tu navegador o gestor de archivos.
3. **Aplicación segura y de código abierto:** Debido a que el APK se distribuye de forma directa y gratuita sin pasar por Google Play Store, Android puede mostrar inicialmente la ventana de revisión de **Google Play Protect**. Al pulsar **Analizar app**, Play Protect habitualmente verifica el paquete sin detectar riesgos ni mostrar alerta de inseguridad; si en algún dispositivo solicita confirmación adicional, selecciona *Más detalles → Instalar de todos modos*.
4. La aplicación **no** solicita permisos invasivos ni `REQUEST_INSTALL_PACKAGES` para instalar paquetes externos; solo usa almacenamiento interno privado para tus documentos descargados y acceso de red para descargas/actualizaciones.

---

## 6. Herramientas y Tecnologías Utilizadas

- **Contenedor Híbrido y Plugins:** **Capacitor 8** (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/filesystem`, `@capacitor/network`, `@capacitor/preferences`, `@capacitor/dialog`, `@capacitor/toast`, `@capacitor/browser`, `@capacitor-community/file-opener`).
- **Capa Nativa Android (`android/`):** **Java** + **Android SDK** (`MainActivity.java`, `PdfViewerPlugin.java` basado en `PdfRenderer`, `OtaUpdaterPlugin.java` con descarga atómica HTTP y cache de activos) y **Gradle**.
- **Interfaz y Overlay Móvil (`web-overlay/`):** `HTML5`, `CSS3`, `JavaScript (ES6+)` (`native-bridge.js`, sincronizado con la base de datos y estilos del sitio oficial `bibliotech-scouts`).
- **Automatización y Compilación:** **Node.js** (`scripts/sync-web.mjs` con minificación `esbuild` en el overlay) y **GitHub Actions** (`.github/workflows/android.yml`) para validar código, activar optimización **R8 / ProGuard** en release, firmar el APK, publicar su huella `SHA-256` (`bibliotech-scout.apk.sha256`) y generar el Release al etiquetar una nueva versión (`vX.Y.Z`).

---

## 7. Novedades de la Versión `2.3.1`

- **Telemetría conectada al Worker de Cloudflare (`8.4.1` / `v2.3.1`) con respaldo automático:** envía el resumen de actividad y errores JS al Worker gratuito con respaldo automático a `FormSubmit`.
- **Verificación de integridad `SHA-256` automática en Releases:** cada publicación compila y adjunta `bibliotech-scout.apk.sha256` junto al APK firmado.
- **Optimización de compilación y bundle:** activado `minifyEnabled true` y `shrinkResources true` en Gradle Release con reglas ProGuard para Capacitor y plugins nativos; limpieza de PNGs duplicados y minificación `esbuild` tanto del sitio base (`Web 8.4.1`) como del overlay nativo (`native-bridge.js`, `native-early.js`, `native.css`).
- **Validaciones CI en GitHub Actions:** verificación previa de sintaxis JS y comprobación automática de que `www/` no incluya archivos de prueba antes de empaquetar.
