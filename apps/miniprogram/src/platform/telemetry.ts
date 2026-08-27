import type { ClientCapabilityStore } from '../app/client-capability-store.js';
import {
  executeWxJsonRequest,
  type WxJsonRequest,
  type WxJsonRequestOptions,
} from './wx-request-executor.js';

export type MiniTelemetryPage =
  | 'app'
  | 'identity'
  | 'workbench'
  | 'manual-matrix'
  | 'manual-schedule'
  | 'backfill'
  | 'group-settings'
  | 'unknown';

export type MiniTelemetryDeviceTier = 'low' | 'medium' | 'high' | 'unknown';
export type MiniTelemetryNetworkType = 'none' | 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown';
export type MiniTelemetryErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'CLIENT_CAPABILITY_DISABLED'
  | 'CLIENT_VERSION_UNSUPPORTED'
  | 'INVALID_RESPONSE'
  | 'MINI_RUNTIME_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';
export type MiniTelemetryPerformanceMetric =
  'core-ready' | 'foreground-ready' | 'maximum-matrix-render' | 'tap-feedback';
export const MINI_TELEMETRY_BOUNDARY_MARKERS = [
  'exports:component-attached',
  'exports:page-onload',
  'insights:component-attached',
  'insights:page-onload',
  'notification-settings:controller-attached',
  'notification-settings:page-onload',
  'notifications:controller-attached',
  'notifications:page-onload',
  'visitor-access:component-attached',
  'visitor-access:page-onload',
] as const;
export type MiniTelemetryBoundaryMarker = (typeof MINI_TELEMETRY_BOUNDARY_MARKERS)[number];

interface QueuedTelemetryEvent {
  readonly dedupeKey: string;
  readonly deviceTier: MiniTelemetryDeviceTier;
  readonly errorCode?: MiniTelemetryErrorCode | undefined;
  readonly page: MiniTelemetryPage;
  readonly performance?:
    | {
        readonly durationMs: number;
        readonly metric: MiniTelemetryPerformanceMetric;
      }
    | undefined;
  readonly stackFingerprint?: string | undefined;
}

interface NetworkTypeOptions {
  readonly fail: (error: unknown) => void;
  readonly success: (result: { readonly networkType?: unknown }) => void;
}

export interface MiniTelemetryEmitter {
  flush(): Promise<void>;
  recordError(page: MiniTelemetryPage, errorCode: MiniTelemetryErrorCode, error: unknown): void;
  recordPerformance(
    page: MiniTelemetryPage,
    metric: MiniTelemetryPerformanceMetric,
    durationMs: number,
  ): void;
}

interface MiniTelemetryEmitterOptions {
  readonly capabilityStore: ClientCapabilityStore;
  readonly getDeviceInfo: () => { readonly benchmarkLevel?: number | undefined };
  readonly getNetworkType: (options: NetworkTypeOptions) => unknown;
  readonly request: WxJsonRequest;
}

const queueLimit = 10;
const requestTimeoutMs = 3_000;
const networkTypeTimeoutMs = 250;
const baseUrl = readApiBaseUrl().replace(/\/$/u, '');
const networkTypes = new Set<MiniTelemetryNetworkType>([
  'none',
  'wifi',
  '2g',
  '3g',
  '4g',
  '5g',
  'unknown',
]);
const allowedBoundaryMarkers = new Set<string>(MINI_TELEMETRY_BOUNDARY_MARKERS);
const sentBoundaryMarkers = new Set<MiniTelemetryBoundaryMarker>();

