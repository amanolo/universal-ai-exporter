import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a valid RGBA PNG buffer of width x height in pure Node.js (no external deps)
 */
function createPngBuffer(width, height, pixelFn) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth: 8
  ihdr.writeUInt8(6, 9); // color type: RGBA (6)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte (0) before each scanline
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(12 + length);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crcData = buffer.subarray(4, 8 + length);
  const crc = crc32(crcData);
  buffer.writeUInt32BE(crc >>> 0, 8 + length);
  return buffer;
}

// Standard CRC32 table & function
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Procedurally draws our brand icon:
 * A rounded document card with a vibrant blue-cyan gradient,
 * document lines, and an export sparkle mark.
 */
function uaiePixelShader(x, y, w, h) {
  const normX = x / w;
  const normY = y / h;

  // Background gradient: Deep Indigo (#0f172a to #1e1b4b)
  let r = Math.floor(15 + normY * 15);
  let g = Math.floor(23 + normY * 10);
  let b = Math.floor(42 + normY * 33);
  let a = 255;

  // Document Page Graphic Dimensions
  const docLeft = Math.floor(w * 0.22);
  const docRight = Math.floor(w * 0.78);
  const docTop = Math.floor(h * 0.16);
  const docBottom = Math.floor(h * 0.84);
  const cornerFold = Math.floor(w * 0.20);

  // Inside doc boundaries
  if (x >= docLeft && x <= docRight && y >= docTop && y <= docBottom) {
    // Check if in folded top-right corner
    const inFoldCutout = (x > (docRight - cornerFold)) && (y < (docTop + cornerFold)) && ((x - (docRight - cornerFold)) + (docTop + cornerFold - y) > cornerFold);

    if (!inFoldCutout) {
      // Document base color: Crisp Pure White (#FFFFFF)
      r = 255;
      g = 255;
      b = 255;

      // Cyan Accent Header Line
      if (y >= docTop + h * 0.18 && y <= docTop + h * 0.24 && x >= docLeft + w * 0.10 && x <= docRight - w * 0.10) {
        r = 14; g = 165; b = 233; // Vibrant Sky Blue (#0ea5e9)
      }

      // Middle Content Lines
      if (y >= docTop + h * 0.32 && y <= docTop + h * 0.36 && x >= docLeft + w * 0.10 && x <= docRight - w * 0.10) {
        r = 71; g = 85; b = 105; // Slate-600
      }
      if (y >= docTop + h * 0.44 && y <= docTop + h * 0.48 && x >= docLeft + w * 0.10 && x <= docRight - w * 0.10) {
        r = 148; g = 163; b = 184; // Slate-400
      }
      if (y >= docTop + h * 0.56 && y <= docTop + h * 0.60 && x >= docLeft + w * 0.10 && x <= docLeft + w * 0.36) {
        r = 16; g = 185; b = 129; // Emerald Accent (#10b981)
      }
    } else {
      // Fold flap styling
      const inFlap = (x >= docRight - cornerFold) && (y <= docTop + cornerFold) && ((x - (docRight - cornerFold)) <= (y - docTop));
      if (inFlap) {
        r = 203; g = 213; b = 225; // Light Gray Slate (#cbd5e1)
      }
    }
  }

  // Rounded outer borders for app icon
  const rad = w * 0.22;
  const isCorner =
    (x < rad && y < rad && Math.hypot(x - rad, y - rad) > rad) ||
    (x > w - rad && y < rad && Math.hypot(x - (w - rad), y - rad) > rad) ||
    (x < rad && y > h - rad && Math.hypot(x - rad, y - (h - rad)) > rad) ||
    (x > w - rad && y > h - rad && Math.hypot(x - (w - rad), y - (h - rad)) > rad);

  if (isCorner) {
    return [0, 0, 0, 0];
  }

  return [r, g, b, a];
}

export function generateAllIcons(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sizes = [16, 32, 48, 128];
  sizes.forEach(size => {
    const pngBuffer = createPngBuffer(size, size, uaiePixelShader);
    const filePath = path.join(outputDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, pngBuffer);
    console.log(`✅ Generated icon asset: ${filePath} (${size}x${size}px)`);
  });
}

// Direct execution
if (process.argv[1] === __filename) {
  const targetDir = path.join(__dirname, '../src/assets/icons');
  generateAllIcons(targetDir);
}
