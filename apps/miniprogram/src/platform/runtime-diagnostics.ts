export type DiagnosticRequestOutcome = 'failed' | 'http-error' | 'success';

export interface RuntimeDiagnosticRequest {
  readonly duplicate: boolean;
  readonly durationMs: number;
  readonly endpoint: string;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly outcome: DiagnosticRequestOutcome;
  readonly retryCount: number;
  readonly startedAt: number;
  readonly statusCode?: number | undefined;
}

export interface RuntimeDiagnosticError {
  readonly code: string;
  readonly fingerprint: string;
  readonly page: string;
  readonly recordedAt: number;
}

export interface RuntimeDiagnosticPerformance {
  readonly durationMs: number;
  readonly metric: string;
  readonly page: string;
  readonly recordedAt: number;
}

export interface RuntimeDiagnosticsSnapshot {
  readonly errors: readonly RuntimeDiagnosticError[];
  readonly performance: readonly RuntimeDiagnosticPerformance[];
  readonly requests: readonly RuntimeDiagnosticRequest[];
}

export interface RuntimeDiagnosticsStore {
  readonly errors: RuntimeDiagnosticError[];
  readonly performance: RuntimeDiagnosticPerformance[];
  readonly requests: RuntimeDiagnosticRequest[];
  getSnapshot(): RuntimeDiagnosticsSnapshot;
  recordError(entry: RuntimeDiagnosticError): void;
  recordPerformance(entry: RuntimeDiagnosticPerformance): void;
  recordRequest(entry: RuntimeDiagnosticRequestInput): void;
}

export type RuntimeDiagnosticRequestInput = Omit<
  RuntimeDiagnosticRequest,
  'duplicate' | 'durationMs' | 'endpoint' | 'retryCount'
> & {
  readonly durationMs: number;
  readonly endpoint: string;
  readonly retryCount: number;
};

interface DiagnosticsApp {
  readonly globalData?: {
    readonly runtimeDiagnostics?: RuntimeDiagnosticsStore | undefined;
  };
}

const requestLimit = 20;
const errorLimit = 10;
const performanceLimit = 12;
const safeEndpointSegments = new Set([
  'api',
  'auth',
  'backfill-batches',
  'calendar',
  'client-capabilities',
  'client-telemetry',
  'contacts',
  'directory',
  'duty-adjustments',
  'events',
  'exports',
  'facets',
  'groups',
  'holidays',
  'insights',
  'leave-requests',
  'login',
  'me',
  'members',
  'notifications',
  'preferences',
  'profile',
  'schedule-periods',
  'scheduling-config',
  'search',
  'statistics',
  'swap-requests',
  'visitor-access',
  'wechat',
  'workbench',
]);

export function createRuntimeDiagnosticsStore(): RuntimeDiagnosticsStore {
  const errors: RuntimeDiagnosticError[] = [];
  const performance: RuntimeDiagnosticPerformance[] = [];
  const requests: RuntimeDiagnosticRequest[] = [];
  const store: RuntimeDiagnosticsStore = {
    errors,
    performance,
    requests,
    getSnapshot: () => createSnapshot(store),
    recordError: (entry) => appendError(store, entry),
    recordPerformance: (entry) => appendPerformance(store, entry),
    recordRequest: (entry) => appendRequest(store, entry),
  };
  return store;
}

export function getRuntimeDiagnosticsSnapshot(): RuntimeDiagnosticsSnapshot {
  const store = resolveRuntimeDiagnosticsStore();
  if (store === undefined) return { errors: [], performance: [], requests: [] };
  return store.getSnapshot();
}

function createSnapshot(store: RuntimeDiagnosticsStore): RuntimeDiagnosticsSnapshot {
  return {
    errors: store.errors.map((entry) => ({ ...entry })),
    performance: store.performance.map((entry) => ({ ...entry })),
    requests: store.requests.map((entry) => ({ ...entry })),
  };
}

function appendRequest(store: RuntimeDiagnosticsStore, entry: RuntimeDiagnosticRequestInput): void {
  try {
    const endpoint = sanitizeDiagnosticEndpoint(entry.endpoint);
    const startedAt = normalizeTimestamp(entry.startedAt);
    const previous = store.requests.at(-1);
    const duplicate =
      previous !== undefined &&
      previous.method === entry.method &&
      previous.endpoint === endpoint &&
      Math.abs(startedAt - previous.startedAt) <= 1_000;
    pushBounded(
      store.requests,
      {
        duplicate,
        durationMs: normalizeDuration(entry.durationMs),
        endpoint,
        method: entry.method,
        outcome: entry.outcome,
        retryCount: Math.max(0, Math.min(9, Math.round(entry.retryCount))),
        startedAt,
        ...(Number.isInteger(entry.statusCode)
          ? { statusCode: Math.max(0, Math.min(999, entry.statusCode as number)) }
          : {}),
      },
      requestLimit,
    );
  } catch {
    // Diagnostics must never alter request behavior.
  }
}

function appendError(store: RuntimeDiagnosticsStore, entry: RuntimeDiagnosticError): void {
  try {
    pushBounded(
      store.errors,
      {
        code: sanitizeFixedLabel(entry.code, 'UNKNOWN'),
        fingerprint: sanitizeFingerprint(entry.fingerprint),
        page: sanitizeFixedLabel(entry.page, 'unknown'),
        recordedAt: normalizeTimestamp(entry.recordedAt),
      },
      errorLimit,
    );
  } catch {
    // Error diagnostics must never recursively report themselves.
  }
}

function appendPerformance(
  store: RuntimeDiagnosticsStore,
  entry: RuntimeDiagnosticPerformance,
): void {
  try {
    pushBounded(
      store.performance,
      {
        durationMs: normalizeDuration(entry.durationMs),
        metric: sanitizeFixedLabel(entry.metric, 'unknown'),
        page: sanitizeFixedLabel(entry.page, 'unknown'),
        recordedAt: normalizeTimestamp(entry.recordedAt),
      },
      performanceLimit,
    );
  } catch {
    // Performance diagnostics are best-effort and read-only.
  }
}

export function sanitizeDiagnosticEndpoint(value: string): string {
  const path = value.replace(/^https?:\/\/[^/]+/iu, '').split(/[?#]/u, 1)[0] ?? '';
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(0, 8)
    .map((segment) => (safeEndpointSegments.has(segment) ? segment : ':value'));
  return segments.length === 0 ? '/unknown' : `/${segments.join('/')}`;
}

function resolveRuntimeDiagnosticsStore(): RuntimeDiagnosticsStore | undefined {
  try {
    return getApp<DiagnosticsApp>().globalData?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}

function pushBounded<T>(target: T[], value: T, limit: number): void {
  target.push(value);
  if (target.length > limit) target.splice(0, target.length - limit);
}

function normalizeDuration(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(600_000, Math.round(value)));
}

function normalizeTimestamp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return Math.round(value);
}

function sanitizeFixedLabel(value: string, fallback: string): string {
  const normalized = String(value)
    .replace(/[^0-9A-Za-z:_-]/gu, '')
    .slice(0, 64);
  return normalized.length === 0 ? fallback : normalized;
}

function sanitizeFingerprint(value: string): string {
  return /^[0-9a-f]{64}$/u.test(value) ? value : 'unavailable';
}
