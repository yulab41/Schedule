import { randomUUID } from 'node:crypto';

import type { JsonObject } from '@schedule/contracts';
import {
  groupMemberships,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  users,
  webPushSubscriptions,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export interface NotificationWriteInput {
  readonly administratorRecipients?: boolean;
  readonly body: string;
  readonly browserDelivery?: boolean;
  readonly excludeRecipientUserIds?: readonly string[];
  readonly groupId: string;
  readonly notificationType: string;
  readonly objectId?: string;
  readonly objectType?: string;
  readonly payload?: JsonObject;
  readonly recipientMembershipIds?: readonly string[];
  readonly recipientUserIds?: readonly string[];
  readonly scheduleEventId?: string;
  readonly shiftAssignmentId?: string;
  readonly title: string;
}

export class NotificationWriter {
  public async append(
    transaction: DatabaseTransaction,
    input: NotificationWriteInput,
  ): Promise<readonly string[]> {
    const recipientUserIds = await this.resolveRecipientUserIds(transaction, input);
    const notificationIds: string[] = [];

    for (const recipientUserId of recipientUserIds) {
      const notificationId = randomUUID();
      await transaction.insert(notifications).values({
        body: input.body,
        groupId: input.groupId,
        id: notificationId,
        notificationType: input.notificationType,
        ...(input.objectId === undefined ? {} : { objectId: input.objectId }),
        ...(input.objectType === undefined ? {} : { objectType: input.objectType }),
        ...(input.payload === undefined ? {} : { payload: input.payload }),
        recipientUserId,
        ...(input.scheduleEventId === undefined ? {} : { scheduleEventId: input.scheduleEventId }),
        ...(input.shiftAssignmentId === undefined
          ? {}
          : { shiftAssignmentId: input.shiftAssignmentId }),
        title: input.title,
      });

      if (
        input.browserDelivery !== false &&
        (await this.shouldDispatchBrowser(transaction, recipientUserId, input.groupId))
      ) {
        await transaction.insert(notificationDeliveries).values({
          channel: 'browser',
          id: randomUUID(),
          maxAttempts: 3,
          nextAttemptAt: new Date(),
          notificationId,
          status: 'pending',
        });
      }

      notificationIds.push(notificationId);
    }

    return notificationIds;
  }

  private async resolveRecipientUserIds(
    transaction: DatabaseTransaction,
    input: NotificationWriteInput,
  ): Promise<readonly string[]> {
    const userIds = new Set(input.recipientUserIds ?? []);

    if (input.recipientMembershipIds !== undefined && input.recipientMembershipIds.length > 0) {
      const rows = await transaction
        .select({ userId: groupMemberships.userId })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .where(
          and(
            eq(groupMemberships.groupId, input.groupId),
            inArray(groupMemberships.id, [...input.recipientMembershipIds]),
            eq(groupMemberships.status, 'active'),
            eq(users.status, 'active'),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
          ),
        );
      for (const row of rows) {
        userIds.add(row.userId);
      }
    }

    if (input.administratorRecipients === true) {
      const rows = await transaction
        .select({ userId: groupMemberships.userId })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .where(
          and(
            eq(groupMemberships.groupId, input.groupId),
            inArray(groupMemberships.role, ['owner', 'administrator']),
            eq(groupMemberships.status, 'active'),
            eq(users.status, 'active'),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
          ),
        );
      for (const row of rows) {
        userIds.add(row.userId);
      }
    }

    for (const excludedUserId of input.excludeRecipientUserIds ?? []) {
      userIds.delete(excludedUserId);
    }

    return [...userIds];
  }

  private async shouldDispatchBrowser(
    transaction: DatabaseTransaction,
    userId: string,
    groupId: string,
  ): Promise<boolean> {
    const [membership] = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);
    if (membership === undefined) {
      return false;
    }

    const [preference] = await transaction
      .select({ browserNotificationsEnabled: notificationPreferences.browserNotificationsEnabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.membershipId, membership.id))
      .limit(1);
    if (preference !== undefined && preference.browserNotificationsEnabled === 0) {
      return false;
    }

    const [subscription] = await transaction
      .select({ id: webPushSubscriptions.id })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.userId, userId))
      .limit(1);

    return subscription !== undefined;
  }
}
