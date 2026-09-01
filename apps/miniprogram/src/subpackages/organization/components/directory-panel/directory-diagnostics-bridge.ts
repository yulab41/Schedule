import type { DirectoryKind } from '@schedule/contracts';

import {
  RUNTIME_DIAGNOSTIC_HEADER_VALUE_MAX_LENGTH,
  RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH,
  RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN,
  RUNTIME_DIRECTORY_RECORD_MAX_BYTES,
  RUNTIME_DIRECTORY_SEARCH_LIMIT,
} from '../../../../platform/runtime-diagnostics-limits.js';
import { isRuntimeDirectorySearchRecording } from '../../../../platform/runtime-diagnostics-bridge.js';
import type {
  RuntimeDiagnosticNetworkProfile,
  RuntimeDiagnosticRequestInput,
  RuntimeDiagnosticServerTiming,
  RuntimeDiagnosticsSlot,
  RuntimeDirectorySearchOutcome,
  RuntimeDirectorySearchType,
  RuntimeRequestDiagnosticObserver,
} from '../../../../platform/runtime-diagnostics-types.js';

export interface DirectorySearchDiagnosticTrace {
  readonly appLaunchAt: number;
  readonly autoStartedByLaunchMarker: boolean;
  readonly confirmedAt: number;
  readonly diagnosticId: string;
  readonly directoryKind: DirectoryKind;
  readonly directoryPageLoadedAt: number;
  readonly eventHandlerStartedAt: number;
  readonly facetsReady: boolean;
  readonly hasFilters: boolean;
  readonly newAppLaunchObserved: boolean;
  readonly pageSessionSearchIndex: number;
  readonly publishedBatchConfirmed: boolean;
  readonly searchTermLength: number;
  readonly searchType: RuntimeDirectorySearchType;
  readonly warmResume: boolean;
  cardBuildMs: number;
  clientRequestStartedAt: number | undefined;
  diagnosticSerializationMs: number;
  hasNextPage: boolean;
  responseBytes: number;
  responseDecodedAt: number | undefined;
  resultCount: number;
  setDataCallCount: number;
  setDataMaxBytes: number;
  setDataTotalBytes: number;
}

export interface DirectoryDiagnosticsBridge {
  readonly beginDirectorySearchDiagnostic: typeof beginDirectorySearchDiagnostic;
  readonly completeDirectorySearchDiagnostic: typeof completeDirectorySearchDiagnostic;
  readonly directoryRequestDiagnosticObserver: RuntimeRequestDiagnosticObserver;
  readonly markDirectorySearchRequestStarted: typeof markDirectorySearchRequestStarted;
  readonly markDirectorySearchResult: typeof markDirectorySearchResult;
  readonly markDirectorySearchReuse: typeof markDirectorySearchReuse;
  readonly trackDirectorySearchSetData: typeof trackDirectorySearchSetData;
}

export const directoryRequestDiagnosticObserver: RuntimeRequestDiagnosticObserver = {
  header: { 'X-Schedule-Directory-Diagnostics': 'v1' },
  observe: ({ requestProfile, responseHeader }) => ({
    networkProfile: parseNetworkProfile(requestProfile),
    requestId: parseRequestId(responseHeader),
    serverTiming: parseServerTiming(responseHeader),
  }),
  shouldObserve: (endpointId) =>
    endpointId === 'organization.directory-list' && isRuntimeDirectorySearchRecording(),
};

export function beginDirectorySearchDiagnostic(input: {
  readonly confirmedAt?: number | undefined;
  readonly directoryKind: DirectoryKind;
  readonly directoryPageLoadedAt: number;
  readonly eventHandlerStartedAt?: number | undefined;
  readonly facetsReady: boolean;
  readonly hasFilters: boolean;
  readonly pageSessionSearchIndex: number;
  readonly publishedBatchConfirmed: boolean;
  readonly searchQuery: string;
}): DirectorySearchDiagnosticTrace | undefined {
  if (!isRuntimeDirectorySearchRecording()) return undefined;
  const slot = resolveSlot();
  if (slot === undefined) return undefined;
  const now = Date.now();
  return {
    appLaunchAt: slot.appLaunchAt,
    autoStartedByLaunchMarker: slot.launchMarkerConsumed,
    cardBuildMs: 0,
    clientRequestStartedAt: undefined,
    confirmedAt: input.confirmedAt ?? now,
    diagnosticId: createDiagnosticId(),
    diagnosticSerializationMs: 0,
    directoryKind: input.directoryKind,
    directoryPageLoadedAt: input.directoryPageLoadedAt,
    eventHandlerStartedAt: input.eventHandlerStartedAt ?? now,
    facetsReady: input.facetsReady,
    hasFilters: input.hasFilters,
    hasNextPage: false,
    newAppLaunchObserved: slot.launchObserved && !slot.warmResumeObserved,
    pageSessionSearchIndex: input.pageSessionSearchIndex,
    publishedBatchConfirmed: input.publishedBatchConfirmed,
    responseBytes: 0,
    responseDecodedAt: undefined,
    resultCount: 0,
    searchTermLength: Math.min(100, Array.from(input.searchQuery.trim()).length),
    searchType: classifySearch(input.searchQuery, input.directoryKind),
    setDataCallCount: 0,
    setDataMaxBytes: 0,
    setDataTotalBytes: 0,
    warmResume: slot.warmResumeObserved,
  };
}

