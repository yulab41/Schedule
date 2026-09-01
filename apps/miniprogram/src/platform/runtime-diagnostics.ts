import {
  RUNTIME_DIAGNOSTIC_ERROR_LIMIT,
  RUNTIME_DIAGNOSTIC_PERFORMANCE_LIMIT,
  RUNTIME_DIAGNOSTIC_REQUEST_LIMIT,
  RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH,
  RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN,
  RUNTIME_DIRECTORY_RECORD_MAX_BYTES,
  RUNTIME_DIRECTORY_SEARCH_LIMIT,
} from './runtime-diagnostics-limits.js';
import type {
  RuntimeDiagnosticError,
  RuntimeDiagnosticPerformance,
  RuntimeDiagnosticRequestInput,
  RuntimeDiagnosticsSlot,
  RuntimeDiagnosticsSnapshot,
  RuntimeDirectorySearchPackedRecord,
  RuntimeDirectorySearchDiagnostic,
} from './runtime-diagnostics-types.js';

export type {
  DiagnosticRequestOutcome,
  RuntimeDiagnosticError,
  RuntimeDiagnosticNetworkProfile,
  RuntimeDiagnosticPerformance,
  RuntimeDiagnosticRequest,
  RuntimeDiagnosticRequestInput,
  RuntimeDiagnosticServerTiming,
  RuntimeDiagnosticsSlot,
  RuntimeDiagnosticsSnapshot,
  RuntimeDirectorySearchDiagnostic,
  RuntimeDirectorySearchOutcome,
  RuntimeDirectorySearchType,
} from './runtime-diagnostics-types.js';

interface DiagnosticsApp {
  readonly globalData?: {
    readonly runtimeDiagnostics?: RuntimeDiagnosticsSlot | undefined;
  };
}

