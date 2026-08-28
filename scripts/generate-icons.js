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
  const nx = x / w;
  const ny = y / h;

  // Rounded rectangle card bounds
  const cornerRadius = 0.18;
  const padding = 0.08;
  const cardLeft = padding;
  const cardRight = 1 - padding;
  const cardTop = padding;
  const cardBottom = 1 - padding;

  // Check if inside rounded rectangle
  let inCard = false;
  if (nx >= cardLeft && nx <= cardRight && ny >= cardTop && ny <= cardBottom) {
    const dx = Math.max(cardLeft + cornerRadius - nx, 0, nx - (cardRight - cornerRadius));
    const dy = Math.max(cardTop + cornerRadius - ny, 0, ny - (cardBottom - cornerRadius));
    if (dx * dx + dy * dy <= cornerRadius * cornerRadius) {
      inCard = true;
    }
  }

  if (!inCard) {
    return [0, 0, 0, 0]; // Transparent background
  }

  // Gradient background: deep ocean blue (#0369a1) to vibrant sky blue (#38bdf8)
  const gradT = (nx + ny) / 2;
  const r = Math.round(3 * (1 - gradT) + 56 * gradT);
  const g = Math.round(105 * (1 - gradT) + 189 * gradT);
  const b = Math.round(161 * (1 - gradT) + 248 * gradT);

  // Document lines in crisp white
  // Line 1: top bar (y: 0.30 - 0.36, x: 0.22 - 0.78)
  // Line 2: mid bar (y: 0.44 - 0.50, x: 0.22 - 0.78)
  // Line 3: bot bar (y: 0.58 - 0.64, x: 0.22 - 0.52)
  const isLine1 = ny >= 0.28 && ny <= 0.36 && nx >= 0.22 && nx <= 0.78;
  const isLine2 = ny >= 0.44 && ny <= 0.52 && nx >= 0.22 && nx <= 0.78;
  const isLine3 = ny >= 0.60 && ny <= 0.68 && nx >= 0.22 && nx <= 0.54;

  // Glowing emerald export accent circle in bottom right corner (y: 0.60-0.84, x: 0.60-0.84)
  const isArrowCircle = Math.hypot(nx - 0.72, ny - 0.72) < 0.16;

  if (isArrowCircle) {
    return [16, 185, 129, 255]; // Vibrant Emerald (#10b981)
  }

  if (isLine1 || isLine2 || isLine3) {
    return [255, 255, 255, 245]; // Crisp white
  }

  return [r, g, b, 255];
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
