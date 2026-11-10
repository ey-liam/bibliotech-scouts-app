/* ============================================================
   BiblioTech Scout — caché de contenido al arranque
   Se carga en <head>, antes que app.js. Así la página usa la
   versión más reciente del catálogo y las preguntas guardada por
   el panel Offline, y no solo la que viene dentro del APK.
   ============================================================ */

(function () {
  "use strict";

  if (!("caches" in window) || window.__btFetchCacheInstalled) return;

  const CACHE_NAME = "bt-content-v1";
  const CACHE_PATHS = /^\/(?:data\/|app-build\.json$)/;
  const originalFetch = window.fetch.bind(window);

  window.__btFetchCacheInstalled = true;
  window.fetch = function (input, init) {
    let target;
    try {
      const raw = typeof input === "string" ? input : input && input.url ? input.url : "";
      if (!raw) return originalFetch(input, init);
      target = new URL(raw, location.href);
    } catch (_) {
      return originalFetch(input, init);
    }

    if (target.origin !== location.origin || !CACHE_PATHS.test(target.pathname)) {
      return originalFetch(input, init);
    }

    return caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(target.href))
      .then((hit) => hit || originalFetch(input, init))
      .catch(() => originalFetch(input, init));
  };
})();
