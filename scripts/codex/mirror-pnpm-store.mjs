/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  throw new Error(`[schedule:store-mirror] ${message}`);
}

function parseArguments(arguments_) {
  const result = { source: undefined, target: undefined, json: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') {
      result.json = true;
      continue;
    }
    if (argument === '--source' || argument === '--target') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) fail(`${argument} requires a value`);
      result[argument.slice(2)] = path.resolve(value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${argument}`);
  }
  if (!result.source || !result.target) fail('--source and --target are required');
  return result;
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  let real = resolved;
  try { real = fs.realpathSync.native(resolved); } catch { /* target may not exist yet */ }
  return process.platform === 'win32' ? real.toLocaleLowerCase('en-US') : real;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function collectFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`store symlink is not accepted: ${source}`);
    if (entry.isDirectory()) collectFiles(source, result);
    else if (entry.isFile()) result.push(source);
    else fail(`unsupported store entry: ${source}`);
  }
  return result;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`target directory is not a real directory: ${directory}`);
}

export async function mirrorStore({ source, target }) {
  const sourceRoot = path.resolve(source);
  const targetRoot = path.resolve(target);
  if (canonicalPath(sourceRoot) === canonicalPath(targetRoot)) fail('source and target must differ');
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) fail(`source store is missing: ${sourceRoot}`);
  if (canonicalPath(targetRoot).startsWith(`${canonicalPath(sourceRoot)}${path.sep}`)) fail('target may not be inside the source store');
  ensureDirectory(targetRoot);

  const sourceFiles = collectFiles(sourceRoot).sort();
  let linked = 0;
  let copied = 0;
  let existing = 0;
  let bytes = 0;
  for (const sourceFile of sourceFiles) {
    const relative = path.relative(sourceRoot, sourceFile);
    const targetFile = path.join(targetRoot, relative);
    ensureDirectory(path.dirname(targetFile));
    const sourceStat = fs.statSync(sourceFile);
    bytes += sourceStat.size;
    if (fs.existsSync(targetFile)) {
      const targetStat = fs.lstatSync(targetFile);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) fail(`target store entry is not a regular file: ${targetFile}`);
      if (targetStat.size === sourceStat.size) {
        existing += 1;
        continue;
      }
      fs.copyFileSync(sourceFile, targetFile);
      copied += 1;
      continue;
    }
    try {
      fs.linkSync(sourceFile, targetFile);
      linked += 1;
    } catch (error) {
      if (!['EXDEV', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
      fs.copyFileSync(sourceFile, targetFile);
      copied += 1;
    }
  }

  const targetFiles = collectFiles(targetRoot).sort();
  const targetBytes = targetFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  if (sourceFiles.length !== targetFiles.length || bytes !== targetBytes) {
    fail(`mirror verification failed: source=${sourceFiles.length}/${bytes}, target=${targetFiles.length}/${targetBytes}`);
  }
  const sampleIndexes = [...new Set([0, 1, 2, Math.floor(sourceFiles.length / 2), sourceFiles.length - 3, sourceFiles.length - 2, sourceFiles.length - 1])]
    .filter((index) => index >= 0 && index < sourceFiles.length);
  const samples = [];
  for (const index of sampleIndexes) {
    const relative = path.relative(sourceRoot, sourceFiles[index]);
    const targetFile = path.join(targetRoot, relative);
    const sourceHash = await hashFile(sourceFiles[index]);
    const targetHash = await hashFile(targetFile);
    if (sourceHash !== targetHash) fail(`sample hash mismatch: ${relative}`);
    samples.push({ path: relative.replaceAll('\\', '/'), sha256: sourceHash });
  }
  return {
    source: sourceRoot,
    target: targetRoot,
    sourceFileCount: sourceFiles.length,
    targetFileCount: targetFiles.length,
    sourceBytes: bytes,
    targetBytes,
    hardlinksCreated: linked,
    filesCopied: copied,
    existingFilesReused: existing,
    sampleCount: samples.length,
    sampleHashesMatch: true,
    samples,
  };
}

const options = parseArguments(process.argv.slice(2));
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  mirrorStore(options)
    .then((result) => {
      if (options.json) console.log(JSON.stringify(result));
      else console.log(JSON.stringify(result, undefined, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
