import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = process.env.ICON_SOURCE || "C:/Users/liamc/bibliotech-scouts/img/icon-512.png";

await mkdir("resources", { recursive: true });

await sharp(SOURCE).resize(1024, 1024, { kernel: "lanczos3" }).png().toFile("resources/icon.png");

const icon = await sharp(SOURCE).resize(560, 560, { kernel: "lanczos3" }).png().toBuffer();

function background(dark) {
  const top = dark ? "#1b1440" : "#2b1a6e";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
      <defs>
        <radialGradient id="g" cx="30%" cy="20%" r="80%">
          <stop offset="0%" stop-color="${top}"/>
          <stop offset="55%" stop-color="#121a3a"/>
          <stop offset="100%" stop-color="#080d1c"/>
        </radialGradient>
      </defs>
      <rect width="2732" height="2732" fill="url(#g)"/>
    </svg>`
  );
}

for (const [name, dark] of [
  ["splash.png", false],
  ["splash-dark.png", true],
]) {
  const base = await sharp(background(dark)).png().toBuffer();
  await sharp(base).composite([{ input: icon, gravity: "center" }]).png().toFile(`resources/${name}`);
}

console.log("Icono y splash generados en resources/");
