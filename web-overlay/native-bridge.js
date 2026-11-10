/* ============================================================
   BiblioTech Scout — capa nativa (solo dentro del APK)
   Panel de contenido sin conexión, descargas y actualizaciones.
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
  const NativeUpdater = plugin("NativeUpdater");

  const SITE = "https://ey-liam.github.io/bibliotech-scouts";
  const APP_REPO = "ey-liam/bibliotech-scouts-app";
  const SITE_REPO = "ey-liam/bibliotech-scouts";
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
  };

  const state = {
    online: true,
    catalog: null,
    docs: [],
    offline: {}, // sha12 -> { title, ext, size, savedAt }
    selected: new Set(),
    query: "",
    section: "all",
    busy: false,
    currentUrl: "",
    modalOpen: false,
    lastFocused: null,
  };

  const $ = (id) => document.getElementById(id);
  const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;

  function toast(text, long) {
    if (Toast) {
      Toast.show({ text, duration: long ? "long" : "short" }).catch(() => {});
    }
  }

  function escapeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  // ------------------------------------------------------------------
  // Caché de datos: permite actualizar catálogo, preguntas y textos
  // sin publicar un APK nuevo.
  // ------------------------------------------------------------------
  function installFetchCache() {
    if (!("caches" in window)) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      let url = "";
      try {
        url = typeof input === "string" ? input : input && input.url ? input.url : "";
      } catch (_) {
        return originalFetch(input, init);
      }
      if (!url || !/^(\.\/)?(data|app-build\.json)/.test(url)) {
        return originalFetch(input, init);
      }
      return caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(new URL(url, location.href).href))
        .then((hit) => hit || originalFetch(input, init))
        .catch(() => originalFetch(input, init));
    };
  }

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
    state.offline = await readPref("offline_index", {});
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
  // Catálogo y panel
  // ------------------------------------------------------------------
  async function loadCatalog() {
    if (state.catalog) return state.catalog;
    const res = await fetch("data/catalog.json");
    if (!res.ok) throw new Error("No se pudo leer el catálogo");
    const json = await res.json();
    state.catalog = json;
    state.docs = (json.documents || [])
      .filter((d) => d && d.sha12 && d.has_web_file)
      .map((d) => ({
        sha12: d.sha12,
        title: d.title || d.filename || "Documento",
        ext: (d.ext || "pdf").toLowerCase(),
        section: d.section_label || d.section || "General",
        year: d.year || "",
        size: d.size_bytes || 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
    return json;
  }

  function docFileName(doc) {
    return `${doc.sha12}.${doc.ext}`;
  }

  function docUrl(doc) {
    return `${SITE}/files/${docFileName(doc)}`;
  }

  function isDownloadLink(url) {
    return /\/files\/[a-f0-9]{12}\.[a-z0-9]+$/i.test(url.pathname);
  }

  function isExternal(url) {
    return /^https?:$/.test(url.protocol) && url.origin !== location.origin;
  }

  function findDocByUrl(url) {
    const match = url.pathname.match(/\/files\/([a-f0-9]{12})\.([a-z0-9]+)$/i);
    if (!match) return null;
    const sha12 = match[1].toLowerCase();
    return state.docs.find((d) => d.sha12 === sha12) || { sha12, title: match[1], ext: match[2].toLowerCase(), size: 0 };
  }

  // ------------------------------------------------------------------
  // Construcción de la interfaz
  // ------------------------------------------------------------------
  function buildUi() {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "bt-offline-fab";
    fab.className = "bt-fab";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V4a1 1 0 0 1 1-1Zm-7 15a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v1.5A1.5 1.5 0 0 1 18.5 22h-13A1.5 1.5 0 0 1 4 20.5V19a1 1 0 0 1 1-1Z"/></svg><span>Offline</span><b id="bt-fab-count" hidden></b>';
    fab.addEventListener("click", openModal);
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
        <header class="bt-modal-head">
          <div>
            <h2 id="bt-offline-title">Contenido sin conexión</h2>
            <p class="bt-sub">Las preguntas y el texto de los documentos ya vienen en la app. Aquí descargas los archivos originales para verlos sin internet.</p>
          </div>
          <button type="button" class="bt-close" data-bt-close="1" aria-label="Cerrar">×</button>
        </header>

        <div class="bt-storage" id="bt-storage"></div>

        <div class="bt-tools">
          <label class="bt-search">
            <span class="bt-sr">Buscar documento</span>
            <input id="bt-search" type="search" placeholder="Buscar por título, año o sección…" autocomplete="off" />
          </label>
          <label class="bt-select">
            <span class="bt-sr">Filtrar por sección</span>
            <select id="bt-section"><option value="all">Todas las secciones</option></select>
          </label>
        </div>

        <p class="bt-count" id="bt-count"></p>
        <div class="bt-list" id="bt-list" role="list"></div>

        <footer class="bt-modal-foot">
          <span id="bt-selection">0 seleccionados</span>
          <div class="bt-actions">
            <button type="button" class="bt-btn bt-secondary" id="bt-delete" disabled>Borrar</button>
            <button type="button" class="bt-btn bt-primary" id="bt-download" disabled>Descargar</button>
          </div>
        </footer>

        <div class="bt-progress" id="bt-progress" hidden>
          <div class="bt-bar"><span id="bt-bar-fill"></span></div>
          <p id="bt-progress-text">Preparando…</p>
        </div>

        <div class="bt-footer-links">
          <button type="button" class="bt-link" id="bt-update">Actualizar contenido</button>
          <span class="bt-dot">·</span>
          <button type="button" class="bt-link" id="bt-check-app">Buscar nueva versión de la app</button>
        </div>
        <p class="bt-note">Los archivos se guardan solo en este dispositivo. Puedes borrarlos cuando quieras.</p>
      </div>`;
    document.body.appendChild(modal);

    $("bt-search").addEventListener("input", (e) => {
      state.query = e.target.value.trim().toLowerCase();
      renderList();
    });
    $("bt-section").addEventListener("change", (e) => {
      state.section = e.target.value;
      renderList();
    });
    $("bt-download").addEventListener("click", downloadSelected);
    $("bt-delete").addEventListener("click", deleteSelected);
    $("bt-update").addEventListener("click", () => updateContent(true));
    $("bt-check-app").addEventListener("click", () => checkAppUpdate(false));
    modal.querySelectorAll("[data-bt-close]").forEach((el) => el.addEventListener("click", closeModal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.modalOpen) closeModal();
    });
  }

  function renderStorage() {
    const entries = Object.values(state.offline);
    const bytes = entries.reduce((sum, item) => sum + (item.size || 0), 0);
    $("bt-storage").innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = entries.length
      ? `${entries.length} archivo${entries.length === 1 ? "" : "s"} guardado${entries.length === 1 ? "" : "s"} · ${fmtMB(bytes)}`
      : "Todavía no has descargado archivos";
    const span = document.createElement("span");
    span.textContent = entries.length
      ? "Disponibles aunque no tengas internet."
      : "Las preguntas y el texto ya funcionan sin conexión.";
    $("bt-storage").append(strong, span);

    const count = $("bt-fab-count");
    count.textContent = String(entries.length);
    count.hidden = entries.length === 0;
  }

  function renderSections() {
    const select = $("bt-section");
    const sections = Array.from(new Set(state.docs.map((d) => d.section))).sort((a, b) => a.localeCompare(b, "es"));
    select.innerHTML = '<option value="all">Todas las secciones</option>';
    for (const section of sections) {
      const option = document.createElement("option");
      option.value = section;
      option.textContent = section;
      select.appendChild(option);
    }
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
    const docs = visibleDocs();
    list.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const doc of docs) {
      const saved = Boolean(state.offline[doc.sha12]);
      const row = document.createElement("label");
      row.className = "bt-row";
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
      frag.appendChild(row);
    }

    if (!docs.length) {
      const empty = document.createElement("p");
      empty.className = "bt-empty";
      empty.textContent = "No hay documentos que coincidan con la búsqueda.";
      frag.appendChild(empty);
    }

    list.appendChild(frag);
    $("bt-count").textContent = `${docs.length} documento${docs.length === 1 ? "" : "s"} descargable${docs.length === 1 ? "" : "s"} de ${state.docs.length}`;
    updateSelection();
  }

  function updateSelection() {
    const total = state.selected.size;
    $("bt-selection").textContent = `${total} seleccionado${total === 1 ? "" : "s"}`;
    $("bt-download").disabled = total === 0 || state.busy;
    $("bt-delete").disabled = total === 0 || state.busy;
    $("bt-download").textContent = total ? `Descargar (${total})` : "Descargar";
    $("bt-delete").textContent = total ? `Borrar (${total})` : "Borrar";
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
      ext: doc.ext,
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
    state.busy = true;
    const docs = state.docs.filter((doc) => state.selected.has(doc.sha12));
    const totalBytes = docs.reduce((sum, doc) => sum + (doc.size || 0), 0);
    const ok = await Dialog.confirm({
      title: "Descargar archivos",
      message: `Se guardarán ${docs.length} archivo${docs.length === 1 ? "" : "s"} (${fmtMB(totalBytes)}). Puedes borrarlos después desde este panel.`,
      okButtonTitle: "Descargar",
      cancelButtonTitle: "Cancelar",
    });
    if (!ok.value) {
      state.busy = false;
      return;
    }

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
        toast("Descarga completada");
      }
      renderStorage();
      renderList();
      setTimeout(() => {
        if (!state.busy) $("bt-progress").hidden = true;
      }, 3500);
    } finally {
      state.busy = false;
      updateSelection();
    }
  }

  async function deleteSelected() {
    if (state.busy || !state.selected.size) return;
    const docs = Object.keys(state.offline).filter((sha) => state.selected.has(sha));
    if (!docs.length) {
      toast("Los archivos seleccionados no están descargados.");
      return;
    }
    const ok = await Dialog.confirm({
      title: "Borrar archivos",
      message: `Se eliminarán ${docs.length} archivo${docs.length === 1 ? "" : "s"} de este dispositivo. Las preguntas y el texto seguirán disponibles.`,
      okButtonTitle: "Borrar",
      cancelButtonTitle: "Cancelar",
    });
    if (!ok.value) return;

    state.busy = true;
    updateSelection();
    for (const sha of docs) {
      const entry = state.offline[sha];
      try {
        await Filesystem.deleteFile({
          path: `${DATA_DIR}/${sha}.${entry.ext}`,
          directory: "DATA",
        });
      } catch (_) {}
      delete state.offline[sha];
    }
    await persistOfflineIndex();
    state.busy = false;
    state.selected.clear();
    renderStorage();
    renderList();
    toast("Archivos borrados");
  }

  async function openDoc(doc) {
    const entry = state.offline[doc.sha12];
    if (!entry) return false;
    try {
      const { uri } = await Filesystem.getUri({
        path: `${DATA_DIR}/${doc.sha12}.${entry.ext}`,
        directory: "DATA",
      });
      await FileOpener.open({
        filePath: uri,
        contentType: MIME[entry.ext] || "application/octet-stream",
        openWithDefault: true,
      });
      return true;
    } catch (error) {
      toast("No se pudo abrir el archivo. ¿Tienes un visor instalado?");
      console.warn(error);
      return false;
    }
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
      if (!opened) toast("El archivo está guardado, pero no hay visor disponible.");
      return;
    }

    if (!state.online) {
      toast("Sin conexión. Ese archivo no está descargado. Puedes bajarlo desde el panel Offline.");
      return;
    }

    const choice = await Dialog.confirm({
      title: doc.title.length > 70 ? `${doc.title.slice(0, 70)}…` : doc.title,
      message: `${doc.size ? `${fmtMB(doc.size)} · ` : ""}¿Descargarlo para verlo sin conexión? También puedes abrirlo en el navegador.`,
      okButtonTitle: "Descargar",
      cancelButtonTitle: "Abrir en navegador",
    });

    if (!choice.value) {
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
      toast("Descargado");
      await openDoc(doc);
    } catch (error) {
      toast("No se pudo descargar. Revisa tu conexión.");
      console.warn(error);
    } finally {
      state.busy = false;
      $("bt-progress").hidden = true;
    }
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
          const etag = head.headers.get("etag") || head.headers.get("content-length") || "";
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
  // Actualización del APK
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
        if (!silent) toast("No se pudo consultar la versión más reciente.");
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

      const asset = (release.assets || []).find((item) => /\.apk$/i.test(item.name));
      if (!asset) {
        if (!silent) toast("La versión nueva aún no tiene APK publicado.");
        return;
      }

      const accepted = await Dialog.confirm({
        title: `Nueva versión ${latest}`,
        message: (release.body || "Incluye mejoras y correcciones.").slice(0, 320),
        okButtonTitle: "Actualizar",
        cancelButtonTitle: "Ahora no",
      });
      if (!accepted.value) return;

      if (!NativeUpdater) {
        Browser.open({ url: asset.browser_download_url });
        return;
      }

      toast("Descargando actualización…", true);
      await NativeUpdater.install({ url: asset.browser_download_url });
      toast("Sigue las instrucciones de Android para instalar.", true);
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
      const etag = head.headers.get("etag") || head.headers.get("content-length") || "";
      const etags = await readPref("content_etags", {});
      const previous = etags["data/catalog.json"];
      if (etag && previous && previous !== etag && navigator.onLine) {
        toast("Hay contenido nuevo. Actualízalo desde el panel Offline.", true);
      }
    } catch (_) {}
  }

  // ------------------------------------------------------------------
  // Red, enlaces y ciclo de vida
  // ------------------------------------------------------------------
  function setOnline(online) {
    state.online = online;
    const banner = $("bt-net-banner");
    banner.hidden = online;
    if (online) {
      document.documentElement.classList.remove("bt-offline");
    } else {
      document.documentElement.classList.add("bt-offline");
      setTimeout(() => {
        if (state.online) banner.hidden = true;
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

  function openModal() {
    if (state.modalOpen) return;
    state.modalOpen = true;
    state.lastFocused = document.activeElement;
    $("bt-offline-modal").hidden = false;
    document.documentElement.classList.add("bt-modal-open");
    setTimeout(() => $("bt-search").focus(), 60);
    if (!state.catalog) {
      loadCatalog()
        .then(() => {
          renderSections();
          renderStorage();
          renderList();
        })
        .catch(() => toast("No se pudo leer el catálogo."));
    } else {
      renderStorage();
      renderList();
    }
  }

  function closeModal() {
    if (!state.modalOpen) return;
    state.modalOpen = false;
    $("bt-offline-modal").hidden = true;
    document.documentElement.classList.remove("bt-modal-open");
    if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus();
  }

  function installBackButton() {
    if (!App || !App.addListener) return;
    App.addListener("backButton", ({ canGoBack }) => {
      if (state.modalOpen) {
        closeModal();
      } else if (canGoBack) {
        history.back();
      } else {
        App.exitApp();
      }
    });
  }

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  async function start() {
    installFetchCache();
    await clearOldContentCache();
    await loadOfflineIndex();
    buildUi();
    installLinkHandler();
    installBackButton();

    if (Network) {
      try {
        const status = await Network.getStatus();
        setOnline(Boolean(status.connected));
        Network.addListener("networkStatusChange", (statusUpdate) => setOnline(Boolean(statusUpdate.connected)));
      } catch (_) {}
    }

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

    // Si hay red, el catálogo se puede refrescar desde el panel.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
