import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  CalendarRoleSummary,
  CalendarShiftTypeSummary,
  GuestCalendarReadModel,
} from '@schedule/contracts';
import {
  groups,
  groupMemberContacts,
  leaveRequests,
  scheduleEvents,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { assertBusinessMonthContainsDate } from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull, ne, or } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { isMobilePhoneConsentEffective } from '../groups/mobile-phone-consent.js';
import { GroupPermissionService } from '../groups/permission-service.js';

export const calendarMarkerEventTypes = [
  'swap_completed',
  'leave_cover_completed',
  'duty_adjustment_completed',
  'duty_adjustment_revoked',
  'swap_revoked',
] as const;

export function toCalendarChangeMarker(eventType: string): CalendarChangeMarker | undefined {
  switch (eventType) {
    case 'swap_completed':
      return 'swap';
    case 'leave_cover_completed':
      return 'leave-cover';
    case 'duty_adjustment_completed':
      return 'overtime';
    default:
      return undefined;
  }
}

interface ContactRow {
  readonly isConfirmed: number;
  readonly membershipId: string;
  readonly mobilePhone: string | null;
  readonly mobilePhoneConsentFingerprint: string | null;
  readonly mobilePhoneConsentNoticeVersion: string | null;
  readonly mobilePhoneConsentRevokedAt: Date | null;
  readonly mobilePhoneConsentedAt: Date | null;
  readonly shortPhone: string | null;
}

type CalendarContactVisibility = 'member' | 'guest';

export class CalendarQuery {
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async readMonth(
    identity: AuthenticatedIdentity,
    groupId: string,
    businessMonth: string,
  ): Promise<CalendarReadModel> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const monthStart = assertValidBusinessMonth(businessMonth);
      const periods = await transaction
        .select({ id: schedulePeriods.id, scheduleRoleId: schedulePeriods.scheduleRoleId })
        .from(schedulePeriods)
        .where(
          and(
            eq(schedulePeriods.groupId, authorization.group.id),
            eq(schedulePeriods.businessMonth, monthStart),
            inArray(schedulePeriods.status, ['published', 'past']),
            isNull(schedulePeriods.deletedAt),
          ),
        )
        .orderBy(asc(schedulePeriods.scheduleRoleId), asc(schedulePeriods.revision));

