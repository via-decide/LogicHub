// LogicHub/scripts/build-icons.mjs
// Generates the PWA icons as real PNGs.
//
// icons/icon-192.png and icon-512.png were ASCII text files of 185 bytes each.
// The manifests referenced them, so installing the app showed a broken image.
// These are written here as valid PNGs with no external dependency, so the build
// cannot regress to a placeholder that merely has the right filename.
//
// Run: node scripts/build-icons.mjs

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { crc32 } from 'node:zlib';

/** Brand mark: an orange rounded square with a lighter notch, on near-black. */
const BACKGROUND = [7, 17, 15];
const MARK = [255, 103, 31];

function pixel(x, y, size, inset) {
  const min = inset;
  const max = size - inset;
  if (x < min || x >= max || y < min || y >= max) return BACKGROUND;

  // Rounded corners.
  const radius = Math.floor((max - min) * 0.22);
  const dx = Math.min(x - min, max - 1 - x);
  const dy = Math.min(y - min, max - 1 - y);
  if (dx < radius && dy < radius) {
    const ox = radius - dx;
    const oy = radius - dy;
    if (ox * ox + oy * oy > radius * radius) return BACKGROUND;
  }

  // A notch cut from the lower right, so the mark reads as a shape rather than
  // a plain square at small sizes.
  const notch = Math.floor((max - min) * 0.42);
  if (x > max - notch && y > max - notch) return BACKGROUND;

  return MARK;
}

function buildPng(size, inset) {
  return encodePng(size, size, (x, y) => pixel(x, y, size, inset));
}

/**
 * The social card.
 *
 * A link to the site currently unfurls with no image at all. This draws the same
 * mark on the 1200×630 canvas the platforms crop to, with a rule beneath it, so
 * a shared link reads as deliberate rather than broken. No text is drawn — there
 * is no font here, and a hand-plotted wordmark would look worse than none.
 */
function buildOgImage(width, height) {
  const markSize = Math.floor(height * 0.42);
  const markX = Math.floor((width - markSize) / 2);
  const markY = Math.floor(height * 0.24);
  const ruleY = markY + markSize + Math.floor(height * 0.09);
  const ruleHalfWidth = Math.floor(width * 0.16);
  const ruleThickness = Math.max(2, Math.floor(height * 0.008));

  return encodePng(width, height, (x, y) => {
    if (
      y >= ruleY && y < ruleY + ruleThickness
      && Math.abs(x - width / 2) < ruleHalfWidth
    ) {
      return MARK;
    }

    const localX = x - markX;
    const localY = y - markY;
    if (localX < 0 || localX >= markSize || localY < 0 || localY >= markSize) {
      return BACKGROUND;
    }
    return pixel(localX, localY, markSize, 0);
  });
}

/** Truecolour PNG, no filtering, one call per pixel. */
function encodePng(width, height, colourAt) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // no per-scanline filter
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colourAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr(width, height)),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;  // bit depth
  header[9] = 2;  // colour type: truecolour
  return header;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
  return Buffer.concat([length, typeAndData, crc]);
}

const targets = [
  // A maskable icon needs padding, since the launcher may crop to a circle.
  { path: 'icons/icon-192.png', size: 192, inset: 16 },
  { path: 'icons/icon-512.png', size: 512, inset: 42 },
  { path: 'icons/icon-maskable-512.png', size: 512, inset: 96 },
];

if (!existsSync('icons')) mkdirSync('icons', { recursive: true });
if (!existsSync('public/icons')) mkdirSync('public/icons', { recursive: true });

const written = [];
for (const target of targets) {
  const png = buildPng(target.size, target.inset);
  writeFileSync(target.path, png);
  writeFileSync(`public/${target.path}`, png);
  written.push({ path: target.path, size: target.size, bytes: png.length });
}

// 1200×630 is the size every platform crops its preview from.
const og = buildOgImage(1200, 630);
writeFileSync('og-image.png', og);
writeFileSync('public/og-image.png', og);
written.push({ path: 'og-image.png', size: '1200x630', bytes: og.length });

console.log(JSON.stringify({ written }, null, 2));