export interface RuntimeDiagnosticsStore extends RuntimeDiagnosticsSlot {
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

// Test helper and diagnostics-only facade. App runtime creates only the plain data slot.
export function createRuntimeDiagnosticsStore(): RuntimeDiagnosticsStore {
  const slot: RuntimeDiagnosticsSlot = {
    appLaunchAt: 0,
    directorySearchRecording: false,
    directorySearches: [],
    errors: [],
    initialShowPending: false,
    launchMarkerConsumed: false,
    launchObserved: false,
    performance: [],
    requests: [],
    warmResumeObserved: false,
  };
  const store: RuntimeDiagnosticsStore = {
    ...slot,
    clearDirectorySearches: () => slot.directorySearches.splice(0, slot.directorySearches.length),
    getSnapshot: () => createSnapshot(slot),
    isDirectorySearchRecording: () => slot.directorySearchRecording,
    recordDirectorySearch: (entry) => appendDirectorySearch(slot, entry),
    recordError: (entry) => boundedPush(slot.errors, entry, RUNTIME_DIAGNOSTIC_ERROR_LIMIT),
    recordPerformance: (entry) =>
      boundedPush(slot.performance, entry, RUNTIME_DIAGNOSTIC_PERFORMANCE_LIMIT),
    recordRequest: (entry) =>
      boundedPush(
        slot.requests,
        {
          ...entry,
          endpoint: sanitizeDiagnosticEndpoint(entry.endpoint),
          ...(entry.networkProfile === undefined
            ? {}
            : { networkProfile: sanitizeNetworkProfile(entry.networkProfile) }),
          ...(entry.requestId === undefined
            ? {}
            : { requestId: safeOptionalRequestId(entry.requestId) }),
          ...(entry.serverTiming === undefined
            ? {}
            : { serverTiming: sanitizeServerTiming(entry.serverTiming) }),
        },
        RUNTIME_DIAGNOSTIC_REQUEST_LIMIT,
      ),
    startDirectorySearchRecording: () => {
      slot.directorySearchRecording = true;
      store.directorySearchRecording = true;
    },
    stopDirectorySearchRecording: () => {
      slot.directorySearchRecording = false;
      store.directorySearchRecording = false;
    },
  };
  // Keep facade array references and scalar launch fields aligned with the backing slot.
  Object.defineProperties(store, {
    appLaunchAt: { get: () => slot.appLaunchAt, set: (value) => (slot.appLaunchAt = value) },
    directorySearchRecording: {
      get: () => slot.directorySearchRecording,
      set: (value) => (slot.directorySearchRecording = value),
    },
    launchMarkerConsumed: {
      get: () => slot.launchMarkerConsumed,
      set: (value) => (slot.launchMarkerConsumed = value),
    },
    launchObserved: {
      get: () => slot.launchObserved,
      set: (value) => (slot.launchObserved = value),
    },
  });
  return store;
}

export function getRuntimeDiagnosticsSnapshot(): RuntimeDiagnosticsSnapshot {
  const slot = resolveRuntimeDiagnosticsSlot();
  return slot === undefined
    ? {
        appLaunchAt: 0,
        directorySearches: [],
        directorySearchRecording: false,
        errors: [],
        launchMarkerConsumed: false,
        launchObserved: false,
        performance: [],
        requests: [],
      }
    : createSnapshot(slot);
}

export function startRuntimeDirectorySearchRecording(): boolean {
  const slot = resolveRuntimeDiagnosticsSlot();
  if (slot === undefined) return false;
  slot.directorySearchRecording = true;
  slot.launchMarkerConsumed = false;
  return true;
}

export function stopRuntimeDirectorySearchRecording(): void {
  const slot = resolveRuntimeDiagnosticsSlot();
  if (slot !== undefined) slot.directorySearchRecording = false;
}

export function clearRuntimeDirectorySearches(): void {
  const slot = resolveRuntimeDiagnosticsSlot();
  slot?.directorySearches.splice(0, slot.directorySearches.length);
}

export { sanitizeDiagnosticEndpoint };

const safeEndpointSegments = new Set([
  'api',
  'auth',
  'calendar',
  'client-capabilities',
  'client-telemetry',
  'contacts',
  'directory',
  'employee-directory',
  'events',
  'exports',
  'facets',
  'groups',
  'holidays',
  'insights',
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
  'visitor-access',
  'wechat',
  'workbench',
]);

function sanitizeDiagnosticEndpoint(value: string): string {
  const path = value.replace(/^https?:\/\/[^/]+/iu, '').split(/[?#]/u, 1)[0] ?? '';
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(0, 8)
    .map((segment) => (safeEndpointSegments.has(segment) ? segment : ':value'));
  return segments.length === 0 ? '/unknown' : `/${segments.join('/')}`;
}

function createSnapshot(slot: RuntimeDiagnosticsSlot): RuntimeDiagnosticsSnapshot {
  return {
    appLaunchAt: slot.appLaunchAt,
    directorySearches: slot.directorySearches.map(unpackDirectorySearch),
    directorySearchRecording: slot.directorySearchRecording,
    errors: slot.errors.map((entry) => ({ ...entry })),
    launchMarkerConsumed: slot.launchMarkerConsumed,
    launchObserved: slot.launchObserved,
    performance: slot.performance.map((entry) => ({ ...entry })),
    requests: slot.requests.map((entry, index, requests) => ({
      ...entry,
      duplicate:
        requests[index - 1]?.method === entry.method &&
        requests[index - 1]?.endpoint === entry.endpoint &&
        Math.abs(entry.startedAt - (requests[index - 1]?.startedAt ?? 0)) <= 1_000,
      ...(entry.networkProfile === undefined
        ? {}
        : { networkProfile: { ...entry.networkProfile } }),
      profileEnabled: entry.profileEnabled === true,
      ...(entry.serverTiming === undefined ? {} : { serverTiming: { ...entry.serverTiming } }),
    })),
  };
}

function appendDirectorySearch(
  slot: RuntimeDiagnosticsSlot,
  entry: RuntimeDirectorySearchDiagnostic,
): void {
  const safe = {
    appLaunchToConfirmMs: duration(entry.appLaunchToConfirmMs),
    autoStartedByLaunchMarker: entry.autoStartedByLaunchMarker === true,
    cardBuildMs: duration(entry.cardBuildMs),
    completedResultReuse: entry.completedResultReuse === true,
    confirmedAt: timestamp(entry.confirmedAt),
    contextWaitMs: duration(entry.contextWaitMs),
    diagnosticId: fixedText(entry.diagnosticId, 32, 'DIR-unavailable'),
    diagnosticSerializationMs: duration(entry.diagnosticSerializationMs),
    directoryKind:
      entry.directoryKind === 'employee' ? ('employee' as const) : ('internal' as const),
    directoryPageLoadToConfirmMs: duration(entry.directoryPageLoadToConfirmMs),
    duplicateRequestIntercepted: entry.duplicateRequestIntercepted === true,
    eventHandlerStartMs: duration(entry.eventHandlerStartMs),
    facetsOrReleaseWaitMs: duration(entry.facetsOrReleaseWaitMs),
    facetsReady: entry.facetsReady === true,
    firstSearchInPageSession: entry.firstSearchInPageSession === true,
    hasFilters: entry.hasFilters === true,
    hasNextPage: entry.hasNextPage === true,
    inFlightRequestReuse: entry.inFlightRequestReuse === true,
    networkProfile: sanitizeNetworkProfile(entry.networkProfile),
    networkRequestStartMs: duration(entry.networkRequestStartMs),
    networkResponseMs: duration(entry.networkResponseMs),
    newAppLaunchObserved: entry.newAppLaunchObserved === true,
    nextRenderCycleMs: duration(entry.nextRenderCycleMs),
    outcome:
      entry.outcome === 'success' || entry.outcome === 'superseded'
        ? entry.outcome
        : ('failed' as const),
    pageSessionSearchIndex: count(entry.pageSessionSearchIndex, 100),
    profileEnabled: entry.profileEnabled === true,
    publishedBatchConfirmed: entry.publishedBatchConfirmed === true,
    recordedAt: timestamp(entry.recordedAt),
    requestId: safeRequestId(entry.requestId),
    responseBytes: count(entry.responseBytes, 20_000_000),
    responseBytesEstimated: entry.responseBytesEstimated === true,
    responseToConversionMs: duration(entry.responseToConversionMs),
    resultCount: count(entry.resultCount, 100_000),
    searchTermLength: count(entry.searchTermLength, 100),
    searchType:
      entry.searchType === 'employee-code' ||
      entry.searchType === 'name' ||
      entry.searchType === 'phone'
        ? entry.searchType
        : ('other' as const),
    serverTiming: sanitizeServerTiming(entry.serverTiming),
    setDataBytesEstimated: entry.setDataBytesEstimated === true,
    setDataCallCount: count(entry.setDataCallCount, 100),
    setDataCommitMs: duration(entry.setDataCommitMs),
    setDataMaxBytes: count(entry.setDataMaxBytes, 20_000_000),
    setDataTotalBytes: count(entry.setDataTotalBytes, 100_000_000),
    totalMs: duration(entry.totalMs),
    truncated:
      entry.truncated === true || utf8Bytes(safeJson(entry)) > RUNTIME_DIRECTORY_RECORD_MAX_BYTES,
    warmResume: entry.warmResume === true,
  };
  const packed = packDirectorySearch(safe);
  if (utf8Bytes(JSON.stringify(packed)) > RUNTIME_DIRECTORY_RECORD_MAX_BYTES) {
    packed[7] = 'DIR-truncated';
    packed[19] = { supported: false };
    packed[29] = 'unavailable';
    packed[36] = { supported: false };
    packed[43] = true;
  }
  slot.directorySearches.push(packed);
  if (slot.directorySearches.length > RUNTIME_DIRECTORY_SEARCH_LIMIT) {
    slot.directorySearches.splice(
      0,
      slot.directorySearches.length - RUNTIME_DIRECTORY_SEARCH_LIMIT,
    );
  }
}

function packDirectorySearch(entry: RuntimeDirectorySearchDiagnostic): unknown[] {
  return [
    1,
    entry.appLaunchToConfirmMs,
    entry.autoStartedByLaunchMarker,
    entry.cardBuildMs,
    entry.completedResultReuse,
    entry.confirmedAt,
    entry.contextWaitMs,
    entry.diagnosticId,
    entry.diagnosticSerializationMs,
    entry.directoryKind === 'employee' ? 'e' : 'i',
    entry.directoryPageLoadToConfirmMs,
    entry.duplicateRequestIntercepted,
    entry.eventHandlerStartMs,
    entry.facetsOrReleaseWaitMs,
    entry.facetsReady,
    entry.firstSearchInPageSession,
    entry.hasFilters,
    entry.hasNextPage,
    entry.inFlightRequestReuse,
    entry.networkProfile,
    entry.networkRequestStartMs,
    entry.networkResponseMs,
    entry.newAppLaunchObserved,
    entry.nextRenderCycleMs,
    entry.outcome === 'success' ? 's' : entry.outcome === 'superseded' ? 'x' : 'f',
    entry.pageSessionSearchIndex,
    entry.profileEnabled,
    entry.publishedBatchConfirmed,
    entry.recordedAt,
    entry.requestId,
    entry.responseBytes,
    entry.responseBytesEstimated,
    entry.responseToConversionMs,
    entry.resultCount,
    entry.searchTermLength,
    entry.searchType === 'employee-code'
      ? 'e'
      : entry.searchType === 'name'
        ? 'n'
        : entry.searchType === 'phone'
          ? 'p'
          : 'o',
    entry.serverTiming,
    entry.setDataBytesEstimated,
    entry.setDataCallCount,
    entry.setDataCommitMs,
    entry.setDataMaxBytes,
    entry.setDataTotalBytes,
    entry.totalMs,
    entry.truncated,
    entry.warmResume,
  ];
}

function unpackDirectorySearch(
  value: RuntimeDirectorySearchPackedRecord,
): RuntimeDirectorySearchDiagnostic {
  const outcome = value[24] === 's' ? 'success' : value[24] === 'x' ? 'superseded' : 'failed';
  const searchType =
    value[35] === 'e'
      ? 'employee-code'
      : value[35] === 'n'
        ? 'name'
        : value[35] === 'p'
          ? 'phone'
          : 'other';
  return {
    appLaunchToConfirmMs: duration(value[1] as number),
    autoStartedByLaunchMarker: value[2] === true,
    cardBuildMs: duration(value[3] as number),
    completedResultReuse: value[4] === true,
    confirmedAt: timestamp(value[5] as number),
    contextWaitMs: duration(value[6] as number),
    diagnosticId: fixedText(String(value[7] ?? ''), 32, 'DIR-unavailable'),
    diagnosticSerializationMs: duration(value[8] as number),
    directoryKind: value[9] === 'e' ? 'employee' : 'internal',
    directoryPageLoadToConfirmMs: duration(value[10] as number),
    duplicateRequestIntercepted: value[11] === true,
    eventHandlerStartMs: duration(value[12] as number),
    facetsOrReleaseWaitMs: duration(value[13] as number),
    facetsReady: value[14] === true,
    firstSearchInPageSession: value[15] === true,
    hasFilters: value[16] === true,
    hasNextPage: value[17] === true,
    inFlightRequestReuse: value[18] === true,
    networkProfile:
      isRecord(value[19]) && value[19]['supported'] === true
        ? (value[19] as unknown as RuntimeDirectorySearchDiagnostic['networkProfile'])
        : { supported: false },
    networkRequestStartMs: duration(value[20] as number),
    networkResponseMs: duration(value[21] as number),
    newAppLaunchObserved: value[22] === true,
    nextRenderCycleMs: duration(value[23] as number),
    outcome,
    pageSessionSearchIndex: count(value[25] as number, 100),
    profileEnabled: value[26] === true,
    publishedBatchConfirmed: value[27] === true,
    recordedAt: timestamp(value[28] as number),
    requestId: safeRequestId(String(value[29] ?? '')),
    responseBytes: count(value[30] as number, 20_000_000),
    responseBytesEstimated: value[31] === true,
    responseToConversionMs: duration(value[32] as number),
    resultCount: count(value[33] as number, 100_000),
    searchTermLength: count(value[34] as number, 100),
    searchType,
    serverTiming:
      isRecord(value[36]) && value[36]['supported'] === true
        ? (value[36] as unknown as RuntimeDirectorySearchDiagnostic['serverTiming'])
        : { supported: false },
    setDataBytesEstimated: value[37] === true,
    setDataCallCount: count(value[38] as number, 100),
    setDataCommitMs: duration(value[39] as number),
    setDataMaxBytes: count(value[40] as number, 20_000_000),
    setDataTotalBytes: count(value[41] as number, 100_000_000),
    totalMs: duration(value[42] as number),
    truncated: value[43] === true,
    warmResume: value[44] === true,
  };
}

function resolveRuntimeDiagnosticsSlot(): RuntimeDiagnosticsSlot | undefined {
  try {
    return getApp<DiagnosticsApp>().globalData?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}

function safeRequestId(value: string): string {
  const candidate = String(value);
  if (candidate.length > RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH) return 'unavailable';
  return RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN.test(candidate) ? candidate : 'unavailable';
}

function safeOptionalRequestId(value: string): string | undefined {
  const safe = safeRequestId(value);
  return safe === 'unavailable' ? undefined : safe;
}

function sanitizeNetworkProfile(
  value: RuntimeDirectorySearchDiagnostic['networkProfile'] | undefined,
): RuntimeDirectorySearchDiagnostic['networkProfile'] {
  if (value?.supported !== true) return { supported: false };
  return {
    supported: true,
    ...optionalDuration('connectMs', value.connectMs),
    ...optionalDuration('dnsMs', value.dnsMs),
    ...optionalDuration('downloadMs', value.downloadMs),
    ...optionalDuration('tlsMs', value.tlsMs),
    ...optionalDuration('ttfbMs', value.ttfbMs),
  };
}

function sanitizeServerTiming(
  value: RuntimeDirectorySearchDiagnostic['serverTiming'] | undefined,
): RuntimeDirectorySearchDiagnostic['serverTiming'] {
  if (value?.supported !== true) return { supported: false };
  return {
    supported: true,
    ...optionalDuration('aliasMs', value.aliasMs),
    ...optionalDuration('authMs', value.authMs),
    ...optionalDuration('batchMs', value.batchMs),
    ...(value.cache === 'hit' || value.cache === 'miss' || value.cache === 'none'
      ? { cache: value.cache }
      : {}),
    ...(typeof value.coldStart === 'boolean' ? { coldStart: value.coldStart } : {}),
    ...optionalDuration('contactsMs', value.contactsMs),
    ...optionalDuration('countMs', value.countMs),
    ...optionalDuration('databaseWaitMs', value.databaseWaitMs),
    ...optionalDuration('instanceAgeMs', value.instanceAgeMs),
    ...optionalDuration('permissionMs', value.permissionMs),
    ...optionalDuration('queryMs', value.queryMs),
    ...(typeof value.queueSupported === 'boolean' ? { queueSupported: value.queueSupported } : {}),
    ...optionalDuration('rowsMs', value.rowsMs),
    ...optionalDuration('serializationMs', value.serializationMs),
    ...optionalDuration('totalMs', value.totalMs),
    ...optionalDuration('transformMs', value.transformMs),
  };
}

function optionalDuration<Key extends string>(
  key: Key,
  value: number | undefined,
): { readonly [Property in Key]?: number } {
  return typeof value === 'number' && Number.isFinite(value)
    ? ({ [key]: duration(value) } as { readonly [Property in Key]?: number })
    : {};
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return 'x'.repeat(RUNTIME_DIRECTORY_RECORD_MAX_BYTES + 1);
  }
}

function boundedPush<T>(target: T[], value: T, maximum: number): void {
  target.push(value);
  if (target.length > maximum) target.shift();
}

function fixedText(value: string, maximum: number, fallback: string): string {
  const normalized = String(value)
    .replace(/[^0-9A-Za-z._:-]/gu, '')
    .slice(0, maximum);
  return normalized.length === 0 ? fallback : normalized;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function duration(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(600_000, Math.round(value)))
    : 0;
}

function count(value: number | undefined, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.round(value)))
    : 0;
}

function timestamp(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