export function markDirectorySearchRequestStarted(
  trace: DirectorySearchDiagnosticTrace | undefined,
): void {
  if (trace !== undefined) trace.clientRequestStartedAt = Date.now();
}

export function markDirectorySearchResult(
  trace: DirectorySearchDiagnosticTrace | undefined,
  input: {
    readonly cardBuildMs: number;
    readonly hasNextPage: boolean;
    readonly response: unknown;
    readonly responseDecodedAt: number;
    readonly resultCount: number;
  },
): void {
  if (trace === undefined) return;
  const measurement = estimateBytes(input.response);
  trace.cardBuildMs = input.cardBuildMs;
  trace.diagnosticSerializationMs += measurement.durationMs;
  trace.hasNextPage = input.hasNextPage;
  trace.responseBytes = measurement.bytes;
  trace.responseDecodedAt = input.responseDecodedAt;
  trace.resultCount = input.resultCount;
}

export function markDirectorySearchReuse(
  trace: DirectorySearchDiagnosticTrace | undefined,
  input: { readonly hasNextPage: boolean; readonly resultCount: number },
): void {
  if (trace === undefined) return;
  trace.hasNextPage = input.hasNextPage;
  trace.resultCount = input.resultCount;
}

export function trackDirectorySearchSetData(
  trace: DirectorySearchDiagnosticTrace | undefined,
  patch: Readonly<Record<string, unknown>>,
): void {
  if (trace === undefined) return;
  const measurement = estimateBytes(patch);
  trace.diagnosticSerializationMs += measurement.durationMs;
  trace.setDataCallCount += 1;
  trace.setDataTotalBytes += measurement.bytes;
  trace.setDataMaxBytes = Math.max(trace.setDataMaxBytes, measurement.bytes);
}

export function completeDirectorySearchDiagnostic(
  trace: DirectorySearchDiagnosticTrace | undefined,
  input: {
    readonly completedResultReuse: boolean;
    readonly inFlightRequestReuse: boolean;
    readonly nextRenderCycleAt?: number | undefined;
    readonly outcome: RuntimeDirectorySearchOutcome;
    readonly setDataCommitAt?: number | undefined;
  },
): void {
  if (trace === undefined) return;
  const slot = resolveSlot();
  if (slot === undefined) return;
  const nextRenderCycleAt = input.nextRenderCycleAt ?? Date.now();
  const request = findRequest(slot, trace);
  const requestStartedAt = request?.issuedAt ?? request?.startedAt;
  const responseAt =
    request?.completedAt ??
    (request === undefined ? undefined : request.startedAt + request.durationMs);
  const facetsOrReleaseWaitMs =
    (request?.capabilityWaitMs ?? 0) +
    (requestStartedAt === undefined || request === undefined
      ? 0
      : elapsed(request.startedAt, requestStartedAt));
  appendBoundedRecord(slot, [
    1,
    elapsed(trace.appLaunchAt, trace.confirmedAt),
    trace.autoStartedByLaunchMarker,
    trace.cardBuildMs,
    input.completedResultReuse,
    trace.confirmedAt,
    request?.contextWaitMs ?? 0,
    trace.diagnosticId,
    trace.diagnosticSerializationMs,
    trace.directoryKind === 'employee' ? 'e' : 'i',
    elapsed(trace.directoryPageLoadedAt, trace.confirmedAt),
    input.completedResultReuse || input.inFlightRequestReuse,
    elapsed(trace.confirmedAt, trace.eventHandlerStartedAt),
    facetsOrReleaseWaitMs,
    trace.facetsReady,
    trace.pageSessionSearchIndex === 1,
    trace.hasFilters,
    trace.hasNextPage,
    input.inFlightRequestReuse,
    request?.networkProfile ?? { supported: false },
    requestStartedAt === undefined ? 0 : elapsed(trace.confirmedAt, requestStartedAt),
    responseAt === undefined ? 0 : elapsed(trace.confirmedAt, responseAt),
    trace.newAppLaunchObserved,
    elapsed(trace.confirmedAt, nextRenderCycleAt),
    input.outcome === 'success' ? 's' : input.outcome === 'superseded' ? 'x' : 'f',
    trace.pageSessionSearchIndex,
    request?.profileEnabled === true,
    trace.publishedBatchConfirmed,
    Date.now(),
    request?.requestId ?? 'unavailable',
    trace.responseBytes,
    true,
    responseAt === undefined || trace.responseDecodedAt === undefined
      ? 0
      : elapsed(responseAt, trace.responseDecodedAt),
    trace.resultCount,
    trace.searchTermLength,
    trace.searchType === 'employee-code'
      ? 'e'
      : trace.searchType === 'name'
        ? 'n'
        : trace.searchType === 'phone'
          ? 'p'
          : 'o',
    request?.serverTiming ?? { supported: false },
    true,
    trace.setDataCallCount,
    input.setDataCommitAt === undefined ? 0 : elapsed(trace.confirmedAt, input.setDataCommitAt),
    trace.setDataMaxBytes,
    trace.setDataTotalBytes,
    elapsed(trace.confirmedAt, Date.now()),
    false,
    trace.warmResume,
  ]);
}

