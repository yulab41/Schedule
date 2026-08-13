#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

export const CALENDAR_CORE_MAX_BYTES = 20 * 1024;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDirectory = path.join(repositoryRoot, 'packages', 'calendar-core');
const sourceBundlePath = path.join(packageDirectory, 'dist', 'miniprogram', 'index.js');
const sourceMetafilePath = path.join(packageDirectory, 'dist', 'miniprogram', 'meta.json');
const packedBundleDirectory = path.join(
  repositoryRoot,
  'apps',
  'miniprogram',
  'miniprogram_npm',
  '@schedule',
  'calendar-core',
);
const packedBundlePath = path.join(packedBundleDirectory, 'index.js');
const packedBuildMarkerPath = path.join(
  repositoryRoot,
  '.tmp-miniprogram-preview',
  'calendar-core-build-npm.json',
);

const forbiddenRuntimeIdentifiers = new Set([
  'Buffer',
  'XMLHttpRequest',
  '__dirname',
  '__filename',
  'document',
  'fetch',
  'global',
  'globalThis',
  'localStorage',
  'navigator',
  'process',
  'self',
  'window',
  'wx',
]);

export const CALENDAR_CORE_RUNTIME_EXPORTS = [
  'addBusinessMonths',
  'addWeeks',
  'buildCalendarCacheNotice',
  'buildCalendarMonthViewModel',
  'buildCalendarSurfaceViewModel',
  'buildDayList',
  'buildMonthGrid',
  'createCalendarMonthStateViewModel',
  'createCalendarViewModeState',
  'filterCalendarAssignments',
  'findCalendarPhoneAction',
  'formatChinaDateTime',
  'formatChinaStandardTime',
  'formatShiftTimeRange',
  'getAvailablePhoneActions',
  'getBusinessMonthLabel',
  'getBusinessMonthOf',
  'getBusinessMonthsForWeek',
  'getCalendarMarkerDescription',
  'getCalendarMarkerLabel',
  'getCurrentBusinessDate',
  'getCurrentBusinessMonth',
  'getDutyMemberName',
  'getDutyMembershipId',
  'getHolidayShortLabel',
  'getVisibleWeekForMonth',
  'getWeekDays',
  'getWeekIndexForToday',
  'getWeekLabel',
  'getWeekStartDate',
  'getWeekdayLabel',
  'goCalendarToBusinessMonth',
  'goCalendarToThisWeek',
  'goCalendarToToday',
  'isPastBusinessDate',
  'isWeekend',
  'mergeCalendarFilterViewModels',
  'parseBusinessDate',
  'parseBusinessMonth',
  'recenterCalendarMonthSlots',
  'recenterMonthSlots',
  'rotateMonthSlots',
  'sortCalendarAssignments',
  'stepCalendarMonth',
  'stepCalendarWeek',
  'switchCalendarViewMode',
];

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
    'calendar-core-bundle.js',
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
      if (moduleName === 'zod' || moduleName.startsWith('@schedule/')) {
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
    'calendar-core-bundle.js',
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
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'module' || node.expression.text === 'exports')
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

export function findCalendarCoreBundleIssues(bundle) {
  const source = bundle.toString('utf8');
  const issues = [];
  if (bundle.byteLength > CALENDAR_CORE_MAX_BYTES) {
    issues.push(`bundle exceeds ${CALENDAR_CORE_MAX_BYTES} bytes`);
  }
  if (!hasCommonJsExport(source)) issues.push('bundle is not CommonJS');
  if (/\n\s{2,}\S/u.test(source)) issues.push('bundle is not minified');
  issues.push(...findForbiddenRuntimeIssues(source));
  return issues;
}

