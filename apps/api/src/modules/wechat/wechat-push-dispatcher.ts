import type { DatabaseClient, DatabaseTransaction, ScheduleDatabase } from '@schedule/database';
import {
  users,
  userProfiles,
  shiftAssignments,
  schedulePeriods,
  groupMemberships,
  scheduleEvents,
  groups,
  notificationPreferences,
} from '@schedule/database';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { collectMarkers } from '../calendar/calendar-query.js';

import {
  WechatGatewayError,
  type WechatGateway,
  type WechatSubscribeMessageData,
  type WechatSendPhaseObserver,
  type WechatMessageTargetVersion,
} from './wechat-gateway.js';
import {
  automaticWechatTargetVersion,
  buildBusinessTemplateData,
  businessNotificationTypes,
  readBusinessTemplateConfiguration,
} from './wechat-business-template.js';

export type WechatTemplateKind = 'dutyReminder' | 'business';

export interface WechatTemplateIds {
  readonly dutyReminder: string | undefined;
  readonly business?: string;
}

export function getWechatTemplateKind(notificationType: string): WechatTemplateKind | undefined {
  if (notificationType === 'duty_reminder') {
    return 'dutyReminder';
  }
  if (businessNotificationTypes.has(notificationType)) return 'business';
  return undefined;
}

export function readWechatTemplateIds(values: NodeJS.ProcessEnv = process.env): WechatTemplateIds {
  const business = readBusinessTemplateConfiguration(values);
  return {
    dutyReminder: values.WECHAT_DUTY_REMINDER_TEMPLATE_ID,
    ...(business ? { business: business.id } : {}),
  };
}

export interface WechatNotificationRecord {
  readonly shiftAssignmentId?: string | null;
  readonly groupId?: string | null;
  readonly dutyReminder?: WechatDutyReminder;
  readonly body: string;
  readonly id: string;
  readonly notificationType: string;
  readonly recipientUserId: string;
  readonly title: string;
  readonly payload?: Readonly<Record<string, unknown>> | null;
  readonly createdAt?: Date;
}

export interface WechatDutyReminder {
  readonly businessDate: string;
  readonly memberName: string;
  readonly shiftTypeName: string;
  readonly changed: boolean;
}

export const dutyReminderFieldKeys = ['thing6', 'character_string7', 'thing9', 'thing8'] as const;

type OpenidLookup = (
  userId: string,
  database?: ScheduleDatabase | DatabaseTransaction,
) => Promise<string | null>;

