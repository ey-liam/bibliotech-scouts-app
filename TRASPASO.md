# BiblioTech Scout — Documento Maestro de Traspaso y Arquitectura del Sistema
**Para:** Gemini Argon 4 / Próximos Desarrolladores y Agentes  
**Fecha de corte:** 10 de Noviembre de 2026  
**Versión actual del ecosistema:** BETA V6 (Web) · Mobile 2.1.0 (Android)  
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
* **Diagnóstico de Play Protect en Android:** Investigó a fondo las causas por las que Google Play Protect marcaba alertas heurísticas en el APK sideloaded.
* **Eliminación de permisos y código riesgoso:**
  - Retiró el permiso `android.permission.REQUEST_INSTALL_PACKAGES` de `AndroidManifest.xml`.
  - Eliminó por completo el plugin `NativeUpdaterPlugin.java`, su registro en `MainActivity.java`, y su `FileProvider` dedicado.
  - Redirigió el sistema de actualización para que «Buscar actualización» consulte la última release de GitHub y abra la descarga del APK directamente en el navegador del teléfono, evitando el patrón de autoinstalación que detonaba falsos positivos.
* **Sección de Descarga en el Sitio Web:** Creó la sección `#app` («Lleva BiblioTech Scout en tu bolsillo») con instrucciones de instalación, advertencias sobre Play Protect y enlace dinámico a la última release.
* **Prototipos de Motor de Respuestas:** Diseñó scripts de evaluación semántica local con stopwords y sinónimos para generar respuestas directas sin depender de APIs de IA de pago.

### Aportes de Antigravity
* **Solución del Botón de Descargas Duplicado:**
  - Eliminó el botón redundante `#bt-header-btn` de la barra superior.
  - Centralizó el acceso nativo en el botón flotante inferior izquierdo (`#bt-offline-fab`) y en el menú lateral (`#bt-nav-downloads`), evitando estorbos en pantallas táctiles.
* **Corrección de Zoom y Pliego Horizontal en Tablets:**
  - Eliminó la restricción `Math.max(1, ...)` del visor nativo, permitiendo zoom de alejamiento hasta el 40% (`Math.max(0.4, ...)`) y acercamiento hasta el 250%.
  - Añadió soporte nativo para lectura en pliego de 2 páginas lado a lado en tablets y modo horizontal, adaptándose al ancho real de la pantalla.
* **Lectura Directa de Archivos en la Web y «Abrir en pestaña»:**
  - Detectó que en la web pública `canEmbedNative` fallaba y volcaba únicamente texto plano.
  - Implementó el visor visual interactivo para PDFs utilizando Google Docs Viewer embebido en `#modalPreviewPane`, permitiendo ver el PDF original con todas sus páginas, tipografías e ilustraciones.
  - Modificó «Abrir en pestaña» en archivos PDF para que abra el visor visual original completo en una nueva pestaña en vez de generar un HTML con texto plano extraído.
* **Sinopsis y Descripción de Archivos:**
  - Incorporó `#modalDocDescBox` (`.modal-doc-desc-box`) en el encabezado del lector, mostrando un resumen del contenido de cada documento.
  - Añadió el extracto de 2 líneas `.book-desc` en cada tarjeta de los estantes de la Biblioteca Scout.
* **Reorganización de Barras y Botones:**
  - Separó el botón de cierre (`✕`) a una fila superior (`.modal-header-top`) junto al título para que nunca se caiga ni se desplace debajo de la barra de acciones.
  - Agrupó las acciones en una sola fila desplazable horizontalmente (`.modal-toolbar-row`), evitando saltos de línea antiestéticos.
  - Niveló alturas (40 px) y alineó simétricamente los filtros y pestañas en `#biblioteca`.
* **Rediseño Cósmico de Agentes de Cambio.MX (CNRC):**
  - Transformó la sección `#agentes` para igualar la estética oficial del sitio web de Google Sites creado por Liam para el Comité Nacional de la Red de Caminantes (CNRC).
  - Integró fondo estelar con nebulosas, marcos dobles cian neón, esquineros de carreras a cuadros blancos y negros, destellos de estrellas (✦) y clips de papel de colores.
  - Añadió el extracto oficial completo de la convocatoria de proyectos scouts dirigido a toda la Red Nacional de Caminantes.
  - Incorporó los 4 Ejes Temáticos con insignias en alta resolución (*Salud y Bienestar*, *Habilidades para la Vida*, *Paz y Participación Comunitaria*, *Medio Ambiente y Sustentabilidad*), vinculados a los cuatro pilares de la educación (*aprender a ser, aprender a saber, aprender a hacer y aprender a convivir*).
  - Incluyó la firma: `ESTE SITIO ES ELABORADO Y GESTIONADO POR EL CNRC & DEL TODOPODEROSO LIAM`.
