import { readFile } from 'node:fs/promises';

const SOURCE_URL = new URL('../testing/minium/p1/test_p1_native.py', import.meta.url);
const ARCHIVE_ENTRY_NAME = 'test_p1_native.py';
const DOS_EPOCH_DATE = 0x21;
const UTF8_FLAG = 0x0800;
const EXPECTED_TEST_METHODS = [
  'test_calendar_month',
  'test_foundation_controls',
  'test_manual_matrix_daily',
  'test_manual_matrix_maximum',
];
const EXPECTED_CAPTURES = [
  'p1-foundation-controls-v1--initial.png',
  'p1-foundation-controls-v1--notification-on.png',
  'p1-foundation-controls-v1--contact-unchecked.png',
  'p1-foundation-controls-v1--week-selected.png',
  'p1-calendar-month-v1--initial.png',
  'p1-calendar-month-v1--selected-date.png',
  'p1-calendar-month-v1--previous-month.png',
  'p1-calendar-month-v1--next-month.png',
  'p1-calendar-month-v1--rebound.png',
  'p1-manual-matrix-daily-v1--initial.png',
  'p1-manual-matrix-daily-v1--horizontal-scroll.png',
  'p1-manual-matrix-daily-v1--cell-selected.png',
  'p1-manual-matrix-daily-v1--undo.png',
  'p1-manual-matrix-maximum-v1--initial.png',
  'p1-manual-matrix-maximum-v1--scroll-end.png',
  'p1-manual-matrix-maximum-v1--stale-cell.png',
  'p1-manual-matrix-maximum-v1--cell-selected.png',
  'p1-manual-matrix-maximum-v1--undo.png',
];

const CRC32_TABLE = Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export async function loadP1MiniumSource() {
  return normalizeText(await readFile(SOURCE_URL, 'utf8'));
}

export function validateP1MiniumSource(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error('P1 Minium source is required.');
  }
  if (!source.includes('class P1NativeParityTest(minium.MiniTest):')) {
    throw new Error('P1 Minium source must inherit from minium.MiniTest.');
  }
  if (/dev_tool_path|project_path|token|appid|appsecret|private[_-]?key/i.test(source)) {
    throw new Error('P1 Minium source must not contain local paths or credentials.');
  }
  const testMethods = [...source.matchAll(/^ {4}def (test_[a-z0-9_]+)\(self\):$/gm)]
    .map((match) => match[1])
    .sort();
  if (JSON.stringify(testMethods) !== JSON.stringify(EXPECTED_TEST_METHODS)) {
    throw new Error('P1 Minium test methods do not match the approved native evidence cases.');
  }
  const captureNames = [...source.matchAll(/self\._capture\("([^"]+\.png)"\)/g)].map(
    (match) => match[1],
  );
  if (JSON.stringify(captureNames) !== JSON.stringify(EXPECTED_CAPTURES)) {
    throw new Error('P1 Minium capture names do not match the checked-in P1 state manifest.');
  }
  if (new Set(captureNames).size !== captureNames.length) {
    throw new Error('P1 Minium capture names must be unique.');
  }
  return { captureNames, testMethods };
}

export async function buildP1MiniumArchive() {
  const source = await loadP1MiniumSource();
  validateP1MiniumSource(source);
  return createStoredZip(ARCHIVE_ENTRY_NAME, Buffer.from(source, 'utf8'));
}

export function listStoredZipEntries(archive) {
  if (!Buffer.isBuffer(archive)) throw new Error('ZIP archive must be a Buffer.');
  const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0 || endOffset + 22 > archive.length) {
    throw new Error('ZIP end-of-central-directory record is missing.');
  }
  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('ZIP central-directory entry is invalid.');
    }
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    entries.push(archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function normalizeText(source) {
  return `${source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()}\n`;
}

function crc32(content) {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(name, content) {
  const nameBuffer = Buffer.from(name, 'utf8');
  const checksum = crc32(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(UTF8_FLAG, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(DOS_EPOCH_DATE, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(UTF8_FLAG, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(DOS_EPOCH_DATE, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);

  const centralOffset = local.length + nameBuffer.length + content.length;
  const centralSize = central.length + nameBuffer.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([local, nameBuffer, content, central, nameBuffer, end]);
}
