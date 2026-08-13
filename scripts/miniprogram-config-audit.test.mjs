import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { findProjectConfigIssues } from './miniprogram-config-audit.mjs';

const trackedConfig = JSON.parse(
  readFileSync(new URL('../apps/miniprogram/project.config.json', import.meta.url), 'utf8'),
);

const cleanConfig = {
  appid: 'wx56a7a21f974fd9af',
  compileType: 'miniprogram',
  libVersion: '3.16.2',
  miniprogramRoot: './',
  packOptions: {
    ignore: [],
    include: [{ type: 'folder', value: 'assets' }],
  },
  projectname: 'schedule-miniprogram',
  setting: {
    compileWorklet: true,
    es6: true,
    minified: true,
    minifyWXML: true,
    minifyWXSS: true,
    postcss: true,
    ignoreUploadUnusedFiles: true,
    uploadWithSourceMap: true,
    urlCheck: true,
    useCompilerPlugins: ['typescript'],
  },
};

describe('tracked miniprogram project configuration', () => {
  it('rejects inherited V2 and machine-local compiler settings', () => {
    const issues = findProjectConfigIssues({
      ...cleanConfig,
      libVersion: 'latest',
      setting: {
        ...cleanConfig.setting,
        babelSetting: { disablePlugins: [], ignore: [], outputPath: '' },
        compileWorklet: false,
        disableSWC: true,
        swc: false,
        urlCheck: false,
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        'libVersion must equal 3.16.2',
        'setting.compileWorklet must be true',
        'setting.urlCheck must be true',
        'setting.babelSetting is not allowed in tracked configuration',
        'setting.disableSWC is not allowed in tracked configuration',
        'setting.swc is not allowed in tracked configuration',
      ]),
    );
  });

  it('accepts the exact V3-0.5 team baseline', () => {
    expect(findProjectConfigIssues(cleanConfig)).toEqual([]);
  });

  it('requires release uploads to exclude files outside the production dependency graph', () => {
    expect(
      findProjectConfigIssues({
        ...cleanConfig,
        setting: { ...cleanConfig.setting, ignoreUploadUnusedFiles: false },
      }),
    ).toContain('setting.ignoreUploadUnusedFiles must be true');
  });

  it('keeps manifest-referenced tab assets in dependency-pruned release uploads', () => {
    expect(
      findProjectConfigIssues({
        ...cleanConfig,
        packOptions: { ignore: [], include: [] },
      }),
    ).toContain('packOptions.include must contain only the assets folder');
  });

  it('keeps the committed project configuration on the accepted baseline', () => {
    expect(findProjectConfigIssues(trackedConfig)).toEqual([]);
  });
});
