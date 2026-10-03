import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { LocalBackupStorage } from './backup-storage.js';

const root = fileURLToPath(
  new URL('../../../../runtime/audit/backup-storage-tests/', import.meta.url),
);
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
it('publishes only a complete stream and removes interrupted temporary output', async () => {
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(`${root}case-`);
  directories.push(directory);
  const storage = new LocalBackupStorage(directory);
  await expect(
    storage.writeStream(
      'incomplete.backup',
      (async function* () {
        yield Buffer.from('prefix');
        throw new Error('synthetic interrupted stream');
      })(),
    ),
  ).rejects.toThrow('interrupted');
  expect(await readdir(directory)).toEqual([]);
  await storage.writeStream(
    'complete.backup',
    (async function* () {
      yield Buffer.from('one');
      yield Buffer.from('two');
    })(),
  );
  expect((await storage.read('complete.backup')).toString()).toBe('onetwo');
  expect(await readdir(directory)).toEqual(['complete.backup']);
});
