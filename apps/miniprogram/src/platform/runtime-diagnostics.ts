export type DiagnosticRequestOutcome = 'failed' | 'http-error' | 'success';

export interface RuntimeDiagnosticNetworkProfile {
  readonly connectMs?: number | undefined;
  readonly dnsMs?: number | undefined;
  readonly downloadMs?: number | undefined;
  readonly supported: boolean;
  readonly tlsMs?: number | undefined;
  readonly ttfbMs?: number | undefined;
}

export interface RuntimeDiagnosticRequest {
  readonly capabilityWaitMs?: number | undefined;
  readonly completedAt?: number | undefined;
  readonly contextWaitMs?: number | undefined;
  readonly duplicate: boolean;
  readonly durationMs: number;
  readonly endpoint: string;
  readonly issuedAt?: number | undefined;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly networkProfile?: RuntimeDiagnosticNetworkProfile | undefined;
  readonly outcome: DiagnosticRequestOutcome;
  readonly requestId?: string | undefined;
  readonly retryCount: number;
  readonly startedAt: number;
  readonly statusCode?: number | undefined;
}

export type RuntimeDirectorySearchOutcome = 'failed' | 'success' | 'superseded';
export type RuntimeDirectorySearchType = 'employee-code' | 'name' | 'other' | 'phone';

export interface RuntimeDirectorySearchDiagnostic {
  readonly cardBuildMs: number;
  readonly completedResultReuse: boolean;
  readonly confirmedAt: number;
  readonly contextWaitMs: number;
  readonly deviceModel: string;
  readonly diagnosticId: string;
  readonly directoryKind: 'employee' | 'internal';
  readonly duplicateRequestIntercepted: boolean;
  readonly eventHandlerStartMs: number;
  readonly experienceVersion: string;
  readonly facetsOrReleaseWaitMs: number;
  readonly facetsReady: boolean;
  readonly firstSearchInPageSession: boolean;
  readonly hasFilters: boolean;
  readonly hasNextPage: boolean;
  readonly inFlightRequestReuse: boolean;
  readonly miniProgramVersion: string;
  readonly networkProfile: RuntimeDiagnosticNetworkProfile;
  readonly networkRequestStartMs: number;
  readonly networkResponseMs: number;
  readonly networkType: string;
  readonly outcome: RuntimeDirectorySearchOutcome;
  readonly publishedBatchConfirmed: boolean;
  readonly recordedAt: number;
  readonly requestId: string;
  readonly responseBytes: number;
  readonly responseToConversionMs: number;
  readonly resultCount: number;
  readonly resultVisibleMs: number;
  readonly sdkVersion: string;
  readonly searchTermLength: number;
  readonly searchType: RuntimeDirectorySearchType;
  readonly setDataCallbackMs: number;
  readonly setDataCallCount: number;
  readonly setDataMaxBytes: number;
  readonly setDataTotalBytes: number;
  readonly systemVersion: string;
  readonly totalMs: number;
  readonly wechatVersion: string;
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
  readonly directorySearches: readonly RuntimeDirectorySearchDiagnostic[];
  readonly directorySearchRecording: boolean;
  readonly errors: readonly RuntimeDiagnosticError[];
  readonly performance: readonly RuntimeDiagnosticPerformance[];
  readonly requests: readonly RuntimeDiagnosticRequest[];
}

export interface RuntimeDiagnosticsStore {
  readonly directorySearches: RuntimeDirectorySearchDiagnostic[];
  readonly errors: RuntimeDiagnosticError[];
  readonly performance: RuntimeDiagnosticPerformance[];
  readonly requests: RuntimeDiagnosticRequest[];
  clearDirectorySearches(): void;
  getSnapshot(): RuntimeDiagnosticsSnapshot;
  isDirectorySearchRecording(): boolean;
  recordDirectorySearch(entry: RuntimeDirectorySearchDiagnostic): void;
  recordError(entry: RuntimeDiagnosticError): void;
  recordPerformance(entry: RuntimeDiagnosticPerformance): void;
  recordRequest(entry: RuntimeDiagnosticRequestInput): void;
  startDirectorySearchRecording(): void;
  stopDirectorySearchRecording(): void;
}

