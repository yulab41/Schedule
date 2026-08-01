import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  CalendarRoleSummary,
  CalendarShiftTypeSummary,
} from '@schedule/contracts';
import {
  groupMemberContacts,
  scheduleEvents,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { assertBusinessMonthContainsDate } from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';

export const calendarMarkerEventTypes = [
  'swap_completed',
  'leave_cover_completed',
  'assignment_manually_updated',
  'duty_adjustment_completed',
] as const;

export function toCalendarChangeMarker(eventType: string): CalendarChangeMarker | undefined {
  switch (eventType) {
    case 'swap_completed':
      return 'swap';
    case 'leave_cover_completed':
      return 'leave-cover';
    case 'assignment_manually_updated':
      return 'manual-adjustment';
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
  readonly shortPhone: string | null;
}

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
            eq(schedulePeriods.status, 'published'),
            isNull(schedulePeriods.deletedAt),
          ),
        )
        .orderBy(asc(schedulePeriods.scheduleRoleId), asc(schedulePeriods.revision));

      if (periods.length === 0) {
        return emptyCalendar(authorization.group.id, businessMonth);
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
        transaction
          .select({
            affectedShiftIds: scheduleEvents.affectedShiftIds,
            eventType: scheduleEvents.eventType,
          })
          .from(scheduleEvents)
          .where(
            and(
              eq(scheduleEvents.groupId, authorization.group.id),
              inArray(scheduleEvents.schedulePeriodId, periodIds),
              inArray(scheduleEvents.eventType, [...calendarMarkerEventTypes]),
            ),
          ),
      ]);

      const roleNamesById = new Map(roles.map((role) => [role.id, role.name]));
      const scheduleRoleIdByPeriodId = new Map(
        periods.map((period) => [period.id, period.scheduleRoleId]),
      );
      const markersByShiftId = collectMarkers(markerEvents);
      const memberNamesById = collectMemberNames(assignments);
      const membershipIds = [...memberNamesById.keys()].sort();
      const contactsByMembershipId = await this.readContacts(transaction, membershipIds);

      return {
        assignments: assignments.map((assignment) =>
          toCalendarAssignment(
            assignment,
            scheduleRoleIdByPeriodId,
            roleNamesById,
            markersByShiftId,
          ),
        ),
        businessMonth,
        groupId: authorization.group.id,
        members: buildMembers(memberNamesById, contactsByMembershipId),
        roles: buildRoleSummaries(roleNamesById),
        shiftTypes: buildShiftTypeSummaries(assignments),
      };
    });
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
  memberNamesById: ReadonlyMap<string, string>,
  contactsByMembershipId: ReadonlyMap<string, ContactRow>,
): CalendarDutyMember[] {
  return [...memberNamesById.entries()]
    .map(([membershipId, realName]) => {
      const contact = contactsByMembershipId.get(membershipId);
      return {
        isConfirmed: contact?.isConfirmed === 1,
        membershipId,
        realName,
        ...(contact?.mobilePhone === null || contact?.mobilePhone === undefined
          ? {}
          : { mobilePhone: contact.mobilePhone }),
        ...(contact?.shortPhone === null || contact?.shortPhone === undefined
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
