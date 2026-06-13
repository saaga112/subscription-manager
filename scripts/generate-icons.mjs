import { writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { join } from "path";

// Generates simple solid-color square PNG icons (no external deps) so the
// PWA manifest and Apple touch icon have valid images to reference.

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size, [r, g, b]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = size * 3 + 1;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const off = rowStart + 1 + x * 3;
      // Draw a simple rounded "card" look: border + fill
      const margin = Math.floor(size * 0.12);
      const onBorder = x < margin || y < margin || x >= size - margin || y >= size - margin;
      if (onBorder) {
        raw[off] = 255;
        raw[off + 1] = 255;
        raw[off + 2] = 255;
      } else {
        raw[off] = r;
        raw[off + 1] = g;
        raw[off + 2] = b;
      }
    }
  }

  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(process.cwd(), "public", "icons");
import { mkdirSync } from "fs";
mkdirSync(outDir, { recursive: true });

const blue = [37, 99, 235]; // tailwind blue-600

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makePng(size, blue));
}
writeFileSync(join(outDir, "apple-touch-icon.png"), makePng(180, blue));

console.log("Generated PWA icons in public/icons");