export type RuntimeDiagnosticRequestInput = Omit<
  RuntimeDiagnosticRequest,
  'duplicate' | 'durationMs' | 'endpoint' | 'retryCount'
> & {
  readonly durationMs: number;
  readonly endpoint: string;
  readonly profileRequested?: boolean | undefined;
  readonly requestProfile?: unknown;
  readonly responseHeader?: unknown;
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
const directorySearchLimit = 20;
const safeEndpointSegments = new Set([
  'api',
  'auth',
  'backfill-batches',
  'calendar',
  'client-capabilities',
  'client-telemetry',
  'contacts',
  'directory',
  'employee-directory',
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
  const directorySearches: RuntimeDirectorySearchDiagnostic[] = [];
  const errors: RuntimeDiagnosticError[] = [];
  const performance: RuntimeDiagnosticPerformance[] = [];
  const requests: RuntimeDiagnosticRequest[] = [];
  let directorySearchRecording = false;
  const store: RuntimeDiagnosticsStore = {
    directorySearches,
    errors,
    performance,
    requests,
    clearDirectorySearches: () => directorySearches.splice(0, directorySearches.length),
    getSnapshot: () => createSnapshot(store),
    isDirectorySearchRecording: () => directorySearchRecording,
    recordDirectorySearch: (entry) => appendDirectorySearch(store, entry),
    recordError: (entry) => appendError(store, entry),
    recordPerformance: (entry) => appendPerformance(store, entry),
    recordRequest: (entry) => appendRequest(store, entry),
    startDirectorySearchRecording: () => {
      directorySearchRecording = true;
    },
    stopDirectorySearchRecording: () => {
      directorySearchRecording = false;
    },
  };
  return store;
}

export function getRuntimeDiagnosticsSnapshot(): RuntimeDiagnosticsSnapshot {
  const store = resolveRuntimeDiagnosticsStore();
  if (store === undefined) {
    return {
      directorySearches: [],
      directorySearchRecording: false,
      errors: [],
      performance: [],
      requests: [],
    };
  }
  return store.getSnapshot();
}

export function startRuntimeDirectorySearchRecording(): boolean {
  const store = resolveRuntimeDiagnosticsStore();
  if (store === undefined) return false;
  store.startDirectorySearchRecording();
  return true;
}

export function stopRuntimeDirectorySearchRecording(): void {
  resolveRuntimeDiagnosticsStore()?.stopDirectorySearchRecording();
}

export function clearRuntimeDirectorySearches(): void {
  resolveRuntimeDiagnosticsStore()?.clearDirectorySearches();
}

export function isRuntimeDirectorySearchRecording(): boolean {
  return resolveRuntimeDiagnosticsStore()?.isDirectorySearchRecording() === true;
}

function createSnapshot(store: RuntimeDiagnosticsStore): RuntimeDiagnosticsSnapshot {
  return {
    directorySearches: store.directorySearches.map((entry) => ({
      ...entry,
      networkProfile: { ...entry.networkProfile },
    })),
    directorySearchRecording: store.isDirectorySearchRecording(),
    errors: store.errors.map((entry) => ({ ...entry })),
    performance: store.performance.map((entry) => ({ ...entry })),
    requests: store.requests.map((entry) => ({
      ...entry,
      ...(entry.networkProfile === undefined
        ? {}
        : { networkProfile: { ...entry.networkProfile } }),
    })),
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
    const networkProfile = resolveNetworkProfile(entry);
    const requestId = resolveRequestId(entry);
    pushBounded(
      store.requests,
      {
        ...(entry.capabilityWaitMs === undefined
          ? {}
          : { capabilityWaitMs: normalizeDuration(entry.capabilityWaitMs) }),
        ...(entry.completedAt === undefined
          ? {}
          : { completedAt: normalizeTimestamp(entry.completedAt) }),
        duplicate,
        ...(entry.contextWaitMs === undefined
          ? {}
          : { contextWaitMs: normalizeDuration(entry.contextWaitMs) }),
        durationMs: normalizeDuration(entry.durationMs),
        endpoint,
        ...(entry.issuedAt === undefined ? {} : { issuedAt: normalizeTimestamp(entry.issuedAt) }),
        method: entry.method,
        ...(networkProfile === undefined ? {} : { networkProfile }),
        outcome: entry.outcome,
        retryCount: Math.max(0, Math.min(9, Math.round(entry.retryCount))),
        ...(requestId === undefined ? {} : { requestId }),
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

function appendDirectorySearch(
  store: RuntimeDiagnosticsStore,
  entry: RuntimeDirectorySearchDiagnostic,
): void {
  try {
    pushBounded(
      store.directorySearches,
      {
        cardBuildMs: normalizeDuration(entry.cardBuildMs),
        completedResultReuse: entry.completedResultReuse === true,
        confirmedAt: normalizeTimestamp(entry.confirmedAt),
        contextWaitMs: normalizeDuration(entry.contextWaitMs),
        deviceModel: sanitizeRuntimeLabel(entry.deviceModel, '不支持'),
        diagnosticId: sanitizeDiagnosticId(entry.diagnosticId),
        directoryKind: entry.directoryKind === 'employee' ? 'employee' : 'internal',
        duplicateRequestIntercepted: entry.duplicateRequestIntercepted === true,
        eventHandlerStartMs: normalizeDuration(entry.eventHandlerStartMs),
        experienceVersion: sanitizeRuntimeLabel(entry.experienceVersion, '未提供'),
        facetsOrReleaseWaitMs: normalizeDuration(entry.facetsOrReleaseWaitMs),
        facetsReady: entry.facetsReady === true,
        firstSearchInPageSession: entry.firstSearchInPageSession === true,
        hasFilters: entry.hasFilters === true,
        hasNextPage: entry.hasNextPage === true,
        inFlightRequestReuse: entry.inFlightRequestReuse === true,
        miniProgramVersion: sanitizeRuntimeLabel(entry.miniProgramVersion, '未提供'),
        networkProfile: normalizeNetworkProfile(entry.networkProfile),
        networkRequestStartMs: normalizeDuration(entry.networkRequestStartMs),
        networkResponseMs: normalizeDuration(entry.networkResponseMs),
        networkType: sanitizeRuntimeLabel(entry.networkType, '不支持'),
        outcome:
          entry.outcome === 'success' || entry.outcome === 'superseded' ? entry.outcome : 'failed',
        publishedBatchConfirmed: entry.publishedBatchConfirmed === true,
        recordedAt: normalizeTimestamp(entry.recordedAt),
        requestId: sanitizeRequestId(entry.requestId),
        responseBytes: normalizeCount(entry.responseBytes, 20_000_000),
        responseToConversionMs: normalizeDuration(entry.responseToConversionMs),
        resultCount: normalizeCount(entry.resultCount, 100_000),
        resultVisibleMs: normalizeDuration(entry.resultVisibleMs),
        sdkVersion: sanitizeRuntimeLabel(entry.sdkVersion, '不支持'),
        searchTermLength: normalizeCount(entry.searchTermLength, 100),
        searchType:
          entry.searchType === 'employee-code' ||
          entry.searchType === 'name' ||
          entry.searchType === 'phone'
            ? entry.searchType
            : 'other',
        setDataCallbackMs: normalizeDuration(entry.setDataCallbackMs),
        setDataCallCount: normalizeCount(entry.setDataCallCount, 100),
        setDataMaxBytes: normalizeCount(entry.setDataMaxBytes, 20_000_000),
        setDataTotalBytes: normalizeCount(entry.setDataTotalBytes, 100_000_000),
        systemVersion: sanitizeRuntimeLabel(entry.systemVersion, '不支持'),
        totalMs: normalizeDuration(entry.totalMs),
        wechatVersion: sanitizeRuntimeLabel(entry.wechatVersion, '不支持'),
      },
      directorySearchLimit,
    );
  } catch {
    // Directory diagnostics must never alter search behavior.
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

function normalizeCount(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

function normalizeNetworkProfile(
  value: RuntimeDiagnosticNetworkProfile,
): RuntimeDiagnosticNetworkProfile {
  if (value.supported !== true) return { supported: false };
  return {
    supported: true,
    ...(value.dnsMs === undefined ? {} : { dnsMs: normalizeDuration(value.dnsMs) }),
    ...(value.connectMs === undefined ? {} : { connectMs: normalizeDuration(value.connectMs) }),
    ...(value.tlsMs === undefined ? {} : { tlsMs: normalizeDuration(value.tlsMs) }),
    ...(value.ttfbMs === undefined ? {} : { ttfbMs: normalizeDuration(value.ttfbMs) }),
    ...(value.downloadMs === undefined ? {} : { downloadMs: normalizeDuration(value.downloadMs) }),
  };
}

function resolveNetworkProfile(
  entry: RuntimeDiagnosticRequestInput,
): RuntimeDiagnosticNetworkProfile | undefined {
  if (entry.networkProfile !== undefined) return normalizeNetworkProfile(entry.networkProfile);
  if (entry.requestProfile !== undefined) {
    return normalizeNetworkProfile(normalizeRequestProfile(entry.requestProfile));
  }
  return entry.profileRequested === true ? { supported: false } : undefined;
}

function normalizeRequestProfile(value: unknown): RuntimeDiagnosticNetworkProfile {
  if (!isRecord(value)) return { supported: false };
  const dnsMs = phaseDuration(value, 'domainLookUpStart', 'domainLookUpEnd');
  const connectMs = phaseDuration(value, 'connectStart', 'connectEnd');
  const tlsMs = phaseDuration(value, 'SSLconnectionStart', 'SSLconnectionEnd');
  const ttfbMs = phaseDuration(value, 'requestStart', 'responseStart');
  const downloadMs = phaseDuration(value, 'responseStart', 'responseEnd');
  if ([dnsMs, connectMs, tlsMs, ttfbMs, downloadMs].every((item) => item === undefined)) {
    return { supported: false };
  }
  return {
    supported: true,
    ...(dnsMs === undefined ? {} : { dnsMs }),
    ...(connectMs === undefined ? {} : { connectMs }),
    ...(tlsMs === undefined ? {} : { tlsMs }),
    ...(ttfbMs === undefined ? {} : { ttfbMs }),
    ...(downloadMs === undefined ? {} : { downloadMs }),
  };
}

function phaseDuration(
  profile: Readonly<Record<string, unknown>>,
  startKey: string,
  endKey: string,
): number | undefined {
  const start = profile[startKey];
  const end = profile[endKey];
  return typeof start === 'number' &&
    Number.isFinite(start) &&
    typeof end === 'number' &&
    Number.isFinite(end) &&
    end >= start
    ? end - start
    : undefined;
}

function resolveRequestId(entry: RuntimeDiagnosticRequestInput): string | undefined {
  if (entry.requestId !== undefined) return sanitizeRequestId(entry.requestId);
  if (!isRecord(entry.responseHeader)) return undefined;
  for (const [key, value] of Object.entries(entry.responseHeader)) {
    if (key.toLowerCase() === 'x-request-id' && typeof value === 'string') {
      return sanitizeRequestId(value);
    }
  }
  return undefined;
}

function sanitizeDiagnosticId(value: string): string {
  const normalized = String(value)
    .replace(/[^0-9A-Za-z-]/gu, '')
    .slice(0, 32);
  return normalized.length === 0 ? 'DIR-unavailable' : normalized;
}

function sanitizeRequestId(value: string): string {
  const normalized = String(value)
    .replace(/[^0-9A-Za-z._:-]/gu, '')
    .slice(0, 80);
  return normalized.length === 0 ? '不支持' : normalized;
}

function sanitizeRuntimeLabel(value: string, fallback: string): string {
  const normalized = String(value)
    .replace(/[+]?\d{7,}/gu, '[redacted]')
    .replace(/\b(?:account|employee|group|permission|cursor)-[^\s/]+/giu, '[redacted]')
    .replace(/[^0-9A-Za-z ._()+/\-[\]]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 80);
  return normalized.length === 0 ? fallback : normalized;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
