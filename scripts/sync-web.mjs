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

// Recursos de interfaz que deben viajar dentro del APK. Son los que usan el
// menú, las animaciones, los fondos, el autor y las secciones del sitio.
// Las galerías grandes que no se referencian desde la página se quedan fuera.
const BASE_ASSETS = [
  "assets/Liam.png",
  "assets/Liam.webp",
  "assets/LiamFondo.jpg",
  "assets/scouts/logo_biblioteca_centenario.png",
  "assets/scouts/foto_secciones_nac.png",
  "assets/scouts/foros_extra_2.jpg",
  "assets/scouts/foros_evento_3.jpg",
  "assets/scouts/wosm_photo2.jpg",
  "assets/scouts/agentes_cambio/LetreroCNRC.png",
  "assets/scouts/agentes_cambio/Logos.png",
];

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
  run("git", ["-C", cloneDir, "sparse-checkout", "set", "data", "img", "covers", "assets"]);
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

  for (const dir of ["data", "img", "covers"]) {
    const from = path.join(source, dir);
    if (!existsSync(from)) {
      throw new Error(`Falta la carpeta ${dir}/ en el sitio de origen (${source}).`);
    }
    await cp(from, path.join(outDir, dir), { recursive: true });
  }

  // Solo los recursos visuales que la página usa de verdad. Así el APK incluye
  // menú, animaciones y fondos sin arrastrar las galerías de 66 MB.
  for (const relative of BASE_ASSETS) {
    const from = path.join(source, relative);
    if (!existsSync(from)) {
      throw new Error(`Falta el recurso base ${relative} en el sitio de origen.`);
    }
    const to = path.join(outDir, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
  }
}

function patchHtml(html) {
  let out = html;

  // La leyenda del pie se genera desde package.json para que la app y el sitio
  // muestren siempre la misma versión.
  if (pkg.versionLabel) {
    out = out.replace(
      /(<p class="footer-db-cutoff">\s*Base de datos: )([^<]+)(<\/p>)/i,
      (match, start, body, end) => {
        const cutoff = (body.match(/\d{2}\/\d{2}\/\d{4}/) || ["11/11/2026"])[0];
        return `${start}${cutoff} · ${pkg.versionLabel}${end}`;
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

async function patchHtmlFile() {
  const htmlPath = path.join(outDir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const patched = patchHtml(html);
  await writeFile(htmlPath, patched, "utf8");
}

async function copyOverlay() {
  let esbuild = null;
  try {
    esbuild = await import("esbuild");
  } catch (_) {}

  for (const file of ["native-early.js", "native.css", "native-bridge.js"]) {
    const src = path.join(overlayDir, file);
    const dest = path.join(outDir, file);
    if (esbuild) {
      const loader = file.endsWith(".css") ? "css" : "js";
      const code = await readFile(src, "utf8");
      const out = await esbuild.transform(code, {
        loader,
        minify: true,
        charset: "utf8",
        legalComments: "none",
        ...(loader === "css" ? { target: ["chrome90"] } : {}),
      });
      await writeFile(dest, out.code, "utf8");
    } else {
      await cp(src, dest);
    }
  }
}

async function writeBuildInfo(source) {
  const commit = runCapture("git", ["-C", source, "rev-parse", "--short", "HEAD"]) || "desconocido";
  const info = {
    appVersion: pkg.version,
    versionLabel: pkg.versionLabel || "",
    siteCommit: commit,
    siteUrl,
    baseAssets: BASE_ASSETS,
    bundledCovers: true,
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
await patchHtmlFile();
await copyOverlay();
const info = await writeBuildInfo(source);

const size = await dirSize(outDir);
console.log("");
console.log(`www/ listo — commit del sitio: ${info.siteCommit}`);
console.log(`Versión visible: ${info.versionLabel}`);
console.log(`Peso del contenido web: ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log("Siguiente paso: npx cap sync android");
