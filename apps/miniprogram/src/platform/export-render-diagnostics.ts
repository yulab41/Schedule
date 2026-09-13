import { recordRuntimeDiagnosticPerformance } from './runtime-diagnostics-bridge.js';

const stages = new Set([
  'open-requested',
  'module-registered',
  'page-load',
  'page-show',
  'page-ready',
  'page-unload',
  'options-start',
  'options-ready',
  'options-error',
  'options-timeout',
]);

// Fixed session-only labels; never include query values or raw errors.
export function recordExportRenderStage(stage: string): void {
  if (!stages.has(stage)) return;
  recordRuntimeDiagnosticPerformance({
    page: 'exports',
    metric: stage,
    durationMs: 0,
    recordedAt: Date.now(),
  });
}
