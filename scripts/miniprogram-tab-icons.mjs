#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const size = 81;
const inactiveColor = '#6B7280';
const activeColor = '#1F5AA6';
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const tabIconNames = ['workbench', 'calendar', 'notifications', 'profile'];

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function parseColor(value) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    255,
  ];
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const offset = (y * size + x) * 4;
  pixels.set(color, offset);
}

function fillCircle(pixels, centerX, centerY, radius, color) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        setPixel(pixels, x, y, color);
      }
    }
  }
}

function drawLine(pixels, fromX, fromY, toX, toY, width, color) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step += 1) {
    const progress = steps === 0 ? 0 : step / steps;
    fillCircle(
      pixels,
      Math.round(fromX + (toX - fromX) * progress),
      Math.round(fromY + (toY - fromY) * progress),
      Math.floor(width / 2),
      color,
    );
  }
}

function drawRectangle(pixels, left, top, right, bottom, width, color) {
  drawLine(pixels, left, top, right, top, width, color);
  drawLine(pixels, right, top, right, bottom, width, color);
  drawLine(pixels, right, bottom, left, bottom, width, color);
  drawLine(pixels, left, bottom, left, top, width, color);
}

function drawWorkbench(pixels, color) {
  for (const [left, top] of [
    [19, 19],
    [45, 19],
    [19, 45],
    [45, 45],
  ]) {
    drawRectangle(pixels, left, top, left + 16, top + 16, 4, color);
  }
}

function drawCalendar(pixels, color) {
  drawRectangle(pixels, 17, 20, 64, 64, 4, color);
  drawLine(pixels, 17, 32, 64, 32, 4, color);
  drawLine(pixels, 29, 15, 29, 25, 4, color);
  drawLine(pixels, 52, 15, 52, 25, 4, color);
  for (const y of [42, 53]) {
    for (const x of [29, 41, 53]) {
      fillCircle(pixels, x, y, 2, color);
    }
  }
}

function drawNotifications(pixels, color) {
  drawLine(pixels, 24, 55, 57, 55, 4, color);
  drawLine(pixels, 24, 55, 29, 48, 4, color);
  drawLine(pixels, 57, 55, 52, 48, 4, color);
  drawLine(pixels, 29, 48, 29, 36, 4, color);
  drawLine(pixels, 52, 48, 52, 36, 4, color);
  drawLine(pixels, 29, 36, 35, 28, 4, color);
  drawLine(pixels, 52, 36, 46, 28, 4, color);
  drawLine(pixels, 35, 28, 46, 28, 4, color);
  fillCircle(pixels, 40, 62, 3, color);
}

function drawProfile(pixels, color) {
  fillCircle(pixels, 40, 28, 10, color);
  fillCircle(pixels, 40, 28, 5, [0, 0, 0, 0]);
  drawLine(pixels, 20, 62, 24, 49, 4, color);
  drawLine(pixels, 24, 49, 32, 44, 4, color);
  drawLine(pixels, 32, 44, 48, 44, 4, color);
  drawLine(pixels, 48, 44, 56, 49, 4, color);
  drawLine(pixels, 56, 49, 60, 62, 4, color);
  drawLine(pixels, 20, 62, 60, 62, 4, color);
}

const drawIcon = {
  calendar: drawCalendar,
  notifications: drawNotifications,
  profile: drawProfile,
  workbench: drawWorkbench,
};

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row += 1) {
    const targetOffset = row * (size * 4 + 1);
    scanlines[targetOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + row * size * 4, size * 4).copy(
      scanlines,
      targetOffset + 1,
    );
  }

  return Buffer.concat([
    pngSignature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function generateTabIcons(outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  const generated = [];
  for (const name of tabIconNames) {
    for (const active of [false, true]) {
      const pixels = new Uint8Array(size * size * 4);
      drawIcon[name](pixels, parseColor(active ? activeColor : inactiveColor));
      const file = path.join(outputDirectory, `${name}${active ? '-active' : ''}.png`);
      writeFileSync(file, encodePng(pixels));
      generated.push(file);
    }
  }
  return generated;
}

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedUrl === import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = path.join(root, 'apps', 'miniprogram', 'assets', 'tab-bar');
  const generated = generateTabIcons(outputDirectory);
  console.log(`[miniprogram-tab-icons] generated ${generated.length} icons`);
}
