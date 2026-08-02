import { randomUUID } from 'node:crypto';

import type {
  GroupNotificationSettings,
  MemberNotificationPreferences,
  PushConfiguration,
  UpdateGroupNotificationSettingsInput,
  UpdateMemberNotificationPreferencesInput,
  WebPushSubscriptionInput,
} from '@schedule/contracts';
import type { DatabaseClient } from '@schedule/database';
import {
  notificationPreferences,
  notificationSettings,
  webPushSubscriptions,
  withTransaction,
} from '@schedule/database';
import { and, eq, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { requireActiveUser } from './active-user.js';
import type { PushDispatcher } from './notification-dispatcher.js';
import { validateReminderHours } from './reminder-hours.js';

const defaultDutyReminderHours: readonly number[] = [24, 2];
const maximumEndpointLength = 1000;
const maximumP256dhLength = 256;
const maximumAuthLength = 128;

export class NotificationService {
  private readonly permissionService = new GroupPermissionService();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly pushDispatcher: PushDispatcher,
  ) {}

  public async getGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupNotificationSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageNotifications',
      );
      const [row] = await transaction
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.groupId, authorization.group.id))
        .limit(1);

      return {
        dutyReminderHours: row?.dutyReminderHours ?? defaultDutyReminderHours,
        groupId: authorization.group.id,
      };
    });
  }

  public async updateGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupNotificationSettingsInput,
  ): Promise<GroupNotificationSettings> {
    const dutyReminderHours = parseReminderHours(input.dutyReminderHours);

    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageNotifications',
      );
      await transaction
        .insert(notificationSettings)
        .values({
          dutyReminderHours,
          groupId: authorization.group.id,
          version: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            dutyReminderHours,
            version: sql`${notificationSettings.version} + 1`,
          },
        });

      return {
        dutyReminderHours,
        groupId: authorization.group.id,
      };
    });
  }

  public async getMyPreferences(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<MemberNotificationPreferences> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const [row] = await transaction
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.membershipId, authorization.membership.id))
        .limit(1);

      return row === undefined
        ? {
            browserNotificationsEnabled: true,
            dutyReminderHours: null,
            membershipId: authorization.membership.id,
          }
        : {
            browserNotificationsEnabled: row.browserNotificationsEnabled === 1,
            dutyReminderHours: row.dutyReminderHours ?? null,
            membershipId: authorization.membership.id,
          };
    });
  }

  public async updateMyPreferences(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateMemberNotificationPreferencesInput,
  ): Promise<MemberNotificationPreferences> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const [currentRow] = await transaction
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.membershipId, authorization.membership.id))
        .limit(1);
      const current =
        currentRow === undefined
          ? { browserNotificationsEnabled: true, dutyReminderHours: null }
          : {
              browserNotificationsEnabled: currentRow.browserNotificationsEnabled === 1,
              dutyReminderHours: currentRow.dutyReminderHours ?? null,
            };
      const dutyReminderHours =
        input.dutyReminderHours === undefined
          ? current.dutyReminderHours
          : parseReminderHoursOrDisable(input.dutyReminderHours);
      const browserNotificationsEnabled =
        input.browserNotificationsEnabled ?? current.browserNotificationsEnabled;

      await transaction
        .insert(notificationPreferences)
        .values({
          browserNotificationsEnabled: browserNotificationsEnabled ? 1 : 0,
          dutyReminderHours,
          id: randomUUID(),
          membershipId: authorization.membership.id,
          version: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            browserNotificationsEnabled: browserNotificationsEnabled ? 1 : 0,
            dutyReminderHours,
            version: sql`${notificationPreferences.version} + 1`,
          },
        });

      return {
        browserNotificationsEnabled,
        dutyReminderHours,
        membershipId: authorization.membership.id,
      };
    });
  }

  public getPushConfiguration(): PushConfiguration {
    return { vapidPublicKey: this.pushDispatcher.vapidPublicKey };
  }

  public async savePushSubscription(
    identity: AuthenticatedIdentity,
    input: WebPushSubscriptionInput,
  ): Promise<void> {
    validatePushSubscription(input);

    return withTransaction(this.databaseClient, async (transaction) => {
      const userId = await requireActiveUser(transaction, identity);
      await transaction
        .delete(webPushSubscriptions)
        .where(
          and(
            eq(webPushSubscriptions.userId, userId),
            eq(webPushSubscriptions.endpoint, input.endpoint),
          ),
        );
      await transaction.insert(webPushSubscriptions).values({
        auth: input.keys.auth,
        endpoint: input.endpoint,
        id: randomUUID(),
        p256dh: input.keys.p256dh,
        userId,
      });
    });
  }

  public async deletePushSubscriptions(identity: AuthenticatedIdentity): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const userId = await requireActiveUser(transaction, identity);
      await transaction.delete(webPushSubscriptions).where(eq(webPushSubscriptions.userId, userId));
    });
  }
}

function parseReminderHours(value: readonly number[]): number[] {
  try {
    return validateReminderHours(value);
  } catch {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '提醒时间必须是 1 到 720 小时之间、互不相同的 1 到 5 个整数。',
    });
  }
}

function parseReminderHoursOrDisable(value: readonly number[] | null): number[] | null {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value) && value.length === 0) {
    return [];
  }
  return parseReminderHours(value);
}

function validatePushSubscription(input: WebPushSubscriptionInput): void {
  const endpointIsValid =
    typeof input.endpoint === 'string' &&
    input.endpoint.length > 0 &&
    input.endpoint.length <= maximumEndpointLength &&
    (input.endpoint.startsWith('https://') || input.endpoint.startsWith('http://localhost'));
  const p256dhIsValid =
    typeof input.keys.p256dh === 'string' &&
    input.keys.p256dh.length > 0 &&
    input.keys.p256dh.length <= maximumP256dhLength;
  const authIsValid =
    typeof input.keys.auth === 'string' &&
    input.keys.auth.length > 0 &&
    input.keys.auth.length <= maximumAuthLength;

  if (!endpointIsValid || !p256dhIsValid || !authIsValid) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '浏览器推送订阅信息无效。',
    });
  }
}
