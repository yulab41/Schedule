import type {
  RuntimeDiagnosticError,
  RuntimeDiagnosticPerformance,
  RuntimeDiagnosticRequestInput,
  RuntimeDiagnosticsStore,
} from './runtime-diagnostics.js';

interface DiagnosticsBridgeApp {
  readonly globalData?: {
    readonly runtimeDiagnostics?: RuntimeDiagnosticsStore | undefined;
  };
}

export function recordRuntimeDiagnosticRequest(entry: RuntimeDiagnosticRequestInput): void {
  try {
    resolveRuntimeDiagnosticsStore()?.recordRequest(entry);
  } catch {
    // Diagnostics must never alter request behavior.
  }
}

export function recordRuntimeDiagnosticError(entry: RuntimeDiagnosticError): void {
  try {
    resolveRuntimeDiagnosticsStore()?.recordError(entry);
  } catch {
    // Error diagnostics must never recursively report themselves.
  }
}

export function recordRuntimeDiagnosticPerformance(entry: RuntimeDiagnosticPerformance): void {
  try {
    resolveRuntimeDiagnosticsStore()?.recordPerformance(entry);
  } catch {
    // Performance diagnostics are best-effort and read-only.
  }
}

function resolveRuntimeDiagnosticsStore(): RuntimeDiagnosticsStore | undefined {
  try {
    return getApp<DiagnosticsBridgeApp>().globalData?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}
