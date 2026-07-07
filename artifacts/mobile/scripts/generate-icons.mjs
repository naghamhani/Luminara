/**
 * Regenerate the Luminara store PNGs from the vector master.
 *
 *   npm i -D sharp        # one-time (native, ~ few MB)
 *   node scripts/generate-icons.mjs
 *
 * Writes:
 *   assets/luminara-logo.png     1024×1024 opaque app icon + splash source
 *   assets/luminara-mark.png     1024×1024 transparent flame mark
 *   assets/images/icon.png       96×96    transparent favicon
 *
 * If you'd rather not install sharp, open scripts/generate-app-icon.html in a
 * browser and click the download buttons — same output, zero dependencies.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, "..", "assets");

// Geometry — identical to components/LuminaraLogo.tsx and assets/brand/*.svg
const FLAME =
  "M50,16 C57,32 68,41 68,55 C68,69 60,77 50,77 C40,77 32,69 32,55 C32,41 43,32 50,16 Z";
const SPARK =
  "M50,38 C54,48 60,53 60,62 C60,70 56,75 50,75 C44,75 40,70 40,62 C40,53 46,48 50,38 Z";
const CRADLE = "M24,72 C34,90 66,90 76,72";

const glow = `
  <defs><radialGradient id="g" cx="50%" cy="46%" r="52%">
    <stop offset="0" stop-color="#FFC97A" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#FFC97A" stop-opacity="0"/>
  </radialGradient></defs>
  <circle cx="50" cy="48" r="34" fill="url(#g)"/>`;

function svg({ bg, cradle }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ""}
    ${glow}
    <path d="${FLAME}" fill="#F6A94C"/>
    <path d="${SPARK}" fill="#FFE7BE" opacity="0.92"/>
    <path d="${CRADLE}" fill="none" stroke="${cradle}" stroke-width="5.5" stroke-linecap="round"/>
  </svg>`;
}

const jobs = [
  { out: "luminara-logo.png", size: 1024, bg: "#5168B4", cradle: "#F4F6FD" }, // opaque icon (iOS masks corners)
  { out: "luminara-mark.png", size: 1024, bg: null, cradle: "#5168B4" },
  { out: "images/icon.png", size: 96, bg: null, cradle: "#5168B4" },
];

const { default: sharp } = await import("sharp").catch(() => {
  console.error("\n✗ sharp not installed. Run:  npm i -D sharp\n  (or use scripts/generate-app-icon.html — no install needed)\n");
  process.exit(1);
});

for (const j of jobs) {
  const buf = Buffer.from(svg({ bg: j.bg, cradle: j.cradle }));
  const dest = resolve(assets, j.out);
  await mkdir(dirname(dest), { recursive: true });
  await sharp(buf, { density: 384 }).resize(j.size, j.size).png().toFile(dest);
  console.log("✓", j.out, `${j.size}×${j.size}`);
}
console.log("\nDone. Rebuild the app to pick up the new icon & splash.");
