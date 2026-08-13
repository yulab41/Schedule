#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

export const CLIENT_CORE_TARGET_BYTES = 10 * 1024;
export const CLIENT_CORE_MAX_BYTES = 20 * 1024;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDirectory = path.join(repositoryRoot, 'packages', 'client-core');
const sourceBundlePath = path.join(packageDirectory, 'dist', 'miniprogram', 'index.js');
const sourceMetafilePath = path.join(packageDirectory, 'dist', 'miniprogram', 'meta.json');
const packedBundleDirectory = path.join(
  repositoryRoot,
  'apps',
  'miniprogram',
  'miniprogram_npm',
  '@schedule',
  'client-core',
);
const packedBundlePath = path.join(packedBundleDirectory, 'index.js');
const packedBuildMarkerPath = path.join(
  repositoryRoot,
  '.tmp-miniprogram-preview',
  'client-core-build-npm.json',
);

const forbiddenRuntimeIdentifiers = new Set([
  'Buffer',
  'XMLHttpRequest',
  '__dirname',
  '__filename',
  'window',
  'document',
  'fetch',
  'global',
  'globalThis',
  'localStorage',
  'navigator',
  'process',
  'self',
  'wx',
]);
const nodeBuiltins = new Set(
  builtinModules.flatMap((moduleName) => {
    const normalized = moduleName.replace(/^node:/u, '');
    return [normalized, `node:${normalized}`];
  }),
);

function isPropertyName(identifier) {
  const parent = identifier.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) && parent.name === identifier) ||
    (ts.isMethodDeclaration(parent) && parent.name === identifier) ||
    (ts.isPropertyDeclaration(parent) && parent.name === identifier)
  );
}

