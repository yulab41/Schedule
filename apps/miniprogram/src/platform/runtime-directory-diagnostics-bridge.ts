import type {
  RuntimeDiagnosticRequest,
  RuntimeDirectorySearchDiagnostic,
  RuntimeDiagnosticsStore,
} from './runtime-diagnostics.js';

interface DiagnosticsBridgeApp {
  readonly globalData?: {
    readonly runtimeDiagnostics?: RuntimeDiagnosticsStore | undefined;
  };
}

export function recordRuntimeDirectorySearch(entry: RuntimeDirectorySearchDiagnostic): void {
  try {
    resolveRuntimeDiagnosticsStore()?.recordDirectorySearch(entry);
  } catch {
    // Directory diagnostics must never alter search behavior.
  }
}

export function findRuntimeDiagnosticRequest(input: {
  readonly endpoint: string;
  readonly method: RuntimeDiagnosticRequest['method'];
  readonly startedAt: number;
}): RuntimeDiagnosticRequest | undefined {
  try {
    return resolveRuntimeDiagnosticsStore()
      ?.getSnapshot()
      .requests.filter(
        (request) =>
          request.method === input.method &&
          request.endpoint === input.endpoint &&
          request.startedAt >= input.startedAt - 10,
      )
      .sort(
        (left, right) =>
          Math.abs(left.startedAt - input.startedAt) - Math.abs(right.startedAt - input.startedAt),
      )[0];
  } catch {
    return undefined;
  }
}

function resolveRuntimeDiagnosticsStore(): RuntimeDiagnosticsStore | undefined {
  try {
    return getApp<DiagnosticsBridgeApp>().globalData?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}
