import type { DirectoryKind } from '@schedule/contracts';

import { buildInfo } from '../../../../platform/build-info.js';
import {
  findRuntimeDiagnosticRequest,
  recordRuntimeDirectorySearch,
} from '../../../../platform/runtime-directory-diagnostics-bridge.js';
import { isRuntimeDirectorySearchRecording } from '../../../../platform/runtime-diagnostics-bridge.js';
import type {
  RuntimeDiagnosticNetworkProfile,
  RuntimeDirectorySearchOutcome,
  RuntimeDirectorySearchType,
} from '../../../../platform/runtime-diagnostics.js';
import { readMiniProgramRuntimeIdentity } from '../../../../platform/runtime-environment.js';

export interface DirectorySearchDiagnosticTrace {
  readonly confirmedAt: number;
  readonly diagnosticId: string;
  readonly directoryKind: DirectoryKind;
  readonly eventHandlerStartedAt: number;
  readonly facetsReady: boolean;
  readonly firstSearchInPageSession: boolean;
  readonly hasFilters: boolean;
  readonly publishedBatchConfirmed: boolean;
  readonly searchTermLength: number;
  readonly searchType: RuntimeDirectorySearchType;
  cardBuildMs: number;
  clientRequestStartedAt: number | undefined;
  hasNextPage: boolean;
  responseBytes: number;
  responseDecodedAt: number | undefined;
  resultCount: number;
  setDataCallCount: number;
  setDataMaxBytes: number;
  setDataTotalBytes: number;
}

export interface BeginDirectorySearchDiagnosticInput {
  readonly confirmedAt?: number | undefined;
  readonly directoryKind: DirectoryKind;
  readonly eventHandlerStartedAt?: number | undefined;
  readonly facetsReady: boolean;
  readonly firstSearchInPageSession: boolean;
  readonly hasFilters: boolean;
  readonly publishedBatchConfirmed: boolean;
  readonly searchQuery: string;
}

export interface CompleteDirectorySearchDiagnosticInput {
  readonly completedResultReuse: boolean;
  readonly inFlightRequestReuse: boolean;
  readonly outcome: RuntimeDirectorySearchOutcome;
  readonly setDataCallbackAt?: number | undefined;
  readonly visibleAt?: number | undefined;
}

interface DiagnosticRuntimeApi {
  readonly getAppBaseInfo?: () => {
    readonly SDKVersion?: unknown;
    readonly version?: unknown;
  };
  readonly getDeviceInfo?: () => {
    readonly model?: unknown;
    readonly system?: unknown;
  };
  readonly getNetworkType?: (options: {
    readonly fail: () => void;
    readonly success: (result: { readonly networkType?: unknown }) => void;
  }) => unknown;
}

