#!/usr/bin/env node
// Draws the PWA icon set for both clients.
//
// Why a script rather than checked-in binaries: an installed PWA is judged on
// its home-screen icon before anything else, and a missing one degrades to a
// screenshot of the page. Generating them keeps the brand colours in exactly one
// place — the design tokens below are copied from `apps/admin-web/app/globals.css`
// — and means a colour change is a re-run, not a trip through a design tool.
//
//   node scripts/generate-app-icons.mjs
//
// No dependencies. PNG is a container around a zlib stream, and both are in the
// Node standard library, so an icon pipeline does not need to add a native image
// package to the install.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Design tokens — `--color-ink-950` and `--color-accent-500`. */
const INK = [0x0a, 0x0d, 0x11];
const ACCENT = [0x12, 0xb7, 0x6a];

// ------------------------------------------------------------------ png

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** `pixels` is RGBA, row-major, 4 bytes per pixel. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Filter type 0 ("none") in front of every scanline. Real filters exist to
  // help compression on photographs; flat brand colour already deflates to
  // almost nothing.
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- draw

function canvas(size, [r, g, b]) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}

/**
 * Rounded rectangle, anti-aliased by sampling a 3x3 grid inside each pixel.
 * Without the sampling the plates read as visibly stepped at 192px, which is the
 * size most Android launchers actually draw.
 */
function roundedRect(pixels, size, { x, y, w, h, r }, [cr, cg, cb]) {
  const inside = (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const dx = Math.max(x + r - px, px - (x + w - r), 0);
    const dy = Math.max(y + r - py, py - (y + h - r), 0);
    return dx * dx + dy * dy <= r * r;
  };

  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(size - 1, Math.ceil(x + w));
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(size - 1, Math.ceil(y + h));

  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          if (inside(px + (sx + 0.5) / 3, py + (sy + 0.5) / 3)) hits += 1;
        }
      }
      if (hits === 0) continue;

      const a = hits / 9;
      const i = (py * size + px) * 4;
      pixels[i] = Math.round(pixels[i] * (1 - a) + cr * a);
      pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + cg * a);
      pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + cb * a);
    }
  }
}

/**
 * A dumbbell: centre bar, an inner plate and a shorter outer plate each side.
 * `scale` shrinks the mark toward the centre — a maskable icon may be cropped to
 * a circle inscribed in the middle 80%, so the mark has to sit inside that.
 */
function drawDumbbell(size, scale) {
  const pixels = canvas(size, INK);
  const c = size / 2;
  const u = size * scale;
  const bar = { w: 0.46, h: 0.115 };
  const inner = { w: 0.10, h: 0.40, at: 0.255 };
  const outer = { w: 0.075, h: 0.24, at: 0.375 };

  roundedRect(
    pixels,
    size,
    { x: c - (u * bar.w) / 2, y: c - (u * bar.h) / 2, w: u * bar.w, h: u * bar.h, r: u * 0.03 },
    ACCENT,
  );

  for (const side of [-1, 1]) {
    for (const plate of [inner, outer]) {
      roundedRect(
        pixels,
        size,
        {
          x: c + side * u * plate.at - (u * plate.w) / 2,
          y: c - (u * plate.h) / 2,
          w: u * plate.w,
          h: u * plate.h,
          r: u * 0.028,
        },
        ACCENT,
      );
    }
  }

  return pixels;
}

// ----------------------------------------------------------------- emit

// `scale` is the mark's share of the canvas. Maskable icons get the smaller mark
// so a circular crop cannot clip a plate off.
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-192.png', size: 192, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86 },
  { file: 'favicon.png', size: 64, scale: 1 },
];

const TARGETS = [
  join(ROOT, 'apps/admin-web/public/icons'),
  join(ROOT, 'apps/member-mobile/public/icons'),
];

for (const dir of TARGETS) {
  mkdirSync(dir, { recursive: true });
  for (const { file, size, scale } of ICONS) {
    writeFileSync(join(dir, file), encodePng(size, drawDumbbell(size, scale)));
  }
  console.log(`wrote ${ICONS.length} icons to ${dir.replace(`${ROOT}/`, '')}`);
}