* **Banco de Preguntas Oficiales de Agentes de Cambio:** Añadió 6 preguntas y respuestas fundamentadas a `data/faq_v3.json` para resolución instantánea sin conexión.
* **Instagram Oficial del Creador:** Añadió el usuario `@liaadurg3` y el botón oficial con degradado en `#acerca` y en el pie de página.
* **Salto de Versión V5 / 2.0.0:** Sincronizó y publicó la versión Web **V5** y la versión Android **2.0.0**, disparando la compilación automatizada en GitHub Actions y publicando el APK firmado de 49.3 MB.

---

## 3. Arquitectura del Repositorio Web (`bibliotech-scouts`)

El sitio web es una Single Page Application (SPA) estática optimizada para rendimiento, accesibilidad (Lighthouse 100) y funcionamiento sin backend propietario:

```
bibliotech-scouts/
├── index.html                 # Estructura semántica completa, modales, iconos SVG y secciones
├── styles.css                 # Sistema de diseño con variables CSS, aurora animada, estilos cósmicos y responsive
├── app.js                     # Controlador principal: estado, buscador, lector, banco de preguntas y eventos
├── manifest.webmanifest       # Manifiesto PWA
├── 404.html                   # Página de redirección para GitHub Pages
├── data/
│   ├── catalog.json           # Catálogo curado de 650 documentos (título, año, sección, categoría, sha12, resumen)
│   ├── questions_bank.json    # Banco base masivo con miles de preguntas y respuestas documentales
│   ├── faq_v3.json            # Banco especializado de preguntas (primeros auxilios, uniforme, Agentes de Cambio)
│   ├── knowledge_base.json    # Base de conocimiento enciclopédico estructurado
│   ├── chunks.json            # Fragmentos textuales indexados para coincidencia por términos
│   └── text/                  # Textos extraídos de documentos identificados por su hash SHA-12 (<sha12>.txt)
├── covers/                    # 433 portadas de documentos en formato JPG (<sha12>.jpg)
├── img/                       # Logotipos oficiales (Flor de Lis, ASMAC, WOSM, fotos de eventos)
└── assets/
    ├── Liam.png / Liam.webp   # Retrato animado APNG y estático del creador
    ├── LiamFondo.jpg          # Fondo del escenario 3D del creador
    └── scouts/agentes_cambio/ # Recursos oficiales de Agentes de Cambio (Logos, Ejes, Letreros CNRC)
```

### Funcionamiento del Motor de Respuestas en `app.js`
1. **Carga en paralelo:** Al inicializar, `app.js` lanza promesas simultáneas para `catalog.json`, `questions_bank.json`, `faq_v3.json` y `chunks.json`.
2. **Normalización:** Las consultas del usuario se normalizan eliminando acentos, caracteres especiales y signos de interrogación (`normalizeQuestionKey`).
3. **Búsqueda por capas:**
   - *Capa 1 (Coincidencia exacta / normalizada):* Si la pregunta coincide con una clave del banco de preguntas, devuelve la respuesta estructurada de inmediato junto con la cita del documento oficial.
   - *Capa 2 (Coincidencia difusa y palabras clave):* Evalúa la similitud léxica y términos coincidentes en el banco de preguntas y en la base de conocimiento.
   - *Capa 3 (Búsqueda en fragmentos de documentos - `chunks.json`):* Localiza los párrafos más relevantes dentro de los manuales y estatutos oficiales y extrae la respuesta citando página y documento.
4. **Respuesta Transparente:** Si la información no existe en los documentos oficiales cargados, el motor lo indica honestamente sin alucinar ni inventar datos.

---

## 4. Arquitectura de la Aplicación Android (`bibliotech-scouts-app`)

La app para Android envuelve el sitio web utilizando **Capacitor 8** e inyecta una capa nativa especializada:

```
bibliotech-scouts-app/
├── package.json               # Versión de la app (2.0.0) y leyenda visible (BETA V5 - 2.0 Mobile)
├── scripts/
│   ├── sync-web.mjs           # Copia el sitio hermano a www/, agrega BASE_ASSETS, portadas e inyecta overlays
│   └── make-assets.mjs        # Generador de iconos adaptativos y pantallas splash
├── web-overlay/
│   ├── native-early.js        # Script inyectado al inicio del <head> para interceptar fetch y servir caché offline
│   ├── native-bridge.js       # Orquestador del panel 'Mi biblioteca', descargas, visor PDF nativo y zoom
│   └── native.css             # Estilos del botón flotante inferior, modal de descargas y visores nativos
├── android/
│   ├── app/build.gradle       # Configuración de compilación Android (minSdk 24, targetSdk 36, versionCode 6)
│   └── app/src/main/
│       ├── AndroidManifest.xml # Manifiesto con permiso único android.permission.INTERNET
│       └── java/mx/bibliotechscout/app/
│           ├── MainActivity.java    # Actividad principal con registro de PdfViewerPlugin
│           └── PdfViewerPlugin.java # Plugin Capacitor que usa android.graphics.pdf.PdfRenderer
└── .github/workflows/
    └── android.yml            # CI/CD: compila, firma con Release Keystore y publica el APK en Releases
```