      return this.buildCalendar(
        transaction,
        authorization.group.id,
        businessMonth,
        periods,
        'member',
        true,
      );
    });
  }

  public async readPeriod(
    identity: AuthenticatedIdentity,
    groupId: string,
    schedulePeriodId: string,
  ): Promise<CalendarReadModel> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const [period] = await transaction
        .select({
          businessMonth: schedulePeriods.businessMonth,
          id: schedulePeriods.id,
          scheduleRoleId: schedulePeriods.scheduleRoleId,
        })
        .from(schedulePeriods)
        .where(
          and(
            eq(schedulePeriods.id, schedulePeriodId),
            eq(schedulePeriods.groupId, authorization.group.id),
            isNull(schedulePeriods.deletedAt),
          ),
        )
        .limit(1);
      if (period === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '排班发布记录不存在或不可用。',
        });
      }

      return this.buildCalendar(
        transaction,
        authorization.group.id,
        period.businessMonth.slice(0, 7),
        [period],
        'member',
        true,
      );
    });
  }

  public async readLoggedInGuestMonth(
    identity: AuthenticatedIdentity,
    groupId: string,
    businessMonth: string,
  ): Promise<GuestCalendarReadModel> {
    await withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewGuestCalendar',
      );
    });

    const [group] = await this.databaseClient.database
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
      .limit(1);
    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在或不可用。',
      });
    }

    return this.readGuestMonthForGroup(group, businessMonth);
  }

  public async readGuestMonthByGroupId(
    groupId: string,
    businessMonth: string,
  ): Promise<GuestCalendarReadModel> {
    assertValidBusinessMonth(businessMonth);
    const [group] = await this.databaseClient.database
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
      .limit(1);
    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在或不可用。',
      });
    }

    return this.readGuestMonthForGroup(group, businessMonth);
  }

  private async readGuestMonthForGroup(
    group: { readonly id: string; readonly name: string },
    businessMonth: string,
  ): Promise<GuestCalendarReadModel> {
    const calendar = await withTransaction(this.databaseClient, async (transaction) => {
      const periods = await transaction
        .select({ id: schedulePeriods.id, scheduleRoleId: schedulePeriods.scheduleRoleId })
        .from(schedulePeriods)
        .where(
          and(
            eq(schedulePeriods.groupId, group.id),
            eq(schedulePeriods.businessMonth, `${businessMonth}-01`),
            inArray(schedulePeriods.status, ['published', 'past']),
            isNull(schedulePeriods.deletedAt),
          ),
        )
        .orderBy(asc(schedulePeriods.scheduleRoleId), asc(schedulePeriods.revision));
      return this.buildCalendar(transaction, group.id, businessMonth, periods, 'guest', false);
    });
    return { calendar, groupName: group.name };
  }

  private async buildCalendar(
    transaction: DatabaseTransaction,
    groupId: string,
    businessMonth: string,
    periods: readonly { readonly id: string; readonly scheduleRoleId: string }[],
    contactVisibility: CalendarContactVisibility,
    includeChangeMarkers: boolean,
  ): Promise<CalendarReadModel> {
    if (periods.length === 0) {
      return emptyCalendar(groupId, businessMonth);
    }

    const periodIds = periods.map((period) => period.id);
    const roleIds = [...new Set(periods.map((period) => period.scheduleRoleId))];
    const [assignments, roles, markerEvents] = await Promise.all([
      transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            inArray(shiftAssignments.schedulePeriodId, periodIds),
            isNull(shiftAssignments.deletedAt),
          ),
        )
        .orderBy(
          asc(shiftAssignments.businessDate),
          asc(shiftAssignments.slotPosition),
          asc(shiftAssignments.id),
        ),
      transaction
        .select({ id: scheduleRoles.id, name: scheduleRoles.name })
        .from(scheduleRoles)
        .where(and(inArray(scheduleRoles.id, roleIds), isNull(scheduleRoles.deletedAt))),
      includeChangeMarkers
        ? transaction
            .select({
              affectedShiftIds: scheduleEvents.affectedShiftIds,
              eventType: scheduleEvents.eventType,
              occurredAt: scheduleEvents.occurredAt,
            })
            .from(scheduleEvents)
            .leftJoin(
              leaveRequests,
              and(
                eq(scheduleEvents.objectType, 'leave_cover'),
                eq(scheduleEvents.objectId, leaveRequests.id),
              ),
            )
            .where(
              and(
                eq(scheduleEvents.groupId, groupId),
                inArray(scheduleEvents.schedulePeriodId, periodIds),
                inArray(scheduleEvents.eventType, [...calendarMarkerEventTypes]),
                or(
                  ne(scheduleEvents.eventType, 'leave_cover_completed'),
                  and(isNull(leaveRequests.deletedAt), eq(leaveRequests.status, 'approved')),
                ),
              ),
            )
            .orderBy(asc(scheduleEvents.occurredAt), asc(scheduleEvents.id))
        : Promise.resolve([]),
    ]);

    const roleNamesById = new Map(roles.map((role) => [role.id, role.name]));
    const scheduleRoleIdByPeriodId = new Map(
      periods.map((period) => [period.id, period.scheduleRoleId]),
    );
    const markersByShiftId = includeChangeMarkers ? collectMarkers(markerEvents) : new Map();
    const memberNamesById = collectMemberNames(assignments);
    const membershipIds = [...memberNamesById.keys()].sort();
    const contactsByMembershipId = await this.readContacts(transaction, membershipIds);

    return {
      assignments: assignments.map((assignment) =>
        toCalendarAssignment(assignment, scheduleRoleIdByPeriodId, roleNamesById, markersByShiftId),
      ),
      businessMonth,
      groupId,
      members: buildMembers(groupId, memberNamesById, contactsByMembershipId, contactVisibility),
      roles: buildRoleSummaries(roleNamesById),
      shiftTypes: buildShiftTypeSummaries(assignments),
    };
  }

  private async readContacts(
    transaction: DatabaseTransaction,
    membershipIds: readonly string[],
  ): Promise<ReadonlyMap<string, ContactRow>> {
    if (membershipIds.length === 0) {
      return new Map();
    }

    const contacts = await transaction
      .select({
        isConfirmed: groupMemberContacts.isConfirmed,
        membershipId: groupMemberContacts.membershipId,
        mobilePhone: groupMemberContacts.mobilePhone,
        mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
        mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
        mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
        mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
        shortPhone: groupMemberContacts.shortPhone,
      })
      .from(groupMemberContacts)
      .where(
        and(
          inArray(groupMemberContacts.membershipId, membershipIds),
          isNull(groupMemberContacts.deletedAt),
        ),
      );

    return new Map(contacts.map((contact) => [contact.membershipId, contact]));
  }
}

