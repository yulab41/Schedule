import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('Mini Program visible build identity', () => {
  it('uses one compile-time version and commit label', () => {
    const buildInfo = readSource('platform/build-info.ts');
    const declarations = readSource('types/build-env.d.ts');

    expect(buildInfo).toContain('__MINIPROGRAM_BUILD_VERSION__');
    expect(buildInfo).toContain('__MINIPROGRAM_BUILD_COMMIT__');
    expect(buildInfo).toContain('__MINIPROGRAM_BUILD_TIME__');
    expect(buildInfo).toContain('__MINIPROGRAM_BUILD_DESCRIPTION__');
    expect(buildInfo).toContain('__MINIPROGRAM_BUILD_DIRTY__');
    expect(buildInfo).toContain('buildLabel');
    expect(declarations).toContain('declare const __MINIPROGRAM_BUILD_VERSION__: string;');
    expect(declarations).toContain('declare const __MINIPROGRAM_BUILD_COMMIT__: string;');
    expect(declarations).toContain('declare const __MINIPROGRAM_BUILD_TIME__: string;');
  });

  it('shows the build label on every P1 page used for device testing', () => {
    for (const page of ['index', 'calendar-poc', 'manual-matrix-poc', 'gesture-probe']) {
      const template = readSource(`pages/${page}/index.wxml`);
      const source = readSource(`pages/${page}/index.ts`);
      expect(template, page).toContain('{{buildLabel}}');
      expect(source, page).toContain('buildInfo.buildLabel');
    }
  });

  it('keeps the diagnostic runtime card visible before gesture probes and allows page scroll', () => {
    const config = JSON.parse(readSource('pages/gesture-probe/index.json'));
    const template = readSource('pages/gesture-probe/index.wxml');

    expect(config.disableScroll).toBe(false);
    expect(template.indexOf('C · 真机运行信息')).toBeLessThan(
      template.indexOf('A · Skyline Pan Worklet'),
    );
    expect(template).toContain('代码版本');
  });
});