export function createMiniTelemetryEmitter(
  options: MiniTelemetryEmitterOptions,
): MiniTelemetryEmitter {
  const queue: QueuedTelemetryEvent[] = [];
  const dedupeKeys = new Set<string>();
  let flushScheduled = false;
  let inFlight: Promise<void> | undefined;

  const scheduleFlush = (): void => {
    if (flushScheduled) return;
    flushScheduled = true;
    void Promise.resolve().then(async () => {
      flushScheduled = false;
      await flush();
    });
  };

  const enqueue = (event: Omit<QueuedTelemetryEvent, 'dedupeKey' | 'deviceTier'>): void => {
    if (!options.capabilityStore.isEnabled('core')) return;
    const deviceTier = readDeviceTier(options.getDeviceInfo);
    const dedupeKey = JSON.stringify({ ...event, deviceTier });
    if (dedupeKeys.size >= queueLimit || dedupeKeys.has(dedupeKey)) return;
    dedupeKeys.add(dedupeKey);
    queue.push({ ...event, dedupeKey, deviceTier });
    scheduleFlush();
  };

  const sendNextBatch = async (): Promise<void> => {
    if (!options.capabilityStore.isEnabled('core')) {
      for (const event of queue.splice(0)) dedupeKeys.delete(event.dedupeKey);
      return;
    }
    const networkType = await readNetworkType(options.getNetworkType);
    const batch = queue.splice(0, queueLimit);
    if (batch.length === 0) return;
    try {
      await executeWxJsonRequest({
        capability: 'core',
        data: {
          events: batch.map(({ dedupeKey, ...event }) => {
            void dedupeKey;
            return { ...event, networkType };
          }),
        },
        method: 'POST',
        request: (requestOptions: WxJsonRequestOptions) => options.request(requestOptions),
        timeout: requestTimeoutMs,
        url: `${baseUrl}/client-telemetry`,
      });
    } catch {
      // Anonymous telemetry is best-effort and must never enter its own error path.
    } finally {
      for (const event of batch) dedupeKeys.delete(event.dedupeKey);
    }
  };

  const flush = async (): Promise<void> => {
    if (inFlight !== undefined) return inFlight;
    if (queue.length === 0) return;
    const pending = sendNextBatch().finally(() => {
      if (inFlight === pending) inFlight = undefined;
      if (queue.length > 0) scheduleFlush();
    });
    inFlight = pending;
    return pending;
  };

  return {
    flush,
    recordError(page, errorCode, error) {
      try {
        enqueue({ errorCode, page, stackFingerprint: createTelemetryStackFingerprint(error) });
      } catch {
        // App error handling must never throw or recursively report itself.
      }
    },
    recordPerformance(page, metric, durationMs) {
      try {
        if (!Number.isFinite(durationMs)) return;
        enqueue({
          page,
          performance: {
            durationMs: Math.max(0, Math.min(600_000, Math.round(durationMs))),
            metric,
          },
        });
      } catch {
        // Performance telemetry is best-effort and never affects the measured page.
      }
    },
  };
}

export function createRuntimeMiniTelemetryEmitter(
  capabilityStore: ClientCapabilityStore,
): MiniTelemetryEmitter {
  const runtime = wx as unknown as {
    readonly getDeviceInfo?: () => { readonly benchmarkLevel?: number | undefined };
    readonly getNetworkType?: ((options: NetworkTypeOptions) => unknown) | undefined;
  };
  return createMiniTelemetryEmitter({
    capabilityStore,
    getDeviceInfo: () => runtime.getDeviceInfo?.() ?? {},
    getNetworkType: (options) => {
      if (runtime.getNetworkType === undefined) {
        options.fail(undefined);
        return undefined;
      }
      return runtime.getNetworkType(options);
    },
    request: (requestOptions) => wx.request(requestOptions),
  });
}

export function recordMiniTelemetryPerformance(
  page: MiniTelemetryPage,
  metric: MiniTelemetryPerformanceMetric,
  durationMs: number,
): void {
  resolveRuntimeEmitter()?.recordPerformance(page, metric, durationMs);
}

export function recordMiniTelemetryBoundary(marker: MiniTelemetryBoundaryMarker): void {
  if (!allowedBoundaryMarkers.has(marker) || sentBoundaryMarkers.has(marker)) return;
  const runtime = resolveRuntimeTelemetry();
  if (runtime === undefined || !runtime.capabilityStore.isEnabled('core')) return;
  runtime.emitter.recordError('unknown', 'UNKNOWN', marker);
  sentBoundaryMarkers.add(marker);
}

export function resolveTelemetryPage(route: string): MiniTelemetryPage {
  if (route.startsWith('pages/identity/') || route.startsWith('pages/admin-bind/')) {
    return 'identity';
  }
  if (route === 'pages/workbench/index') return 'workbench';
  if (route === 'pages/manual-matrix-poc/index') return 'manual-matrix';
  if (route === 'subpackages/scheduling/pages/manual/index') return 'manual-schedule';
  if (route === 'subpackages/scheduling/pages/backfill/index') return 'backfill';
  if (route === 'subpackages/organization/pages/group-settings/index') return 'group-settings';
  return 'unknown';
}

export function resolveDeviceTier(benchmarkLevel: number | undefined): MiniTelemetryDeviceTier {
  if (!Number.isFinite(benchmarkLevel) || (benchmarkLevel ?? 0) <= 0) return 'unknown';
  if ((benchmarkLevel as number) <= 2) return 'low';
  if ((benchmarkLevel as number) <= 5) return 'medium';
  return 'high';
}

export function normalizeNetworkType(value: unknown): MiniTelemetryNetworkType {
  return typeof value === 'string' && networkTypes.has(value as MiniTelemetryNetworkType)
    ? (value as MiniTelemetryNetworkType)
    : 'unknown';
}

export function createTelemetryStackFingerprint(error: unknown): string {
  try {
    return sha256Hex(sanitizeStack(extractErrorText(error)));
  } catch {
    return sha256Hex('unknown');
  }
}

