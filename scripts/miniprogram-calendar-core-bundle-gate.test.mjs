import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CALENDAR_CORE_MAX_BYTES,
  findCalendarCoreBundleIssues,
  findCalendarCoreMetafileIssues,
  inspectPackedCalendarCoreMiniProgramBundle,
  preparePackedCalendarCoreBuild,
} from './miniprogram-calendar-core-bundle-gate.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceBundlePath = path.join(
  repositoryRoot,
  'packages',
  'calendar-core',
  'dist',
  'miniprogram',
  'index.js',
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('calendar-core Mini bundle gate', () => {
  it('rejects size, platform globals, external runtime imports, and escaped graph inputs', () => {
    expect(findCalendarCoreBundleIssues(Buffer.alloc(CALENDAR_CORE_MAX_BYTES + 1))).toContain(
      `bundle exceeds ${CALENDAR_CORE_MAX_BYTES} bytes`,
    );
    expect(findCalendarCoreBundleIssues(Buffer.from('module.exports={x:fetch};'))).toContain(
      'bundle references forbidden runtime identifier: fetch',
    );
    expect(
      findCalendarCoreMetafileIssues({
        inputs: { '../contracts/src/index.ts': { imports: [] } },
        outputs: { 'dist/miniprogram/index.js': { imports: [{ external: true, path: 'zod' }] } },
      }),
    ).toEqual(
      expect.arrayContaining([
        'metafile input escapes calendar-core src: ../contracts/src/index.ts',
        'metafile output import is external: zod',
      ]),
    );
  });

  it('requires a fresh packed copy with the locked runtime exports', () => {
    const safeRoot = mkdtempSync(path.join(tmpdir(), 'schedule-calendar-core-gate-'));
    temporaryDirectories.push(safeRoot);
    const packedDirectory = path.join(safeRoot, 'packed');
    const packedBundlePath = path.join(packedDirectory, 'index.js');
    const markerPath = path.join(safeRoot, 'marker.json');
    mkdirSync(packedDirectory, { recursive: true });
    const startedAtMs = Date.now() - 1_000;
    preparePackedCalendarCoreBuild({
      markerPath,
      packedDirectory,
      sourceBundlePath,
      startedAtMs,
      testOnlySafeRoot: safeRoot,
    });
    mkdirSync(packedDirectory, { recursive: true });
    copyFileSync(sourceBundlePath, packedBundlePath);
    utimesSync(packedBundlePath, new Date(), new Date());
    expect(
      inspectPackedCalendarCoreMiniProgramBundle({
        markerPath,
        packedBundlePath,
        sourceBundlePath,
      }),
    ).toMatchObject({ issues: [] });

    writeFileSync(packedBundlePath, 'module.exports={};\n', 'utf8');
    utimesSync(packedBundlePath, new Date(), new Date());
    expect(
      inspectPackedCalendarCoreMiniProgramBundle({
        markerPath,
        packedBundlePath,
        sourceBundlePath,
      }).issues,
    ).toContain('packed bundle is missing export: buildCalendarMonthViewModel');
  });

  it('keeps the production source bundle within the locked maximum', () => {
    expect(readFileSync(sourceBundlePath).byteLength).toBeLessThanOrEqual(CALENDAR_CORE_MAX_BYTES);
  });

  it('returns auditable issues instead of throwing for absent packed artifacts', () => {
    const missingRoot = mkdtempSync(path.join(tmpdir(), 'schedule-calendar-core-missing-'));
    temporaryDirectories.push(missingRoot);
    expect(
      inspectPackedCalendarCoreMiniProgramBundle({
        markerPath: path.join(missingRoot, 'missing-marker.json'),
        packedBundlePath: path.join(missingRoot, 'missing-packed.js'),
        sourceBundlePath,
      }),
    ).toMatchObject({ issues: ['packed calendar-core build marker is missing or malformed'] });
  });
});
