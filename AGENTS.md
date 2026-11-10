# AGENTS.md — App Android de BiblioTech

Este repositorio contiene la app Android de BiblioTech Scout. El sitio sigue
viviendo en `ey-liam/bibliotech-scouts`.

## Reglas

1. **Una tarea = una rama = un pull request.**
2. Ramas: `agent/opencode/<tema>`, `agent/gemini/<tema>`, `human/<tema>`.
3. No se editan a mano los JSON de `data/` del sitio; se copian con
   `scripts/sync-web.mjs`.
4. No se suben keystores, contraseñas ni `.env`. La firma usa secretos de GitHub.
5. Los cambios de interfaz nativa van en `web-overlay/`; no se modifica `app.js`
   del sitio salvo necesidad justificada.
6. Cada cambio debe compilar en el workflow de Android antes de fusionarse.
7. Si cambia el contrato con el sitio (rutas de datos, `files/`, catálogo), hay
   que actualizar `web-overlay/native-bridge.js` y el README.

## Validación mínima

- `npm run sync:web` termina sin errores.
- `npx cap sync android` reconoce los 8 plugins.
- El workflow de GitHub Actions compila el APK.
- El panel Offline abre, lista documentos y descarga al menos un archivo en un
  dispositivo o emulador.
- La app arranca sin conexión y responde preguntas.
- La versión nueva se instala encima de la anterior (misma firma).
