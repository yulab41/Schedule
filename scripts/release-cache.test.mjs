import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  acquireCacheLock,
  computeCacheKey,
  publishCacheEntry,
  readCacheEntry,
  restoreCachePayload,
} from './release-cache.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('immutable local release cache', () => {
  it('uses sorted file contents and toolchain context instead of commit or mtime', () => {
    const root = createTemporaryDirectory();
    fs.writeFileSync(path.join(root, 'a.txt'), 'alpha\n');
    fs.writeFileSync(path.join(root, 'b.txt'), 'beta\n');

    const first = computeCacheKey(root, ['b.txt', 'a.txt'], { command: ['build'], schema: 1 });
    fs.utimesSync(path.join(root, 'a.txt'), new Date(), new Date());
    const second = computeCacheKey(root, ['a.txt', 'b.txt'], { command: ['build'], schema: 1 });
    const changedContext = computeCacheKey(root, ['a.txt', 'b.txt'], {
      command: ['build', '--changed'],
      schema: 1,
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(changedContext).not.toBe(first);
  });

  it('publishes complete entries atomically and rejects corrupted payloads', () => {
    const root = createTemporaryDirectory();
    const cacheRoot = path.join(root, 'cache');
    const payload = path.join(root, 'payload.tar.zst');
    fs.writeFileSync(payload, 'trusted payload');
    const key = 'a'.repeat(64);

    const entry = publishCacheEntry(cacheRoot, 'api-flat', key, payload, { treeSha256: 'b' });
    expect(readCacheEntry(cacheRoot, 'api-flat', key)?.payloadPath).toBe(entry.payloadPath);

    fs.writeFileSync(entry.payloadPath, 'corrupted');
    expect(readCacheEntry(cacheRoot, 'api-flat', key)).toBeUndefined();
  });

  it('restores by copy so output mutation cannot poison the cache', () => {
    const root = createTemporaryDirectory();
    const cacheRoot = path.join(root, 'cache');
    const payload = path.join(root, 'payload.tar.gz');
    const destination = path.join(root, 'release', 'payload.tar.gz');
    fs.writeFileSync(payload, 'immutable cache bytes');
    const entry = publishCacheEntry(cacheRoot, 'dist', 'c'.repeat(64), payload, {});

    restoreCachePayload(entry, destination);
    fs.writeFileSync(destination, 'changed output');

    expect(fs.readFileSync(entry.payloadPath, 'utf8')).toBe('immutable cache bytes');
    expect(readCacheEntry(cacheRoot, 'dist', 'c'.repeat(64))).toBeDefined();
  });

  it('serializes package writers with an explicit removable lock', () => {
    const root = createTemporaryDirectory();
    const release = acquireCacheLock(root, 'package');

    expect(() => acquireCacheLock(root, 'package')).toThrow(/cache lock/u);
    release();
    expect(() => acquireCacheLock(root, 'package')).not.toThrow();
  });
});

function createTemporaryDirectory() {
  fs.mkdirSync(path.join(repositoryRoot, 'runtime'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(repositoryRoot, 'runtime', 'test-release-cache-'));
  temporaryDirectories.push(directory);
  return directory;
}
