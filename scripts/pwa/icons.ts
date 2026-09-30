/**
 * `npm run pwa:icons`: draws the app icon (same shapes as src/app/icon.svg: sea tile, lemon,
 * leaf) as PNGs in public/icons/. No image library: a tiny supersampled rasterizer + PNG encoder.
 * Re-run only if the icon design changes, then commit public/icons/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

// Brand colours (mirror --sea, --lemon, --success in src/app/globals.css).
type RGB = [number, number, number];
const SEA: RGB = [0x17, 0x68, 0xa6];
const LEMON: RGB = [0xf7, 0xd2, 0x3e];
const LEAF: RGB = [0x2c, 0x9a, 0x58];

// Leaf: SVG path "M32 22c2-6 8-9 14-8-2 6-8 9-14 8Z" flattened to a polygon (64-unit space).
function cubic(p0: number[], p1: number[], p2: number[], p3: number[], steps = 40): number[][] {
  const pts: number[][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return pts;
}
const LEAF_POLY = [
  [32, 22],
  ...cubic([32, 22], [34, 16], [40, 13], [46, 14]),
  ...cubic([46, 14], [44, 20], [38, 23], [32, 22]),
];

function inPolygon(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundRect(x: number, y: number, r: number): boolean {
  if (x < 0 || y < 0 || x > 64 || y > 64) return false;
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Colour at a point of the 64-unit design, or null (transparent). */
function sample(x: number, y: number, rounded: boolean, scale: number): RGB | null {
  if (!inRoundRect(x, y, rounded ? 16 : 0)) return null;
  // Artwork scaled around the centre (maskable icons keep it inside the safe zone).
  const ax = 32 + (x - 32) / scale;
  const ay = 32 + (y - 32) / scale;
  if (ax >= 31 && ax <= 47 && ay >= 12 && ay <= 24 && inPolygon(ax, ay, LEAF_POLY)) return LEAF;
  if (((ax - 32) / 17) ** 2 + ((ay - 35) / 13) ** 2 <= 1) return LEMON;
  return SEA;
}

function render(size: number, rounded: boolean, scale: number): Buffer {
  const SS = 4; // 4x4 samples per pixel
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(((px + (sx + 0.5) / SS) * 64) / size, ((py + (sy + 0.5) / SS) * 64) / size, rounded, scale);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      }
      const o = row + 1 + px * 4;
      if (a) {
        raw[o] = Math.round(r / a);
        raw[o + 1] = Math.round(g / a);
        raw[o + 2] = Math.round(b / a);
      }
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return png(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });
const ICONS: { file: string; size: number; rounded: boolean; scale: number }[] = [
  { file: "icon-192.png", size: 192, rounded: true, scale: 1 },
  { file: "icon-512.png", size: 512, rounded: true, scale: 1 },
  // Full-bleed: the OS applies its own mask (Android) or rounded corners (iOS).
  { file: "icon-maskable-512.png", size: 512, rounded: false, scale: 0.85 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, scale: 1 },
];
for (const icon of ICONS) {
  writeFileSync(join(OUT, icon.file), render(icon.size, icon.rounded, icon.scale));
  console.log(`✓ public/icons/${icon.file}`);
}
