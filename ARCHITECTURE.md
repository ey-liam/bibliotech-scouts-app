# Arquitectura y Traspaso Técnico — BiblioTech Scout App Android

\	ext
/* ============================================================================
 * DOCUMENTO MAESTRO UNIFICADO DE ARQUITECTURA, PROTOCOLO Y TRASPASO INTERNO
 * (Consolidación íntegra de AGENTS.md [Web y App], GEMINI.md,
 *  .github/copilot-instructions.md, TRASPASO.md y TRASPASO_GEMINI_ARGON.md)
 * ============================================================================
 *
 * Para: Próximos desarrolladores y agentes de IA
 * Fecha de corte: 12 de Noviembre de 2026
 * Versión actual del ecosistema: BETA 8.3.1 (Web) - 2.2.16 Mobile (Android)
 * Autor y Creador Exclusivo: Liam Durán - Provincia TLXH
 * Sitio Web Público: https://ey-liam.github.io/bibliotech-scouts/
 * Repositorio Web: https://github.com/ey-liam/bibliotech-scouts (rama main)
 * Repositorio App Android: https://github.com/ey-liam/bibliotech-scouts-app
 * Paquete Android: mx.bibliotechscout.app
 * APK Oficial Release: https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk
 *
 * ----------------------------------------------------------------------------
 * 1. OBJETIVO Y REGLAS FUNDAMENTALES (LECTURA OBLIGATORIA)
 * ----------------------------------------------------------------------------
 * BiblioTech Scout es un sitio estático (HTML, CSS y JavaScript sin compilación)
 * publicado con GitHub Pages y acompañado por su app Android en Capacitor 8.
 * Su prioridad es que cualquier persona pueda consultar y descargar
 * documentación oficial de ASMAC y WOSM de forma clara, rápida y accesible.
 *
 * Reglas estrictas del proyecto:
 * 1. Autoría y Colaboradores Exclusivos:
 *    - En todos los commits, PRs, README.md, licencias, créditos de interfaz y
 *      metadatos de GitHub, el único autor y creador reconocido es Liam Durán
 *      (ey-liam, correo verificado: rdc.tlxh@gmail.com / liamchuchundra1@gmail.com).
 *    - Bajo ninguna circunstancia se debe listar a agentes de IA (OpenCode,
 *      Antigravity, Gemini, Claude o Copilot) como autores o colaboradores en
 *      GitHub ni en la web.
 *    - Una tarea = una rama = un pull request. No trabajar directo en main.
 *      Nombres de rama: agent/opencode/<tema>, agent/gemini/<tema>,
 *      agent/copilot/<tema> o human/<tema>. Siempre fusionar a main con
 *      --squash y eliminar la rama para conservar un historial limpio.
 * 2. Cero Emojis en Código y Menús:
 *    - No utilizar emojis gráficos en ninguna parte del código fuente, menús,
 *      textos, títulos de botones, commits ni etiquetas. Únicamente iconos SVG
 *      vectoriales limpios y accesibles con atributos ARIA.
 * 3. Privacidad, Seguridad y Documentos Sensibles:
 *    - El acervo documental se compone únicamente de publicaciones, manuales,
 *      reglamentos, carnets y documentos públicos e institucionales de ASMAC y
 *      World Scouting (WOSM).
 *    - Jamás indexar ni subir documentos personales, consentimientos médicos,
 *      formatos con datos privados ni fotografías familiares de carpetas
 *      locales como SCOUTS DOCUMENTOS.
 *    - No subir tokens, contraseñas, keystores, archivos .env ni service.json.
 *      El MCP de GitHub obtiene el token de gh en tiempo de ejecución y la firma
 *      del APK usa secretos de GitHub Actions.
 * 4. Prohibición de Edición Manual de JSON Generados y Rigor Documental:
 *    - No editar a mano data/catalog.json, data/knowledge_base.json,
 *      data/questions_bank.json, data/faq_v3.json, data/faq_v4.json ni
 *      data/chunks.json. Todos salen de scripts generadores.
 *    - No inventar información documental: las respuestas deben salir únicamente
 *      de los documentos oficiales y de la base de conocimiento del proyecto.
 * 5. Sincronización Antes de Editar y entre Web y App:
 *    - Antes de empezar: git fetch origin y actualizar la rama desde
 *      origin/main (git rebase origin/main o git merge origin/main).
 *    - Cualquier cambio en la lógica web, estilos o base de datos de
 *      bibliotech-scouts debe sincronizarse en bibliotech-scouts-app con
 *      npm run sync:web y npx cap sync android.
 * 6. Cambios Pequeños, Respeto al Trabajo Ajeno y Accesibilidad:
 *    - Evitar PRs gigantes que mezclen datos, diseño y lógica.
 *    - Si un archivo tiene cambios ajenos, investigarlos antes de reemplazar.
 *    - Accesibilidad y rendimiento no son opcionales: cada cambio debe mantener
 *      o mejorar el resultado de Lighthouse, sin quitar alt, ARIA ni enlace de
 *      salto al contenido.
 * 7. Precaución con Scripts de Copia Masiva en Copia Local (Antigravity/Gemini):
 *    - En C:\Users\liamc\.gemini\antigravity\scratch\bibliotech-scouts\ existen
 *      public/ (fuente de scripts de generación) y dist_web/ (clon git).
 *    - prepare_public_site.py copia public/ sobre dist_web/. No ejecutar
 *      prepare_public_site.py, actualizar_bibliotech.bat ni PUBLICAR_WEB.bat
 *      mientras otro agente esté editando el sitio, y nunca antes de sincronizar
 *      index.html, styles.css, app.js, img/ y assets/ desde main hacia public/.
 * 8. Reglas Adicionales de la App Android (bibliotech-scouts-app):
 *    - Los cambios de interfaz nativa van en web-overlay/; no modificar app.js
 *      del sitio salvo necesidad justificada.
 *    - Si cambia el contrato con el sitio (rutas de datos, files/, catálogo),
 *      actualizar web-overlay/native-bridge.js y el README.
 *    - Cada cambio debe compilar en el workflow de Android antes de fusionarse.
 * 9. Idioma y Tono:
 *    - Contenido de cara al usuario redactado en español latinoamericano, con
 *      tono cercano, scout y fraterno.
 *
 * ----------------------------------------------------------------------------
 * 2. MAPA DE ARCHIVOS Y ARQUITECTURA DE AMBOS REPOSITORIOS
 * ----------------------------------------------------------------------------
 *
 * A) Repositorio Web (ey-liam/bibliotech-scouts):
 * - index.html (editable con cuidado): Estructura semántica y accesible con SVGs
 *   embebidos. Hero V7, buscador, catálogo por sección, biblioteca de 498
 *   documentos, propósito/autor, Agentes de Cambio.MX, sección #app, lector
 *   interactivo modal (#docModal), panel de guardados (#savedPanel) y dock
 *   inferior (#unifiedBottomDock).
 * - styles.css (editable): Diseño responsivo, variables CSS temáticas scout,
 *   aurora animada, glassmorphism, transformaciones 3D, estilos cósmicos, modo
 *   campamento / noche OLED (html[data-camp-mode="true"]), dock claro y
 *   animaciones de resorte (--spring-bounce).
 * - app.js (editable): Motor principal: estado, buscador, lector, audio TTS
 *   (speechSynthesis), gestor de guardados híbrido y carga de datos.
 * - manifest.webmanifest / 404.html / sw.js: Manifiesto PWA, redirección de
 *   GitHub Pages y Service Worker.
 * - data/catalog.json (NO editar a mano): Catálogo curado de 650 documentos
 *   (498 libros/manuales descargables), con título, año, sección, categoría,
 *   páginas, sinopsis y hash SHA-12.
 * - data/knowledge_base.json (NO editar a mano): Base enciclopédica estructurada
 *   (110 temas).
 * - data/questions_bank.json, data/faq_v3.json y data/faq_v4.json (NO editar a
 *   mano): Banco combinado de 11,254 preguntas y respuestas únicas (5,356 base,
 *   101 V3 [primeros auxilios, uniforme, Agentes de Cambio] y 5,797 V4 generadas
 *   con scripts/generate_faq_v4.js). La ampliación V4 añade tres capas:
 *   convocatorias (dirigido a, sede, fechas, cuotas, requisitos, contacto y
 *   modalidad), formatos/actas/seguro (asunto, datos solicitados, autorizaciones
 *   y orden del día) y menciones textuales con página y cita, además de podar
 *   cortes arbitrarios y limpiar encabezados/membretes en resumen().
 * - data/chunks.json (NO editar a mano): Fragmentos textuales indexados para
 *   búsqueda profunda por términos.
 * - data/text/ (NO editar a mano): 650 archivos de texto plano indexados por
 *   su hash SHA-12 (<sha12>.txt) para lectura rápida y motor offline.
 * - covers/: 433 portadas de libros y manuales en formato JPG (<sha12>.jpg).
 * - img/ y assets/: Logotipos e imágenes optimizadas (incluido Liam.png APNG,
 *   Liam.webp estático, LiamFondo.jpg y assets/scouts/agentes_cambio/ para CNRC).
 * - README.md: Presentación pública y guía de uso del proyecto.
 *
 * Funcionamiento del Motor de Respuestas en app.js:
 * 1. Carga en paralelo y diferida de catalog.json, questions_bank.json,
 *    faq_v3.json, faq_v4.json, knowledge_base.json y chunks.json.
 * 2. Normalización de consultas eliminando acentos, signos y caracteres
 *    especiales (normalizeQuestionKey).
 * 3. Búsqueda por 3 capas:
 *    - Capa 1 (Coincidencia exacta / normalizada): Respuesta directa del banco
 *      con documento oficial citado.
 *    - Capa 2 (Coincidencia difusa y palabras clave): Evalúa similitud léxica,
 *      n-gramas, stopwords y sinónimos en el banco de preguntas y knowledge base.
 *    - Capa 3 (Fragmentos de documentos - chunks.json): Localiza los párrafos
 *      más relevantes en manuales y estatutos citando página y documento.
 * 4. Respuesta transparente: Si un dato no existe en documentos oficiales
 *    cargados, el motor lo indica sin inventar ni alucinar datos.
 *
 * B) Repositorio App Android (ey-liam/bibliotech-scouts-app):
 * Envuelve el sitio web utilizando Capacitor 8 e inyecta una capa nativa:
 * - package.json: Versión 2.2.16 y versionLabel "2.2.16 Mobile - Web 8.3.1 (12/11/2026)".
 * - scripts/sync-web.mjs: Clona o toma ../bibliotech-scouts como fuente hacia
 *   www/, copia index.html, styles.css, app.js, manifest.webmanifest, data/,
 *   img/, covers/ y BASE_ASSETS; parchea la leyenda del pie desde package.json;
 *   inyecta native-early.js en <head>, native.css y native-bridge.js al final;
 *   y genera www/app-build.json.
 *   Lista exacta BASE_ASSETS (15 recursos empaquetados sin galerías de 66 MB):
 *     assets/Liam.png, assets/Liam.webp, assets/LiamFondo.jpg,
 *     assets/scouts/logo_biblioteca_centenario.png,
 *     assets/scouts/foto_secciones_nac.png, assets/scouts/foros_extra_2.jpg,
 *     assets/scouts/foros_evento_3.jpg, assets/scouts/wosm_photo2.jpg,
 *     assets/scouts/agentes_cambio/AgentesDeCambioLogo.png,
 *     assets/scouts/agentes_cambio/Salud.png,
 *     assets/scouts/agentes_cambio/Habilidades.png,
 *     assets/scouts/agentes_cambio/Sustentabilidad.png,
 *     assets/scouts/agentes_cambio/Paz.png,
 *     assets/scouts/agentes_cambio/LetreroCNRC.png,
 *     assets/scouts/agentes_cambio/Logos.png.
 * - scripts/make-assets.mjs: Genera iconos adaptativos y splash desde img/icon-512.png.
 * - scripts/make-native-test.mjs: Crea native-test.html con mock para probar
 *   la capa nativa en navegador sin incluir páginas de prueba en el APK.
 * - web-overlay/native-early.js: Script en <head> para interceptar fetch y
 *   servir caché offline / actualizaciones OTA antes de arrancar app.js.
 * - web-overlay/native-bridge.js: Orquestador de Mi biblioteca, descargas con
 *   @capacitor/filesystem, visor PDF nativo, actualización OTA web/datos y
 *   verificación de versión APK contra releases/latest de GitHub.
 * - web-overlay/native.css: Estilos del botón flotante inferior izquierdo,
 *   modal de descargas, banner OTA y visores nativos.
 * - android/app/build.gradle: Configuración Android (applicationId
 *   mx.bibliotechscout.app, versionName 2.2.16, versionCode 25 y compilación
 *   sobreescrita en tag vía APP_VERSION_NAME / APP_VERSION_CODE).
 * - android/app/src/main/AndroidManifest.xml: Permiso único
 *   android.permission.INTERNET (sin REQUEST_INSTALL_PACKAGES).
 * - android/app/src/main/java/mx/bibliotechscout/app/:
 *   - MainActivity.java: Registra PdfViewerPlugin y OtaUpdaterPlugin e
 *     intercepta recursos locales activos OTA mediante WebViewClient.
 *   - PdfViewerPlugin.java: Renderiza páginas PDF en HD con android.graphics.pdf.PdfRenderer.
 *   - OtaUpdaterPlugin.java: Gestor atómico de staging/promoción/rollback OTA.
 * - .github/workflows/android.yml: Compila en Node 22 + Java 21 + Android SDK 36;
 *   en push/PR genera apk debug de prueba; en tags v<semver> firma con keystore de
 *   GitHub Secrets (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD,
 *   ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD) y publica bibliotech-scout.apk.
 *
 * ----------------------------------------------------------------------------
 * 3. HISTORIAL TÉCNICO CONSOLIDADO DE APORTES (OPENCODE + ANTIGRAVITY)
 * ----------------------------------------------------------------------------
 * Evolución coordinada bajo la dirección de Liam Durán:
 * - Diagnóstico y mitigación de Play Protect en Android (OpenCode):
 *   Retiro de android.permission.REQUEST_INSTALL_PACKAGES, eliminación completa
 *   de NativeUpdaterPlugin.java, su registro en MainActivity.java y su
 *   FileProvider; actualización redirigida al navegador mediante GitHub Releases
 *   latest; creación de sección #app en la web con guía de instalación e
 *   indicaciones de seguridad; y prototipos de motor de respuestas directas con
 *   stopwords y sinónimos sin APIs externas.
 * - Lectura, Biblioteca Móvil y V5/V6 (Antigravity):
 *   - Botón único de descargas: eliminación de #bt-header-btn redundante,
 *     centralizado en #bt-offline-fab (esquina inferior izquierda) y
 *     #bt-nav-downloads en el menú lateral.
 *   - Zoom y pliego en tablets: eliminación del límite Math.max(1, ...) para
 *     permitir zoom de 40% (0.4) hasta 250% (2.5) y soporte de lectura en pliego
 *     de 2 páginas lado a lado en modo horizontal/tablets.
 *   - Visor directo de PDFs en web pública: buildFileUrl apuntando limpiamente a
 *     assets de GitHub Releases v1.0 (<sha12>.pdf) y Google Docs Viewer embebido
 *     en #modalPreviewPane y en «Abrir en pestaña», evitando texto plano forzado.
 *   - Sinopsis y barras del lector: #modalDocDescBox (.modal-doc-desc-box),
 *     extractos de 2 líneas .book-desc en estantes, cierre separado en
 *     .modal-header-top, barra desplazable en .modal-toolbar-row y filtros de
 *     #biblioteca nivelados a 40 px.
 *   - Rediseño cósmico de Agentes de Cambio.MX (CNRC): estelar cósmico, bordes
 *     cian neón, 4 Ejes Temáticos (Salud y Bienestar, Habilidades para la Vida,
 *     Paz y Participación Comunitaria, Medio Ambiente y Sustentabilidad) ligados
 *     a los 4 pilares de la educación, chips conectados en data/faq_v3.json,
 *     enlaces a cnrc@scouts.org.mx e Instagram @RNC.MX.
 * - Reestructuración V7 y Mobile 2.2.x (Antigravity + OpenCode):
 *   - Inicio V7: tarjeta central inclinada rotate(-2deg), cinta diagonal
 *     .hero-band azul-morada, texto centrado «By Liam», 10 iconos SVG blancos
 *     flotantes, extensión continua del fondo oscuro hasta #seccion-buscador y
 *     garantía visual de «BiblioTech Scout» sin truncar en móviles.
 *   - Sustitución de «Mochila» por «Guardados»: persistencia híbrida en
 *     document.cookie + localStorage (bt_saved_docs y bt_note_) con modal/sheet
 *     #savedPanel para ver, abrir o borrar guardados y notas de campo.
 *   - Dock unificado y Modo Noche OLED: .bt-unified-dock claro frosted glass
 *     oculto en escritorio (min-width: 921px), botón #dockBtnNight con
 *     aria-pressed, modo oscuro limpio (html[data-camp-mode="true"]) sin tintes
 *     amarillos, y botón visible en cabecera solo para escritorio sin duplicar.
 *   - Banco ampliado V4 y OTA: expansión a 11,254 preguntas únicas (5,797 en
 *     faq_v4.json) + capa OTA de interfaz/datos y capturas web/móvil en README.
 *
 * ----------------------------------------------------------------------------
 * 4. REPARTO DE ROLES, FLUJO DE TRABAJO, VALIDACIÓN Y DESPLIEGUE
 * ----------------------------------------------------------------------------
 * A) Reparto recomendado de trabajo:
 * - OpenCode: Mejoras de UI, accesibilidad, rendimiento y SEO; refactorizaciones
 *   pequeñas de app.js; validación local, Lighthouse y revisión técnica de PRs;
 *   conexión con GitHub vía MCP oficial.
 * - Antigravity / Gemini: Generación y actualización de data/<archivo>.json;
 *   extracción de texto, portadas y documentos; publicación de assets y sitio
 *   cuando corresponda desde dist_web; revisión de contenido y consistencia.
 * - GitHub Copilot: Revisión de PRs y sugerencias de código; correcciones
 *   pequeñas desde issues; explicación y pruebas cuando aplique (en plan
 *   Student usa selección automática de modelo; Claude puede aparecer mediante
 *   esa selección, sin elegirse manualmente).
 * - Persona (Liam): Decide alcance de contenido, aprueba merges y confirma
 *   cambios que afecten publicación o datos oficiales.
 *
 * B) Configuración de agentes en esta máquina:
 * - OpenCode: MCP github en C:\Users\liamc\.config\opencode\opencode.json
 *   (usa token de gh mediante launcher.mjs; no guarda token en JSON).
 * - Antigravity: MCP github en C:\Users\liamc\.gemini\config\mcp_config.json
 *   (reiniciar Antigravity tras modificar ese archivo).
 * - Copilot: Usado desde GitHub.com, VS Code o GitHub Copilot CLI.
 *
 * C) Flujo de trabajo y PRs:
 * 1. Tomar o abrir issue con etiqueta del agente (agent:opencode / agent:gemini /
 *    agent:copilot) y área (area:ui / area:data / area:a11y / area:performance /
 *    area:docs). Ejemplos de asignación:
 *    "@opencode implementa el issue #12 en agent/opencode/mejoras-sitio",
 *    "@gemini regenera data/questions_bank.json y abre PR en agent/gemini/datos",
 *    "Copilot, revisa el PR #15 y señala riesgos de accesibilidad".
 * 2. Crear rama desde origin/main, hacer el cambio mínimo y validar en local.
 * 3. Al revisar un PR (guía Copilot): verificar cambio pequeño ligado al issue,
 *    accesibilidad (alt, contraste, landmarks, labels, teclado), rendimiento
 *    (imágenes sin loading="lazy", JSON pesados al inicio, animaciones
 *    costosas), que no se editaron JSON generados a mano y señalar riesgos
 *    concretos.
 * 4. Al proponer código: seguir estilo de app.js y styles.css, usar escapeHtml
 *    en contenido dinámico, no agregar dependencias sin justificar, dejar PR en
 *    revisión humana si afecta datos o publicación.
 * 5. En PRs que cambian datos (guía GEMINI): documentar qué datos/archivos
 *    cambiaron, qué script se ejecutó, cómo se validó el sitio y cuánto cambió
 *    el peso de archivos.
 * 6. Hacer merge con squash (--squash), borrar la rama y verificar GitHub Pages
 *    entre 1 y 2 minutos después.
 *
 * D) Validación mínima web (Definition of Done):
 * - Servidor local desde raíz: python -m http.server 8765 --bind 127.0.0.1
 * - Validar sintaxis: node --check app.js
 * - Validar JSON modificado: python -m json.tool data/catalog.json > $null
 * - Comprobar en navegador (escritorio y móvil 390 px de ancho sin desbordes):
 *   0 errores en consola, buscador responde con fuentes, pestañas de biblioteca
 *   y catálogo funcionan, lector abre y descarga, Lighthouse de accesibilidad y
 *   SEO igual o superior al previo, y ninguna imagen fuera de primera pantalla
 *   sin loading="lazy" ni decoding="async".
 *
 * E) Publicación desde copia scratch/dist_web (cuando se use ese flujo):
 * 1. git -C dist_web pull --ff-only (o alinear desde origin/main sin borrar
 *    archivos locales de promo).
 * 2. Sincronizar archivos del sitio desde dist_web hacia public/.
 * 3. Ejecutar el script generador correspondiente.
 * 4. Ejecutar prepare_public_site.py.
 * 5. Revisar git -C dist_web status antes de commitear.
 * 6. Commit con autoría exclusiva de Liam y push a main.
 * 7. Verificar sitio publicado en GitHub Pages.
 *
 * F) Resolución de conflictos:
 * - Dos agentes en el mismo archivo: gana el primer PR revisado e integrado; el
 *   segundo actualiza su rama y resuelve conflictos.
 * - Cambios en public/ vs repo: primero sincronizar public/ desde main.
 * - Datos generados diferentes: no sobrescribir sin comparar diff antes.
 * - Sitio publicado no refleja merge: esperar 1-2 min, revisar Actions Pages
 *   y recargar sin caché.
 *
 * G) Flujo, prueba y validación mínima en Android (bibliotech-scouts-app):
 * - Sincronizar sitio: npm run sync:web y npx cap sync android (debe reconocer
 *   los 8 plugins de Capacitor sin errores).
 * - Probar capa nativa en navegador:
 *   npx --yes http-server www -p 8766 -a 127.0.0.1 -c-1
 *   node scripts/make-native-test.mjs (abrir http://127.0.0.1:8766/native-test.html).
 *   Después volver a ejecutar npm run sync:web antes de cap sync para no meter
 *   páginas de prueba en el APK.
 * - Checklist Android: el workflow Build Android APK compila, Panel Offline abre
 *   y descarga archivo en dispositivo/emulador, arranca sin internet respondiendo
 *   preguntas, y nueva versión se instala encima conservando misma firma.
 * - Release de nuevo APK firmado: actualizar version y versionLabel en
 *   package.json, versionName y versionCode en android/app/build.gradle y
 *   leyendas en index.html; merge squash a main; crear tag anotado vX.Y.Z y
 *   hacer git push origin vX.Y.Z.
 *
 * ----------------------------------------------------------------------------
 * 5. PUNTOS CLAVE DE EVOLUCIÓN Y PENDIENTES CONOCIDOS
 * ----------------------------------------------------------------------------
 * 1. Refinamiento del ranking semántico local en app.js para consultas
 *    coloquiales ("qué hago si me lastimo", "cómo pasar de tropa a caminantes",
 *    "cuánto cuesta la membresía") sin penalizar términos comunes.
 * 2. Descarga de documentos en lote por estantes completos en Mi biblioteca
 *    (ej. los 39 libros del Centenario) con barra de progreso consolidada.
 * 3. Caché progresivo de portadas bajo demanda en @capacitor/filesystem.
 * 4. Play Protect: para erradicar por completo cualquier advertencia heurística
 *    de sideloading, la vía recomendada es publicar en Google Play Console o
 *    solicitar verificación de desarrollador independiente ante Google Play.
 * 5. Pendientes web heredados (issue #12): archivos alojados solo en releases
 *    (donde Content-Disposition: attachment fuerza descarga en «Abrir en
 *    pestaña», resoluble publicando copias web livianas en files/) y reemplazo
 *    de 7 portadas WhatsApp-Image de Identidad Gráfica.
 *
 * ----------------------------------------------------------------------------
 * 6. ENLACES DE REFERENCIA TÉCNICA
 * ----------------------------------------------------------------------------
 * - Documentación de GitHub Pages: https://docs.github.com/pages
 * - Accesibilidad web (WCAG 2.2): https://www.w3.org/WAI/WCAG22/quickref/
 * - Lighthouse: https://developer.chrome.com/docs/lighthouse/overview/
 * - Protocolo OpenCode: https://opencode.ai/docs/rules/
 * ============================================================================ */
\\n