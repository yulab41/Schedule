import { randomUUID } from 'node:crypto';

import type { AuditLogWriteInput, JsonObject } from '@schedule/contracts';
import { auditLogs, type DatabaseTransaction } from '@schedule/database';

import { redactSensitiveFields } from '../../security/redact.js';

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
      metadata: redactSensitiveFields(input.metadata) as JsonObject,
      operationId: input.operationId,
      outcome: input.outcome,
      requestId: input.requestId ?? null,
      targetId: input.targetId ?? null,
      targetType: input.targetType ?? null,
    });

    return auditLogId;
  }
}