export function beginDirectorySearchDiagnostic(
  input: BeginDirectorySearchDiagnosticInput,
): DirectorySearchDiagnosticTrace | undefined {
  if (!isRuntimeDirectorySearchRecording()) return undefined;
  const startedAt = Date.now();
  const confirmedAt = input.confirmedAt ?? startedAt;
  return {
    cardBuildMs: 0,
    clientRequestStartedAt: undefined,
    confirmedAt,
    diagnosticId: createDiagnosticId(),
    directoryKind: input.directoryKind,
    eventHandlerStartedAt: input.eventHandlerStartedAt ?? startedAt,
    facetsReady: input.facetsReady,
    firstSearchInPageSession: input.firstSearchInPageSession,
    hasFilters: input.hasFilters,
    hasNextPage: false,
    publishedBatchConfirmed: input.publishedBatchConfirmed,
    responseBytes: 0,
    responseDecodedAt: undefined,
    resultCount: 0,
    searchTermLength: Math.min(100, Array.from(input.searchQuery.trim()).length),
    searchType: classifySearch(input.searchQuery, input.directoryKind),
    setDataCallCount: 0,
    setDataMaxBytes: 0,
    setDataTotalBytes: 0,
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
  trace.cardBuildMs = input.cardBuildMs;
  trace.hasNextPage = input.hasNextPage;
  trace.responseBytes = estimateBytes(input.response);
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
  const bytes = estimateBytes(patch);
  trace.setDataCallCount += 1;
  trace.setDataTotalBytes += bytes;
  trace.setDataMaxBytes = Math.max(trace.setDataMaxBytes, bytes);
}

export function completeDirectorySearchDiagnostic(
  trace: DirectorySearchDiagnosticTrace | undefined,
  input: CompleteDirectorySearchDiagnosticInput,
): void {
  if (trace === undefined) return;
  const visibleAt = input.visibleAt ?? Date.now();
  const request = findMatchingDirectoryRequest(trace);
  const requestStartedAt = request?.issuedAt ?? request?.startedAt;
  const responseAt =
    request?.completedAt ??
    (request === undefined ? undefined : request.startedAt + request.durationMs);
  const runtime = wx as unknown as DiagnosticRuntimeApi;
  const device = safeCall(() => runtime.getDeviceInfo?.());
  const app = safeCall(() => runtime.getAppBaseInfo?.());
  const identity = readMiniProgramRuntimeIdentity();
  void readNetworkType(runtime).then((networkType) => {
    recordRuntimeDirectorySearch({
      cardBuildMs: trace.cardBuildMs,
      completedResultReuse: input.completedResultReuse,
      confirmedAt: trace.confirmedAt,
      contextWaitMs: request?.contextWaitMs ?? 0,
      deviceModel: textValue(device?.model),
      diagnosticId: trace.diagnosticId,
      directoryKind: trace.directoryKind,
      duplicateRequestIntercepted: input.completedResultReuse || input.inFlightRequestReuse,
      eventHandlerStartMs: elapsed(trace.confirmedAt, trace.eventHandlerStartedAt),
      experienceVersion: buildInfo.buildLabel,
      facetsOrReleaseWaitMs:
        (request?.capabilityWaitMs ?? 0) +
        (requestStartedAt === undefined || request === undefined
          ? 0
          : elapsed(request.startedAt, requestStartedAt)),
      facetsReady: trace.facetsReady,
      firstSearchInPageSession: trace.firstSearchInPageSession,
      hasFilters: trace.hasFilters,
      hasNextPage: trace.hasNextPage,
      inFlightRequestReuse: input.inFlightRequestReuse,
      miniProgramVersion: identity.version,
      networkProfile: request?.networkProfile ?? unsupportedNetworkProfile,
      networkRequestStartMs:
        requestStartedAt === undefined ? 0 : elapsed(trace.confirmedAt, requestStartedAt),
      networkResponseMs: responseAt === undefined ? 0 : elapsed(trace.confirmedAt, responseAt),
      networkType,
      outcome: input.outcome,
      publishedBatchConfirmed: trace.publishedBatchConfirmed,
      recordedAt: Date.now(),
      requestId: request?.requestId ?? '不支持',
      responseBytes: trace.responseBytes,
      responseToConversionMs:
        responseAt === undefined || trace.responseDecodedAt === undefined
          ? 0
          : elapsed(responseAt, trace.responseDecodedAt),
      resultCount: trace.resultCount,
      resultVisibleMs: elapsed(trace.confirmedAt, visibleAt),
      sdkVersion: textValue(app?.SDKVersion),
      searchTermLength: trace.searchTermLength,
      searchType: trace.searchType,
      serverTiming: request?.serverTiming ?? unsupportedServerTiming,
      setDataCallbackMs:
        input.setDataCallbackAt === undefined
          ? 0
          : elapsed(trace.confirmedAt, input.setDataCallbackAt),
      setDataCallCount: trace.setDataCallCount,
      setDataMaxBytes: trace.setDataMaxBytes,
      setDataTotalBytes: trace.setDataTotalBytes,
      systemVersion: textValue(device?.system),
      totalMs: elapsed(trace.confirmedAt, visibleAt),
      wechatVersion: textValue(app?.version),
    });
  });
}

const unsupportedNetworkProfile: RuntimeDiagnosticNetworkProfile = { supported: false };
const unsupportedServerTiming = { supported: false } as const;

function findMatchingDirectoryRequest(trace: DirectorySearchDiagnosticTrace) {
  const expectedEndpoint =
    trace.directoryKind === 'employee'
      ? '/api/groups/:value/employee-directory'
      : '/api/groups/:value/directory';
  const startedAt = trace.clientRequestStartedAt;
  if (startedAt === undefined) return undefined;
  return findRuntimeDiagnosticRequest({ endpoint: expectedEndpoint, method: 'GET', startedAt });
}

function classifySearch(value: string, kind: DirectoryKind): RuntimeDirectorySearchType {
  const normalized = value.trim();
  const compact = normalized.replace(/[\s()-]/gu, '');
  if (/^\+?\d{7,20}$/u.test(compact)) return 'phone';
  if (kind === 'employee' && /^(?:[A-Za-z]+)?\d{3,20}$/u.test(compact)) {
    return 'employee-code';
  }
  if (/[\u3400-\u9fff]/u.test(normalized) || /^[A-Za-z\s·.]+$/u.test(normalized)) return 'name';
  return 'other';
}

function estimateBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return 0;
    let bytes = 0;
    for (const character of serialized) {
      const codePoint = character.codePointAt(0) ?? 0;
      bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    }
    return bytes;
  } catch {
    return 0;
  }
}

function createDiagnosticId(): string {
  const time = Date.now().toString(36).slice(-7);
  const random = Math.random().toString(36).slice(2, 9);
  return `DIR-${time}-${random}`;
}

function elapsed(startedAt: number, completedAt: number): number {
  return Math.max(0, Math.round(completedAt - startedAt));
}

function safeCall<T>(reader: (() => T) | undefined): T | undefined {
  try {
    return reader?.();
  } catch {
    return undefined;
  }
}

function readNetworkType(runtime: DiagnosticRuntimeApi): Promise<string> {
  return new Promise((resolve) => {
    if (runtime.getNetworkType === undefined) {
      resolve('不支持');
      return;
    }
    let settled = false;
    const finish = (value: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish('不支持'), 500);
    try {
      runtime.getNetworkType({
        fail: () => finish('不支持'),
        success: (result) => finish(textValue(result.networkType)),
      });
    } catch {
      finish('不支持');
    }
  });
}

function textValue(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 80)
    : '不支持';
}