export function sha256Hex(value: string): string {
  const bytes = encodeUtf8(value);
  const bitLength = bytes.length * 8;
  const message = [...bytes, 0x80];
  while (message.length % 64 !== 56) message.push(0);
  message.push(0, 0, 0, 0);
  message.push(
    (bitLength >>> 24) & 0xff,
    (bitLength >>> 16) & 0xff,
    (bitLength >>> 8) & 0xff,
    bitLength & 0xff,
  );

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] =
        ((message[cursor] ?? 0) << 24) |
        ((message[cursor + 1] ?? 0) << 16) |
        ((message[cursor + 2] ?? 0) << 8) |
        (message[cursor + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = addUnsigned(words[index - 16] ?? 0, sigma0, words[index - 7] ?? 0, sigma1);
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choice = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 = addUnsigned(
        h ?? 0,
        sum1,
        choice,
        sha256Constants[index] ?? 0,
        words[index] ?? 0,
      );
      const sum0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = addUnsigned(sum0, majority);
      h = g;
      g = f;
      f = e;
      e = addUnsigned(d ?? 0, temporary1);
      d = c;
      c = b;
      b = a;
      a = addUnsigned(temporary1, temporary2);
    }
    hash[0] = addUnsigned(hash[0] ?? 0, a ?? 0);
    hash[1] = addUnsigned(hash[1] ?? 0, b ?? 0);
    hash[2] = addUnsigned(hash[2] ?? 0, c ?? 0);
    hash[3] = addUnsigned(hash[3] ?? 0, d ?? 0);
    hash[4] = addUnsigned(hash[4] ?? 0, e ?? 0);
    hash[5] = addUnsigned(hash[5] ?? 0, f ?? 0);
    hash[6] = addUnsigned(hash[6] ?? 0, g ?? 0);
    hash[7] = addUnsigned(hash[7] ?? 0, h ?? 0);
  }
  return hash.map((word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

function resolveRuntimeTelemetry():
  | {
      readonly capabilityStore: Pick<ClientCapabilityStore, 'isEnabled'>;
      readonly emitter: MiniTelemetryEmitter;
    }
  | undefined {
  if (typeof getApp !== 'function') return undefined;
  try {
    const globalData = getApp<{
      readonly globalData?: {
        readonly clientCapabilityStore?: Pick<ClientCapabilityStore, 'isEnabled'> | undefined;
        readonly telemetryEmitter?: MiniTelemetryEmitter | undefined;
      };
    }>().globalData;
    if (
      globalData?.clientCapabilityStore === undefined ||
      globalData.telemetryEmitter === undefined
    ) {
      return undefined;
    }
    return {
      capabilityStore: globalData.clientCapabilityStore,
      emitter: globalData.telemetryEmitter,
    };
  } catch {
    return undefined;
  }
}

function resolveRuntimeEmitter(): MiniTelemetryEmitter | undefined {
  return resolveRuntimeTelemetry()?.emitter;
}

function readApiBaseUrl(): string {
  return typeof __MINIPROGRAM_API_BASE_URL__ === 'string'
    ? __MINIPROGRAM_API_BASE_URL__
    : 'https://invalid.local/api';
}

function readDeviceTier(
  getDeviceInfo: () => { readonly benchmarkLevel?: number | undefined },
): MiniTelemetryDeviceTier {
  try {
    return resolveDeviceTier(getDeviceInfo().benchmarkLevel);
  } catch {
    return 'unknown';
  }
}

function readNetworkType(
  getNetworkType: (options: NetworkTypeOptions) => unknown,
): Promise<MiniTelemetryNetworkType> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => finish('unknown'), networkTypeTimeoutMs);
    const finish = (networkType: MiniTelemetryNetworkType): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(networkType);
    };
    try {
      getNetworkType({
        fail: () => finish('unknown'),
        success: (result) => finish(normalizeNetworkType(result.networkType)),
      });
    } catch {
      finish('unknown');
    }
  });
}

function extractErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.stack ?? error.message;
  if (isRecord(error)) {
    for (const key of ['stack', 'message', 'reason'] as const) {
      const value = error[key];
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.stack ?? value.message;
    }
  }
  return 'unknown';
}

function sanitizeStack(value: string): string {
  return (
    value
      .slice(0, 4_096)
      .replace(/https?:\/\/[^\s)]+/giu, '<url>')
      .replace(/\b[A-Za-z]:[\\/][^\s)]+/gu, '<path>')
      .replace(/(^|[\s(])\/(?:[^\s/)]+\/)+[^\s)]+/gu, '$1<path>')
      .replace(/[?&][^\s)]+/gu, '<query>')
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu,
        '<uuid>',
      )
      .replace(/\b[0-9a-f]{16,}\b/giu, '<hex>')
      .replace(/\b\d+\b/gu, '<number>')
      .replace(/\s+/gu, ' ')
      .trim() || 'unknown'
  );
}

function encodeUtf8(value: string): number[] {
  const bytes: number[] = [];
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | (point >>> 6), 0x80 | (point & 0x3f));
    else if (point <= 0xffff) {
      bytes.push(0xe0 | (point >>> 12), 0x80 | ((point >>> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >>> 18),
        0x80 | ((point >>> 12) & 0x3f),
        0x80 | ((point >>> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function addUnsigned(...values: readonly number[]): number {
  return values.reduce((sum, value) => (sum + (value >>> 0)) >>> 0, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const sha256Constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
