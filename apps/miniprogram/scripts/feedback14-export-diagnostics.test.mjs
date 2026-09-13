import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('records only fixed export stages in the existing bounded report', async () => {
  const slot = { performance: [] };
  vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: slot } }));
  const { recordExportRenderStage } = await import('../src/platform/export-render-diagnostics.ts');
  recordExportRenderStage('page-load');
  recordExportRenderStage('unsafe-name-phone-query');
  recordExportRenderStage('options-ready');
  expect(slot.performance.map((e) => e.metric)).toEqual(['page-load', 'options-ready']);
});
