import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  ARTIFACT_ROOT,
  SOURCE_ROOT,
  auditProductionPackageContents,
  buildMiniProgram,
  createFileManifest,
  listFiles,
  listRegisteredPages,
  sha256,
} from './build-tools.mjs';
import { verifyBuildManifest } from './miniprogram-ci-helpers.mjs';

const outputDirectory = path.join(ARTIFACT_ROOT, 'production-content-test');
const reusablePages = [
  'pages/index/index',
  'pages/gesture-probe/index',
  'subpackages/diagnostics/pages/test-tools/index',
];
const removedRoutes = [
  'pages/profile/index',
  'subpackages/organization/pages/directory/index',
  'subpackages/workflows/pages/swap/index',
];

afterAll(() => rmSync(outputDirectory, { recursive: true, force: true }));

describe('production package boundary', () => {
  it('keeps reusable diagnostic source and tests outside registered routes', () => {
    const appJson = JSON.parse(readFileSync(path.join(SOURCE_ROOT, 'app.json'), 'utf8'));
    const routes = listRegisteredPages(appJson);
    expect(routes).toHaveLength(18);
    for (const route of reusablePages) {
      for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
        expect(existsSync(path.join(SOURCE_ROOT, `${route}${extension}`))).toBe(true);
      }
      expect(routes).not.toContain(route);
    }
    expect(existsSync(path.join(SOURCE_ROOT, 'platform/diagnostics-access.ts'))).toBe(true);
    for (const route of removedRoutes) {
      expect(routes).not.toContain(route);
      expect(existsSync(path.join(SOURCE_ROOT, `${route}.ts`))).toBe(false);
    }
  });

  it('excludes diagnostic files from the built upload and rejects a reintroduced file', async () => {
    const build = await buildMiniProgram({
      buildCommit: 'package-slim-test',
      buildDirty: false,
      buildTime: '2026-09-26T00:00:00.000Z',
      buildVersion: 'package-slim-test',
      outdir: outputDirectory,
      profile: 'production',
    });
    expect(auditProductionPackageContents(outputDirectory)).toEqual([]);
    expect(verifyBuildManifest(build, sha256(JSON.stringify(build.files)))).toBeUndefined();
    const files = listFiles(outputDirectory).map((file) =>
      path.relative(outputDirectory, file).split(path.sep).join('/'),
    );
    for (const route of reusablePages) {
      expect(
        files.some((file) => file.startsWith(`${path.dirname(route).replaceAll('\\', '/')}/`)),
      ).toBe(false);
    }
    expect(files).not.toContain('platform/diagnostics-access.js');

    const forbidden = path.join(
      outputDirectory,
      'subpackages/diagnostics/pages/test-tools/index.js',
    );
    mkdirSync(path.dirname(forbidden), { recursive: true });
    writeFileSync(forbidden, 'Page({});\n');
    expect(auditProductionPackageContents(outputDirectory)).toContain(
      'forbidden production file: subpackages/diagnostics/pages/test-tools/index.js',
    );
    const appJsonPath = path.join(outputDirectory, 'app.json');
    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
    appJson.pages.push('pages/index/index');
    writeFileSync(appJsonPath, JSON.stringify(appJson));
    expect(auditProductionPackageContents(outputDirectory)).toContain(
      'forbidden production route: pages/index/index',
    );
    expect(() =>
      verifyBuildManifest(
        build,
        sha256(
          JSON.stringify(createFileManifest(outputDirectory, new Set(['build-manifest.json']))),
        ),
      ),
    ).toThrow(/Upload package content rejected/u);
  });
});
