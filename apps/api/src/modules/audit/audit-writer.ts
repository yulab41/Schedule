import { randomUUID } from 'node:crypto';

import type { AuditLogWriteInput, JsonObject, JsonValue } from '@schedule/contracts';
import { auditLogs, type DatabaseTransaction } from '@schedule/database';

const sensitiveFields = new Set([
  'accesstoken',
  'authorization',
  'mobile',
  'mobilephone',
  'password',
  'phone',
  'phonenumber',
  'refreshtoken',
  'shortphone',
  'telephone',
  'token',
]);

export class AuditWriter {
  public async append(
    transaction: DatabaseTransaction,
    input: AuditLogWriteInput,
  ): Promise<string> {
    const auditLogId = randomUUID();

    await transaction.insert(auditLogs).values({
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      groupId: input.groupId ?? null,
      id: auditLogId,
      metadata: redactAuditData(input.metadata),
      operationId: input.operationId,
      outcome: input.outcome,
      requestId: input.requestId ?? null,
      targetId: input.targetId ?? null,
      targetType: input.targetType ?? null,
    });

    return auditLogId;
  }
}

function redactAuditData(metadata: JsonObject): JsonObject {
  return redactValue(metadata, new WeakSet<object>()) as JsonObject;
}

function redactValue(value: JsonValue, seen: WeakSet<object>): JsonValue {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  return Object.fromEntries(
    Object.entries(value).map(([field, nestedValue]) => [
      field,
      sensitiveFields.has(normalizeFieldName(field))
        ? '[REDACTED]'
        : redactValue(nestedValue, seen),
    ]),
  );
}

function normalizeFieldName(field: string): string {
  return field.replaceAll(/[-_]/g, '').toLowerCase();
}
