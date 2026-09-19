import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findWorkletIssues } from './build-tools.mjs';

// The app is WebView-only by product decision (ADR-0007, user-confirmed on the Xiaomi 14 with
// trial .171). These guards make that decision executable: a reintroduced renderer switch, a
// Skyline compatibility layer or a Worklet directive fails the suite instead of shipping.

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(appRoot, 'src');
const scannedExtensions = new Set(['.ts', '.wxml', '.wxss', '.wxs', '.json']);
const bannedIdentifiers = [
  'skyline3172UiCompatibility',
  'is-skyline-3172-ui',
  'is-compat',
  'worklet:',
  'wx.worklet',
  'pan-gesture-handler',
  '__MINIPROGRAM_RENDERER__',
  'rendererOptions',
];

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return scannedExtensions.has(path.extname(entry.name)) ? [full] : [];
  });
}

function relative(file) {
  return path.relative(appRoot, file).split(path.sep).join('/');
}

describe('WebView-only rendering policy', () => {
  it('requests WebView at the app level and never declares renderer options', () => {
    const appJson = JSON.parse(read('src/app.json'));
    expect(appJson.renderer).toBe('webview');
    expect(appJson.rendererOptions).toBeUndefined();
  });

  it('keeps every page-level renderer declaration on WebView', () => {
    for (const file of listSourceFiles(sourceRoot).filter((entry) => entry.endsWith('.json'))) {
      const config = JSON.parse(readFileSync(file, 'utf8'));
      if (config.renderer === undefined) continue;
      expect(config.renderer, relative(file)).toBe('webview');
      expect(config.rendererOptions, relative(file)).toBeUndefined();
    }
  });

  it('leaves no Skyline compatibility surface or Worklet directive in the source tree', () => {
    const files = listSourceFiles(sourceRoot);
    for (const identifier of bannedIdentifiers) {
      const offenders = files
        .filter((file) => readFileSync(file, 'utf8').includes(identifier))
        .map(relative);
      expect(offenders, `source uses ${identifier}`).toEqual([]);
    }
    const worklets = files
      .filter((file) => file.endsWith('.ts'))
      .map((file) => findWorkletIssues(readFileSync(file, 'utf8'), relative(file)));
    expect(worklets.map((entry) => entry.issues).flat()).toEqual([]);
    expect(worklets.reduce((total, entry) => total + entry.count, 0)).toBe(0);
  });

  it('keeps the build free of a renderer switch and reports WebView in diagnostics', () => {
    const buildTools = read('scripts/build-tools.mjs');
    expect(buildTools).not.toContain('__MINIPROGRAM_RENDERER__');
    expect(buildTools).not.toContain('readRequestedRenderer');
    const buildEnv = read('src/types/build-env.d.ts');
    expect(buildEnv).not.toContain('__MINIPROGRAM_RENDERER__');
    const buildInfo = read('src/platform/build-info.ts');
    expect(buildInfo).toContain('WebView（应用请求）');
    expect(buildInfo).not.toContain('Skyline（应用请求）');
  });
});
