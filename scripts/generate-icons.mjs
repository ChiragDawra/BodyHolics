/**
 * Rasterises design/bodyholic-mark.png into every icon artefact the app needs.
 *
 * Run with: node scripts/generate-icons.mjs
 * The master itself comes from scripts/build-mark.py — see the notes there.
 *
 * Outputs are committed, so this only needs re-running when the mark changes.
 * It leans on the `sharp` that ships with Next.js rather than adding a
 * dependency of its own.
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import sharp from "sharp";

/** --color-surface. Must stay in sync with lib/theme.ts and globals.css. */
const GROUND = "#0A0A0C";

const master = await readFile("design/bodyholic-mark.png");

/**
 * The mark on the app's own ground, square.
 *
 * The artwork is a white silhouette on transparency and is half again as wide
 * as it is tall, so it is fitted by width and centred vertically — `contain`
 * against a square would letterbox it and leave it looking small.
 *
 * `fraction` is how much of the canvas width the figure spans. Small sizes get
 * more of it: at 16px the figure is only about thirteen pixels across and the
 * arms and the knocked-out lettering mush into a grey blob, so the margin that
 * reads as deliberate padding at 512 is detail it cannot afford. Checked by
 * rendering 16 and 32 at several fractions and looking at them.
 */
function defaultFraction(size) {
  return size <= 48 ? 0.94 : 0.82;
}

async function icon(size, { fraction = defaultFraction(size), flatten = true } = {}) {
  const markWidth = Math.round(size * fraction);

  const mark = await sharp(master)
    .resize({ width: markWidth })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: flatten ? GROUND : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: mark, gravity: "centre" }]);

  return canvas.png({ compressionLevel: 9 }).toBuffer();
}

/**
 * An .ico holding several sizes.
 *
 * Windows and some browsers pick the size they want out of the container, so
 * shipping only 32 leaves them upscaling a blurry one into a 48px slot. Each
 * entry is a whole PNG, which every target since Vista understands.
 */
function pngsToIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length + entries.length * 16;
  const dir = [];

  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(entry);
  }

  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

await mkdir("public/icons", { recursive: true });

/**
 * The previous mark was an SVG. Next.js emits a <link> for every icon file it
 * finds in app/, so leaving it behind would ship two competing favicons and
 * let the browser choose the old one.
 */
await rm("app/icon.svg", { force: true });

await writeFile(
  "app/favicon.ico",
  pngsToIco(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({ size, png: await icon(size) })),
    ),
  ),
);

await writeFile("app/icon.png", await icon(512));

// iOS renders transparency as black and applies its own rounding, so this one
// is opaque and edge-to-edge.
await writeFile("app/apple-icon.png", await icon(180));

await writeFile("public/icons/icon-192.png", await icon(192));
await writeFile("public/icons/icon-512.png", await icon(512));

/**
 * Android crops a maskable icon to whatever shape the launcher uses, and only
 * the central 80% of the canvas is guaranteed to survive. A wide mark
 * inscribed in that circle can span about 65% of the width before its corners
 * leave the safe zone, so this one is set well inside that.
 */
await writeFile("public/icons/maskable-512.png", await icon(512, { fraction: 0.6 }));

console.log("icons written from design/bodyholic-mark.png");