function collectMarkers(
  events: readonly {
    readonly affectedShiftIds: readonly string[];
    readonly eventType: string;
  }[],
): ReadonlyMap<string, readonly CalendarChangeMarker[]> {
  const markersByShiftId = new Map<string, CalendarChangeMarker[]>();
  for (const event of events) {
    const revokedMarker =
      event.eventType === 'swap_revoked'
        ? 'swap'
        : event.eventType === 'duty_adjustment_revoked'
          ? 'overtime'
          : undefined;
    if (revokedMarker !== undefined) {
      for (const shiftId of event.affectedShiftIds) {
        markersByShiftId.set(
          shiftId,
          (markersByShiftId.get(shiftId) ?? []).filter((marker) => marker !== revokedMarker),
        );
      }
      continue;
    }
    const marker = toCalendarChangeMarker(event.eventType);
    if (marker === undefined) {
      continue;
    }

    for (const shiftId of event.affectedShiftIds) {
      const markers = markersByShiftId.get(shiftId) ?? [];
      if (!markers.includes(marker)) {
        markers.push(marker);
      }
      markersByShiftId.set(shiftId, markers);
    }
  }

  return markersByShiftId;
}

function collectMemberNames(
  assignments: readonly (typeof shiftAssignments.$inferSelect)[],
): ReadonlyMap<string, string> {
  const memberNamesById = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.plannedMembershipId !== null && assignment.plannedMemberName !== null) {
      memberNamesById.set(assignment.plannedMembershipId, assignment.plannedMemberName);
    }
    if (assignment.actualMembershipId !== null && assignment.actualMemberName !== null) {
      memberNamesById.set(assignment.actualMembershipId, assignment.actualMemberName);
    }
  }

  return memberNamesById;
}

function toCalendarAssignment(
  assignment: typeof shiftAssignments.$inferSelect,
  scheduleRoleIdByPeriodId: ReadonlyMap<string, string>,
  roleNamesById: ReadonlyMap<string, string>,
  markersByShiftId: ReadonlyMap<string, readonly CalendarChangeMarker[]>,
): CalendarDutyAssignment {
  const scheduleRoleId = scheduleRoleIdByPeriodId.get(assignment.schedulePeriodId) ?? '';

  return {
    ...(assignment.actualMemberName === null
      ? {}
      : { actualMemberName: assignment.actualMemberName }),
    ...(assignment.actualMembershipId === null
      ? {}
      : { actualMembershipId: assignment.actualMembershipId }),
    businessDate: assignment.businessDate,
    changeMarkers: markersByShiftId.get(assignment.id) ?? [],
    endsAt: assignment.endsAt.toISOString(),
    id: assignment.id,
    ...(assignment.plannedMemberName === null
      ? {}
      : { plannedMemberName: assignment.plannedMemberName }),
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMembershipId: assignment.plannedMembershipId }),
    schedulePeriodId: assignment.schedulePeriodId,
    scheduleRoleId,
    scheduleRoleName: roleNamesById.get(scheduleRoleId) ?? '',
    shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
    shiftTypeColor: assignment.shiftTypeColor,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: assignment.shiftTypeName,
    shiftTypeTextColor: assignment.shiftTypeTextColor,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt.toISOString(),
  };
}

