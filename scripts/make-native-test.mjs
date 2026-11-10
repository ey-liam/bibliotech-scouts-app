import { copyFile, readFile, writeFile } from "node:fs/promises";

// Copia el mock al www generado y crea una página de prueba que lo carga
// antes que native-bridge.js. No forma parte del APK.
await copyFile("web-overlay/native-mock.js", "www/native-mock.js");
const html = await readFile("www/index.html", "utf8");
const marker = '<script src="native-bridge.js" defer></script>';
const withMock = html.replace(
  marker,
  '<script src="native-mock.js" defer></script>\n  ' + marker
);
await writeFile("www/native-test.html", withMock, "utf8");
console.log("Prueba nativa lista en http://127.0.0.1:8766/native-test.html");
