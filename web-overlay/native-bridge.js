/* ============================================================
   BiblioTech Scout — capa nativa (solo dentro del APK)
   Mi biblioteca: descargas, lector PDF integrado, imágenes,
   contenido sin conexión y actualizaciones.
   ============================================================ */

(function () {
  "use strict";

  const Cap = window.Capacitor;
  const isNative = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
  if (!isNative) return;

  const plugin = (name) => (Cap.Plugins && Cap.Plugins[name]) || null;
  const Filesystem = plugin("Filesystem");
  const Preferences = plugin("Preferences");
  const Browser = plugin("Browser");
  const App = plugin("App");
  const Dialog = plugin("Dialog");
  const Toast = plugin("Toast");
  const Network = plugin("Network");
  const FileOpener = plugin("FileOpener");
  const PdfViewer = plugin("PdfViewer");
  const OtaUpdater = plugin("OtaUpdater");

  const SITE = "https://ey-liam.github.io/bibliotech-scouts";
  const APP_REPO = "ey-liam/bibliotech-scouts-app";
  const APP_RELEASES = `https://github.com/${APP_REPO}/releases/latest`;
  const APP_DOWNLOAD = `${APP_RELEASES}/download/bibliotech-scout.apk`;
  const SITE_REPO = "ey-liam/bibliotech-scouts";
  const GITHUB_RELEASE_BASE = `https://github.com/${SITE_REPO}/releases/download/v1.0/`;
  const DATA_DIR = "offline";
  const OTA_STAGING_DIR = "ota_staging";
  const CACHE_NAME = "bt-content-v1";
  const SHELL_FILES = ["index.html", "styles.css", "app.js"];
  const DATA_JSON = [
    "data/catalog.json",
    "data/questions_bank.json",
    "data/knowledge_base.json",
    "data/chunks.json",
    "data/spreadsheets.json",
    "data/faq_v3.json",
    "data/faq_v4.json",
  ];
  const MIME = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    html: "text/html",
    htm: "text/html",
  };
  const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif"]);
  const TRASH_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H4a1 1 0 1 0 0 2h1l1 13a1 1 0 0 0 1 .9h10a1 1 0 0 0 1-.9l1-13h1a1 1 0 1 0 0-2h-4V4a1 1 0 0 0-1-1H9Zm1 2h4v1h-4V5Zm-1.9 4h7.8l-.8 11H8.9L8.1 9Z"/></svg>';

  const state = {
    online: navigator.onLine !== false,
    catalog: null,
    docs: [],
    docsById: {},
    offline: {}, // sha12 -> { title, ext, section, size, savedAt }
    selected: new Set(),
    query: "",
    section: "all",
    category: "all",
    subcategory: "all",
    activeTab: "files",
    savedQuery: "",
    busy: false,
    modalOpen: false,
    lastFocused: null,
    pdf: null,
    image: null,
    html: null,
    appInfo: null,
    siteInfo: null,
    resizeTimer: null,
  };

  const $ = (id) => document.getElementById(id);
  const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;

  function toast(text, long) {
    if (Toast) {
      Toast.show({ text, duration: long ? "long" : "short" }).catch(() => {});
    }
  }

  async function ensureDataDirectory() {
    if (!Filesystem) return;
    try {
      await Filesystem.mkdir({
        path: DATA_DIR,
        directory: "DATA",
        recursive: true,
      });
    } catch (_) {}
  }

  async function confirmDialog(title, message, okButtonTitle, cancelButtonTitle) {
    if (Dialog && Dialog.confirm) {
      try {
        const result = await Dialog.confirm({
          title,
          message,
          okButtonTitle: okButtonTitle || "Aceptar",
          cancelButtonTitle: cancelButtonTitle || "Cancelar",
        });
        if (result && typeof result.value === "boolean") {
          return result.value;
        }
      } catch (e) {
        console.warn("Dialog.confirm no disponible, usando confirm web", e);
      }
    }
    try {
      return window.confirm(`${title}\n\n${message}`);
    } catch (_) {
      return true;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  // ------------------------------------------------------------------
  // Caché de datos: native-early.js la instala en <head>, antes de que
  // app.js empiece a pedir el catálogo. Aquí solo se escribe y se borra.
  // ------------------------------------------------------------------

  async function readPref(key, fallback) {
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function writePref(key, value) {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch (_) {}
  }

  async function loadOfflineIndex() {
    state.offline = (await readPref("offline_index", {})) || {};
  }

  async function persistOfflineIndex() {
    await writePref("offline_index", state.offline);
  }

  async function clearOldContentCache() {
    try {
      const info = await App.getInfo();
      const stored = await readPref("app_version", "");
      if (stored !== info.version) {
        if ("caches" in window) await caches.delete(CACHE_NAME);
        await writePref("app_version", info.version);
        await writePref("content_etags", {});
        await writePref("shell_etags", {});
        await writePref("text_shas", {});
      }
    } catch (_) {}
  }

  // ------------------------------------------------------------------
  // Catálogo y documentos
  // ------------------------------------------------------------------
  async function loadCatalog() {
    if (state.catalog) return state.catalog;
    const res = await fetch("data/catalog.json");
    if (!res.ok) throw new Error("No se pudo leer el catálogo");
    const json = await res.json();
    state.catalog = json;
    const byId = {};
    state.docs = (json.documents || [])
      .filter((d) => d && d.sha12 && (String(d.ext || "").toLowerCase() !== "html" || d.is_readable_html === true))
      .map((d) => {
        const entry = {
          id: d.id || "",
          sha12: d.sha12,
          title: d.title || d.filename || "Documento",
          ext: String(d.ext || "pdf").toLowerCase(),
          section: d.section_label || d.section || "General",
          category: d.category || "General",
          subcategory: d.subcategory || "",
          year: d.year || "",
          size: d.size_bytes || 0,
          has_web_file: Boolean(d.has_web_file),
        };
        if (entry.id) byId[entry.id] = entry;
        return entry;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
    state.docsById = byId;
    return json;
  }

  function docFileName(doc) {
    return `${doc.sha12}.${String(doc.ext || "pdf").toLowerCase()}`;
  }

  function docUrl(doc) {
    const fileName = docFileName(doc);
    if (doc.has_web_file) {
      return `${SITE}/files/${fileName}`;
    }
    return `${GITHUB_RELEASE_BASE}${fileName}`;
  }

  function isDownloadLink(url) {
    if (/\/files\/[a-f0-9]{12}\.[a-z0-9]+$/i.test(url.pathname)) return true;
    if (url.hostname === "github.com" && /\/releases\/download\/[^/]+\/([a-f0-9]{12})\.([a-z0-9]+)$/i.test(url.pathname)) return true;
    return false;
  }

  function isExternal(url) {
    return /^https?:$/.test(url.protocol) && url.origin !== location.origin;
  }

  function findDocByUrl(url) {
    let match = url.pathname.match(/\/files\/([a-f0-9]{12})\.([a-z0-9]+)$/i);
    if (!match && url.hostname === "github.com") {
      match = url.pathname.match(/\/releases\/download\/[^/]+\/([a-f0-9]{12})\.([a-z0-9]+)$/i);
    }
    if (!match) return null;
    const sha12 = match[1].toLowerCase();
    const ext = match[2].toLowerCase();
    const found = state.docs.find((d) => d.sha12 === sha12);
    if (found) return found;
    return {
      sha12,
      title: match[1],
      ext,
      section: "General",
      year: "",
      size: 0,
      has_web_file: false,
    };
  }

  function offlineEntries() {
    return Object.entries(state.offline).map(([sha12, item]) => ({ sha12, ...item }));
  }

  function offlineBytes() {
    return offlineEntries().reduce((sum, item) => sum + (item.size || 0), 0);
  }

  function injectNavLink() {
    if ($("bt-nav-downloads")) return;
    const mainNav = document.querySelector("#navegacion-principal");
    if (!mainNav) return;
    const link = document.createElement("a");
    link.href = "#descargas-offline";
    link.id = "bt-nav-downloads";
    link.className = "nav-link bt-nav-link";
    link.innerHTML = '<span>Descargas</span><span class="bt-nav-badge" id="bt-nav-badge" hidden>0</span>';
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const header = document.querySelector(".main-header");
      const navToggle = $("navToggle");
      const navBackdrop = $("navBackdrop");
      if (header && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        if (navToggle) navToggle.setAttribute("aria-expanded", "false");
        if (navBackdrop) navBackdrop.hidden = true;
      }
      openModal("files");
    });
    mainNav.appendChild(link);
  }

  // ------------------------------------------------------------------
  // Construcción de la interfaz
  // ------------------------------------------------------------------
  function buildUi() {
    if ($("bt-offline-fab")) return;

    // injectNavLink(); // Retirado: usuario solicitó dejar solo el botón de la esquina inferior izquierda

    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "bt-offline-fab";
    fab.className = "bt-fab";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-label", "Abrir descargas sin conexión");
    fab.innerHTML =
      '<span class="bt-fab-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>' +
      '</span>' +
      '<span class="bt-fab-label">Descargas</span>' +
      '<b id="bt-fab-count" hidden>0</b>';
    fab.addEventListener("click", () => openModal("files"));
    document.body.appendChild(fab);

    const banner = document.createElement("div");
    banner.id = "bt-net-banner";
    banner.className = "bt-net-banner";
    banner.hidden = true;
    banner.setAttribute("role", "status");
    banner.textContent = "Sin conexión · usando el contenido guardado";
    document.body.appendChild(banner);

    const modal = document.createElement("div");
    modal.id = "bt-offline-modal";
    modal.className = "bt-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "bt-offline-title");
    modal.innerHTML = `
      <div class="bt-modal-backdrop" data-bt-close="1"></div>
      <div class="bt-modal-panel" role="document">
        <div class="bt-sheet-grip" aria-hidden="true"></div>
        <header class="bt-modal-head">
          <div class="bt-head-copy">
            <span class="bt-eyebrow">BiblioTech Scout · Modo sin conexión</span>
            <h2 id="bt-offline-title">Mi biblioteca</h2>
            <p class="bt-sub">Documentos y lecturas oficiales disponibles en tu dispositivo sin necesidad de internet.</p>
          </div>
          <button type="button" class="bt-close" id="bt-close-btn" data-bt-close="1" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <nav class="bt-tabs" role="tablist" aria-label="Secciones de Mi biblioteca">
          <button type="button" class="bt-tab is-active" id="bt-tab-files" role="tab" aria-selected="true" aria-controls="bt-panel-files">
            <span>Mis descargas</span><span class="bt-tab-badge" id="bt-tab-files-count">0</span>
          </button>
          <button type="button" class="bt-tab" id="bt-tab-download" role="tab" aria-selected="false" aria-controls="bt-panel-download" tabindex="-1">
            <span>Explorar catálogo</span><span class="bt-tab-badge" id="bt-tab-download-count">0</span>
          </button>
          <button type="button" class="bt-tab" id="bt-tab-app" role="tab" aria-selected="false" aria-controls="bt-panel-app" tabindex="-1">
            <span>App y estado</span>
          </button>
        </nav>

        <div class="bt-progress" id="bt-progress" hidden>
          <div class="bt-bar"><span id="bt-bar-fill"></span></div>
          <p id="bt-progress-text">Preparando…</p>
        </div>

        <div class="bt-panels">
          <section class="bt-panel" id="bt-panel-files" role="tabpanel" aria-labelledby="bt-tab-files">
            <div class="bt-storage" id="bt-saved-storage"></div>
            <div class="bt-notes-shortcut-wrap">
              <button type="button" class="bt-notes-shortcut" id="bt-open-saved-notes">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                <span>Marcadores y notas</span>
              </button>
            </div>
            <label class="bt-search bt-search-saved">
              <span class="bt-sr">Buscar en mis archivos descargados</span>
              <input id="bt-saved-search" type="search" placeholder="Buscar en mis descargas…" autocomplete="off" />
            </label>
            <div class="bt-list" id="bt-saved-list" role="list"></div>
            <button type="button" class="bt-link bt-danger-link" id="bt-delete-all">Borrar todos los archivos guardados</button>
          </section>

          <section class="bt-panel" id="bt-panel-download" role="tabpanel" aria-labelledby="bt-tab-download" hidden>
            <div class="bt-storage" id="bt-storage"></div>
            <div class="bt-tools">
              <label class="bt-search">
                <span class="bt-sr">Buscar documento en catálogo</span>
                <input id="bt-search" type="search" placeholder="Buscar por título, categoría, subcategoría o año…" autocomplete="off" />
              </label>
              <label class="bt-select">
                <span class="bt-sr">Filtrar por categoría</span>
                <select id="bt-category"><option value="all">Todas las categorías</option></select>
              </label>
              <label class="bt-select">
                <span class="bt-sr">Filtrar por subcategoría</span>
                <select id="bt-subcategory"><option value="all">Todas las subcategorías</option></select>
              </label>
              <label class="bt-select">
                <span class="bt-sr">Filtrar por sección</span>
                <select id="bt-section"><option value="all">Todas las secciones</option></select>
              </label>
            </div>
            <div class="bt-list-head">
              <p class="bt-count" id="bt-count"></p>
              <div class="bt-head-links">
                <button type="button" class="bt-link" id="bt-select-batch">Seleccionar bloque (25)</button>
                <button type="button" class="bt-link" id="bt-select-visible">Seleccionar visibles</button>
              </div>
            </div>
            <div class="bt-list" id="bt-list" role="list"></div>
          </section>

          <section class="bt-panel" id="bt-panel-app" role="tabpanel" aria-labelledby="bt-tab-app" hidden>
            <div class="bt-app-card">
              <div class="bt-app-row"><span>Versión de la app</span><strong id="bt-app-version">—</strong></div>
              <div class="bt-app-row"><span>Contenido del sitio</span><strong id="bt-app-site">—</strong></div>
              <div class="bt-app-row"><span>Auto-actualización</span><strong id="bt-app-ota">Activa (web y datos)</strong></div>
              <div class="bt-app-row"><span>Conexión</span><strong id="bt-app-network">—</strong></div>
              <div class="bt-app-row"><span>Archivos guardados</span><strong id="bt-app-storage">—</strong></div>
            </div>
            <div class="bt-app-actions">
              <button type="button" class="bt-btn bt-primary" id="bt-update">Actualizar web y contenido ahora</button>
              <button type="button" class="bt-btn bt-secondary" id="bt-check-app">Buscar actualización de APK</button>
              <button type="button" class="bt-btn bt-secondary" id="bt-verify-offline">Verificar preguntas sin conexión</button>
            </div>
            <p class="bt-app-status" id="bt-app-status" role="status"></p>
            <p class="bt-note">La app actualiza automáticamente el contenido y la interfaz web cuando tienes internet, conservando todos tus documentos descargados. Al pulsar «Buscar actualización de APK» se verifica si existe una nueva versión nativa para instalar desde el navegador.</p>
          </section>
        </div>

        <footer class="bt-modal-foot" id="bt-download-foot" hidden>
          <span id="bt-selection">0 seleccionados</span>
          <div class="bt-actions">
            <button type="button" class="bt-btn bt-secondary" id="bt-delete" disabled>Borrar</button>
            <button type="button" class="bt-btn bt-primary" id="bt-download" disabled>Descargar</button>
          </div>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const pdfViewer = document.createElement("div");
    pdfViewer.id = "bt-pdf-viewer";
    pdfViewer.className = "bt-viewer";
    pdfViewer.hidden = true;
    pdfViewer.setAttribute("role", "dialog");
    pdfViewer.setAttribute("aria-modal", "true");
    pdfViewer.setAttribute("aria-labelledby", "bt-pdf-title");
    pdfViewer.innerHTML = `
      <header class="bt-viewer-head">
        <button type="button" class="bt-viewer-icon" id="bt-pdf-close" aria-label="Cerrar lector">←</button>
        <div class="bt-viewer-title">
          <strong id="bt-pdf-title">Documento</strong>
          <span id="bt-pdf-page">Página 1</span>
        </div>
        <button type="button" class="bt-viewer-icon" id="bt-pdf-external" aria-label="Abrir con otra app" title="Abrir con otra app">↗</button>
      </header>
      <div class="bt-viewer-stage" id="bt-pdf-stage">
        <div class="bt-viewer-loading" id="bt-pdf-loading">Cargando página…</div>
        <div class="bt-pdf-pages-wrap" id="bt-pdf-pages-wrap">
          <div class="bt-pdf-page-slot" id="bt-pdf-slot-1">
            <img id="bt-pdf-image" class="bt-pdf-image" alt="" draggable="false" hidden />
          </div>
          <div class="bt-pdf-page-slot" id="bt-pdf-slot-2" hidden>
            <img id="bt-pdf-image-2" class="bt-pdf-image" alt="" draggable="false" hidden />
          </div>
        </div>
      </div>
      <footer class="bt-viewer-foot">
        <button type="button" class="bt-viewer-nav" id="bt-pdf-prev" aria-label="Página anterior" disabled>‹</button>
        <div class="bt-zoom" role="group" aria-label="Zoom">
          <button type="button" id="bt-pdf-zoom-out" aria-label="Alejar">−</button>
          <span id="bt-pdf-zoom" title="Restablecer al 100%">100%</span>
          <button type="button" id="bt-pdf-zoom-in" aria-label="Acercar">+</button>
        </div>
        <button type="button" class="bt-layout-toggle" id="bt-pdf-layout-btn" aria-label="Cambiar vista de páginas" title="Ver 2 páginas en horizontal">
          <span class="bt-layout-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 16H5V5h6v14zm8 0h-6V5h6v14z"/></svg>
          </span>
          <span id="bt-pdf-layout-label">2 págs</span>
        </button>
        <button type="button" class="bt-viewer-nav" id="bt-pdf-next" aria-label="Página siguiente" disabled>›</button>
      </footer>`;
    document.body.appendChild(pdfViewer);

    const imageViewer = document.createElement("div");
    imageViewer.id = "bt-image-viewer";
    imageViewer.className = "bt-viewer";
    imageViewer.hidden = true;
    imageViewer.setAttribute("role", "dialog");
    imageViewer.setAttribute("aria-modal", "true");
    imageViewer.setAttribute("aria-labelledby", "bt-image-title");
    imageViewer.innerHTML = `
      <header class="bt-viewer-head">
        <button type="button" class="bt-viewer-icon" id="bt-image-close" aria-label="Cerrar imagen">←</button>
        <div class="bt-viewer-title">
          <strong id="bt-image-title">Imagen</strong>
          <span id="bt-image-meta"></span>
        </div>
        <button type="button" class="bt-viewer-icon" id="bt-image-external" aria-label="Abrir con otra app" title="Abrir con otra app">↗</button>
      </header>
      <div class="bt-viewer-stage bt-image-stage">
        <img id="bt-image-img" alt="" draggable="false" />
      </div>`;
    document.body.appendChild(imageViewer);

    const htmlViewer = document.createElement("div");
    htmlViewer.id = "bt-html-viewer";
    htmlViewer.className = "bt-viewer";
    htmlViewer.hidden = true;
    htmlViewer.setAttribute("role", "dialog");
    htmlViewer.setAttribute("aria-modal", "true");
    htmlViewer.setAttribute("aria-labelledby", "bt-html-title");
    htmlViewer.innerHTML = `
      <header class="bt-viewer-head">
        <button type="button" class="bt-viewer-icon" id="bt-html-close" aria-label="Cerrar guía">←</button>
        <div class="bt-viewer-title">
          <strong id="bt-html-title">Guía HTML</strong>
          <span id="bt-html-meta"></span>
        </div>
        <button type="button" class="bt-viewer-icon" id="bt-html-external" aria-label="Abrir con otra app" title="Abrir con otra app">↗</button>
      </header>
      <div class="bt-viewer-stage bt-html-stage">
        <iframe id="bt-html-frame" class="bt-html-frame" sandbox="allow-same-origin" title="Contenido de la guía"></iframe>
      </div>`;
    document.body.appendChild(htmlViewer);

    $("bt-tab-download").addEventListener("click", () => setTab("download", true));
    $("bt-tab-files").addEventListener("click", () => setTab("files", true));
    $("bt-tab-app").addEventListener("click", () => setTab("app", true));

    $("bt-search").addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderList();
    });
    $("bt-category").addEventListener("change", (event) => {
      state.category = event.target.value;
      state.subcategory = "all";
      renderSubcategories();
      renderList();
    });
    $("bt-subcategory").addEventListener("change", (event) => {
      state.subcategory = event.target.value;
      renderList();
    });
    $("bt-section").addEventListener("change", (event) => {
      state.section = event.target.value;
      renderList();
    });
    $("bt-saved-search").addEventListener("input", (event) => {
      state.savedQuery = event.target.value.trim().toLowerCase();
      renderSavedList();
    });
    $("bt-download").addEventListener("click", downloadSelected);
    $("bt-delete").addEventListener("click", deleteSelected);
    $("bt-select-batch").addEventListener("click", selectBatchVisible);
    $("bt-select-visible").addEventListener("click", toggleVisibleSelection);
    $("bt-delete-all").addEventListener("click", deleteAllSaved);
    $("bt-open-saved-notes").addEventListener("click", () => {
      closeModal();
      setTimeout(() => {
        if (typeof window.openSavedPanel === "function") {
          window.openSavedPanel();
        }
      }, 120);
    });
    $("bt-update").addEventListener("click", () => updateContent(true, false));
    $("bt-check-app").addEventListener("click", () => checkAppUpdate(false));
    $("bt-verify-offline").addEventListener("click", () => verifyOfflineData(true));

    const otaBanner = document.createElement("div");
    otaBanner.id = "bt-ota-banner";
    otaBanner.className = "bt-ota-banner";
    otaBanner.hidden = true;
    otaBanner.setAttribute("role", "status");
    otaBanner.innerHTML =
      '<span>Nueva versión web lista en la app.</span>' +
      '<button type="button" class="bt-ota-banner-apply" id="bt-ota-banner-apply">Aplicar</button>' +
      '<button type="button" class="bt-ota-banner-dismiss" id="bt-ota-banner-dismiss" aria-label="Cerrar aviso">&times;</button>';
    document.body.appendChild(otaBanner);

    $("bt-ota-banner-apply").addEventListener("click", async () => {
      otaBanner.hidden = true;
      if (OtaUpdater && OtaUpdater.reloadApp) {
        await OtaUpdater.reloadApp().catch(() => location.reload());
      } else {
        location.reload();
      }
    });
    $("bt-ota-banner-dismiss").addEventListener("click", () => {
      otaBanner.hidden = true;
    });

    modal.querySelectorAll("[data-bt-close]").forEach((el) => el.addEventListener("click", closeModal));

    $("bt-pdf-close").addEventListener("click", closePdfReader);
    $("bt-pdf-prev").addEventListener("click", () => goPdfPage(-1));
    $("bt-pdf-next").addEventListener("click", () => goPdfPage(1));
    $("bt-pdf-zoom-out").addEventListener("click", () => stepPdfZoom(-0.25));
    $("bt-pdf-zoom-in").addEventListener("click", () => stepPdfZoom(0.25));
    $("bt-pdf-zoom").addEventListener("click", () => setPdfZoom(1, true));
    $("bt-pdf-layout-btn").addEventListener("click", togglePdfLayout);
    $("bt-pdf-external").addEventListener("click", () => {
      if (!state.pdf) return;
      openWithSystem(state.pdf.doc, state.pdf.entry);
    });
    $("bt-image-close").addEventListener("click", closeImageViewer);
    $("bt-image-external").addEventListener("click", () => {
      if (!state.image) return;
      openWithSystem(state.image.doc, state.image.entry);
    });
    $("bt-html-close").addEventListener("click", closeHtmlViewer);
    $("bt-html-external").addEventListener("click", () => {
      if (!state.html) return;
      openWithSystem(state.html.doc, state.html.entry);
    });
    window.addEventListener("message", handleViewerMessage);

    let touchStart = null;
    const stage = $("bt-pdf-stage");
    stage.addEventListener(
      "touchstart",
      (event) => {
        if (!state.pdf || state.pdf.zoom > 1 || event.touches.length !== 1) {
          touchStart = null;
          return;
        }
        touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchend",
      (event) => {
        if (!touchStart || !state.pdf) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        touchStart = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          goPdfPage(dx < 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    document.addEventListener("keydown", (event) => {
      if (state.pdf) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goPdfPage(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goPdfPage(1);
        } else if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          stepPdfZoom(0.25);
        } else if (event.key === "-") {
          event.preventDefault();
          stepPdfZoom(-0.25);
        } else if (event.key === "Escape") {
          event.preventDefault();
          closePdfReader();
        }
        return;
      }
      if (state.image) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeImageViewer();
        }
        return;
      }
      if (state.html) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeHtmlViewer();
        }
        return;
      }
      if (event.key === "Escape" && state.modalOpen) closeModal();
    });

    window.addEventListener("resize", () => {
      if (!state.pdf) return;
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(() => {
        if (!state.pdf) return;
        if (!state.pdf.userLayoutChoice) {
          const isLandscape = window.innerWidth > window.innerHeight;
          const isWide = window.innerWidth >= 680;
          state.pdf.twoPage = Boolean(isLandscape && isWide);
        }
        renderPdfPage(state.pdf.page);
      }, 200);
    });

    const setupDockIntegration = () => {
      const dock = document.getElementById("unifiedBottomDock");
      const dockBtn = document.getElementById("dockBtnSaved") || document.getElementById("dockBtnMochila");
      if (dock && dockBtn) {
        document.body.classList.add("has-unified-dock");
        if (!dockBtn.__btBound) {
          dockBtn.__btBound = true;
          dockBtn.addEventListener(
            "click",
            (e) => {
              e.preventDefault();
              e.stopImmediatePropagation();
              openModal("files");
            },
            true
          );
        }
      }
    };
    setupDockIntegration();
    setTimeout(setupDockIntegration, 600);
  }

  function setTab(tab, focusTab) {
    if (!["download", "files", "app"].includes(tab)) tab = "files";
    state.activeTab = tab;
    writePref("library_tab", tab);
    for (const name of ["download", "files", "app"]) {
      const button = $(`bt-tab-${name}`);
      const panel = $(`bt-panel-${name}`);
      const active = name === tab;
      if (button) {
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
        if (active && focusTab) button.focus();
      }
      if (panel) panel.hidden = !active;
    }
    const foot = $("bt-download-foot");
    if (foot) foot.hidden = tab !== "download";
    if (tab === "files") renderSavedList();
    if (tab === "app") renderAppInfo();
  }

  function renderStorage() {
    const entries = offlineEntries();
    const bytes = offlineBytes();
    const summary = entries.length
      ? `${entries.length} archivo${entries.length === 1 ? "" : "s"} guardado${entries.length === 1 ? "" : "s"} · ${fmtMB(bytes)}`
      : "Todavía no has descargado archivos";

    const storage = $("bt-storage");
    if (storage) {
      storage.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = summary;
      const span = document.createElement("span");
      span.textContent = entries.length
        ? "Disponibles aunque no tengas internet."
        : "Las preguntas y el texto ya funcionan sin conexión.";
      storage.append(strong, span);
    }

    const savedStorage = $("bt-saved-storage");
    if (savedStorage) {
      savedStorage.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = summary;
      const span = document.createElement("span");
      span.textContent = entries.length
        ? "Toca «Abrir» para ver un documento aquí mismo, sin conexión."
        : "Descarga manuales e insignias desde «Explorar catálogo».";
      savedStorage.append(strong, span);
    }

    const fabCount = $("bt-fab-count");
    if (fabCount) {
      fabCount.textContent = String(entries.length);
      fabCount.hidden = entries.length === 0;
    }

    const navBadge = $("bt-nav-badge");
    if (navBadge) {
      navBadge.textContent = String(entries.length);
      navBadge.hidden = entries.length === 0;
    }

    const dockBadge = $("dockSavedCount") || $("dockBackpackCount");
    if (dockBadge) {
      dockBadge.textContent = String(entries.length);
      dockBadge.classList.toggle("hidden", entries.length === 0);
    }

    const tabCount = $("bt-tab-files-count");
    if (tabCount) tabCount.textContent = String(entries.length);
    const downloadCount = $("bt-tab-download-count");
    if (downloadCount) downloadCount.textContent = String(state.docs.length);

    const deleteAll = $("bt-delete-all");
    if (deleteAll) deleteAll.disabled = entries.length === 0;

    const appStorage = $("bt-app-storage");
    if (appStorage) appStorage.textContent = entries.length ? `${entries.length} · ${fmtMB(bytes)}` : "Sin archivos";
  }

  function renderCategories() {
    const select = $("bt-category");
    if (!select) return;
    const cats = Array.from(new Set(state.docs.map((doc) => doc.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es")
    );
    select.innerHTML = '<option value="all">Todas las categorías</option>';
    for (const cat of cats) {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    }
    select.value = state.category;
  }

  function renderSubcategories() {
    const select = $("bt-subcategory");
    if (!select) return;
    const pool =
      state.category === "all" ? state.docs : state.docs.filter((doc) => doc.category === state.category);
    const subs = Array.from(new Set(pool.map((doc) => doc.subcategory).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es")
    );
    select.innerHTML = '<option value="all">Todas las subcategorías</option>';
    for (const sub of subs) {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      select.appendChild(option);
    }
    select.value = subs.includes(state.subcategory) ? state.subcategory : "all";
    state.subcategory = select.value;
  }

  function renderSections() {
    const select = $("bt-section");
    if (!select) return;
    const sections = Array.from(new Set(state.docs.map((doc) => doc.section))).sort((a, b) => a.localeCompare(b, "es"));
    select.innerHTML = '<option value="all">Todas las secciones</option>';
    for (const section of sections) {
      const option = document.createElement("option");
      option.value = section;
      option.textContent = section;
      select.appendChild(option);
    }
    select.value = state.section;
    renderCategories();
    renderSubcategories();
  }

  function visibleDocs() {
    return state.docs.filter((doc) => {
      if (state.section !== "all" && doc.section !== state.section) return false;
      if (state.category !== "all" && doc.category !== state.category) return false;
      if (state.subcategory !== "all" && doc.subcategory !== state.subcategory) return false;
      if (!state.query) return true;
      const haystack = `${doc.title} ${doc.section} ${doc.category} ${doc.subcategory} ${doc.year}`.toLowerCase();
      return haystack.includes(state.query);
    });
  }

  function renderList() {
    const list = $("bt-list");
    if (!list) return;
    const docs = visibleDocs();
    list.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (const doc of docs) {
      const saved = Boolean(state.offline[doc.sha12]);
      const row = document.createElement("label");
      row.className = saved ? "bt-row bt-row-saved" : "bt-row";
      row.setAttribute("role", "listitem");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "bt-check";
      check.checked = state.selected.has(doc.sha12);
      check.disabled = state.busy;
      check.setAttribute("aria-label", `Seleccionar ${doc.title}`);
      check.addEventListener("change", () => {
        if (check.checked) state.selected.add(doc.sha12);
        else state.selected.delete(doc.sha12);
        updateSelection();
      });

      const thumbWrap = document.createElement("span");
      thumbWrap.className = "bt-row-thumb-wrap";
      const thumbExt = document.createElement("span");
      thumbExt.className = "bt-row-ext";
      thumbExt.textContent = String(doc.ext || "?").toUpperCase().slice(0, 4);
      const thumbImg = document.createElement("img");
      thumbImg.className = "bt-row-thumb";
      thumbImg.src = `covers/${doc.sha12}.jpg`;
      thumbImg.alt = "";
      thumbImg.loading = "lazy";
      thumbImg.addEventListener("error", () => thumbImg.remove());
      thumbWrap.append(thumbExt, thumbImg);

      const main = document.createElement("span");
      main.className = "bt-row-main";
      const title = document.createElement("strong");
      title.textContent = doc.title;
      const meta = document.createElement("small");
      meta.textContent = `${doc.section}${doc.year ? ` · ${doc.year}` : ""} · ${doc.size ? fmtMB(doc.size) : "tamaño desconocido"}`;
      main.append(title, meta);

      const tag = document.createElement("span");
      tag.className = saved ? "bt-tag bt-tag-saved" : "bt-tag";
      tag.textContent = saved ? "Guardado" : doc.ext.toUpperCase();

      row.append(check, thumbWrap, main, tag);
      fragment.appendChild(row);
    }

    if (!docs.length) {
      const empty = document.createElement("p");
      empty.className = "bt-empty";
      empty.textContent = "No hay documentos que coincidan con la búsqueda.";
      fragment.appendChild(empty);
    }

    list.appendChild(fragment);
    const count = $("bt-count");
    if (count) {
      count.textContent = `${docs.length} documento${docs.length === 1 ? "" : "s"} descargable${docs.length === 1 ? "" : "s"} de ${state.docs.length}`;
    }
    updateSelection();
  }

  function updateSelection() {
    const total = state.selected.size;
    const selection = $("bt-selection");
    if (selection) selection.textContent = `${total} seleccionado${total === 1 ? "" : "s"}`;
    const download = $("bt-download");
    const remove = $("bt-delete");
    if (download) {
      download.disabled = total === 0 || state.busy;
      download.textContent = total ? `Descargar (${total})` : "Descargar";
    }
    if (remove) {
      remove.disabled = total === 0 || state.busy;
      remove.textContent = total ? `Borrar (${total})` : "Borrar";
    }

    const docs = visibleDocs();
    const allSelected = docs.length > 0 && docs.every((doc) => state.selected.has(doc.sha12));
    const selectVisible = $("bt-select-visible");
    if (selectVisible) {
      selectVisible.textContent = allSelected ? "Quitar selección" : "Seleccionar visibles";
      selectVisible.disabled = docs.length === 0 || state.busy;
    }
    const selectBatch = $("bt-select-batch");
    if (selectBatch) {
      selectBatch.disabled = docs.length === 0 || state.busy;
    }
  }

  function selectBatchVisible() {
    if (state.busy) return;
    const docs = visibleDocs();
    const pending = docs.filter((doc) => !state.offline[doc.sha12]);
    const pool = pending.length ? pending : docs;
    const batch = pool.slice(0, 25);
    if (!batch.length) return;
    batch.forEach((doc) => state.selected.add(doc.sha12));
    renderList();
    toast(`Seleccionados ${batch.length} documento${batch.length === 1 ? "" : "s"} del filtro actual.`);
  }

  function toggleVisibleSelection() {
    if (state.busy) return;
    const docs = visibleDocs();
    const allSelected = docs.length > 0 && docs.every((doc) => state.selected.has(doc.sha12));
    if (allSelected) {
      docs.forEach((doc) => state.selected.delete(doc.sha12));
    } else {
      docs.forEach((doc) => state.selected.add(doc.sha12));
    }
    renderList();
  }

  function renderSavedList() {
    const list = $("bt-saved-list");
    if (!list) return;
    const query = state.savedQuery;
    const entries = offlineEntries()
      .filter((item) => {
        if (!query) return true;
        return `${item.title || ""} ${item.section || ""} ${item.ext || ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));

    list.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "bt-empty-state";
      if (query) {
        empty.innerHTML = `
          <p class="bt-empty-desc">No hay archivos descargados que coincidan con «${query}».</p>
        `;
      } else {
        empty.innerHTML = `
          <div class="bt-empty-icon-wrap" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="38" height="38"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
          </div>
          <h3 class="bt-empty-title">Tu biblioteca sin conexión está vacía</h3>
          <p class="bt-empty-desc">Guarda manuales oficiales, reglamentos o insignias en tu dispositivo para poder consultarlos en cualquier campamento sin señal ni internet.</p>
          <button type="button" class="bt-btn bt-primary bt-empty-cta" id="bt-empty-to-catalog">
            <span>Explorar catálogo y descargar</span>
          </button>
        `;
        const cta = empty.querySelector("#bt-empty-to-catalog");
        if (cta) {
          cta.addEventListener("click", () => setTab("download", true));
        }
      }
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of entries) {
      const card = document.createElement("div");
      card.className = "bt-saved-card";
      card.setAttribute("role", "listitem");

      const icon = document.createElement("div");
      icon.className = `bt-saved-icon bt-ext-${String(item.ext || "bin").toLowerCase()}`;
      const extLabel = document.createElement("span");
      extLabel.className = "bt-saved-ext";
      extLabel.textContent = String(item.ext || "?").toUpperCase().slice(0, 4);
      icon.appendChild(extLabel);
      if (item.sha12) {
        const cover = document.createElement("img");
        cover.className = "bt-saved-thumb";
        cover.src = `covers/${item.sha12}.jpg`;
        cover.alt = "";
        cover.loading = "lazy";
        cover.addEventListener("error", () => cover.remove());
        icon.appendChild(cover);
      }

      const info = document.createElement("div");
      info.className = "bt-saved-info";
      info.setAttribute("tabindex", "0");
      info.setAttribute("role", "button");
      info.setAttribute("aria-label", `Abrir ${item.title || "documento"}`);

      const title = document.createElement("h4");
      title.className = "bt-saved-title";
      title.textContent = item.title || "Documento";

      const meta = document.createElement("div");
      meta.className = "bt-saved-meta";

      if (item.section) {
        const sec = document.createElement("span");
        sec.className = "bt-pill-section";
        sec.textContent = item.section;
        meta.appendChild(sec);
      }
      if (item.size) {
        const sz = document.createElement("span");
        sz.className = "bt-pill-size";
        sz.textContent = fmtMB(item.size);
        meta.appendChild(sz);
      }
      if (item.savedAt) {
        const dt = document.createElement("span");
        dt.className = "bt-pill-date";
        dt.textContent = formatDate(item.savedAt);
        meta.appendChild(dt);
      }
      info.append(title, meta);
      info.addEventListener("click", () => openSaved(item));
      info.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSaved(item);
        }
      });

      const actions = document.createElement("div");
      actions.className = "bt-saved-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "bt-btn bt-btn-open";
      openBtn.setAttribute("aria-label", `Abrir ${item.title || "documento"}`);
      openBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg><span>Abrir</span>';
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSaved(item);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "bt-btn bt-btn-delete";
      delBtn.setAttribute("aria-label", `Eliminar ${item.title || "documento"}`);
      delBtn.innerHTML = TRASH_SVG;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSaved(item.sha12);
      });

      actions.append(openBtn, delBtn);
      card.append(icon, info, actions);
      fragment.appendChild(card);
    }
    list.appendChild(fragment);
  }

  // ------------------------------------------------------------------
  // Descargas
  // ------------------------------------------------------------------
  let progressListener = null;
  async function ensureProgressListener() {
    if (progressListener || !Filesystem) return;
    progressListener = await Filesystem.addListener("progress", (data) => {
      if (!state.busy) return;
      const pct = data.contentLength ? Math.min(100, Math.round((data.bytes / data.contentLength) * 100)) : 0;
      $("bt-bar-fill").style.width = `${pct}%`;
      $("bt-progress-text").textContent = `Descargando… ${pct}% (${fmtMB(data.bytes)} de ${fmtMB(data.contentLength || 0)})`;
    });
  }

  async function cacheDocCover(sha12) {
    if (!sha12 || !Filesystem) return;
    try {
      const coverPath = `covers/${sha12}.jpg`;
      const stat = await Filesystem.stat({ path: coverPath, directory: "DATA" }).catch(() => null);
      if (stat) return;
      await Filesystem.downloadFile({
        url: `${SITE}/covers/${sha12}.jpg`,
        path: coverPath,
        directory: "DATA",
        recursive: true
      }).catch(() => {});
    } catch (_) {}
  }

  async function downloadDoc(doc, index, total) {
    if (!Filesystem) throw new Error("Filesystem no disponible");
    await ensureDataDirectory();
    const fileName = docFileName(doc);
    $("bt-progress-text").textContent = `Descargando ${index + 1} de ${total}: ${doc.title}`;
    $("bt-bar-fill").style.width = "0%";
    await Filesystem.downloadFile({
      url: docUrl(doc),
      path: `${DATA_DIR}/${fileName}`,
      directory: "DATA",
      recursive: true,
      progress: true,
    });
    if (doc.sha12) {
      cacheDocCover(doc.sha12).catch(() => {});
    }
    state.offline[doc.sha12] = {
      title: doc.title,
      ext: String(doc.ext || "pdf").toLowerCase(),
      section: doc.section || "General",
      size: doc.size || 0,
      savedAt: new Date().toISOString(),
    };
    await persistOfflineIndex();
  }

  async function downloadSelected() {
    if (state.busy || !state.selected.size) return;
    if (!state.online) {
      toast("Sin conexión. Conéctate para descargar archivos.");
      return;
    }
    const docs = state.docs.filter((doc) => state.selected.has(doc.sha12));
    if (!docs.length) return;
    const totalBytes = docs.reduce((sum, doc) => sum + (doc.size || 0), 0);
    const accepted = await confirmDialog(
      "Descargar archivos",
      `Se guardarán ${docs.length} archivo${docs.length === 1 ? "" : "s"} (${fmtMB(totalBytes)}). Puedes abrirlos o borrarlos después desde Mis descargas.`,
      "Descargar",
      "Cancelar"
    );
    if (!accepted) return;

    state.busy = true;
    updateSelection();
    $("bt-progress").hidden = false;
    await ensureProgressListener();
    let errors = 0;
    try {
      for (let i = 0; i < docs.length; i += 1) {
        try {
          await downloadDoc(docs[i], i, docs.length);
        } catch (error) {
          errors += 1;
          console.warn("No se pudo descargar", docs[i].sha12, error);
        }
        $("bt-bar-fill").style.width = `${Math.round(((i + 1) / docs.length) * 100)}%`;
      }
      $("bt-progress-text").textContent = errors
        ? `Listo con ${errors} error${errors === 1 ? "" : "es"}. Revisa tu conexión e inténtalo de nuevo.`
        : `Listo: ${docs.length} archivo${docs.length === 1 ? "" : "s"} disponible${docs.length === 1 ? "" : "s"} sin conexión.`;
      if (!errors) {
        state.selected.clear();
        toast(`¡Descarga completada! (${docs.length} archivo${docs.length === 1 ? "" : "s"})`);
        setTab("files", false);
      }
      renderStorage();
      renderList();
      renderSavedList();
      setTimeout(() => {
        if (!state.busy) $("bt-progress").hidden = true;
      }, 3500);
    } finally {
      state.busy = false;
      updateSelection();
    }
  }

  async function deleteFileEntry(sha12, entry) {
    if (Filesystem) {
      const extList = [entry && entry.ext, "pdf", "PDF", "png", "jpg", "docx", "xlsx"];
      const uniqueExts = Array.from(new Set(extList.filter(Boolean)));
      for (const ext of uniqueExts) {
        try {
          await Filesystem.deleteFile({
            path: `${DATA_DIR}/${sha12}.${ext}`,
            directory: "DATA",
          });
        } catch (_) {}
      }
    }
    delete state.offline[sha12];
    state.selected.delete(sha12);
    await persistOfflineIndex();
  }

  async function deleteSelected() {
    if (state.busy || !state.selected.size) return;
    const docs = Object.keys(state.offline).filter((sha) => state.selected.has(sha));
    if (!docs.length) {
      toast("Los archivos seleccionados no están descargados.");
      return;
    }
    const accepted = await confirmDialog(
      "Eliminar archivos",
      `Se eliminarán ${docs.length} archivo${docs.length === 1 ? "" : "s"} de este dispositivo. Las preguntas y el texto seguirán disponibles sin conexión.`,
      "Eliminar",
      "Cancelar"
    );
    if (!accepted) return;

    state.busy = true;
    updateSelection();
    for (const sha of docs) {
      await deleteFileEntry(sha, state.offline[sha]);
    }
    state.busy = false;
    state.selected.clear();
    renderStorage();
    renderList();
    renderSavedList();
    toast("Archivos eliminados");
  }

  async function deleteSaved(sha12) {
    const entry = state.offline[sha12];
    if (!entry) return;
    const accepted = await confirmDialog(
      "Eliminar archivo",
      `¿Deseas eliminar «${entry.title || "este documento"}» del dispositivo?\n\nPodrás volver a descargarlo cuando tengas conexión a internet.`,
      "Eliminar",
      "Cancelar"
    );
    if (!accepted) return;
    state.busy = true;
    try {
      await deleteFileEntry(sha12, entry);
      toast("Archivo eliminado del dispositivo");
    } catch (err) {
      console.warn("Error borrando archivo:", err);
      delete state.offline[sha12];
      await persistOfflineIndex();
    } finally {
      state.busy = false;
      renderStorage();
      renderList();
      renderSavedList();
    }
  }

  async function deleteAllSaved() {
    const entries = offlineEntries();
    if (!entries.length || state.busy) return;
    const accepted = await confirmDialog(
      "Eliminar todos los archivos",
      `Se eliminarán los ${entries.length} archivos descargados de este dispositivo.\n\nLas preguntas, textos y el contenido integrado seguirán funcionando sin conexión.`,
      "Eliminar todos",
      "Cancelar"
    );
    if (!accepted) return;
    state.busy = true;
    try {
      for (const entry of entries) {
        await deleteFileEntry(entry.sha12, entry);
      }
      toast("Todos los archivos fueron eliminados");
    } finally {
      state.busy = false;
      state.selected.clear();
      renderStorage();
      renderList();
      renderSavedList();
    }
  }

  // ------------------------------------------------------------------
  // Abrir archivos: lector PDF integrado, imágenes y visor del sistema
  // ------------------------------------------------------------------
  async function assertFile(doc) {
    if (!Filesystem) return null;
    const path = `${DATA_DIR}/${doc.sha12}.${doc.ext}`;
    try {
      await Filesystem.stat({ path, directory: "DATA" });
      return path;
    } catch (_) {
      return null;
    }
  }

  async function openSaved(item) {
    const doc =
      state.docs.find((candidate) => candidate.sha12 === item.sha12) || {
        sha12: item.sha12,
        title: item.title,
        ext: item.ext,
        section: item.section,
        size: item.size,
      };
    await openDoc(doc);
  }

  async function openDoc(doc) {
    const entry = state.offline[doc.sha12];
    if (!entry) {
      toast("Ese archivo no está descargado.");
      return false;
    }
    const ext = String(entry.ext || doc.ext || "pdf").toLowerCase();
    const normalized = { ...doc, ext };
    const path = await assertFile(normalized);
    if (!path) {
      delete state.offline[doc.sha12];
      await persistOfflineIndex();
      renderStorage();
      renderList();
      renderSavedList();
      toast("El archivo ya no está en el dispositivo. Vuelve a descargarlo.");
      return false;
    }
    if (ext === "pdf") return openPdfReader(normalized, entry);
    if (IMAGE_EXTS.has(ext)) return openImageViewer(normalized, entry);
    if (ext === "html" || ext === "htm") return openHtmlViewer(normalized, entry);
    if (ext === "xlsx") return openSpreadsheetViewer(normalized, entry);
    return openWithSystem(normalized, entry);
  }

  async function openWithSystem(doc, entry) {
    if (!Filesystem) {
      toast("No se pudo acceder al archivo.");
      return false;
    }
    try {
      const { uri } = await Filesystem.getUri({
        path: `${DATA_DIR}/${doc.sha12}.${doc.ext}`,
        directory: "DATA",
      });
      if (!FileOpener) {
        toast("No hay una app disponible para abrir este formato.");
        return false;
      }
      await FileOpener.open({
        filePath: uri,
        contentType: MIME[doc.ext] || "application/octet-stream",
        openWithDefault: true,
      });
      return true;
    } catch (error) {
      toast("No se pudo abrir el archivo. ¿Tienes un visor instalado?");
      console.warn(error);
      return false;
    }
  }

  function closePdfReader() {
    if (!state.pdf) return;
    state.pdf = null;
    const viewer = $("bt-pdf-viewer");
    if (viewer) viewer.hidden = true;
    const image1 = $("bt-pdf-image");
    if (image1) {
      image1.removeAttribute("src");
      image1.hidden = true;
      image1.style.maxHeight = "";
      image1.style.maxWidth = "";
      image1.style.width = "";
      image1.style.height = "";
    }
    const image2 = $("bt-pdf-image-2");
    if (image2) {
      image2.removeAttribute("src");
      image2.hidden = true;
      image2.style.maxHeight = "";
      image2.style.maxWidth = "";
      image2.style.width = "";
      image2.style.height = "";
    }
    const slot2 = $("bt-pdf-slot-2");
    if (slot2) slot2.hidden = true;
    const wrap = $("bt-pdf-pages-wrap");
    if (wrap) {
      wrap.classList.remove("bt-pdf-spread");
      wrap.classList.remove("is-zoomed");
    }
    document.documentElement.classList.remove("bt-viewer-open");
    if (PdfViewer && PdfViewer.close) PdfViewer.close().catch(() => {});
  }

  async function openPdfReader(doc, entry) {
    if (!PdfViewer) {
      toast("El lector integrado no está disponible. Abriendo con otra app…");
      return openWithSystem(doc, entry);
    }
    closeImageViewer();
    closeHtmlViewer();
    const path = `${DATA_DIR}/${doc.sha12}.${doc.ext}`;
    const isLandscape = window.innerWidth > window.innerHeight;
    const isWide = window.innerWidth >= 680;
    state.pdf = {
      doc,
      entry,
      path,
      pages: 0,
      page: 0,
      zoom: 1,
      twoPage: Boolean(isLandscape && isWide),
      userLayoutChoice: false,
      cache: new Map(),
      token: 0,
    };
    const viewer = $("bt-pdf-viewer");
    viewer.hidden = false;
    document.documentElement.classList.add("bt-viewer-open");
    $("bt-pdf-title").textContent = doc.title || "Documento";
    $("bt-pdf-page").textContent = "Abriendo…";
    $("bt-pdf-image").hidden = true;
    $("bt-pdf-image").removeAttribute("src");
    const img2 = $("bt-pdf-image-2");
    if (img2) {
      img2.hidden = true;
      img2.removeAttribute("src");
    }
    const slot2 = $("bt-pdf-slot-2");
    if (slot2) slot2.hidden = !state.pdf.twoPage;
    $("bt-pdf-loading").hidden = false;
    $("bt-pdf-loading").textContent = "Preparando el documento…";
    $("bt-pdf-prev").disabled = true;
    $("bt-pdf-next").disabled = true;
    setPdfZoom(1, true);

    try {
      const info = await PdfViewer.open({ path });
      if (!state.pdf) return false;
      state.pdf.pages = Number(info && info.pages) || 0;
      if (!state.pdf.pages) throw new Error("El PDF no tiene páginas.");

      let initialPage = 0;
      let initialZoom = 1;
      try {
        const raw = localStorage.getItem(`bt_reader_state_${doc.sha12}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.page === "number" && parsed.page >= 0 && parsed.page < state.pdf.pages) {
            initialPage = parsed.page;
          }
          if (typeof parsed.zoom === "number" && parsed.zoom >= 0.45 && parsed.zoom <= 2.45) {
            initialZoom = parsed.zoom;
          }
        }
      } catch (_) {}

      if (initialZoom !== 1) {
        setPdfZoom(initialZoom, true);
      }
      await renderPdfPage(initialPage);
      if (initialPage > 0) {
        toast(`Continuando en la página ${initialPage + 1}`);
      }
      return true;
    } catch (error) {
      console.warn("No se pudo abrir el PDF", error);
      closePdfReader();
      toast("No se pudo abrir el PDF. Probando con el visor del sistema…");
      return openWithSystem(doc, entry);
    }
  }

  function savePdfReaderState() {
    const pdf = state.pdf;
    if (!pdf || !pdf.doc || !pdf.doc.sha12) return;
    try {
      localStorage.setItem(
        `bt_reader_state_${pdf.doc.sha12}`,
        JSON.stringify({
          page: pdf.page,
          zoom: pdf.zoom,
        })
      );
    } catch (_) {}
  }

  function applyPdfZoom() {
    const pdf = state.pdf;
    if (!pdf) return;
    const zoom = pdf.zoom;
    const stage = $("bt-pdf-stage");
    const wrap = $("bt-pdf-pages-wrap");
    const img1 = $("bt-pdf-image");
    const img2 = $("bt-pdf-image-2");

    const label = $("bt-pdf-zoom");
    if (label) label.textContent = `${Math.round(zoom * 100)}%`;

    const zoomOutBtn = $("bt-pdf-zoom-out");
    const zoomInBtn = $("bt-pdf-zoom-in");
    if (zoomOutBtn) zoomOutBtn.disabled = zoom <= 0.45;
    if (zoomInBtn) zoomInBtn.disabled = zoom >= 2.45;

    if (Math.abs(zoom - 1) < 0.01) {
      if (img1) {
        img1.style.maxHeight = "";
        img1.style.maxWidth = "";
        img1.style.width = "";
        img1.style.height = "";
      }
      if (img2) {
        img2.style.maxHeight = "";
        img2.style.maxWidth = "";
        img2.style.width = "";
        img2.style.height = "";
      }
      if (wrap) wrap.classList.remove("is-zoomed");
    } else {
      const baseHeight = Math.max(300, (stage ? stage.clientHeight : window.innerHeight) - 120);
      const targetHeight = Math.round(baseHeight * zoom);
      if (img1) {
        img1.style.maxHeight = `${targetHeight}px`;
        img1.style.maxWidth = zoom > 1 ? "none" : "";
        img1.style.width = "auto";
        img1.style.height = `${targetHeight}px`;
      }
      if (img2) {
        img2.style.maxHeight = `${targetHeight}px`;
        img2.style.maxWidth = zoom > 1 ? "none" : "";
        img2.style.width = "auto";
        img2.style.height = `${targetHeight}px`;
      }
      if (wrap) wrap.classList.toggle("is-zoomed", zoom > 1);
    }
  }

  function setPdfZoom(value, reset) {
    if (!state.pdf) return;
    const minZoom = 0.4;
    const maxZoom = 2.5;
    const zoom = Math.max(minZoom, Math.min(maxZoom, reset ? 1 : Math.round(value * 100) / 100));
    state.pdf.zoom = zoom;
    applyPdfZoom();
    savePdfReaderState();
  }

  function stepPdfZoom(delta) {
    if (!state.pdf) return;
    setPdfZoom(state.pdf.zoom + delta, false);
  }

  function togglePdfLayout() {
    const pdf = state.pdf;
    if (!pdf) return;
    pdf.userLayoutChoice = true;
    pdf.twoPage = !pdf.twoPage;
    if (pdf.twoPage && pdf.page % 2 !== 0 && pdf.page > 0) {
      pdf.page -= 1;
    }
    renderPdfPage(pdf.page);
  }

  function updatePdfNav() {
    const pdf = state.pdf;
    if (!pdf) return;
    const label = $("bt-pdf-page");
    const target2 = (pdf.twoPage && pdf.page + 1 < pdf.pages) ? pdf.page + 1 : null;
    if (label) {
      if (target2 !== null) {
        label.textContent = `Páginas ${pdf.page + 1} - ${target2 + 1} de ${pdf.pages}`;
      } else {
        label.textContent = `Página ${pdf.page + 1} de ${pdf.pages}`;
      }
    }
    const prev = $("bt-pdf-prev");
    const next = $("bt-pdf-next");
    if (prev) prev.disabled = pdf.page <= 0;
    if (next) {
      const lastRendered = target2 !== null ? target2 : pdf.page;
      next.disabled = lastRendered >= pdf.pages - 1;
    }
    const layoutLabel = $("bt-pdf-layout-label");
    const layoutBtn = $("bt-pdf-layout-btn");
    if (layoutLabel) {
      layoutLabel.textContent = pdf.twoPage ? "1 pág" : "2 págs";
    }
    if (layoutBtn) {
      layoutBtn.setAttribute("aria-label", pdf.twoPage ? "Cambiar a 1 página" : "Cambiar a 2 páginas");
      layoutBtn.title = pdf.twoPage ? "Ver 1 página" : "Ver 2 páginas en horizontal";
    }
  }

  function applyPdfSlot(img, dataUrl, pageIndex, totalPages) {
    if (!img) return;
    img.src = dataUrl;
    img.alt = `Página ${pageIndex + 1} de ${totalPages}`;
    img.hidden = false;
  }

  async function renderPdfPage(page) {
    const pdf = state.pdf;
    if (!pdf || !pdf.pages) return;

    let target = Math.max(0, Math.min(pdf.pages - 1, page));
    if (pdf.twoPage && target % 2 !== 0 && target > 0) {
      target -= 1;
    }
    pdf.page = target;
    savePdfReaderState();

    const target2 = (pdf.twoPage && target + 1 < pdf.pages) ? target + 1 : null;
    const width = (window.innerWidth >= 720 && !pdf.twoPage) ? 1800 : 1200;

    updatePdfNav();

    const stage = $("bt-pdf-stage");
    if (stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }

    const wrap = $("bt-pdf-pages-wrap");
    if (wrap) {
      wrap.classList.toggle("bt-pdf-spread", Boolean(pdf.twoPage && target2 !== null));
    }

    const slot2 = $("bt-pdf-slot-2");
    if (slot2) {
      slot2.hidden = !pdf.twoPage || target2 === null;
    }

    const token = ++pdf.token;
    const loading = $("bt-pdf-loading");
    const img1 = $("bt-pdf-image");
    const img2 = $("bt-pdf-image-2");

    const key1 = `${target}@${width}`;
    const cached1 = pdf.cache.get(key1);
    const key2 = target2 !== null ? `${target2}@${width}` : null;
    const cached2 = key2 ? pdf.cache.get(key2) : null;

    if (cached1 && (!key2 || cached2)) {
      applyPdfSlot(img1, cached1, target, pdf.pages);
      if (key2 && cached2) {
        applyPdfSlot(img2, cached2, target2, pdf.pages);
      } else if (img2) {
        img2.hidden = true;
      }
      if (loading) loading.hidden = true;
      applyPdfZoom();
      return;
    }

    if (loading) {
      loading.hidden = false;
      loading.textContent = target2 !== null
        ? `Cargando páginas ${target + 1} y ${target2 + 1}…`
        : `Cargando página ${target + 1}…`;
    }

    try {
      let data1 = cached1;
      if (!data1) {
        const res1 = await PdfViewer.renderPage({ page: target, width });
        if (!state.pdf || state.pdf !== pdf || token !== pdf.token) return;
        data1 = res1.dataUrl;
        pdf.cache.set(key1, data1);
      }
      applyPdfSlot(img1, data1, target, pdf.pages);

      if (target2 !== null) {
        let data2 = cached2;
        if (!data2) {
          const res2 = await PdfViewer.renderPage({ page: target2, width });
          if (!state.pdf || state.pdf !== pdf || token !== pdf.token) return;
          data2 = res2.dataUrl;
          pdf.cache.set(key2, data2);
        }
        applyPdfSlot(img2, data2, target2, pdf.pages);
      } else if (img2) {
        img2.hidden = true;
      }

      if (pdf.cache.size > 20) {
        const oldest = pdf.cache.keys().next().value;
        pdf.cache.delete(oldest);
      }

      if (loading) loading.hidden = true;
      applyPdfZoom();
    } catch (error) {
      if (!state.pdf || state.pdf !== pdf) return;
      console.warn("No se pudo renderizar la página", error);
      if (loading) {
        loading.hidden = false;
        loading.textContent = "No se pudo mostrar esta página. Puedes abrir el archivo con otra app.";
      }
    }
  }

  function goPdfPage(delta) {
    const pdf = state.pdf;
    if (!pdf) return;
    const step = pdf.twoPage ? (delta > 0 ? 2 : -2) : delta;
    const next = pdf.page + step;
    if (delta < 0 && pdf.page <= 0) return;
    if (delta > 0 && pdf.page >= pdf.pages - 1) return;
    renderPdfPage(Math.max(0, Math.min(pdf.pages - 1, next)));
  }

  function closeImageViewer() {
    if (!state.image) return;
    state.image = null;
    const viewer = $("bt-image-viewer");
    if (viewer) viewer.hidden = true;
    const image = $("bt-image-img");
    if (image) {
      image.removeAttribute("src");
      image.alt = "";
      image.onerror = null;
    }
    document.documentElement.classList.remove("bt-viewer-open");
  }

  async function openImageViewer(doc, entry) {
    closePdfReader();
    closeHtmlViewer();
    const path = `${DATA_DIR}/${doc.sha12}.${doc.ext}`;
    let src = "";
    try {
      const { uri } = await Filesystem.getUri({ path, directory: "DATA" });
      src = Cap.convertFileSrc ? Cap.convertFileSrc(uri) : uri;
    } catch (_) {}
    state.image = { doc, entry, path };
    const viewer = $("bt-image-viewer");
    viewer.hidden = false;
    document.documentElement.classList.add("bt-viewer-open");
    $("bt-image-title").textContent = doc.title || "Imagen";
    $("bt-image-meta").textContent = `${String(doc.ext || "").toUpperCase()}${entry.size ? ` · ${fmtMB(entry.size)}` : ""}`;
    const image = $("bt-image-img");
    image.onerror = async () => {
      image.onerror = null;
      if (!Filesystem || !Filesystem.readFile) {
        image.alt = "No se pudo mostrar la imagen.";
        return;
      }
      try {
        const { data } = await Filesystem.readFile({ path, directory: "DATA" });
        image.src = `data:${MIME[doc.ext] || "image/*"};base64,${data}`;
      } catch (_) {
        image.alt = "No se pudo mostrar la imagen.";
      }
    };
    if (src) image.src = src;
    else image.onerror();
    return true;
  }

  function closeHtmlViewer() {
    if (!state.html) return;
    state.html = null;
    const viewer = $("bt-html-viewer");
    if (viewer) viewer.hidden = true;
    const frame = $("bt-html-frame");
    if (frame) frame.removeAttribute("srcdoc");
    document.documentElement.classList.remove("bt-viewer-open");
  }

  async function openHtmlViewer(doc, entry) {
    closePdfReader();
    closeImageViewer();
    const path = `${DATA_DIR}/${doc.sha12}.${doc.ext}`;
    state.html = { doc, entry, path };
    const viewer = $("bt-html-viewer");
    viewer.hidden = false;
    document.documentElement.classList.add("bt-viewer-open");
    $("bt-html-title").textContent = doc.title || "Guía HTML";
    $("bt-html-meta").textContent = `${doc.category || "Guía Web"}${entry.size ? ` · ${fmtMB(entry.size)}` : ""}`;
    const frame = $("bt-html-frame");
    try {
      const { data } = await Filesystem.readFile({ path, directory: "DATA", encoding: "utf8" });
      let htmlText = String(data || "");
      if (!htmlText.trim().startsWith("<") && /^[A-Za-z0-9+/=\s]+$/.test(htmlText.slice(0, 64))) {
        const bin = atob(htmlText.replace(/\s+/g, ""));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        htmlText = new TextDecoder("utf-8").decode(bytes);
      }
      frame.srcdoc = htmlText;
    } catch (_) {
      frame.srcdoc = "<p style='padding:24px;font-family:sans-serif;'>No se pudo abrir esta guía HTML offline.</p>";
    }
    return true;
  }

  function buildSpreadsheetHtml(doc, pkg, isDark) {
    const payload = JSON.stringify(pkg.sheets || []).replace(/<\/script/gi, "<\\/script");
    const safeTitle = JSON.stringify(String(doc && doc.title ? doc.title : "hoja_scout").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "hoja_scout");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:12px;font-family:system-ui,-apple-system,sans-serif;background:${isDark ? "#0d0822" : "#f8fafc"};color:${isDark ? "#e2e8f0" : "#0f172a"};}
  .tabs-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
  .tabs{display:flex;flex-wrap:wrap;gap:6px;}
  .tab{padding:6px 12px;border-radius:10px;border:1px solid ${isDark ? "rgba(139,92,246,.45)" : "#cbd5e1"};background:${isDark ? "rgba(24,15,50,.94)" : "#fff"};color:${isDark ? "#f8fafc" : "#1e293b"};font-weight:700;font-size:12px;cursor:pointer;}
  .tab.active{background:linear-gradient(135deg,#7928ca,#0284c7);color:#fff;border-color:transparent;}
  .csv-btn{background:${isDark ? "rgba(16,185,129,.2)" : "#ecfdf5"};color:${isDark ? "#6ee7b7" : "#065f46"};border-color:${isDark ? "rgba(16,185,129,.45)" : "#a7f3d0"};}
  .q{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid ${isDark ? "rgba(139,92,246,.45)" : "#cbd5e1"};background:${isDark ? "#140c2b" : "#fff"};color:${isDark ? "#fff" : "#0f172a"};font-size:13px;margin-bottom:10px;}
  .wrap{overflow:auto;max-height:74vh;border:1px solid ${isDark ? "rgba(139,92,246,.4)" : "#cbd5e1"};border-radius:12px;background:${isDark ? "#0a0618" : "#fff"};}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{border:1px solid ${isDark ? "rgba(139,92,246,.22)" : "#e2e8f0"};padding:6px 8px;text-align:left;vertical-align:top;max-width:240px;word-break:break-word;}
  thead th{position:sticky;top:0;background:${isDark ? "#1c113d" : "#ede9fe"};color:${isDark ? "#c4b5fd" : "#4c1d95"};text-align:center;font-weight:800;}
  tr.hdr td{background:${isDark ? "rgba(56,189,248,.14)" : "#f1f5f9"};font-weight:800;}
  .num{background:${isDark ? "#140c2b" : "#f1f5f9"};color:#64748b;text-align:center;width:36px;font-weight:700;}
  .note{font-size:11px;color:${isDark ? "#cbd5e1" : "#475569"};margin-top:8px;}
</style></head><body>
<div class="tabs-bar">
  <div class="tabs" id="tabs"></div>
  <button type="button" class="tab csv-btn" id="csvExportBtn">Exportar CSV</button>
</div>
<input type="search" id="q" class="q" placeholder="Filtrar texto dentro de la hoja..." />
<div class="wrap" id="stage"></div>
<div class="note" id="note"></div>
<script>
const sheets = ${payload};
const baseTitle = ${safeTitle};
let active = 0;
function col(i){let n=i+1,s="";while(n>0){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function draw(){
  const tabs=document.getElementById("tabs");
  tabs.innerHTML=sheets.map((s,i)=>'<button class="tab '+(i===active?'active':'')+'" data-i="'+i+'">'+esc(s.name)+' ('+s.total_rows+')</button>').join("");
  tabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{active=+b.dataset.i;draw();});
  const s=sheets[active]; if(!s)return;
  const f=document.getElementById("q").value.trim().toLowerCase();
  const rows=f?s.rows.filter((r,i)=>i===0||r.some(c=>String(c).toLowerCase().includes(f))):s.rows;
  const cols=Math.max(s.total_cols||1,...rows.map(r=>r.length),1);
  let th='<th>#</th>'+Array.from({length:cols},(_,i)=>'<th>'+col(i)+'</th>').join("");
  let tb=rows.map((r,ri)=>'<tr class="'+(ri===0?'hdr':'')+'"><th class="num">'+(ri+1)+'</th>'+Array.from({length:cols},(_,ci)=>'<td>'+esc(r[ci]||"")+'</td>').join("")+'</tr>').join("");
  document.getElementById("stage").innerHTML='<table><thead><tr>'+th+'</tr></thead><tbody>'+tb+'</tbody></table>';
  document.getElementById("note").textContent=s.truncated?('Mostrando '+s.displayed_rows+' de '+s.total_rows+' filas. Pulsa "Abrir con otra app" para ver o editar el .xlsx completo.'):'Vista sin conexión de hoja de cálculo Excel.';
}
document.getElementById("q").oninput=draw;
document.getElementById("csvExportBtn").onclick=()=>{
  const s=sheets[active]; if(!s||!s.rows)return;
  const csv="\\uFEFF"+s.rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\\r\\n");
  const sheetSlug=String(s.name||"hoja").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"")||"hoja";
  const filename=baseTitle+"_"+sheetSlug+".csv";
  if(window.parent&&window.parent!==window){
    window.parent.postMessage({type:"bt-export-csv",filename,csv},"*");
  }
};
draw();
</script></body></html>`;
  }

  async function handleViewerMessage(event) {
    const frame = $("bt-html-frame");
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== "bt-export-csv" || typeof data.csv !== "string") return;
    const safeName =
      String(data.filename || "hoja_scout.csv")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "hoja_scout.csv";
    if (Filesystem) {
      try {
        const exportPath = `${DATA_DIR}/_exports/${safeName}`;
        await Filesystem.writeFile({
          path: exportPath,
          data: data.csv,
          directory: "DATA",
          encoding: "utf8",
          recursive: true,
        });
        toast(`CSV exportado: ${safeName}`);
        if (FileOpener) {
          const { uri } = await Filesystem.getUri({ path: exportPath, directory: "DATA" });
          try {
            await FileOpener.open({
              filePath: uri,
              contentType: "text/csv",
              openWithDefault: true,
            });
          } catch (_) {}
        }
        return;
      } catch (error) {
        console.warn("No se pudo guardar CSV nativo", error);
      }
    }
    try {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`CSV exportado: ${safeName}`);
    } catch (_) {
      toast("No se pudo exportar el CSV en este dispositivo.");
    }
  }

  async function openSpreadsheetViewer(doc, entry) {
    try {
      const res = await fetch("data/spreadsheets.json");
      const db = res && res.ok ? await res.json() : {};
      const pkg = db && db[doc.sha12];
      if (!pkg || !pkg.sheets || !pkg.sheets.length) {
        return openWithSystem(doc, entry);
      }
      closePdfReader();
      closeImageViewer();
      const path = `${DATA_DIR}/${doc.sha12}.${doc.ext}`;
      state.html = { doc, entry, path };
      const viewer = $("bt-html-viewer");
      viewer.hidden = false;
      document.documentElement.classList.add("bt-viewer-open");
      $("bt-html-title").textContent = doc.title || "Hoja de cálculo Excel";
      $("bt-html-meta").textContent = `Excel (.xlsx) · ${pkg.sheet_count || pkg.sheets.length} hojas${entry.size ? ` · ${fmtMB(entry.size)}` : ""}`;
      const isDark = document.documentElement.getAttribute("data-camp-mode") === "true";
      $("bt-html-frame").srcdoc = buildSpreadsheetHtml(doc, pkg, isDark);
      return true;
    } catch (_) {
      return openWithSystem(doc, entry);
    }
  }

  // ------------------------------------------------------------------
  // Aplicación: información, verificación y actualizaciones
  // ------------------------------------------------------------------
  async function renderAppInfo() {
    const versionEl = $("bt-app-version");
    if (versionEl && App && App.getInfo) {
      try {
        state.appInfo = state.appInfo || (await App.getInfo());
        versionEl.textContent = `v${state.appInfo.version || "?"}`;
      } catch (_) {}
    }

    if (!state.siteInfo) {
      try {
        const res = await fetch("app-build.json", { cache: "no-store" });
        if (res.ok) state.siteInfo = await res.json();
      } catch (_) {}
    }
    const siteEl = $("bt-app-site");
    if (siteEl) {
      siteEl.textContent = state.siteInfo
        ? `${state.siteInfo.siteCommit || "—"}${state.siteInfo.versionLabel ? ` · ${state.siteInfo.versionLabel}` : ""}`
        : "—";
    }
    const otaEl = $("bt-app-ota");
    if (otaEl) {
      let otaLabel = "Activa (web y datos)";
      if (OtaUpdater && OtaUpdater.getOtaStatus) {
        try {
          const ota = await OtaUpdater.getOtaStatus();
          if (ota && ota.active) {
            const stamp = ota.updatedAt ? formatDate(ota.updatedAt) : "al día";
            otaLabel = `Web actualizada (${stamp || "al día"})`;
          } else {
            otaLabel = "Al día (base del APK)";
          }
        } catch (_) {}
      }
      otaEl.textContent = otaLabel;
    }
    const networkEl = $("bt-app-network");
    if (networkEl) networkEl.textContent = state.online ? "Con conexión" : "Sin conexión";
    renderStorage();
  }

  function setAppStatus(text) {
    const status = $("bt-app-status");
    if (status) status.textContent = text;
  }

  async function verifyOfflineData(manual) {
    const checks = [
      ["Banco de preguntas", "data/questions_bank.json", (json) => (json.questions || []).length],
      ["FAQ V3", "data/faq_v3.json", (json) => (json.questions || []).length],
      ["FAQ ampliado V4", "data/faq_v4.json", (json) => (json.questions || []).length],
      ["Base de conocimiento", "data/knowledge_base.json", (json) => (json.topics || []).length],
      ["Fragmentos", "data/chunks.json", (json) => (Array.isArray(json) ? json.length : 0)],
    ];
    setAppStatus("Comprobando que las preguntas y los textos estén completos…");
    const parts = [];
    let ok = 0;
    for (const [label, url, count] of checks) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const total = count(json);
        if (!total) throw new Error("vacío");
        parts.push(`${label}: ${total.toLocaleString("es-MX")}`);
        ok += 1;
      } catch (error) {
        console.warn("Verificación offline fallida", url, error);
        parts.push(`${label}: error`);
      }
    }
    const message =
      ok === checks.length
        ? `Todo listo sin conexión · ${parts.join(" · ")}`
        : `Revisión parcial · ${parts.join(" · ")}`;
    setAppStatus(message);
    if (manual) toast(ok === checks.length ? "Preguntas y textos disponibles sin conexión" : "Algunos datos no se pudieron leer");
    return ok === checks.length;
  }

  // ------------------------------------------------------------------
  // Actualización automática de web y contenido (sin publicar APK)
  // ------------------------------------------------------------------
  function isBundledFileStillCurrent(headRes, builtAtMs) {
    if (!builtAtMs) return false;
    const lastMod = headRes.headers.get("last-modified");
    if (!lastMod) return false;
    const lmMs = Date.parse(lastMod);
    if (!Number.isFinite(lmMs)) return false;
    return lmMs <= builtAtMs + 15 * 60 * 1000;
  }

  function patchRemoteHtml(rawHtml) {
    let out = String(rawHtml || "");
    const label = (state.siteInfo && state.siteInfo.versionLabel) || "";
    if (label) {
      out = out.replace(
        /(<p class="footer-db-cutoff">\s*Base de datos:\s*)([^<]+)(<\/p>)/i,
        (match, start, body, end) => {
          const cutoff = (body.match(/\d{2}\/\d{2}\/\d{4}/) || ["11/11/2026"])[0];
          return `${start}${cutoff} · ${label}${end}`;
        }
      );
    }
    if (!out.includes("native-early.js")) {
      out = out.replace("</head>", '  <script src="native-early.js"></script>\n</head>');
    }
    if (!out.includes("native.css")) {
      out = out.replace("</head>", '  <link rel="stylesheet" href="native.css" />\n</head>');
    }
    if (!out.includes("native-bridge.js")) {
      out = out.replace("</body>", '  <script src="native-bridge.js" defer></script>\n</body>');
    }
    return out;
  }

  async function stageTextFile(relPath, content) {
    if (!Filesystem) return;
    await Filesystem.writeFile({
      path: `${OTA_STAGING_DIR}/${relPath}`,
      data: content,
      directory: "DATA",
      encoding: "utf8",
      recursive: true,
    });
  }

  let autoSyncInFlight = false;

  async function updateContent(manual, silent) {
    if (state.busy || autoSyncInFlight) return;
    if (!state.online) {
      if (manual) toast("Sin conexión. Conéctate para buscar actualizaciones.");
      return;
    }

    if (manual) {
      state.busy = true;
      $("bt-progress").hidden = false;
      $("bt-progress-text").textContent = "Buscando actualizaciones web y de contenido…";
      $("bt-bar-fill").style.width = "8%";
    } else {
      autoSyncInFlight = true;
    }

    try {
      if (!state.siteInfo) {
        try {
          const infoRes = await fetch("app-build.json", { cache: "no-store" });
          if (infoRes.ok) state.siteInfo = await infoRes.json();
        } catch (_) {}
      }
      const builtAtMs = state.siteInfo && state.siteInfo.builtAt ? Date.parse(state.siteInfo.builtAt) : 0;

      const cache = await caches.open(CACHE_NAME);
      const etags = await readPref("content_etags", {});
      const shellEtags = await readPref("shell_etags", {});
      let updated = 0;
      let shellUpdated = false;

      // 1. Verificar capa web (index.html, styles.css, app.js) para actualización OTA sin APK
      if (Filesystem && OtaUpdater) {
        try {
          let needsShellBundle = false;
          const pendingEtags = { ...shellEtags };

          for (const file of SHELL_FILES) {
            const head = await fetch(`${SITE}/${file}`, { method: "HEAD", cache: "no-store" }).catch(() => null);
            if (!head || !head.ok) continue;
            const etag =
              head.headers.get("etag") ||
              [head.headers.get("last-modified"), head.headers.get("content-length")].filter(Boolean).join("|") ||
              "";
            if (!etag) continue;
            if (!pendingEtags[file]) {
              if (isBundledFileStillCurrent(head, builtAtMs)) {
                pendingEtags[file] = etag;
                continue;
              }
            }
            if (pendingEtags[file] !== etag) {
              needsShellBundle = true;
              pendingEtags[file] = etag;
            }
          }

          if (needsShellBundle) {
            if (manual) {
              $("bt-bar-fill").style.width = "20%";
              $("bt-progress-text").textContent = "Descargando interfaz web actualizada…";
            }

            const [htmlRes, cssRes, jsRes] = await Promise.all([
              fetch(`${SITE}/index.html`, { cache: "no-store" }),
              fetch(`${SITE}/styles.css`, { cache: "no-store" }),
              fetch(`${SITE}/app.js`, { cache: "no-store" }),
            ]);

            if (htmlRes.ok && cssRes.ok && jsRes.ok) {
              const [rawHtml, rawCss, rawJs] = await Promise.all([
                htmlRes.text(),
                cssRes.text(),
                jsRes.text(),
              ]);
              const patchedHtml = patchRemoteHtml(rawHtml);

              if (
                patchedHtml.length >= 10240 &&
                patchedHtml.includes("contenido-principal") &&
                patchedHtml.includes("native-bridge.js") &&
                patchedHtml.includes("app.js") &&
                rawCss.length >= 10240 &&
                rawJs.length >= 10240
              ) {
                await stageTextFile("index.html", patchedHtml);
                await stageTextFile("styles.css", rawCss);
                await stageTextFile("app.js", rawJs);
                await OtaUpdater.promoteStaging({
                  siteCommit: "ota-web",
                  updatedAt: new Date().toISOString(),
                });
                await writePref("shell_etags", pendingEtags);
                shellUpdated = true;
                updated += 3;
              }
            }
          } else {
            await writePref("shell_etags", pendingEtags);
          }
        } catch (shellError) {
          console.warn("No se pudo actualizar la interfaz web", shellError);
        }
      }

      // 2. Verificar bases de datos JSON del catálogo, preguntas y fragmentos
      for (let i = 0; i < DATA_JSON.length; i += 1) {
        const path = DATA_JSON[i];
        const remoteUrl = `${SITE}/${path}`;
        const absUrl = new URL(path, location.href).href;
        if (manual) {
          $("bt-bar-fill").style.width = `${25 + Math.round((i / DATA_JSON.length) * 40)}%`;
          $("bt-progress-text").textContent = `Revisando ${path.split("/").pop()}…`;
        }
        try {
          const head = await fetch(remoteUrl, { method: "HEAD", cache: "no-store" });
          if (!head.ok) continue;
          const etag =
            head.headers.get("etag") ||
            [head.headers.get("last-modified"), head.headers.get("content-length")].filter(Boolean).join("|") ||
            "";
          if (etag && !etags[path] && isBundledFileStillCurrent(head, builtAtMs)) {
            etags[path] = etag;
            continue;
          }
          if (etag && etags[path] === etag) continue;
          const res = await fetch(remoteUrl, { cache: "no-store" });
          if (!res.ok) continue;
          const rawJson = await res.text();
          JSON.parse(rawJson);
          await cache.put(
            absUrl,
            new Response(rawJson, {
              status: 200,
              headers: { "Content-Type": "application/json; charset=utf-8" },
            })
          );
          etags[path] = etag;
          updated += 1;
        } catch (error) {
          console.warn("No se pudo actualizar", path, error);
        }
      }
      await writePref("content_etags", etags);

      // 3. Textos extraídos: actualización incremental desde árbol del repositorio
      if (manual) {
        $("bt-progress-text").textContent = "Revisando el texto de los documentos…";
        $("bt-bar-fill").style.width = "70%";
      }
      try {
        const treeRes = await fetch(`https://api.github.com/repos/${SITE_REPO}/git/trees/main?recursive=1`, {
          headers: { Accept: "application/vnd.github+json" },
          cache: "no-store",
        });
        if (treeRes.ok) {
          const tree = await treeRes.json();
          const remoteShas = {};
          (tree.tree || []).forEach((item) => {
            if (item.path && item.path.startsWith("data/text/")) remoteShas[item.path] = item.sha;
          });
          const localShas = await readPref("text_shas", {});
          const changed = Object.keys(remoteShas).filter((path) => remoteShas[path] !== localShas[path]);
          const limit = manual ? 120 : 25;
          const batch = changed.slice(0, limit);

          for (let i = 0; i < batch.length; i += 1) {
            const path = batch[i];
            const absUrl = new URL(path, location.href).href;
            if (manual) {
              $("bt-bar-fill").style.width = `${70 + Math.round((i / Math.max(1, batch.length)) * 25)}%`;
              $("bt-progress-text").textContent = `Actualizando textos… ${i + 1} de ${batch.length}`;
            }
            try {
              const res = await fetch(`${SITE}/${path}`, { cache: "no-store" });
              if (!res.ok) continue;
              await cache.put(absUrl, res.clone());
              localShas[path] = remoteShas[path];
            } catch (_) {}
          }
          await writePref("text_shas", localShas);
          updated += batch.length;
        }
      } catch (error) {
        console.warn("No se pudo revisar el texto", error);
      }

      if (manual) {
        $("bt-bar-fill").style.width = "100%";
        if (updated || shellUpdated) {
          $("bt-progress-text").textContent = `Actualización completada (${updated} archivo${updated === 1 ? "" : "s"}). Recargando…`;
          await writePref("last_content_update", new Date().toISOString());
          setTimeout(async () => {
            if (OtaUpdater && OtaUpdater.reloadApp) {
              await OtaUpdater.reloadApp().catch(() => location.reload());
            } else {
              location.reload();
            }
          }, 850);
        } else {
          $("bt-progress-text").textContent = "Ya tienes la última versión web y de contenido.";
          toast("Todo está actualizado");
          setTimeout(() => {
            if (!state.busy) $("bt-progress").hidden = true;
          }, 2500);
        }
      } else if (shellUpdated || updated > 0) {
        await writePref("last_content_update", new Date().toISOString());
        if (shellUpdated) {
          const otaBanner = $("bt-ota-banner");
          if (otaBanner) otaBanner.hidden = false;
        } else if (updated > 0) {
          toast("Contenido actualizado automáticamente en segundo plano.", false);
        }
      }
    } catch (error) {
      if (manual) {
        $("bt-progress-text").textContent = "No se pudo completar la actualización. Inténtalo más tarde.";
      }
      console.warn(error);
    } finally {
      if (manual) state.busy = false;
      autoSyncInFlight = false;
    }
  }

  // ------------------------------------------------------------------
  // Aviso de actualización del APK (la instalación es manual, desde el navegador)
  // ------------------------------------------------------------------
  function compareVersions(a, b) {
    const pa = String(a).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const da = pa[i] || 0;
      const db = pb[i] || 0;
      if (da !== db) return da > db ? 1 : -1;
    }
    return 0;
  }

  async function checkAppUpdate(silent) {
    if (!state.online) {
      if (!silent) toast("Sin conexión. Conéctate para buscar actualizaciones.");
      return;
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        if (!silent) {
          await Browser.open({ url: APP_RELEASES });
          toast("Abriendo la página de descargas…");
        }
        return;
      }
      const release = await res.json();
      const latest = String(release.tag_name || "").replace(/^v/, "");
      const info = await App.getInfo();
      const current = info.version || "0.0.0";

      if (!latest || compareVersions(latest, current) <= 0) {
        await writePref("last_app_check", Date.now());
        if (!silent) toast(`Ya tienes la última versión (${current})`);
        return;
      }

      await writePref("last_app_check", Date.now());

      if (silent) {
        toast(`Nueva versión ${latest} disponible. Ábrela desde Mi biblioteca → App.`, true);
        return;
      }

      const accepted = await confirmDialog(
        `Nueva versión ${latest}`,
        `${(release.body || "Incluye mejoras y correcciones.").slice(0, 280)}\n\nSe abrirá la descarga en el navegador. Instala el APK encima de esta app para conservar tus archivos.`,
        "Ir a la descarga",
        "Ahora no"
      );
      if (!accepted) return;

      await Browser.open({ url: APP_DOWNLOAD });
      toast("Descarga el APK y ábrelo para instalar la actualización.", true);
    } catch (error) {
      console.warn("No se pudo buscar actualización", error);
      if (!silent) toast("No se pudo buscar la actualización.");
    }
  }

  async function maybeAutoCheckUpdate() {
    const last = (await readPref("last_app_check", 0)) || 0;
    if (Date.now() - last < 12 * 60 * 60 * 1000) return;
    await writePref("last_app_check", Date.now());
    setTimeout(() => checkAppUpdate(true), 3500);
  }

  async function maybeAutoUpdateContent() {
    if (!state.online) return;
    const last = (await readPref("last_auto_sync", 0)) || 0;
    if (Date.now() - last < 2 * 60 * 60 * 1000) return;
    await writePref("last_auto_sync", Date.now());
    setTimeout(() => {
      if (state.online && !state.busy) {
        updateContent(false, true);
      }
    }, 4500);
  }

  // ------------------------------------------------------------------
  // Red, enlaces y ciclo de vida
  // ------------------------------------------------------------------
  function setOnline(online) {
    state.online = online;
    const banner = $("bt-net-banner");
    if (banner) banner.hidden = online;
    document.documentElement.classList.toggle("bt-offline", !online);
    if (state.modalOpen) renderAppInfo();
    if (!online) {
      setTimeout(() => {
        if (state.online && banner) banner.hidden = true;
      }, 4000);
    }
  }

  function installLinkHandler() {
    document.addEventListener(
      "click",
      (event) => {
        const openBtn = event.target.closest && event.target.closest("[data-open-doc]");
        if (openBtn) {
          const docId = openBtn.getAttribute("data-open-doc");
          const doc = docId && state.docsById ? state.docsById[docId] : null;
          if (doc && state.offline[doc.sha12]) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const savedPanel = document.getElementById("savedPanel");
            if (savedPanel && !savedPanel.classList.contains("hidden") && typeof window.closeSavedPanel === "function") {
              window.closeSavedPanel();
            }
            openDoc(doc);
            return;
          }
        }

        const anchor = event.target.closest && event.target.closest("a[href]");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

        let url;
        try {
          url = new URL(href, location.href);
        } catch (_) {
          return;
        }

        if (isDownloadLink(url)) {
          event.preventDefault();
          event.stopPropagation();
          handleDownloadLink(url);
          return;
        }

        if (isExternal(url)) {
          event.preventDefault();
          event.stopPropagation();
          Browser.open({ url: url.href });
        }
      },
      true
    );
  }

  async function handleDownloadLink(url) {
    if (state.busy) {
      toast("Espera a que termine la descarga actual.");
      return;
    }
    const doc = findDocByUrl(url);
    if (!doc) {
      Browser.open({ url: url.href });
      return;
    }

    if (state.offline[doc.sha12]) {
      const opened = await openDoc(doc);
      if (!opened) toast("El archivo está guardado, pero no se pudo abrir.");
      return;
    }

    if (!state.online) {
      toast("Sin conexión. Ese archivo no está descargado. Puedes bajarlo desde Mi biblioteca.");
      return;
    }

    const accepted = await confirmDialog(
      doc.title.length > 70 ? `${doc.title.slice(0, 70)}…` : doc.title,
      `${doc.size ? `${fmtMB(doc.size)} · ` : ""}¿Descargarlo para verlo sin conexión? También puedes abrirlo en el navegador.`,
      "Descargar",
      "Abrir en navegador"
    );

    if (!accepted) {
      Browser.open({ url: url.href });
      return;
    }

    state.busy = true;
    $("bt-progress").hidden = false;
    $("bt-progress-text").textContent = `Descargando: ${doc.title}`;
    await ensureProgressListener();
    try {
      await downloadDoc(doc, 0, 1);
      renderStorage();
      renderList();
      renderSavedList();
      toast("Archivo descargado correctamente");
      setTab("files", false);
      await openDoc(doc);
    } catch (error) {
      toast("No se pudo descargar. Revisa tu conexión.");
      console.warn(error);
    } finally {
      state.busy = false;
      $("bt-progress").hidden = true;
      updateSelection();
    }
  }

  function openModal(targetTab) {
    if (state.modalOpen) return;
    state.modalOpen = true;
    state.lastFocused = document.activeElement;
    const modal = $("bt-offline-modal");
    modal.hidden = false;
    document.documentElement.classList.add("bt-modal-open");

    const tab = targetTab || state.activeTab || "files";
    setTab(tab, false);
    renderStorage();
    renderList();
    renderSavedList();
    renderAppInfo();

    if (state.catalog) {
      renderSections();
    } else {
      loadCatalog()
        .then(() => {
          renderSections();
          renderStorage();
          renderList();
          renderSavedList();
        })
        .catch(() => toast("No se pudo leer el catálogo."));
    }

    setTimeout(() => {
      const target = tab === "files" ? $("bt-saved-search") : tab === "app" ? $("bt-tab-app") : $("bt-search");
      if (target) target.focus();
    }, 80);
  }

  function closeModal() {
    if (!state.modalOpen) return;
    state.modalOpen = false;
    const modal = $("bt-offline-modal");
    if (modal) modal.hidden = true;
    document.documentElement.classList.remove("bt-modal-open");
    if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus();
  }

  function installBackButton() {
    if (!App || !App.addListener) return;
    App.addListener("backButton", ({ canGoBack }) => {
      if (state.pdf) {
        closePdfReader();
      } else if (state.image) {
        closeImageViewer();
      } else if (state.html) {
        closeHtmlViewer();
      } else if (state.modalOpen) {
        closeModal();
      } else if (canGoBack) {
        history.back();
      } else {
        App.exitApp();
      }
    });
  }

  async function maybeVerifyOfflineData() {
    try {
      const info = await App.getInfo();
      const verified = await readPref("offline_verified_version", "");
      if (verified === info.version) return;
      const run = window.requestIdleCallback || ((callback) => setTimeout(callback, 2500));
      run(async () => {
        const ok = await verifyOfflineData(false);
        if (ok) await writePref("offline_verified_version", info.version);
      });
    } catch (_) {}
  }

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  async function start() {
    document.documentElement.classList.add("bt-native");
    if (OtaUpdater && OtaUpdater.confirmBoot) {
      OtaUpdater.confirmBoot().catch(() => {});
    }
    await ensureDataDirectory();
    await clearOldContentCache();
    await loadOfflineIndex();
    buildUi();
    installLinkHandler();
    installBackButton();
    loadCatalog().catch(() => {});

    const savedTab = await readPref("library_tab", "");
    if (["download", "files", "app"].includes(savedTab)) state.activeTab = savedTab;
    else state.activeTab = "files";

    // Verificamos que el enlace en el menú y el almacenamiento estén listos tras el primer render
    setTimeout(() => {
      injectNavLink();
      renderStorage();
    }, 350);

    if (Network) {
      try {
        const status = await Network.getStatus();
        setOnline(Boolean(status.connected));
        Network.addListener("networkStatusChange", (statusUpdate) => setOnline(Boolean(statusUpdate.connected)));
      } catch (_) {}
    }

    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));

    if (App && App.addListener) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          setOnline(navigator.onLine);
          maybeAutoCheckUpdate();
          maybeAutoUpdateContent();
        }
      });
    }

    maybeAutoCheckUpdate();
    maybeAutoUpdateContent();
    maybeVerifyOfflineData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

/* ============================================================================
 * DOCUMENTO MAESTRO UNIFICADO DE ARQUITECTURA, PROTOCOLO Y TRASPASO INTERNO
 * (Consolidación íntegra de AGENTS.md [Web y App], GEMINI.md,
 *  .github/copilot-instructions.md, TRASPASO.md y TRASPASO_GEMINI_ARGON.md)
 * ============================================================================
 *
 * Para: Próximos desarrolladores y agentes de IA
 * Fecha de corte: 11 de Noviembre de 2026
 * Versión actual del ecosistema: BETA V7.6 (Web) - V2.2.8 Mobile (Android)
 * Autor y Creador Exclusivo: Liam Durán - Provincia TLXH (Instagram: @liaadurg3)
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
 * - package.json: Versión 2.2.8 y versionLabel "V2.2.8 Mobile - Web V7.6 (11/11/2026)".
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
 *   mx.bibliotechscout.app, versionName 2.2.8, versionCode 17 y compilación
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
 *     enlaces a cnrc@scouts.org.mx, Instagram @RNC.MX e Instagram @liaadurg3.
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

