/**
 * Generates /public/og-default.png — the site-wide Open Graph fallback image
 * (1200×630) used by every page that doesn't ship its own. WhatsApp is this
 * market's primary share channel and it renders link previews imageless
 * without one. SVG-drawn in the site palette — no stock photography.
 *
 * Run once and commit the output; re-run only if the art or brand changes:
 *   npx tsx scripts/generate-og-default.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const W = 1200;
const H = 630;

const CHARCOAL = "#15171b";
const CHARCOAL_SOFT = "#22262d";
const AMBER = "#f0a500";
const STEEL = "#4a505c";
const STEEL_DARK = "#343945";

/** Tractor unit + box trailer, same silhouette family as the placeholders. */
const truck = `
  <rect x="150" y="330" width="430" height="180" rx="12" fill="${STEEL}"/>
  <rect x="150" y="330" width="430" height="180" rx="12" fill="#ffffff" opacity="0.06"/>
  <path d="M580 372h104l60 78v60H580z" fill="${STEEL_DARK}"/>
  <rect x="598" y="386" width="64" height="50" rx="7" fill="#cfd3da" opacity="0.9"/>
  <rect x="140" y="510" width="620" height="16" rx="8" fill="${STEEL_DARK}"/>
  <circle cx="252" cy="524" r="40" fill="${STEEL_DARK}"/><circle cx="252" cy="524" r="17" fill="#cfd3da"/>
  <circle cx="462" cy="524" r="40" fill="${STEEL_DARK}"/><circle cx="462" cy="524" r="17" fill="#cfd3da"/>
  <circle cx="676" cy="524" r="40" fill="${STEEL_DARK}"/><circle cx="676" cy="524" r="17" fill="#cfd3da"/>`;

function svg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CHARCOAL_SOFT}"/>
      <stop offset="1" stop-color="${CHARCOAL}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect y="${H - 8}" width="${W}" height="8" fill="${AMBER}"/>
  <g opacity="0.5">${truck}</g>
  <text x="80" y="180" font-family="Arial, Helvetica, sans-serif"
        font-size="76" font-weight="bold" fill="#ffffff">camiones<tspan fill="${AMBER}">.com.py</tspan></text>
  <text x="80" y="244" font-family="Arial, Helvetica, sans-serif"
        font-size="34" font-weight="bold" fill="#ffffff" opacity="0.72">Camiones nuevos y usados en Paraguay</text>
  <text x="80" y="296" font-family="Arial, Helvetica, sans-serif"
        font-size="26" fill="#ffffff" opacity="0.55">Precios en US$ y ₲ · Financiación · Consultá por WhatsApp</text>
</svg>`;
}

async function main() {
  const outDir = join(__dirname, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "og-default.png");
  await sharp(Buffer.from(svg())).png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
