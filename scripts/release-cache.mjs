import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CACHE_SCHEMA_VERSION = 1;

export function computeCacheKey(root, relativePaths, context) {
  const resolvedRoot = path.resolve(root);
  const hash = crypto.createHash('sha256');
  hash.update(stableStringify(context));
  hash.update('\0');
  for (const relativePath of [...new Set(relativePaths)].sort()) {
    const normalized = relativePath.replaceAll('\\', '/');
    const absolutePath = path.resolve(resolvedRoot, relativePath);
    assertInside(resolvedRoot, absolutePath);
    const stats = fs.lstatSync(absolutePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`release cache input must be a regular file: ${normalized}`);
    }
    hash.update(normalized);
    hash.update('\0');
    hash.update((stats.mode & 0o777).toString(8));
    hash.update('\0');
    hash.update(sha256File(absolutePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function readCacheEntry(cacheRoot, kind, key) {
  validateKindAndKey(kind, key);
  const root = path.resolve(cacheRoot);
  const entryDirectory = path.join(root, kind, key);
  const metadataPath = path.join(entryDirectory, 'complete.json');
  const payloadPath = path.join(entryDirectory, 'payload.bin');
  try {
    assertNoSymlinkPath(root);
    assertNoSymlinkPath(path.join(root, kind));
    assertNoSymlinkPath(entryDirectory);
    for (const filePath of [metadataPath, payloadPath]) {
      const stats = fs.lstatSync(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) return undefined;
    }
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (
      metadata.schemaVersion !== CACHE_SCHEMA_VERSION ||
      metadata.kind !== kind ||
      metadata.inputKey !== key ||
      !/^[0-9a-f]{64}$/u.test(metadata.payloadSha256) ||
      sha256File(payloadPath) !== metadata.payloadSha256
    ) {
      return undefined;
    }
    return { entryDirectory, metadata, payloadPath };
  } catch {
    return undefined;
  }
}

export function publishCacheEntry(cacheRoot, kind, key, sourcePayload, extraMetadata = {}) {
  validateKindAndKey(kind, key);
  const root = path.resolve(cacheRoot);
  const kindRoot = path.join(root, kind);
  fs.mkdirSync(kindRoot, { recursive: true });
  assertNoSymlinkPath(root);
  assertNoSymlinkPath(kindRoot);
  const existing = readCacheEntry(root, kind, key);
  if (existing !== undefined) return existing;

  const entryDirectory = path.join(kindRoot, key);
  if (fs.existsSync(entryDirectory)) fs.rmSync(entryDirectory, { force: true, recursive: true });
  const temporaryDirectory = fs.mkdtempSync(path.join(kindRoot, `.tmp-${key}-`));
  const temporaryPayload = path.join(temporaryDirectory, 'payload.bin');
  try {
    fs.copyFileSync(sourcePayload, temporaryPayload);
    const metadata = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      kind,
      inputKey: key,
      payloadSha256: sha256File(temporaryPayload),
      ...extraMetadata,
    };
    assertPortableMetadata(metadata);
    fs.writeFileSync(
      path.join(temporaryDirectory, 'complete.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8',
    );
    fs.renameSync(temporaryDirectory, entryDirectory);
  } finally {
    if (fs.existsSync(temporaryDirectory)) {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  }
  const published = readCacheEntry(root, kind, key);
  if (published === undefined) throw new Error(`published ${kind} cache entry failed validation`);
  return published;
}

export function restoreCachePayload(entry, destinationPath) {
  if (sha256File(entry.payloadPath) !== entry.metadata.payloadSha256) {
    throw new Error('release cache payload changed before restore');
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(entry.payloadPath, destinationPath);
  if (sha256File(destinationPath) !== entry.metadata.payloadSha256) {
    throw new Error('restored release cache payload hash mismatch');
  }
}

export function invalidateCacheEntry(cacheRoot, kind, key) {
  validateKindAndKey(kind, key);
  const root = path.resolve(cacheRoot);
  const entryDirectory = path.join(root, kind, key);
  assertInside(root, entryDirectory);
  if (fs.existsSync(entryDirectory) && fs.lstatSync(entryDirectory).isSymbolicLink()) {
    throw new Error('refusing to remove a symlinked release cache entry');
  }
  fs.rmSync(entryDirectory, { force: true, recursive: true });
}

export function acquireCacheLock(cacheRoot, name) {
  if (!/^[a-z0-9-]+$/u.test(name)) throw new Error('invalid release cache lock name');
  const lockRoot = path.join(path.resolve(cacheRoot), 'locks');
  fs.mkdirSync(lockRoot, { recursive: true });
  assertNoSymlinkPath(lockRoot);
  const lockDirectory = path.join(lockRoot, `${name}.lock`);
  try {
    fs.mkdirSync(lockDirectory);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`release cache lock is already held: ${name}`);
    throw error;
  }
  fs.writeFileSync(
    path.join(lockDirectory, 'owner.json'),
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    'utf8',
  );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.rmSync(lockDirectory, { force: true, recursive: true });
  };
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function validateKindAndKey(kind, key) {
  if (!/^[a-z][a-z0-9-]*$/u.test(kind)) throw new Error('invalid release cache kind');
  if (!/^[0-9a-f]{64}$/u.test(key)) throw new Error('invalid release cache key');
}

function assertInside(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`release cache path escapes root: ${candidate}`);
  }
}

function assertNoSymlinkPath(candidate) {
  if (!fs.existsSync(candidate)) return;
  if (fs.lstatSync(candidate).isSymbolicLink()) {
    throw new Error(`release cache path must not be a symlink: ${candidate}`);
  }
}

function assertPortableMetadata(metadata) {
  const source = JSON.stringify(metadata);
  if (/(?:[A-Za-z]:\\|\/(?:Users|home)\/|token|secret|password)/iu.test(source)) {
    throw new Error('release cache metadata contains a local path or secret-like field');
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
