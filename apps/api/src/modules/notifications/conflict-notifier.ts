import type { DatabaseClient } from '@schedule/database';
import { withTransaction } from '@schedule/database';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { requireActiveUser } from './active-user.js';
import { NotificationWriter } from './notification-writer.js';

export interface ConflictNotificationInput {
  readonly groupId: string;
  readonly identity: AuthenticatedIdentity;
  readonly operationId: string;
  readonly preview: unknown;
}

export async function writeConflictNotification(
  databaseClient: DatabaseClient,
  input: ConflictNotificationInput,
): Promise<void> {
  try {
    const summary = toConflictSummary(input.preview);
    if (summary === null) {
      return;
    }

    await withTransaction(databaseClient, async (transaction) => {
      const actorUserId = await requireActiveUser(transaction, input.identity);
      await new NotificationWriter().append(transaction, {
        body: '排班结果包含硬冲突或待处理空缺，请查看预览后处理。',
        browserDelivery: true,
        groupId: input.groupId,
        notificationType: 'conflict_detected',
        objectType: 'schedule_preview',
        payload: {
          operationId: input.operationId,
          preview: summary,
        },
        recipientUserIds: [actorUserId],
        title: '排班冲突待处理',
      });
    });
  } catch {
    // A notification dispatch failure must never break the business response.
  }
}

export function isConflictBlockedError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 409 || error.latestData === undefined) {
    return false;
  }

  return toConflictSummary(error.latestData.preview) !== null;
}

function toConflictSummary(
  preview: unknown,
): { readonly hardConflicts: number; readonly vacancies: number } | null {
  if (preview === null || typeof preview !== 'object') {
    return null;
  }

  const value = preview as { conflicts?: unknown; hardConflicts?: unknown; vacancies?: unknown };
  const hardConflicts = Array.isArray(value.conflicts)
    ? value.conflicts.length
    : Array.isArray(value.hardConflicts)
      ? value.hardConflicts.length
      : 0;
  const vacancies = Array.isArray(value.vacancies) ? value.vacancies.length : 0;

  if (hardConflicts === 0 && vacancies === 0) {
    return null;
  }

  return { hardConflicts, vacancies };
}
