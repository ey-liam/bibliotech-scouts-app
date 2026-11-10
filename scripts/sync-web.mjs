import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "www");
const cacheDir = path.join(root, ".cache");
const siteUrl = "https://ey-liam.github.io/bibliotech-scouts";
const repoUrl = process.env.SITE_REPO_URL || "https://github.com/ey-liam/bibliotech-scouts.git";
const branch = process.env.SITE_BRANCH || "main";
const overlayDir = path.join(root, "web-overlay");

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const sibling = path.resolve(root, "..", "bibliotech-scouts");
const localSource = process.env.SITE_SOURCE
  ? path.resolve(process.env.SITE_SOURCE)
  : existsSync(path.join(sibling, "index.html"))
    ? sibling
    : null;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`Falló: ${command} ${args.join(" ")}`);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

async function prepareSource() {
  if (localSource) {
    console.log(`Usando el sitio local: ${localSource}`);
    return localSource;
  }

  const cloneDir = path.join(cacheDir, "site");
  console.log(`Clonando ${repoUrl} (${branch}) en modo disperso...`);
  await rm(cloneDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  run("git", [
    "clone",
    "--depth", "1",
    "--filter=blob:none",
    "--sparse",
    "--branch", branch,
    repoUrl,
    cloneDir,
  ]);
  run("git", ["-C", cloneDir, "sparse-checkout", "set", "data", "img"]);
  return cloneDir;
}

async function copySite(source) {
  console.log("Copiando el sitio a www/...");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const rootFiles = ["index.html", "styles.css", "app.js", "manifest.webmanifest"];
  for (const file of rootFiles) {
    const from = path.join(source, file);
    if (!existsSync(from)) {
      throw new Error(`Falta ${file} en el sitio de origen (${source}).`);
    }
    await cp(from, path.join(outDir, file));
  }

  for (const dir of ["data", "img"]) {
    const from = path.join(source, dir);
    if (!existsSync(from)) {
      throw new Error(`Falta la carpeta ${dir}/ en el sitio de origen (${source}).`);
    }
    await cp(from, path.join(outDir, dir), { recursive: true });
  }
}

async function patchAppJs() {
  const appPath = path.join(outDir, "app.js");
  let js = await readFile(appPath, "utf8");
  const before = js;

  // Las portadas (11 MB) se quedan en el sitio y se ven cuando hay internet.
  // Sin conexión, app.js muestra su portada de respaldo.
  js = js.replace(/`covers\//g, `\`${siteUrl}/covers/`);

  if (js === before) {
    throw new Error("No se encontraron las rutas de covers/ en app.js.");
  }

  await writeFile(appPath, js, "utf8");
}

async function patchHtml() {
  const htmlPath = path.join(outDir, "index.html");
  let html = await readFile(htmlPath, "utf8");

  // Las imágenes de assets/ se quedan en el servidor: se ven cuando hay internet
  // y no inflan el APK (66 MB). Las rutas locales pasan a ser absolutas.
  html = html.replace(/(src|href|srcset)="assets\//g, `$1="${siteUrl}/assets/`);

  if (!html.includes("native-early.js")) {
    html = html.replace("</head>", '  <script src="native-early.js"></script>\n</head>');
  }

  if (!html.includes("native.css")) {
    html = html.replace("</head>", '  <link rel="stylesheet" href="native.css" />\n</head>');
  }

  if (!html.includes("native-bridge.js")) {
    html = html.replace("</body>", '  <script src="native-bridge.js" defer></script>\n</body>');
  }

  await writeFile(htmlPath, html, "utf8");
}

async function copyOverlay() {
  for (const file of ["native-early.js", "native.css", "native-bridge.js"]) {
    await cp(path.join(overlayDir, file), path.join(outDir, file));
  }
}

async function writeBuildInfo(source) {
  const commit = runCapture("git", ["-C", source, "rev-parse", "--short", "HEAD"]) || "desconocido";
  const info = {
    appVersion: pkg.version,
    siteCommit: commit,
    siteUrl,
    builtAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, "app-build.json"), JSON.stringify(info, null, 2) + "\n", "utf8");
  return info;
}

async function dirSize(dir) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else total += (await stat(full)).size;
  }
  return total;
}

const source = await prepareSource();
await copySite(source);
await patchAppJs();
await patchHtml();
await copyOverlay();
const info = await writeBuildInfo(source);

const size = await dirSize(outDir);
console.log("");
console.log(`www/ listo — commit del sitio: ${info.siteCommit}`);
console.log(`Peso del contenido web: ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log("Siguiente paso: npx cap sync android");