### Proceso de Sincronización (`scripts/sync-web.mjs`)
* Detecta automáticamente si existe el repositorio hermano `../bibliotech-scouts`.
* Copia `data/`, `img/`, `covers/` y los archivos declarados en `BASE_ASSETS`.
* **Lista de recursos base empaquetados (`BASE_ASSETS`):**
  - Retratos y fondos de Liam (`assets/Liam.png`, `assets/Liam.webp`, `assets/LiamFondo.jpg`).
  - Logos y fotografías institucionales del Centenario y WOSM.
  - Logos y orbes de los 4 Ejes de Agentes de Cambio (`AgentesDeCambioLogo.png`, `Salud.png`, `Habilidades.png`, `Sustentabilidad.png`, `Paz.png`, `LetreroCNRC.png`, `Logos.png`).
* Inyecta `native-early.js`, `native.css` y `native-bridge.js` en el `index.html` resultante en `www/`.
* Parchea la versión del pie de página para que coincida exactamente con la declarada en `package.json`.

---

## 5. Procedimiento para Realizar Cambios y Publicar

Cuando debas aplicar mejoras al sistema, sigue rigurosamente este flujo de trabajo:

### Paso 1: Edición en el Repositorio Web (`bibliotech-scouts`)
```powershell
cd C:\Users\liamc\bibliotech-scouts
# Crea tu rama temporal de trabajo
git checkout -b agent/gemini/<nombre-tarea>

# Realiza tus ediciones en index.html, styles.css, app.js o data/
# Comprueba que no haya errores de sintaxis
node --check app.js

# Verifica que no existan emojis accidentales
node -e "const c = require('fs').readFileSync('app.js','utf8'); if (/[\uD83C-\uDBFF\uDC00-\uDFFF]/.test(c)) console.error('Hay emojis!');"

# Commit asegurando autoría de Liam
git add -A
git commit -m "Descripción clara de la mejora"
git push -u origin agent/gemini/<nombre-tarea>

# Crear y fusionar PR con squash usando GitHub CLI
gh pr create --repo ey-liam/bibliotech-scouts --title "Título de la mejora" --body "Detalles"
gh pr merge <numero-pr> --repo ey-liam/bibliotech-scouts --squash --delete-branch --admin
git checkout main
git pull
```

### Paso 2: Sincronización en la App Android (`bibliotech-scouts-app`)
```powershell
cd C:\Users\liamc\bibliotech-scouts-app
git checkout -b agent/gemini/<nombre-tarea>-app

# Sincroniza el sitio web actualizado hacia www/ y Capacitor
npm run sync:web
npx cap sync android

# Si se cambia la versión, edita package.json y android/app/build.gradle
# Commit con autoría de Liam
git add -A
git commit -m "Sincroniza mejoras web y actualiza versión"
git push -u origin agent/gemini/<nombre-tarea>-app

# Crear y fusionar PR con squash
gh pr create --repo ey-liam/bibliotech-scouts-app --title "Actualiza app" --body "Detalles"
gh pr merge <numero-pr> --repo ey-liam/bibliotech-scouts-app --squash --delete-branch --admin
git checkout main
git pull
```

### Paso 3: Publicación de Nueva Release APK
```powershell
# Crear y subir el tag con la nueva versión (ejemplo v2.0.1)
git tag -a v2.0.1 -m "Release v2.0.1"
git push origin v2.0.1

# El workflow de GitHub Actions compilará, firmará y publicará automáticamente bibliotech-scout.apk
gh run list --repo ey-liam/bibliotech-scouts-app --limit 1
```

---

## 6. Puntos Clave para Futuras Mejoras de Gemini Argon 4

1. **Refinamiento del Ranking Semántico Local:** Continuar optimizando el algoritmo en `app.js` para consultas coloquiales (por ejemplo: "qué hago si me lastimo", "cómo pasar de tropa a caminantes", "cuánto cuesta la membresía"). Priorizar coincidencias parciales con sinónimos scouts sin penalizar términos comunes.
2. **Descarga de Documentos en Lote:** En la pestaña *Explorar catálogo* de Mi biblioteca, permitir descargar estantes completos (por ejemplo, los 39 libros del Centenario) con un solo toque y barra de progreso consolidada.
3. **Caché Progresivo de Portadas:** Asegurar que las imágenes de portadas descargadas bajo demanda se almacenen en almacenamiento persistente mediante `@capacitor/filesystem`.
4. **Compatibilidad Play Protect:** Si se desea certificar el APK ante Google para erradicar cualquier advertencia de Play Protect, la ruta recomendada es subir la aplicación a Google Play Console o solicitar la verificación de desarrollador independiente ante el portal de Google Play Protect.
