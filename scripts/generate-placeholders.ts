/**
 * Generates /public/placeholder-truck-{1..6}.webp — neutral, SVG-drawn truck
 * silhouettes (no stock photos). Run once and commit the output; re-run only
 * if the art changes:
 *   npx tsx scripts/generate-placeholders.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const W = 800;
const H = 600;

/** Six body styles matching the site's categories, all one visual family. */
const BODIES: ((c: string, d: string) => string)[] = [
  // 1 — rigid box truck
  (c, d) => `
    <rect x="150" y="220" width="380" height="180" rx="10" fill="${c}"/>
    <path d="M530 260h96l54 70v70H530z" fill="${d}"/>
    <rect x="546" y="272" width="58" height="46" rx="6" fill="#cfd3da"/>
    <circle cx="240" cy="412" r="38" fill="${d}"/><circle cx="240" cy="412" r="16" fill="#cfd3da"/>
    <circle cx="440" cy="412" r="38" fill="${d}"/><circle cx="440" cy="412" r="16" fill="#cfd3da"/>
    <circle cx="612" cy="412" r="38" fill="${d}"/><circle cx="612" cy="412" r="16" fill="#cfd3da"/>`,
  // 2 — tractor unit (fifth wheel, no trailer)
  (c, d) => `
    <path d="M300 250h150l60 76v74H300z" fill="${c}"/>
    <rect x="318" y="264" width="70" height="50" rx="6" fill="#cfd3da"/>
    <rect x="180" y="360" width="120" height="30" rx="6" fill="${d}"/>
    <rect x="205" y="330" width="70" height="30" rx="6" fill="${c}"/>
    <circle cx="360" cy="412" r="40" fill="${d}"/><circle cx="360" cy="412" r="17" fill="#cfd3da"/>
    <circle cx="470" cy="412" r="40" fill="${d}"/><circle cx="470" cy="412" r="17" fill="#cfd3da"/>
    <circle cx="235" cy="412" r="34" fill="${d}"/><circle cx="235" cy="412" r="14" fill="#cfd3da"/>`,
  // 3 — panel van
  (c, d) => `
    <path d="M190 250q0-26 26-26h300q22 0 34 18l56 84v78H190z" fill="${c}"/>
    <path d="M520 244l50 74h-96v-74z" fill="#cfd3da"/>
    <rect x="190" y="330" width="330" height="74" fill="${d}" opacity="0.25"/>
    <circle cx="290" cy="410" r="36" fill="${d}"/><circle cx="290" cy="410" r="15" fill="#cfd3da"/>
    <circle cx="540" cy="410" r="36" fill="${d}"/><circle cx="540" cy="410" r="15" fill="#cfd3da"/>`,
  // 4 — tipper / volquete
  (c, d) => `
    <path d="M170 240h330l-24 150H194z" fill="${c}"/>
    <rect x="160" y="380" width="360" height="22" rx="6" fill="${d}"/>
    <path d="M520 268h92l52 66v68h-144z" fill="${d}"/>
    <rect x="536" y="280" width="54" height="44" rx="6" fill="#cfd3da"/>
    <circle cx="250" cy="416" r="36" fill="${d}"/><circle cx="250" cy="416" r="15" fill="#cfd3da"/>
    <circle cx="420" cy="416" r="36" fill="${d}"/><circle cx="420" cy="416" r="15" fill="#cfd3da"/>
    <circle cx="600" cy="416" r="36" fill="${d}"/><circle cx="600" cy="416" r="15" fill="#cfd3da"/>`,
  // 5 — fridge box (roof unit)
  (c, d) => `
    <rect x="150" y="230" width="370" height="170" rx="10" fill="${c}"/>
    <rect x="150" y="230" width="370" height="170" rx="10" fill="#ffffff" opacity="0.35"/>
    <rect x="150" y="250" width="26" height="60" rx="6" fill="${d}"/>
    <path d="M520 262h96l54 70v68H520z" fill="${d}"/>
    <rect x="536" y="274" width="58" height="46" rx="6" fill="#cfd3da"/>
    <circle cx="250" cy="412" r="36" fill="${d}"/><circle cx="250" cy="412" r="15" fill="#cfd3da"/>
    <circle cx="430" cy="412" r="36" fill="${d}"/><circle cx="430" cy="412" r="15" fill="#cfd3da"/>
    <circle cx="606" cy="412" r="36" fill="${d}"/><circle cx="606" cy="412" r="15" fill="#cfd3da"/>`,
  // 6 — work pickup
  (c, d) => `
    <path d="M210 320h180v-60q0-20 20-20h96q18 0 28 14l44 66z" fill="${c}"/>
    <rect x="430" y="252" width="66" height="52" rx="6" fill="#cfd3da"/>
    <rect x="190" y="320" width="420" height="66" rx="10" fill="${d}"/>
    <circle cx="300" cy="400" r="36" fill="${d}"/><circle cx="300" cy="400" r="15" fill="#cfd3da"/>
    <circle cx="530" cy="400" r="36" fill="${d}"/><circle cx="530" cy="400" r="15" fill="#cfd3da"/>`,
];

function svgFor(n: number): string {
  const body = BODIES[(n - 1) % BODIES.length];
  // subtle tonal variation between the six files
  const bgs = ["#eceae6", "#e8e9ec", "#eeece7", "#e9ebe9", "#edeae8", "#eaeaed"];
  const bg = bgs[(n - 1) % bgs.length];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect y="${H - 155}" width="${W}" height="155" fill="#dedcd7"/>
  <g>${body("#4a505c", "#343945")}</g>
  <text x="${W - 24}" y="${H - 24}" text-anchor="end"
        font-family="Arial, sans-serif" font-size="22" font-weight="bold"
        fill="#a7a49d">camiones.com.py</text>
</svg>`;
}

async function main() {
  const outDir = join(__dirname, "..", "public");
  mkdirSync(outDir, { recursive: true });
  for (let n = 1; n <= 6; n++) {
    const out = join(outDir, `placeholder-truck-${n}.webp`);
    await sharp(Buffer.from(svgFor(n))).webp({ quality: 78 }).toFile(out);
    console.log(`wrote ${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
