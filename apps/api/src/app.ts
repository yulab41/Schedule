import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRequestContext } from './plugins/request-context.js';
import { getApiStatus } from './status.js';

const sensitiveLogFields = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'phone',
  'phoneNumber',
  'mobile',
] as const;

export const logRedactionPaths = sensitiveLogFields.flatMap((field) => [
  field,
  `*.${field}`,
  `*.*.${field}`,
  `*.*.*.${field}`,
]);

type ApiLoggerOptions = NonNullable<FastifyServerOptions['logger']>;
type ApiLoggerConfiguration = Exclude<ApiLoggerOptions, boolean>;
const normalizedSensitiveLogFields = new Set(
  sensitiveLogFields.map((field) => normalizeLogFieldName(field)),
);

export interface CreateAppOptions {
  readonly logger?: false;
  readonly loggerStream?: ApiLoggerConfiguration['stream'];
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: options.logger === false ? false : createLoggerOptions(options.loggerStream),
    requestIdHeader: false,
  });

  registerRequestContext(app);
  registerErrorHandler(app);

  app.get('/health', () => getApiStatus());
  app.get('/ready', () => getApiStatus());

  return app;
}

function createLoggerOptions(stream: ApiLoggerConfiguration['stream']): ApiLoggerConfiguration {
  const logger: ApiLoggerConfiguration = {
    level: stream === undefined && process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: {
      censor: '[REDACTED]',
      paths: logRedactionPaths,
    },
    serializers: {
      err(error) {
        return {
          message: '[REDACTED]',
          stack: '[REDACTED]',
          type: error.name,
        };
      },
      req(request) {
        return {
          method: request.method,
          requestId: request.id,
          url: request.url.split('?')[0] ?? '/',
        };
      },
    },
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((argument) => sanitizeLogArgument(argument)) as Parameters<typeof method>,
        );
      },
      streamWrite(logLine) {
        return sanitizeLogLine(logLine);
      },
    },
  };

  return stream === undefined ? logger : { ...logger, stream };
}

function sanitizeLogArgument(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value.map((item) => sanitizeLogArgument(item, seen));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  return Object.fromEntries(
    Object.entries(value).map(([field, nestedValue]) => [
      field,
      normalizedSensitiveLogFields.has(normalizeLogFieldName(field))
        ? '[REDACTED]'
        : sanitizeLogArgument(nestedValue, seen),
    ]),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeLogFieldName(field: string): string {
  return field.replaceAll(/[-_]/g, '').toLowerCase();
}

function sanitizeLogLine(logLine: string): string {
  const lineEnding = logLine.endsWith('\r\n') ? '\r\n' : logLine.endsWith('\n') ? '\n' : '';
  const json = lineEnding === '' ? logLine : logLine.slice(0, -lineEnding.length);

  try {
    return `${JSON.stringify(sanitizeLogArgument(JSON.parse(json)))}${lineEnding}`;
  } catch {
    return `{"level":50,"msg":"Log entry omitted because sanitization failed"}${lineEnding}`;
  }
}
