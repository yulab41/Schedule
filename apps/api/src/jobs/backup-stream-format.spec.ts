import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { incrementalBackupChecksum } from './backup-stream-archive.js';
import {
  decryptBackupFrames,
  encryptBackupFrames,
  type BackupFrame,
} from './backup-stream-format.js';
const key = Buffer.alloc(32, 1);
const frames: BackupFrame[] = [
  { kind: 'archive', createdAt: '2026-10-03T00:00:00Z' },
  {
    kind: 'table',
    name: 'synthetic',
    primaryKey: ['id'],
    binaryColumns: [],
    columns: ['id', 'name', 'nested'],
  },
  { kind: 'rows', rows: [{ id: '1', name: '合成🙂', nested: { a: 1 } }] },
  { kind: 'table-end', rowCount: 1, sha256: 'synthetic' },
  { kind: 'end', tableCount: 1, rowCount: 1 },
];
async function* input(values: readonly BackupFrame[]) {
  yield* values;
}
async function archive() {
  const chunks = [];
  for await (const chunk of encryptBackupFrames(input(frames), key)) chunks.push(chunk);
  return chunks;
}
async function read(chunks: readonly Buffer[], secret = key) {
  const result = [];
  for await (const frame of decryptBackupFrames(
    (async function* () {
      yield* chunks;
    })(),
    secret,
  ))
    result.push(frame);
  return result;
}
describe('authenticated bounded backup frames', () => {
  it('uses locale-independent ordering for nested checksum keys', () => {
    const checksum = incrementalBackupChecksum();
    checksum.add({ z: { ä: 1, a: 2, z: 3 }, a: '合成' });
    expect(checksum.finish()).toBe(
      createHash('sha256').update('[{"a":"合成","z":{"a":2,"z":3,"ä":1}}]').digest('hex'),
    );
  });
  it('round-trips with arbitrarily split input and authenticated completion', async () => {
    const bytes = Buffer.concat(await archive());
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.subarray(i, i + 7));
    expect(await read(chunks)).toEqual(frames);
  });
  it('rejects wrong keys, altered content, dropped/reordered/duplicated frames and trailing bytes', async () => {
    const chunks = await archive();
    await expect(read(chunks, Buffer.alloc(32, 2))).rejects.toThrow();
    const changed = chunks.map((c) => Buffer.from(c));
    changed[3]![9] = changed[3]![9]! ^ 1;
    for (const corrupt of [
      changed,
      chunks.slice(0, -1),
      [chunks[0]!, chunks[2]!, chunks[1]!, ...chunks.slice(3)],
      [...chunks.slice(0, 3), chunks[2]!, ...chunks.slice(3)],
      [...chunks, Buffer.from('junk')],
    ])
      await expect(read(corrupt)).rejects.toThrow();
  });
  it('rejects incomplete archives instead of accepting an authenticated prefix', async () => {
    const chunks = [];
    for await (const c of encryptBackupFrames(input(frames.slice(0, -1)), key)) chunks.push(c);
    await expect(read(chunks)).rejects.toThrow('missing authenticated end');
  });
});