function appendBoundedRecord(slot: RuntimeDiagnosticsSlot, record: unknown[]): void {
  const measured = estimateBytes(record);
  record[8] = Number(record[8] ?? 0) + measured.durationMs;
  record[42] = elapsed(Number(record[5] ?? 0), Date.now());
  if (measured.bytes > RUNTIME_DIRECTORY_RECORD_MAX_BYTES) {
    record[7] = 'DIR-truncated';
    record[19] = { supported: false };
    record[29] = 'unavailable';
    record[36] = { supported: false };
    record[43] = true;
  }
  slot.directorySearches.push(record);
  if (slot.directorySearches.length > RUNTIME_DIRECTORY_SEARCH_LIMIT) {
    slot.directorySearches.splice(
      0,
      slot.directorySearches.length - RUNTIME_DIRECTORY_SEARCH_LIMIT,
    );
  }
}

function findRequest(
  slot: RuntimeDiagnosticsSlot,
  trace: DirectorySearchDiagnosticTrace,
): RuntimeDiagnosticRequestInput | undefined {
  const startedAt = trace.clientRequestStartedAt;
  if (startedAt === undefined) return undefined;
  return slot.requests
    .filter(
      (request) =>
        request.method === 'GET' &&
        request.endpoint === 'organization.directory-list' &&
        request.startedAt >= startedAt - 10,
    )
    .sort(
      (left, right) => Math.abs(left.startedAt - startedAt) - Math.abs(right.startedAt - startedAt),
    )[0];
}

function parseNetworkProfile(value: unknown): RuntimeDiagnosticNetworkProfile {
  if (!isRecord(value)) return { supported: false };
  const dnsMs = phase(value, 'domainLookUpStart', 'domainLookUpEnd');
  const connectMs = phase(value, 'connectStart', 'connectEnd');
  const tlsMs = phase(value, 'SSLconnectionStart', 'SSLconnectionEnd');
  const ttfbMs = phase(value, 'requestStart', 'responseStart');
  const downloadMs = phase(value, 'responseStart', 'responseEnd');
  return [dnsMs, connectMs, tlsMs, ttfbMs, downloadMs].every((item) => item === undefined)
    ? { supported: false }
    : {
        supported: true,
        ...(dnsMs === undefined ? {} : { dnsMs }),
        ...(connectMs === undefined ? {} : { connectMs }),
        ...(tlsMs === undefined ? {} : { tlsMs }),
        ...(ttfbMs === undefined ? {} : { ttfbMs }),
        ...(downloadMs === undefined ? {} : { downloadMs }),
      };
}

