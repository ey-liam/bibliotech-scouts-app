# BiblioTech Scout — Documento Maestro de Traspaso y Arquitectura del Sistema
**Para:** Gemini Argon 4 / Próximos Desarrolladores y Agentes  
**Fecha de corte:** 11 de Noviembre de 2026  
**Versión actual del ecosistema:** BETA V7 (Web) · Mobile 2.1.1 (Android)  
**Autor y Creador Exclusivo:** Liam Durán — Provincia TLXH (Instagram: [@liaadurg3](https://www.instagram.com/liaadurg3/))  
**Repositorio Web:** `https://github.com/ey-liam/bibliotech-scouts`  
**Repositorio App Android:** `https://github.com/ey-liam/bibliotech-scouts-app`  
**Sitio Web Público:** `https://ey-liam.github.io/bibliotech-scouts/`  
**APK Oficial Release:** `https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk`  

---

## 1. Reglas Fundamentales del Proyecto (¡Lectura Obligatoria!)

Antes de modificar cualquier archivo o realizar un commit, ten siempre presentes estas directrices estrictas definidas por Liam:

1. **Autoría y Colaboradores Exclusivos:**
   - En **todos** los commits, PRs, `README.md`, licencias, créditos de interfaz y metadatos de GitHub, el único autor y creador reconocido es **Liam Durán** (`ey-liam`, correo verificado: `rdc.tlxh@gmail.com` / `liamchuchundra1@gmail.com`).
   - **Bajo ninguna circunstancia** se debe listar a agentes de IA (como OpenCode, Antigravity, Gemini o Claude) como autores o colaboradores en GitHub ni en la web.
   - Las ramas de trabajo `agent/...` son únicamente convenios técnicos temporales; **siempre** deben fusionarse a `main` utilizando `--squash` y eliminando la rama para mantener el historial limpio y con un solo contribuidor.
2. **Cero Emojis en Código y Menús:**
   - No se deben utilizar emojis gráficos en ninguna parte del código fuente, menús, textos, títulos de botones ni etiquetas. Únicamente se permiten iconos SVG vectoriales limpios y accesibles con atributos ARIA.
3. **Privacidad y Documentos Sensibles:**
   - El acervo documental de BiblioTech Scout está compuesto únicamente por publicaciones, manuales, reglamentos, carnets y documentos de dominio público e institucional de la Asociación de Scouts de México, A.C. (ASMAC) y World Scouting (WOSM).
   - **Jamás** se deben indexar ni subir documentos personales, consentimientos médicos, formatos con datos privados ni fotografías familiares de carpetas locales como `SCOUTS DOCUMENTOS`.
4. **Sincronización Simultánea:**
   - Cualquier cambio realizado en la lógica web, estilos o base de datos de `bibliotech-scouts` debe replicarse o sincronizarse de inmediato en `bibliotech-scouts-app` ejecutando `npm run sync:web` y `npx cap sync android`.
5. **Idioma y Tono:**
   - Todo el contenido de cara al usuario está redactado en español latinoamericano, con un tono cercano, scout y fraterno.

---

## 2. Resumen del Trabajo Conjunto: OpenCode + Antigravity

El desarrollo actual de BiblioTech Scout es el resultado de un trabajo coordinado entre dos agentes bajo la dirección de Liam:

### Aportes de OpenCode
* **Diagnóstico de Play Protect en Android:** Investigó las causas por las que Google Play Protect marcaba alertas heurísticas en el APK sideloaded.
* **Eliminación de permisos y código riesgoso:**
  - Retiró el permiso `android.permission.REQUEST_INSTALL_PACKAGES` de `AndroidManifest.xml`.
  - Eliminó por completo el plugin `NativeUpdaterPlugin.java`, su registro en `MainActivity.java`, y su `FileProvider` dedicado.
  - Redirigió el sistema de actualización para que «Buscar actualización» consulte la última release de GitHub y abra la descarga del APK directamente en el navegador del teléfono.
* **Sección de Descarga en el Sitio Web:** Creó la sección `#app` («Lleva BiblioTech Scout en tu bolsillo») con instrucciones de instalación y advertencias sobre Play Protect.
* **Prototipos de Motor de Respuestas:** Diseñó scripts de evaluación semántica local con stopwords y sinónimos para generar respuestas directas sin depender de APIs de IA de pago.

### Aportes de Antigravity
* **Hero V7 (Portada Inclinada Estilo Jamboree 2027):**
  - Diseñó el gran banner dinámico inclinado (`rotate(-2deg)`) con tipografía bold display (`BiblioTech Scout`) en la paleta azul-morada del proyecto, cinta horizontal de fondo (`.hero-band`), iconos scout en esquinas y subtítulo oficial de Liam Durán.
  - Reestructuró el contenido inicial en dos columnas: descripción del sitio con estadísticas (`5,451 preguntas`, `498 documentos`, `104 temas`) y escenario fotográfico de la Comunidad de Caminantes.
* **Sustitución de «Mochila» por «Guardados» con Cookies y LocalStorage Híbrido:**
  - Retiró el sistema antiguo de mochila que presentaba fallos en PWA/iOS.
  - Implementó persistencia híbrida en `document.cookie` y `localStorage` (`bt_saved_docs` y `bt_note_`), asegurando que los documentos guardados y las notas persistan de forma confiable entre sesiones.
  - Diseñó el modal / bottom sheet `#savedPanel` para consultar, abrir en el lector o eliminar guardados y sus notas personales.
* **Dock Inferior Unificado Claro y Acceso a Modo Noche:**
  - Rediseñó `.bt-unified-dock` con fondo claro frosted glass (`rgba(255, 255, 255, 0.94)`), sombras suaves e iconos legibles.
  - Ocultó el dock en PC (`min-width: 921px`) para mantener la pantalla limpia en escritorio.
  - Añadió el botón `#dockBtnNight` con atributo `aria-pressed` para activar/desactivar instantáneamente el modo campamento / noche OLED desde la barra inferior en móvil y tablet.
* **Ajuste de Botón de Descargas en la App Móvil:**
  - Eliminó la inyección del botón redundante de descargas en la cabecera superior, conservando únicamente el botón flotante inferior izquierdo (`.bt-fab`).
* **Visualización Directa de Documentos PDF en Web Pública:**
  - Corrigió `buildFileUrl` para evitar referencias relativas a carpetas locales inexistentes (`files/`), apuntando limpiamente a los assets de GitHub Releases (`https://github.com/ey-liam/bibliotech-scouts/releases/download/v1.0/${sha12}.pdf`).
  - Integró el visor de Google Docs Viewer en el iframe del lector y en el botón «Abrir en pestaña», permitiendo leer el PDF visual original con todas sus páginas, tablas e ilustraciones sin caídas forzadas a texto plano.
* **Controles de Zoom en el Lector:**
  - Añadió botones de `Zoom -` y `Zoom +` en la barra de herramientas del lector para ajustar cómodamente la escala del documento en tablets y teléfonos.
  - Habilitó soporte de lectura a 2 columnas para modo horizontal / landscape en tablets (`.modal-text-pane`).
* **Restauración y Enriquecimiento de Agentes de Cambio.MX:**
  - Restauró la redacción oficial del CNRC y la estructura de los 4 Ejes Temáticos con sus iconos circulares limpios (`salud.png`, `habilidades.png`, `sustentabilidad.png`, `paz.png`).
  - Reintegró los chips de preguntas sugeridas conectadas al buscador documental inteligente.
  - Añadió los enlaces directos de contacto al correo `cnrc@scouts.org.mx` e Instagram `@RNC.MX`.
  - Agregó el enlace al Instagram del creador Liam Durán (`@liaadurg3`).

---

## 3. Arquitectura Técnica de los Repositorios

### Repositorio Web: `ey-liam/bibliotech-scouts`
* **`index.html`**: Estructura principal accesible, semántica, con SVGs embebidos y cero emojis gráficos. Contiene el Hero V7, buscador, catálogo por sección, biblioteca de 498 documentos, acerca del autor, Agentes de Cambio.MX, lector interactivo modal (`#docModal`), panel de guardados (`#savedPanel`) y dock inferior (`#unifiedBottomDock`).
* **`styles.css`**: Hoja de estilos responsiva, con variables temáticas scout, glassmorphism, transformaciones 3D, modo campamento / noche OLED (`html[data-camp-mode="true"]`), dock claro y animaciones de resorte (`--spring-bounce`).
* **`app.js`**: Motor de la aplicación web:
  - Base de datos en memoria (`STATE.documents`, `STATE.questionBank`, `STATE.webChunks`).
  - Motor de respuestas semánticas locales con similitud de n-gramas, stopwords y extracción de fragmentos.
  - Gestor de guardados híbrido (cookies + `localStorage`).
  - Control de audio TTS (`speechSynthesis`).
  - Lector interactivo con visor PDF embebido, pestañas de texto extraído y buscador interno con resaltado.
* **`data/catalog.json`**: Catálogo completo de 650 documentos (498 libros/manuales oficiales descargables), con metadatos de categoría, sección, año, páginas, sinopsis y hash SHA12.
* **`data/text/`**: 650 archivos de texto plano indexados por hash SHA12 para lectura rápida y motor de búsqueda sin conexión.
* **`covers/`**: 433 portadas de libros y manuales oficiales en formato JPG optimizado.

### Repositorio App Android: `ey-liam/bibliotech-scouts-app`
* **`web-overlay/native-bridge.js`**: Puente Capacitor que intercepta peticiones, gestiona almacenamiento local con `@capacitor/filesystem`, abre el visor nativo de Android (`PdfViewerPlugin`) y sincroniza con el dock y el panel de descargas.
* **`android/app/src/main/java/mx/bibliotechscout/app/PdfViewerPlugin.java`**: Plugin nativo para renderizar páginas de PDF en bitmaps en alta definición utilizando `PdfRenderer` de Android.
* **`scripts/sync-web.mjs`**: Script de sincronización automática que copia el contenido de `bibliotech-scouts` a `www/`, inyecta los overlays nativos y ajusta los metadatos de versión.

---

## 4. Instrucciones para Gemini Argon 4

1. **Mantener autoría única de Liam:** Todo cambio debe atribuirse a Liam Durán (`rdc.tlxh@gmail.com`).
2. **Respetar cero emojis:** Usar exclusivamente SVGs limpios en código y menús.
3. **No exponer datos personales:** Mantener fuera de los repositorios documentos privados, médicos o familiares.
4. **Sincronizar siempre:** Ejecutar `npm run sync:web` y `npx cap sync android` después de editar la web.
5. **Seguridad y Play Protect:** Evitar permisos invasivos en Android y mantener la descarga de actualizaciones vía navegador.
