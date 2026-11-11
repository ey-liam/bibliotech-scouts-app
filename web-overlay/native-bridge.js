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

  const SITE = "https://ey-liam.github.io/bibliotech-scouts";
  const APP_REPO = "ey-liam/bibliotech-scouts-app";
  const APP_RELEASES = `https://github.com/${APP_REPO}/releases/latest`;
  const APP_DOWNLOAD = `${APP_RELEASES}/download/bibliotech-scout.apk`;
  const SITE_REPO = "ey-liam/bibliotech-scouts";
  const GITHUB_RELEASE_BASE = `https://github.com/${SITE_REPO}/releases/download/v1.0/`;
  const DATA_DIR = "offline";
  const CACHE_NAME = "bt-content-v1";
  const DATA_JSON = [
    "data/catalog.json",
    "data/questions_bank.json",
    "data/knowledge_base.json",
    "data/chunks.json",
    "data/faq_v3.json",
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
  };
  const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif"]);
  const TRASH_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H4a1 1 0 1 0 0 2h1l1 13a1 1 0 0 0 1 .9h10a1 1 0 0 0 1-.9l1-13h1a1 1 0 1 0 0-2h-4V4a1 1 0 0 0-1-1H9Zm1 2h4v1h-4V5Zm-1.9 4h7.8l-.8 11H8.9L8.1 9Z"/></svg>';

  const state = {
    online: navigator.onLine !== false,
    catalog: null,
    docs: [],
    offline: {}, // sha12 -> { title, ext, section, size, savedAt }
    selected: new Set(),
    query: "",
    section: "all",
    activeTab: "files",
    savedQuery: "",
    busy: false,
    modalOpen: false,
    lastFocused: null,
    pdf: null,
    image: null,
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
    state.docs = (json.documents || [])
      .filter((d) => d && d.sha12 && String(d.ext || "").toLowerCase() !== "html")
      .map((d) => ({
        sha12: d.sha12,
        title: d.title || d.filename || "Documento",
        ext: String(d.ext || "pdf").toLowerCase(),
        section: d.section_label || d.section || "General",
        year: d.year || "",
        size: d.size_bytes || 0,
        has_web_file: Boolean(d.has_web_file),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
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

    injectNavLink();

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
          <button type="button" class="bt-close" id="bt-close-btn" data-bt-close="1" aria-label="Cerrar">×</button>
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
                <input id="bt-search" type="search" placeholder="Buscar por título, año o sección…" autocomplete="off" />
              </label>
              <label class="bt-select">
                <span class="bt-sr">Filtrar por sección</span>
                <select id="bt-section"><option value="all">Todas las secciones</option></select>
              </label>
            </div>
            <div class="bt-list-head">
              <p class="bt-count" id="bt-count"></p>
              <button type="button" class="bt-link" id="bt-select-visible">Seleccionar visibles</button>
            </div>
            <div class="bt-list" id="bt-list" role="list"></div>
          </section>

          <section class="bt-panel" id="bt-panel-app" role="tabpanel" aria-labelledby="bt-tab-app" hidden>
            <div class="bt-app-card">
              <div class="bt-app-row"><span>Versión de la app</span><strong id="bt-app-version">—</strong></div>
              <div class="bt-app-row"><span>Contenido del sitio</span><strong id="bt-app-site">—</strong></div>
              <div class="bt-app-row"><span>Conexión</span><strong id="bt-app-network">—</strong></div>
              <div class="bt-app-row"><span>Archivos guardados</span><strong id="bt-app-storage">—</strong></div>
            </div>
            <div class="bt-app-actions">
              <button type="button" class="bt-btn bt-primary" id="bt-update">Actualizar contenido</button>
              <button type="button" class="bt-btn bt-secondary" id="bt-check-app">Buscar actualización</button>
              <button type="button" class="bt-btn bt-secondary" id="bt-verify-offline">Verificar preguntas sin conexión</button>
            </div>
            <p class="bt-app-status" id="bt-app-status" role="status"></p>
            <p class="bt-note">Los archivos descargados se guardan localmente en tu teléfono. El banco de preguntas, conocimientos y textos ya están integrados en la app y funcionan sin internet. Al pulsar «Buscar actualización» se abre la descarga del APK en el navegador.</p>
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

    $("bt-tab-download").addEventListener("click", () => setTab("download", true));
    $("bt-tab-files").addEventListener("click", () => setTab("files", true));
    $("bt-tab-app").addEventListener("click", () => setTab("app", true));

    $("bt-search").addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
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
    $("bt-select-visible").addEventListener("click", toggleVisibleSelection);
    $("bt-delete-all").addEventListener("click", deleteAllSaved);
    $("bt-update").addEventListener("click", () => updateContent(true));
    $("bt-check-app").addEventListener("click", () => checkAppUpdate(false));
    $("bt-verify-offline").addEventListener("click", () => verifyOfflineData(true));

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

    const tabCount = $("bt-tab-files-count");
    if (tabCount) tabCount.textContent = String(entries.length);
    const downloadCount = $("bt-tab-download-count");
    if (downloadCount) downloadCount.textContent = String(state.docs.length);

    const deleteAll = $("bt-delete-all");
    if (deleteAll) deleteAll.disabled = entries.length === 0;

    const appStorage = $("bt-app-storage");
    if (appStorage) appStorage.textContent = entries.length ? `${entries.length} · ${fmtMB(bytes)}` : "Sin archivos";
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
  }

  function visibleDocs() {
    return state.docs.filter((doc) => {
      if (state.section !== "all" && doc.section !== state.section) return false;
      if (!state.query) return true;
      const haystack = `${doc.title} ${doc.section} ${doc.year}`.toLowerCase();
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

      row.append(check, main, tag);
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
      icon.textContent = String(item.ext || "?").toUpperCase().slice(0, 4);

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
      await renderPdfPage(0);
      return true;
    } catch (error) {
      console.warn("No se pudo abrir el PDF", error);
      closePdfReader();
      toast("No se pudo abrir el PDF. Probando con el visor del sistema…");
      return openWithSystem(doc, entry);
    }
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
      ["FAQ", "data/faq_v3.json", (json) => (json.questions || []).length],
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
  // Actualización de contenido (sin publicar APK)
  // ------------------------------------------------------------------
  async function updateContent(manual) {
    if (state.busy) return;
    if (!state.online) {
      toast("Sin conexión. Conéctate para buscar actualizaciones.");
      return;
    }
    state.busy = true;
    $("bt-progress").hidden = false;
    $("bt-progress-text").textContent = "Buscando actualizaciones del contenido…";
    $("bt-bar-fill").style.width = "10%";

    try {
      const cache = await caches.open(CACHE_NAME);
      const etags = await readPref("content_etags", {});
      let updated = 0;

      for (let i = 0; i < DATA_JSON.length; i += 1) {
        const path = DATA_JSON[i];
        const remoteUrl = `${SITE}/${path}`;
        const absUrl = new URL(path, location.href).href;
        $("bt-bar-fill").style.width = `${10 + Math.round((i / DATA_JSON.length) * 50)}%`;
        $("bt-progress-text").textContent = `Revisando ${path.split("/").pop()}…`;
        try {
          const head = await fetch(remoteUrl, { method: "HEAD", cache: "no-store" });
          if (!head.ok) continue;
          const etag =
            head.headers.get("etag") ||
            [head.headers.get("last-modified"), head.headers.get("content-length")].filter(Boolean).join("|") ||
            "";
          if (etag && etags[path] === etag) continue;
          const res = await fetch(remoteUrl, { cache: "no-store" });
          if (!res.ok) continue;
          await cache.put(absUrl, res.clone());
          etags[path] = etag;
          updated += 1;
        } catch (error) {
          console.warn("No se pudo actualizar", path, error);
        }
      }
      await writePref("content_etags", etags);

      // Textos extraídos: una sola consulta al árbol del repositorio.
      $("bt-progress-text").textContent = "Revisando el texto de los documentos…";
      $("bt-bar-fill").style.width = "65%";
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
          const limit = manual ? 120 : 40;
          const batch = changed.slice(0, limit);

          for (let i = 0; i < batch.length; i += 1) {
            const path = batch[i];
            const absUrl = new URL(path, location.href).href;
            $("bt-bar-fill").style.width = `${65 + Math.round((i / Math.max(1, batch.length)) * 30)}%`;
            $("bt-progress-text").textContent = `Actualizando textos… ${i + 1} de ${batch.length}`;
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

      $("bt-bar-fill").style.width = "100%";
      if (updated) {
        $("bt-progress-text").textContent = `Contenido actualizado (${updated} archivo${updated === 1 ? "" : "s"}). Recargando…`;
        await writePref("last_content_update", new Date().toISOString());
        setTimeout(() => location.reload(), 900);
      } else {
        $("bt-progress-text").textContent = "Ya tienes la última versión del contenido.";
        if (manual) toast("El contenido ya está actualizado");
        setTimeout(() => {
          if (!state.busy) $("bt-progress").hidden = true;
        }, 2500);
      }
    } catch (error) {
      $("bt-progress-text").textContent = "No se pudo actualizar el contenido. Inténtalo más tarde.";
      console.warn(error);
    } finally {
      state.busy = false;
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

  async function maybeNotifyContentUpdate() {
    const last = (await readPref("last_content_check", 0)) || 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    await writePref("last_content_check", Date.now());
    try {
      const head = await fetch(`${SITE}/data/catalog.json`, { method: "HEAD", cache: "no-store" });
      if (!head.ok) return;
      const etag =
        head.headers.get("etag") ||
        [head.headers.get("last-modified"), head.headers.get("content-length")].filter(Boolean).join("|") ||
        "";
      const etags = await readPref("content_etags", {});
      const previous = etags["data/catalog.json"];
      if (etag && previous && previous !== etag && navigator.onLine) {
        toast("Hay contenido nuevo. Actualízalo desde Mi biblioteca → App.", true);
      }
    } catch (_) {}
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
    await ensureDataDirectory();
    await clearOldContentCache();
    await loadOfflineIndex();
    buildUi();
    installLinkHandler();
    installBackButton();

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
        }
      });
    }

    maybeAutoCheckUpdate();
    maybeNotifyContentUpdate();
    maybeVerifyOfflineData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