function buildMembers(
  groupId: string,
  memberNamesById: ReadonlyMap<string, string>,
  contactsByMembershipId: ReadonlyMap<string, ContactRow>,
  contactVisibility: CalendarContactVisibility,
): CalendarDutyMember[] {
  return [...memberNamesById.entries()]
    .map(([membershipId, realName]) => {
      const contact = contactsByMembershipId.get(membershipId);
      const mobilePhoneVisible =
        contact !== undefined &&
        contactVisibility === 'member' &&
        isMobilePhoneConsentEffective(groupId, membershipId, contact);
      const shortPhoneVisible = contactVisibility === 'member' || contact?.isConfirmed === 1;
      return {
        isConfirmed: contact?.isConfirmed === 1,
        membershipId,
        realName,
        ...(contact?.mobilePhone === null ||
        contact?.mobilePhone === undefined ||
        !mobilePhoneVisible
          ? {}
          : { mobilePhone: contact.mobilePhone }),
        ...(contact?.shortPhone === null || contact?.shortPhone === undefined || !shortPhoneVisible
          ? {}
          : { shortPhone: contact.shortPhone }),
      };
    })
    .sort(
      (first, second) =>
        first.realName.localeCompare(second.realName, 'zh-Hans-CN') ||
        first.membershipId.localeCompare(second.membershipId),
    );
}

function buildRoleSummaries(roleNamesById: ReadonlyMap<string, string>): CalendarRoleSummary[] {
  return [...roleNamesById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort(
      (first, second) =>
        first.name.localeCompare(second.name, 'zh-Hans-CN') || first.id.localeCompare(second.id),
    );
}

function buildShiftTypeSummaries(
  assignments: readonly (typeof shiftAssignments.$inferSelect)[],
): CalendarShiftTypeSummary[] {
  const shiftTypesById = new Map<string, CalendarShiftTypeSummary>();
  for (const assignment of assignments) {
    if (shiftTypesById.has(assignment.shiftTypeId)) {
      continue;
    }

    shiftTypesById.set(assignment.shiftTypeId, {
      abbreviation: assignment.shiftTypeAbbreviation,
      color: assignment.shiftTypeColor,
      crossesMidnight: assignment.crossesMidnight === 1,
      ...(assignment.shiftEndTime === null
        ? {}
        : { endTime: normalizeTime(assignment.shiftEndTime) }),
      id: assignment.shiftTypeId,
      isAllDay: assignment.isAllDay === 1,
      name: assignment.shiftTypeName,
      ...(assignment.shiftStartTime === null
        ? {}
        : { startTime: normalizeTime(assignment.shiftStartTime) }),
      textColor: assignment.shiftTypeTextColor,
    });
  }

  return [...shiftTypesById.values()].sort(
    (first, second) =>
      first.name.localeCompare(second.name, 'zh-Hans-CN') || first.id.localeCompare(second.id),
  );
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function assertValidBusinessMonth(businessMonth: string): string {
  try {
    assertBusinessMonthContainsDate(businessMonth, `${businessMonth}-01`);
  } catch (error) {
    throw validationError(error instanceof Error ? error.message : '查询月份格式无效。');
  }

  return `${businessMonth}-01`;
}

function emptyCalendar(groupId: string, businessMonth: string): CalendarReadModel {
  return {
    assignments: [],
    businessMonth,
    groupId,
    members: [],
    roles: [],
    shiftTypes: [],
  };
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