export function findCalendarCoreMetafileIssues(metafile) {
  if (
    metafile === null ||
    typeof metafile !== 'object' ||
    metafile.inputs === null ||
    typeof metafile.inputs !== 'object' ||
    metafile.outputs === null ||
    typeof metafile.outputs !== 'object'
  ) {
    return ['calendar-core esbuild metafile is malformed'];
  }
  const issues = [];
  for (const [inputPath, input] of Object.entries(metafile.inputs)) {
    if (!inputPath.replaceAll('\\', '/').startsWith('src/')) {
      issues.push(`metafile input escapes calendar-core src: ${inputPath}`);
    }
    for (const imported of input.imports ?? []) {
      if (imported.external === true) {
        issues.push(`metafile input import is external: ${String(imported.path)}`);
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

export function preparePackedCalendarCoreBuild({
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
      throw new Error(
        'refusing to remove anything except the exact packed calendar-core directory',
      );
    }
  } else if (!isStrictlyInside(path.resolve(testOnlySafeRoot), resolvedPackedDirectory)) {
    throw new Error('test packed output must stay inside its explicit safe root');
  }
  rmSync(resolvedPackedDirectory, { force: true, recursive: true });
  mkdirSync(path.dirname(markerPath), { recursive: true });
  const marker = { sourceSha256: sha256(sourceBundle), startedAtMs };
  writeFileSync(markerPath, `${JSON.stringify(marker)}\n`, 'utf8');
  return marker;
}

export function inspectCalendarCoreMiniProgramBundle() {
  let bundle;
  try {
    bundle = readFileSync(sourceBundlePath);
  } catch {
    return {
      bundlePath: sourceBundlePath,
      byteLength: 0,
      issues: ['calendar-core source miniprogram bundle is missing'],
    };
  }
  let metafile;
  try {
    metafile = JSON.parse(readFileSync(sourceMetafilePath, 'utf8'));
  } catch {
    return {
      bundlePath: sourceBundlePath,
      byteLength: bundle.byteLength,
      issues: [
        ...findCalendarCoreBundleIssues(bundle),
        'calendar-core esbuild metafile is missing',
      ],
    };
  }
  return {
    bundlePath: sourceBundlePath,
    byteLength: bundle.byteLength,
    issues: [...findCalendarCoreBundleIssues(bundle), ...findCalendarCoreMetafileIssues(metafile)],
  };
}

export function inspectPackedCalendarCoreMiniProgramBundle({
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
      issues: ['packed calendar-core build marker is missing or malformed'],
    };
  }
  let sourceBundle;
  try {
    sourceBundle = readFileSync(currentSourceBundlePath);
  } catch {
    return {
      bundlePath: currentPackedBundlePath,
      byteLength: 0,
      issues: ['calendar-core source miniprogram bundle is missing'],
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
      issues: ['packed calendar-core miniprogram bundle is missing'],
    };
  }
  const issues = findCalendarCoreBundleIssues(bundle);
  if (bundleStat.mtimeMs < marker.startedAtMs)
    issues.push('packed miniprogram bundle predates this build');
  if (sha256(sourceBundle) !== marker.sourceSha256) {
    issues.push('source miniprogram bundle changed after build-npm started');
  }
  try {
    const require = createRequire(import.meta.url);
    const resolvedPackedBundlePath = require.resolve(currentPackedBundlePath);
    delete require.cache[resolvedPackedBundlePath];
    const runtime = require(currentPackedBundlePath);
    for (const name of CALENDAR_CORE_RUNTIME_EXPORTS) {
      if (typeof runtime[name] !== 'function')
        issues.push(`packed bundle is missing export: ${name}`);
    }
    const expectedExports = new Set(CALENDAR_CORE_RUNTIME_EXPORTS);
    for (const name of Object.keys(runtime)) {
      if (typeof runtime[name] === 'function' && !expectedExports.has(name)) {
        issues.push(`packed bundle has unexpected runtime export: ${name}`);
      }
    }
  } catch (error) {
    issues.push(
      `packed bundle require failed: ${error instanceof Error ? error.message : String(error)}`,
    );
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
    const marker = preparePackedCalendarCoreBuild();
    console.log(
      `[miniprogram-calendar-core] cleared stale packed output; source sha256 ${marker.sourceSha256}`,
    );
    return;
  }
  const result = process.argv.includes('--packed')
    ? inspectPackedCalendarCoreMiniProgramBundle()
    : inspectCalendarCoreMiniProgramBundle();
  for (const issue of result.issues) console.error(`[miniprogram-calendar-core] ${issue}`);
  if (result.issues.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(
    `[miniprogram-calendar-core] ${path.relative(repositoryRoot, result.bundlePath)}: ${result.byteLength} bytes${result.sha256 === undefined ? '' : `, sha256 ${result.sha256}`}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
