/* Mock de Capacitor para probar la capa nativa en el navegador. */
(function () {
  const listeners = {};
  const progress = [];
  window.__downloadLog = [];
  window.__deletedLog = [];
  window.__openedLog = [];

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
      return { path: options.path };
    },
    getUri: async ({ path }) => ({ uri: `file:///mock/${path}` }),
    deleteFile: async ({ path }) => {
      window.__deletedLog.push(path);
    },
  };

  const Preferences = {
    get: async ({ key }) => ({ value: localStorage.getItem(`mock:${key}`) }),
    set: async ({ key, value }) => localStorage.setItem(`mock:${key}`, value),
  };

  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Filesystem,
      Preferences,
      Network: {
        getStatus: async () => ({ connected: true, connectionType: "wifi" }),
        addListener: async () => ({ remove() {} }),
      },
      App: {
        getInfo: async () => ({ version: "0.1.0", build: "1" }),
        addListener: async () => ({ remove() {} }),
        exitApp: () => {},
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
      NativeUpdater: {
        install: async (options) => console.log("UPDATE:", options.url),
      },
    },
  };
})();
