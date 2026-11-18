# AGENTS.md — BiblioTech Scout App (Android / Capacitor)

Reglas permanentes para cualquier trabajo dentro de este repositorio (`bibliotech-scouts-app`).

## 1. Arquitectura de la App

- Este repositorio empaqueta el sitio web de `../bibliotech-scouts` dentro de Android con Capacitor 8 y añade la capa nativa en `web-overlay/`:
  - `web-overlay/native-early.js`: inicialización temprana antes de `app.js`.
  - `web-overlay/native-bridge.js`: visor PDF nativo (`#bt-pdf-viewer`), manejo de archivos/descargas offline, compartición, notificaciones OTA y enlace con `window.__btSavedBridge`.
  - `web-overlay/native.css`: estilos nativos y adaptaciones de safe-area / modo inmersivo.
  - `web-overlay/native-mock.js`: simulador para pruebas locales en navegador.
- **No editar `www/` ni `android/app/src/main/assets/public/` a mano:** se regeneran con `npm run sync` desde `../bibliotech-scouts` y `web-overlay/`.
- **CERO emojis** en todo el código, textos visibles, mensajes de toast/diálogo y README.

## 2. Reglas del Visor Nativo y Sincronización

- Todo guardado o nota desde `#bt-pdf-viewer` debe sincronizarse con `window.__btSavedBridge` (respaldo directo a `bt_saved_docs` y `bt_note_<docId>` en `localStorage`) para mantener coherencia con el dock `#dockSavedCount` y la vista de Guardados.
- Nunca tragar errores en silencio en llamadas a plugins de Capacitor (`Filesystem`, `FileOpener`, `Browser`, `Preferences`, `Network`): registrar causa técnica y mostrar fallback o mensaje claro al usuario con opción de reporte (`window.__btOpenBugReport`).
- Liberar siempre `URL.createObjectURL(...)` y canvas temporales al cerrar el visor PDF.

## 3. Protocolo de Release Android (`vX.Y.Z`)

1. Asegurarse de que `../bibliotech-scouts` ya tenga su commit y `git push origin main` hechos.
2. Actualizar versión en `package.json`, `android/app/build.gradle` (`versionName` y subir `versionCode` en `+1`), `web-overlay/native-mock.js` y `README.md`.
3. Ejecutar `npm run sync` (corre `sync:web` + `cap sync android`).
4. Validar sintaxis con `node --check` en `web-overlay/*.js`, `scripts/sync-web.mjs`, `www/native-bridge.js` y `www/app.js`, y confirmar `0` emojis.
5. `git commit`, `git tag vX.Y.Z`, `git push origin main` y `git push origin vX.Y.Z` (dispara el workflow de GitHub Actions que compila y publica el APK).
