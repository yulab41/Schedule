import { recordRuntimeDiagnosticPerformance } from './runtime-diagnostics-bridge.js';

const stages = new Set([
  'open-requested',
  'module-registered',
  'page-load',
  'page-show',
  'page-ready',
  'options-start',
  'options-ready',
  'options-error',
  'options-timeout',
  'layout-unavailable',
  ...['root', 'header', 'scroll'].flatMap((part) =>
    ['positive', 'zero', 'missing'].map((state) => `layout-${part}-${state}`),
  ),
]);
const measurements = new WeakMap<object, object>();

// These fixed labels are session-only evidence in the existing authorized safe report.
// They carry no query, group, member, error text or raw native result.
export function recordExportRenderStage(stage: string): void {
  if (!stages.has(stage)) return;
  recordRuntimeDiagnosticPerformance({
    page: 'exports',
    metric: stage,
    durationMs: 0,
    recordedAt: Date.now(),
  });
}

export function measureExportFirstPaint(page: object): void {
  const token = {};
  measurements.set(page, token);
  try {
    if (typeof wx.createSelectorQuery !== 'function') {
      recordExportRenderStage('layout-unavailable');
      return;
    }
    const query = (
      wx.createSelectorQuery() as MiniProgramSelectorQuery & {
        in(instance: object): MiniProgramSelectorQuery;
      }
    ).in(page);
    for (const selector of ['.exports-page', '.mini-header', '.exports-scroll']) {
      query.select(selector).boundingClientRect();
    }
    query.exec((results) => {
      if (measurements.get(page) !== token) return;
      measurements.delete(page);
      if (!Array.isArray(results)) {
        recordExportRenderStage('layout-unavailable');
        return;
      }
      for (const [index, part] of ['root', 'header', 'scroll'].entries()) {
        const rect = results[index] as { width?: unknown; height?: unknown } | null | undefined;
        const valid =
          rect &&
          typeof rect.width === 'number' &&
          Number.isFinite(rect.width) &&
          typeof rect.height === 'number' &&
          Number.isFinite(rect.height);
        const state = !valid
          ? 'missing'
          : (rect.width as number) > 0 && (rect.height as number) > 0
            ? 'positive'
            : 'zero';
        recordExportRenderStage(`layout-${part}-${state}`);
      }
    });
  } catch {
    measurements.delete(page);
    recordExportRenderStage('layout-unavailable');
  }
}

export function endExportRenderDiagnostics(page: object): void {
  measurements.delete(page);
}
