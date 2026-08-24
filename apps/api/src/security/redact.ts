export const REDACTED = '[REDACTED]';

// 日志与安全审计必须共用同一份敏感字段清单，任何一侧新增字段都需要先改这里。
const sensitiveFieldNames = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'linkToken',
  'appSecret',
  'phone',
  'phoneNumber',
  'mobilePhone',
  'shortPhone',
  'mobile',
  'telephone',
  'openid',
  'unionId',
  'visitorKey',
  'stack',
  'errorStack',
  'errorMessage',
] as const;

// Pino redact 依赖静态路径列表；深于 3 层的嵌套由 redactSensitiveFields 兜底。
export const logRedactionPaths = sensitiveFieldNames.flatMap((field) => [
  field,
  `*.${field}`,
  `*.*.${field}`,
  `*.*.*.${field}`,
]);

const normalizedSensitiveFieldNames = new Set(
  sensitiveFieldNames.map((field) => normalizeFieldName(field)),
);

export function redactSensitiveFields(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value.map((item) => redactValue(item, seen));
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
      normalizedSensitiveFieldNames.has(normalizeFieldName(field))
        ? REDACTED
        : redactValue(nestedValue, seen),
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

function normalizeFieldName(field: string): string {
  return field.replaceAll(/[-_]/g, '').toLowerCase();
}