export class WechatPushDispatcher {
  public readonly isConfigured: boolean;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly gateway: WechatGateway,
    private readonly templateIds: WechatTemplateIds = readWechatTemplateIds(),
    private readonly findOpenid: OpenidLookup = defaultFindOpenid(databaseClient),
  ) {
    this.isConfigured = gateway.isConfigured;
  }

  public async send(
    notification: WechatNotificationRecord,
    database?: ScheduleDatabase | DatabaseTransaction,
    observe?: WechatSendPhaseObserver,
    targetVersion?: WechatMessageTargetVersion,
  ): Promise<{ readonly messageId: string | null }> {
    if (!this.gateway.isConfigured) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'WeChat gateway is not configured.',
      );
    }

    const openid = await this.findOpenid(notification.recipientUserId, database);
    if (openid === null || openid === undefined) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'Recipient has no WeChat openid.',
      );
    }

    const kind = getWechatTemplateKind(notification.notificationType);
    const templateId = kind === undefined ? undefined : this.templateIds[kind];
    if (templateId === undefined || templateId.length === 0) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'WeChat template is not configured.',
      );
    }

    const data =
      kind === 'business'
        ? await this.readBusinessData(notification, templateId, database)
        : buildSubscribeMessageData(
            notification.dutyReminder ?? (await this.readDuty(notification, database)),
          );
    const resolvedTarget = targetVersion ?? automaticWechatTargetVersion(notification.groupId);
    if (resolvedTarget !== 'formal')
      return this.gateway.sendSubscribeMessage(openid, templateId, data, observe, resolvedTarget);
    if (observe === undefined) return this.gateway.sendSubscribeMessage(openid, templateId, data);
    return this.gateway.sendSubscribeMessage(openid, templateId, data, observe);
  }

  private async readBusinessData(
    notification: WechatNotificationRecord,
    templateId: string,
    database?: ScheduleDatabase | DatabaseTransaction,
  ): Promise<WechatSubscribeMessageData> {
    const configuration = readBusinessTemplateConfiguration();
    if (
      !configuration ||
      configuration.id !== templateId ||
      !notification.groupId ||
      !notification.createdAt
    )
      throw missingBusinessData();
    const db = database ?? this.databaseClient.database;
    const [recipient] = await db
      .select({
        groupName: groups.name,
        memberName: userProfiles.realName,
        enabled: notificationPreferences.wechatNotificationsEnabled,
      })
      .from(groupMemberships)
      .innerJoin(groups, and(eq(groups.id, groupMemberships.groupId), isNull(groups.deletedAt)))
      .innerJoin(
        users,
        and(
          eq(users.id, groupMemberships.userId),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .innerJoin(
        userProfiles,
        and(eq(userProfiles.userId, users.id), isNull(userProfiles.deletedAt)),
      )
      .leftJoin(
        notificationPreferences,
        eq(notificationPreferences.membershipId, groupMemberships.id),
      )
      .where(
        and(
          eq(groupMemberships.groupId, notification.groupId),
          eq(groupMemberships.userId, notification.recipientUserId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);
    if (!recipient || recipient.enabled === 0) throw missingBusinessData();
    return buildBusinessTemplateData(configuration, {
      ...notification,
      ...recipient,
      createdAt: notification.createdAt,
    });
  }

  private async readDuty(
    notification: WechatNotificationRecord,
    database?: ScheduleDatabase | DatabaseTransaction,
  ): Promise<WechatDutyReminder> {
    if (!notification.shiftAssignmentId || !notification.groupId) throw missingDutyData();
    const db = database ?? this.databaseClient.database;
    const [assignment] = await db
      .select()
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.id, notification.shiftAssignmentId),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .limit(1);
    if (!assignment || assignment.startsAt <= new Date()) throw missingDutyData();
    const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
    if (!membershipId) throw missingDutyData();
    const [period] = await db
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .innerJoin(groups, and(eq(groups.id, schedulePeriods.groupId), isNull(groups.deletedAt)))
      .where(
        and(
          eq(schedulePeriods.id, assignment.schedulePeriodId),
          eq(schedulePeriods.groupId, notification.groupId),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1);
    const [member] = await db
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.id, membershipId),
          eq(groupMemberships.userId, notification.recipientUserId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);
    if (!period || !member) throw missingDutyData();
    const events = await db
      .select({
        affectedShiftIds: scheduleEvents.affectedShiftIds,
        eventType: scheduleEvents.eventType,
      })
      .from(scheduleEvents)
      .where(
        and(
          eq(scheduleEvents.groupId, notification.groupId),
          eq(scheduleEvents.schedulePeriodId, period.id),
          inArray(scheduleEvents.eventType, ['swap_completed', 'swap_revoked']),
        ),
      )
      .orderBy(asc(scheduleEvents.occurredAt), asc(scheduleEvents.id));
    return {
      businessDate: assignment.businessDate,
      memberName:
        (assignment.actualMembershipId !== null
          ? assignment.actualMemberName
          : assignment.plannedMemberName) ?? '',
      shiftTypeName: assignment.shiftTypeName,
      changed: collectMarkers(events).get(assignment.id)?.includes('swap') ?? false,
    };
  }
}

function defaultFindOpenid(databaseClient: DatabaseClient): OpenidLookup {
  return async (userId, database) => {
    const db = database ?? databaseClient.database;
    const [user] = await db
      .select({ wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.wechatOpenid ?? null;
  };
}

function missingDutyData(): WechatGatewayError {
  return new WechatGatewayError(
    null,
    null,
    'WECHAT_MESSAGE_SEND_FAILED',
    'Duty reminder data is missing or invalid.',
  );
}

function missingBusinessData(): WechatGatewayError {
  return new WechatGatewayError(
    null,
    null,
    'WECHAT_MESSAGE_SEND_FAILED',
    'Business notification configuration or recipient is unavailable.',
  );
}

function buildSubscribeMessageData(duty: WechatDutyReminder): WechatSubscribeMessageData {
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(duty.businessDate) ||
    !duty.memberName.trim() ||
    !duty.shiftTypeName.trim()
  )
    throw invalidTemplateData();
  const thing = (value: string) => {
    if (Array.from(value.trim()).length > 20) throw invalidTemplateData();
    return value.trim();
  };
  return {
    thing6: { value: duty.changed ? '是' : '否' },
    character_string7: { value: duty.businessDate },
    thing9: { value: thing(duty.memberName) },
    thing8: { value: thing(duty.shiftTypeName) },
  };
}

function invalidTemplateData(): WechatGatewayError {
  return new WechatGatewayError(
    null,
    null,
    'VALIDATION_FAILED',
    'Duty reminder template data invalid.',
  );
}
