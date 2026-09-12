import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('records only fixed export stages and bounded layout classes in the existing local report', async () => {
  const slot = { performance: [] };
  vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: slot } }));
  let callback;
  const query = {
    select: vi.fn(() => query),
    boundingClientRect: () => query,
    exec: (fn) => {
      callback = fn;
    },
  };
  vi.stubGlobal('wx', { createSelectorQuery: () => ({ in: () => query }) });
  const { recordExportRenderStage, measureExportFirstPaint, endExportRenderDiagnostics } =
    await import('../src/platform/export-render-diagnostics.ts');
  recordExportRenderStage('page-load');
  recordExportRenderStage('unsafe-name-phone-query');
  const page = {};
  measureExportFirstPaint(page);
  callback([{ width: 390, height: 844 }, { width: 390, height: 0 }, null]);
  expect(slot.performance.map((e) => e.metric)).toEqual([
    'page-load',
    'layout-root-positive',
    'layout-header-zero',
    'layout-scroll-missing',
  ]);
  expect(query.select.mock.calls.flat()).toEqual([
    '.exports-page',
    '.mini-header',
    '.exports-scroll',
  ]);
  measureExportFirstPaint(page);
  endExportRenderDiagnostics(page);
  callback([{ width: 390, height: 844 }]);
  expect(slot.performance).toHaveLength(4);
});

it('cannot interrupt rendering when measurement is unavailable or throws', async () => {
  vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: { performance: [] } } }));
  vi.stubGlobal('wx', {});
  const { measureExportFirstPaint } = await import('../src/platform/export-render-diagnostics.ts');
  expect(() => measureExportFirstPaint({})).not.toThrow();
  vi.stubGlobal('wx', {
    createSelectorQuery: () => {
      throw new Error('native unavailable');
    },
  });
  expect(() => measureExportFirstPaint({})).not.toThrow();
});
