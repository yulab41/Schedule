import type { FastifyInstance, FastifyRequest, RouteShorthandOptions } from 'fastify';

import type { DirectoryQueryPlan } from './directory-query-plan.js';

export interface DirectoryServerTimingTrace {
  aliasMs?: number | undefined;
  authMs?: number | undefined;
  batchMs?: number | undefined;
  contactsMs?: number | undefined;
  countMs?: number | undefined;
  databaseWaitMs?: number | undefined;
  directoryQueryPlan?: DirectoryQueryPlan | undefined;
  permissionMs?: number | undefined;
  queryMs?: number | undefined;
  rowsMs?: number | undefined;
  serializationMs?: number | undefined;
  transformMs?: number | undefined;
  readonly coldStart: boolean;
  readonly instanceAgeMs: number;
  readonly requestStartedAt: number;
  authStartedAt?: number | undefined;
  serializationStartedAt?: number | undefined;
}

const traceByRequest = new WeakMap<FastifyRequest, DirectoryServerTimingTrace>();
const coldInstanceThresholdMs = 60_000;

export function createDirectoryListTimingOptions(app: FastifyInstance): RouteShorthandOptions {
  return {
    onRequest: async (request) => {
      if (!isDirectoryTimingRequested(request)) return;
      const instanceAgeMs = Math.max(0, Math.round(process.uptime() * 1_000));
      traceByRequest.set(request, {
        coldStart: instanceAgeMs < coldInstanceThresholdMs,
        instanceAgeMs,
        requestStartedAt: performance.now(),
      });
    },
    onSend: async (request, reply, payload) => {
      const trace = traceByRequest.get(request);
      if (trace === undefined) return payload;
      trace.serializationMs = elapsedSince(trace.serializationStartedAt);
      reply.header(
        'Server-Timing',
        formatDirectoryServerTiming(trace, elapsedSince(trace.requestStartedAt)),
      );
      return payload;
    },
    preHandler: [
      async (request) => {
        const trace = traceByRequest.get(request);
        if (trace !== undefined) trace.authStartedAt = performance.now();
      },
      app.authenticate,
      async (request) => {
        const trace = traceByRequest.get(request);
        if (trace !== undefined) trace.authMs = elapsedSince(trace.authStartedAt);
      },
    ],
    preSerialization: async (request) => {
      const trace = traceByRequest.get(request);
      if (trace !== undefined) trace.serializationStartedAt = performance.now();
    },
  };
}

export function getDirectoryServerTimingTrace(
  request: FastifyRequest,
): DirectoryServerTimingTrace | undefined {
  return traceByRequest.get(request);
}

export async function measureDirectoryPhase<Result>(
  trace: DirectoryServerTimingTrace | undefined,
  key: 'aliasMs' | 'batchMs' | 'contactsMs' | 'countMs' | 'permissionMs' | 'rowsMs' | 'transformMs',
  operation: () => Promise<Result> | Result,
): Promise<Result> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    if (trace !== undefined) trace[key] = elapsedSince(startedAt);
  }
}

function isDirectoryTimingRequested(request: FastifyRequest): boolean {
  return (
    headerValue(request.headers['x-schedule-directory-diagnostics']) === 'v1' &&
    headerValue(request.headers['x-schedule-client-platform']) === 'miniprogram'
  );
}

function headerValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value.toLowerCase() : value?.[0]?.toLowerCase();
}

function formatDirectoryServerTiming(trace: DirectoryServerTimingTrace, totalMs: number): string {
  return [
    'queue;desc="unsupported"',
    `cold;desc="${trace.coldStart ? 'cold' : 'warm'}"`,
    metric('instance_age', trace.instanceAgeMs, 2_592_000_000),
    'cache;desc="none"',
    trace.directoryQueryPlan === undefined
      ? 'directory_plan;desc="unsupported"'
      : 'directory_plan;desc="' + trace.directoryQueryPlan + '"',
    metric('auth', trace.authMs),
    metric('db_wait', trace.databaseWaitMs),
    metric('permission', trace.permissionMs),
    metric('batch', trace.batchMs),
    metric('alias', trace.aliasMs),
    metric('rows', trace.rowsMs),
    metric('contacts', trace.contactsMs),
    metric('count', trace.countMs),
    metric('query', trace.queryMs),
    metric('transform', trace.transformMs),
    metric('serialize', trace.serializationMs),
    metric('total', totalMs),
  ].join(', ');
}

function metric(name: string, value: number | undefined, maximum = 600_000): string {
  return value === undefined
    ? `${name};desc="unsupported"`
    : `${name};dur=${normalizeDuration(value, maximum)}`;
}

function elapsedSince(startedAt: number | undefined): number {
  return startedAt === undefined ? 0 : normalizeDuration(performance.now() - startedAt);
}

function normalizeDuration(value: number, maximum = 600_000): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(value * 10) / 10));
}
