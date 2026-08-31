/**
 * Rasterises design/icon-master.svg into the six icon artefacts the app needs.
 *
 * Run with: node scripts/generate-icons.mjs
 *
 * Outputs are committed, so this only needs re-running when the mark changes.
 * It leans on the `sharp` that ships with Next.js rather than adding a
 * dependency of its own.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const master = await readFile("design/icon-master.svg");

const render = (size, svg = master) =>
  sharp(svg, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// Android crops a maskable icon to whatever shape the launcher uses, so the
// mark sits inside the central 80% and the ground bleeds to every edge.
const maskableSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
     <rect width="512" height="512" fill="#141413"/>
     <g transform="translate(256,256) scale(0.78) translate(-256,-256)">
       <circle cx="256" cy="256" r="186" fill="#E1502A"/>
       <rect x="171" y="171" width="170" height="170" rx="16" fill="#141413"/>
     </g>
   </svg>`,
);

/** Minimal .ico container wrapping a single 32x32 PNG. */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

await mkdir("public/icons", { recursive: true });

// Modern browsers take the vector directly.
await writeFile("app/icon.svg", master);

await writeFile("app/favicon.ico", pngToIco(await render(32)));

// iOS renders transparency as black, so this one is flattened onto the ground.
await writeFile(
  "app/apple-icon.png",
  await sharp(await render(180)).flatten({ background: "#141413" }).png().toBuffer(),
);

await writeFile("public/icons/icon-192.png", await render(192));
await writeFile("public/icons/icon-512.png", await render(512));
await writeFile("public/icons/maskable-512.png", await render(512, maskableSvg));

console.log("icons written");