function parseServerTiming(headers: unknown): RuntimeDiagnosticServerTiming {
  const value = findHeader(headers, 'server-timing');
  if (value === undefined || value.length > RUNTIME_DIAGNOSTIC_HEADER_VALUE_MAX_LENGTH) {
    return { supported: false };
  }
  const output: Record<string, boolean | number | string> = { supported: true };
  let cacheValid = false;
  let queueValid = false;
  for (const item of value.split(',')) {
    const [rawName, ...parameters] = item.trim().split(';');
    const name = rawName?.toLowerCase();
    if (name === undefined) continue;
    let description: string | undefined;
    let duration: number | undefined;
    for (const parameter of parameters) {
      const [rawKey, rawValue = ''] = parameter.trim().split('=');
      if (rawKey?.toLowerCase() === 'dur' && /^\d+(?:\.\d+)?$/u.test(rawValue)) {
        duration = Math.min(600_000, Math.round(Number(rawValue)));
      }
      if (rawKey?.toLowerCase() === 'desc') {
        description = rawValue.replace(/^"|"$/gu, '').toLowerCase();
      }
    }
    if (name === 'queue') queueValid = description === 'unsupported';
    else if (name === 'cache') cacheValid = description === 'none';
    else if (name === 'cold' && (description === 'cold' || description === 'warm')) {
      output['coldStart'] = description === 'cold';
    } else if (duration !== undefined) {
      const field = serverTimingDurationFields[name];
      if (field !== undefined) output[field] = duration;
    }
  }
  if (!queueValid || !cacheValid || typeof output['totalMs'] !== 'number') {
    return { supported: false };
  }
  output['cache'] = 'none';
  output['queueSupported'] = false;
  return output as unknown as RuntimeDiagnosticServerTiming;
}

const serverTimingDurationFields: Readonly<Record<string, string>> = {
  alias: 'aliasMs',
  auth: 'authMs',
  batch: 'batchMs',
  contacts: 'contactsMs',
  count: 'countMs',
  db_wait: 'databaseWaitMs',
  instance_age: 'instanceAgeMs',
  permission: 'permissionMs',
  query: 'queryMs',
  rows: 'rowsMs',
  serialize: 'serializationMs',
  total: 'totalMs',
  transform: 'transformMs',
};

function parseRequestId(headers: unknown): string | undefined {
  const value = findHeader(headers, 'x-request-id');
  if (value === undefined || value.length > RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH) {
    return undefined;
  }
  return RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

function findHeader(value: unknown, name: string): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const [key, headerValue] of Object.entries(value)) {
    if (key.toLowerCase() === name && typeof headerValue === 'string') return headerValue;
  }
  return undefined;
}

function phase(
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
    ? Math.min(600_000, Math.round(end - start))
    : undefined;
}

function classifySearch(value: string, kind: DirectoryKind): RuntimeDirectorySearchType {
  const normalized = value.trim();
  const compact = normalized.replace(/[\s()-]/gu, '');
  if (/^\+?\d{7,20}$/u.test(compact)) return 'phone';
  if (kind === 'employee' && /^(?:[A-Za-z]+)?\d{3,20}$/u.test(compact)) return 'employee-code';
  if (/[\u3400-\u9fff]/u.test(normalized) || /^[A-Za-z\s·.]+$/u.test(normalized)) return 'name';
  return 'other';
}

function estimateBytes(value: unknown): { readonly bytes: number; readonly durationMs: number } {
  const startedAt = Date.now();
  try {
    const serialized = JSON.stringify(value);
    return {
      bytes: serialized === undefined ? 0 : utf8Bytes(serialized),
      durationMs: Date.now() - startedAt,
    };
  } catch {
    return { bytes: 0, durationMs: Date.now() - startedAt };
  }
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function createDiagnosticId(): string {
  return `DIR-${Date.now().toString(36).slice(-7)}-${Math.random().toString(36).slice(2, 9)}`;
}

function elapsed(startedAt: number, completedAt: number): number {
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 0;
  return Math.max(0, Math.min(600_000, Math.round(completedAt - startedAt)));
}

function resolveSlot(): RuntimeDiagnosticsSlot | undefined {
  try {
    return getApp<{ globalData?: { runtimeDiagnostics?: RuntimeDiagnosticsSlot } }>().globalData
      ?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const directoryDiagnosticsBridge: DirectoryDiagnosticsBridge = {
  beginDirectorySearchDiagnostic,
  completeDirectorySearchDiagnostic,
  directoryRequestDiagnosticObserver,
  markDirectorySearchRequestStarted,
  markDirectorySearchResult,
  markDirectorySearchReuse,
  trackDirectorySearchSetData,
};
