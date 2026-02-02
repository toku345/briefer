import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../src/icons');

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8); // bit depth
  data.writeUInt8(2, 9); // color type (RGB)
  data.writeUInt8(0, 10); // compression
  data.writeUInt8(0, 11); // filter
  data.writeUInt8(0, 12); // interlace

  return createChunk('IHDR', data);
}

function createIDAT(width, height) {
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter byte

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      // 青色 (#0066CC)
      raw[pixelStart] = 0x00; // R
      raw[pixelStart + 1] = 0x66; // G
      raw[pixelStart + 2] = 0xcc; // B
    }
  }

  const compressed = deflateSync(raw);
  return createChunk('IDAT', compressed);
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = makeCrcTable();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function createPng(size) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = createIHDR(size, size);
  const idat = createIDAT(size, size);
  const iend = createIEND();

  return Buffer.concat([Buffer.from(signature), ihdr, idat, iend]);
}

mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createPng(size);
  const path = resolve(iconsDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`Created: ${path}`);
}

console.log('Icons generated successfully!');