function findForbiddenRuntimeIssues(source) {
  const sourceFile = ts.createSourceFile(
    'client-core-bundle.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const issues = new Set();

  function visit(node) {
    if (
      ts.isIdentifier(node) &&
      !isPropertyName(node) &&
      forbiddenRuntimeIdentifiers.has(node.text)
    ) {
      issues.add(`bundle references forbidden runtime identifier: ${node.text}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const moduleName = node.arguments[0].text;
      if (nodeBuiltins.has(moduleName)) {
        issues.add(`bundle imports Node builtin: ${moduleName}`);
      } else if (moduleName === 'zod' || moduleName.startsWith('@schedule/contracts')) {
        issues.add(`bundle imports forbidden runtime module: ${moduleName}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...issues];
}

function hasCommonJsExport(source) {
  const sourceFile = ts.createSourceFile(
    'client-core-bundle.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let found = false;

  function visit(node) {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(node) &&
      ((ts.isIdentifier(node.expression) &&
        node.expression.text === 'module' &&
        node.name.text === 'exports') ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'exports'))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

export function findClientCoreBundleIssues(bundle) {
  const source = bundle.toString('utf8');
  const issues = [];

  if (bundle.byteLength > CLIENT_CORE_MAX_BYTES) {
    issues.push(`bundle exceeds ${CLIENT_CORE_MAX_BYTES} bytes`);
  }
  if (!hasCommonJsExport(source)) {
    issues.push('bundle is not CommonJS');
  }
  if (/\n\s{2,}\S/u.test(source)) {
    issues.push('bundle is not minified');
  }
  issues.push(...findForbiddenRuntimeIssues(source));
  return issues;
}

export function findClientCoreMetafileIssues(metafile) {
  if (
    metafile === null ||
    typeof metafile !== 'object' ||
    metafile.inputs === null ||
    typeof metafile.inputs !== 'object' ||
    metafile.outputs === null ||
    typeof metafile.outputs !== 'object'
  ) {
    return ['client-core esbuild metafile is malformed'];
  }

  const issues = [];
  for (const [inputPath, input] of Object.entries(metafile.inputs)) {
    const normalizedInputPath = inputPath.replaceAll('\\', '/');
    if (!normalizedInputPath.startsWith('src/')) {
      issues.push(`metafile input escapes client-core src: ${inputPath}`);
    }
    for (const imported of input.imports ?? []) {
      const importedPath = String(imported.path);
      if (imported.external === true) {
        issues.push(`metafile input import is external: ${importedPath}`);
      } else if (
        importedPath.startsWith('../') ||
        path.isAbsolute(importedPath) ||
        importedPath.replaceAll('\\', '/').includes('/node_modules/')
      ) {
        issues.push(`metafile input escapes client-core src: ${importedPath}`);
      }
    }
  }
  for (const output of Object.values(metafile.outputs)) {
    for (const imported of output.imports ?? []) {
      if (imported.external === true) {
        issues.push(`metafile output import is external: ${String(imported.path)}`);
      }
    }
  }
  return issues;
}

function sha256(bundle) {
  return createHash('sha256').update(bundle).digest('hex');
}

function isStrictlyInside(rootDirectory, candidateDirectory) {
  const relativePath = path.relative(rootDirectory, candidateDirectory);
  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

export function preparePackedClientCoreBuild({
  markerPath = packedBuildMarkerPath,
  packedDirectory = packedBundleDirectory,
  sourceBundlePath: currentSourceBundlePath = sourceBundlePath,
  startedAtMs = Date.now(),
  testOnlySafeRoot,
} = {}) {
  const sourceBundle = readFileSync(currentSourceBundlePath);
  const resolvedPackedDirectory = path.resolve(packedDirectory);
  if (testOnlySafeRoot === undefined) {
    if (
      !isStrictlyInside(repositoryRoot, resolvedPackedDirectory) ||
      resolvedPackedDirectory !== path.resolve(packedBundleDirectory)
    ) {
      throw new Error('refusing to remove anything except the exact packed client-core directory');
    }
  } else if (!isStrictlyInside(path.resolve(testOnlySafeRoot), resolvedPackedDirectory)) {
    throw new Error('test packed output must stay inside its explicit safe root');
  }

  rmSync(resolvedPackedDirectory, { force: true, recursive: true });
  mkdirSync(path.dirname(markerPath), { recursive: true });
  const marker = {
    sourceSha256: sha256(sourceBundle),
    startedAtMs,
  };
  writeFileSync(markerPath, `${JSON.stringify(marker)}\n`, 'utf8');
  return marker;
}

export function inspectClientCoreMiniProgramBundle() {
  const packageJson = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  if (typeof packageJson.miniprogram !== 'string' || packageJson.miniprogram.length === 0) {
    return {
      bundlePath: undefined,
      byteLength: 0,
      issues: ['package.json must declare a miniprogram entry'],
    };
  }

  const bundlePath = path.resolve(packageDirectory, packageJson.miniprogram);
  let bundle;
  try {
    bundle = readFileSync(bundlePath);
  } catch {
    return {
      bundlePath,
      byteLength: 0,
      issues: [`miniprogram bundle is missing: ${path.relative(repositoryRoot, bundlePath)}`],
    };
  }
  let metafile;
  try {
    metafile = JSON.parse(readFileSync(sourceMetafilePath, 'utf8'));
  } catch {
    metafile = undefined;
  }
  const metafileIssues =
    metafile === undefined
      ? ['client-core esbuild metafile is missing']
      : findClientCoreMetafileIssues(metafile);
  if (
    metafile !== undefined &&
    !Object.keys(metafile.outputs).some((outputPath) =>
      outputPath.replaceAll('\\', '/').endsWith('dist/miniprogram/index.js'),
    )
  ) {
    metafileIssues.push('client-core esbuild metafile does not describe the Mini bundle');
  }
  return {
    bundlePath,
    byteLength: bundle.byteLength,
    issues: [...findClientCoreBundleIssues(bundle), ...metafileIssues],
  };
}

export function inspectPackedClientCoreMiniProgramBundle({
  markerPath = packedBuildMarkerPath,
  packedBundlePath: currentPackedBundlePath = packedBundlePath,
  sourceBundlePath: currentSourceBundlePath = sourceBundlePath,
} = {}) {
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    return {
      bundlePath: currentPackedBundlePath,
      byteLength: 0,
      issues: ['packed miniprogram build marker is missing or malformed'],
    };
  }
  if (
    typeof marker.startedAtMs !== 'number' ||
    !Number.isFinite(marker.startedAtMs) ||
    typeof marker.sourceSha256 !== 'string'
  ) {
    return {
      bundlePath: currentPackedBundlePath,
      byteLength: 0,
      issues: ['packed miniprogram build marker is missing or malformed'],
    };
  }

  let sourceBundle;
  try {
    sourceBundle = readFileSync(currentSourceBundlePath);
  } catch {
    return {
      bundlePath: currentPackedBundlePath,
      byteLength: 0,
      issues: ['source miniprogram bundle is missing'],
    };
  }

  let bundle;
  let bundleStat;
  try {
    bundle = readFileSync(currentPackedBundlePath);
    bundleStat = statSync(currentPackedBundlePath);
  } catch {
    return {
      bundlePath: currentPackedBundlePath,
      byteLength: 0,
      issues: [
        `packed miniprogram bundle is missing: ${path.relative(repositoryRoot, currentPackedBundlePath)}`,
      ],
    };
  }
  const issues = findClientCoreBundleIssues(bundle);
  if (bundleStat.mtimeMs < marker.startedAtMs) {
    issues.push('packed miniprogram bundle predates this build');
  }
  if (sha256(sourceBundle) !== marker.sourceSha256) {
    issues.push('source miniprogram bundle changed after build-npm started');
  }
  return {
    bundlePath: currentPackedBundlePath,
    byteLength: bundle.byteLength,
    issues,
    sha256: sha256(bundle),
  };
}

function main() {
  if (process.argv.includes('--prepare-packed')) {
    const marker = preparePackedClientCoreBuild();
    console.log(
      `[miniprogram-client-core] cleared stale packed output; source sha256 ${marker.sourceSha256}`,
    );
    return;
  }
  const result = process.argv.includes('--packed')
    ? inspectPackedClientCoreMiniProgramBundle()
    : inspectClientCoreMiniProgramBundle();
  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      console.error(`[miniprogram-client-core] ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  const relativeBundlePath = path.relative(repositoryRoot, result.bundlePath);
  const targetStatus =
    result.byteLength <= CLIENT_CORE_TARGET_BYTES ? 'within target' : 'within hard limit';
  console.log(
    `[miniprogram-client-core] ${relativeBundlePath}: ${result.byteLength} bytes (${targetStatus})${result.sha256 === undefined ? '' : `, sha256 ${result.sha256}`}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
