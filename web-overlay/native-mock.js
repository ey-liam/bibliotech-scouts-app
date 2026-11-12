/* Mock de Capacitor para probar la capa nativa en el navegador. */
(function () {
  const listeners = {};
  const progress = [];
  window.__downloadLog = [];
  window.__deletedLog = [];
  window.__openedLog = [];

  const fileSet = new Set(JSON.parse(localStorage.getItem("mock:files") || "[]"));
  const saveFiles = () => localStorage.setItem("mock:files", JSON.stringify([...fileSet]));

  const tinyPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=";

  function pdfPage(page) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">` +
      `<rect width="100%" height="100%" fill="#ffffff"/>` +
      `<rect x="60" y="60" width="1080" height="1480" fill="none" stroke="#dbeafe" stroke-width="8"/>` +
      `<text x="600" y="700" font-size="92" text-anchor="middle" fill="#4f46e5" font-family="Arial">Página ${page + 1}</text>` +
      `<text x="600" y="810" font-size="38" text-anchor="middle" fill="#64748b" font-family="Arial">Vista de prueba del lector PDF</text>` +
      `<text x="600" y="880" font-size="30" text-anchor="middle" fill="#94a3b8" font-family="Arial">BiblioTech Scout · Mi biblioteca</text>` +
      `</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const Filesystem = {
    addListener: async (event, cb) => {
      progress.push(cb);
      return { remove() {} };
    },
    downloadFile: async (options) => {
      const total = 900000;
      for (let i = 1; i <= 5; i += 1) {
        const bytes = Math.round((total * i) / 5);
        progress.forEach((cb) => cb({ url: options.url, bytes, contentLength: total }));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      window.__downloadLog.push(options.path);
      fileSet.add(options.path);
      saveFiles();
      return { path: options.path };
    },
    getUri: async ({ path }) => ({ uri: `file:///mock/${path}` }),
    stat: async ({ path }) => {
      if (!fileSet.has(path)) throw new Error(`No existe ${path}`);
      return { type: "file", size: 900000, uri: `file:///mock/${path}` };
    },
    readFile: async (opts) => {
      if (opts && opts.encoding === "utf8") {
        return { data: "<!DOCTYPE html><html lang='es-MX'><body><main style='padding:20px;font-family:sans-serif'><h1>Guía HTML Offline de Prueba</h1><p>Contenido autónomo cargado correctamente sin conexión.</p></main></body></html>" };
      }
      return { data: tinyPng };
    },
    writeFile: async ({ path }) => {
      fileSet.add(path);
      saveFiles();
      return { uri: `file:///mock/${path}` };
    },
    mkdir: async () => {},
    deleteFile: async ({ path }) => {
      window.__deletedLog.push(path);
      fileSet.delete(path);
      saveFiles();
    },
  };

  const Preferences = {
    get: async ({ key }) => ({ value: localStorage.getItem(`mock:${key}`) }),
    set: async ({ key, value }) => localStorage.setItem(`mock:${key}`, value),
  };

  const PdfViewer = {
    open: async (options) => {
      window.__openedLog.push(`pdf:${options.path}`);
      return { pages: 5, name: options.path };
    },
    renderPage: async ({ page }) => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return { page, pages: 5, width: 1200, height: 1600, dataUrl: pdfPage(page) };
    },
    close: async () => {},
  };

  window.Capacitor = {
    isNativePlatform: () => true,
    convertFileSrc: (uri) => uri,
    Plugins: {
      Filesystem,
      Preferences,
      PdfViewer,
      Network: {
        getStatus: async () => ({ connected: navigator.onLine, connectionType: "wifi" }),
        addListener: async () => ({ remove() {} }),
      },
      App: {
        getInfo: async () => ({ version: "2.3.1", build: "27" }),
        addListener: async () => ({ remove() {} }),
        exitApp: () => {},
      },
      OtaUpdater: {
        confirmBoot: async () => ({ active: false, siteCommit: "", updatedAt: "" }),
        getOtaStatus: async () => ({ active: false, siteCommit: "", updatedAt: "" }),
        promoteStaging: async () => ({ active: true, promotedFiles: 3 }),
        clearOta: async () => ({ active: false }),
        reloadApp: async () => {},
      },
      Dialog: {
        confirm: async () => ({ value: true }),
        alert: async () => {},
      },
      Toast: {
        show: async (options) => console.log("TOAST:", options.text),
      },
      Browser: {
        open: async (options) => window.__openedLog.push(options.url),
      },
      FileOpener: {
        open: async (options) => window.__openedLog.push(options.filePath),
      },
    },
  };
})();
