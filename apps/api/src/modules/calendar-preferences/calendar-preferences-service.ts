import type {
  CalendarPreferences,
  UpdateGroupCalendarDefaults,
  UpdateMemberCalendarPreferences,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { groupMemberships, groups, shiftTypes, withTransaction } from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { type GroupAuthorization, GroupPermissionService } from '../groups/permission-service.js';

export class CalendarPreferencesService {
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async get(identity: AuthenticatedIdentity, groupId: string): Promise<CalendarPreferences> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return this.readAuthorized(transaction, authorization);
    });
  }

  public async updateGroupDefaults(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupCalendarDefaults,
  ): Promise<CalendarPreferences> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const defaultMonthShiftTypeId = await this.validateShiftTypeId(
        transaction,
        authorization.group.id,
        input.defaultMonthShiftTypeId,
      );

      await transaction
        .update(groups)
        .set({
          defaultCalendarView: input.defaultView,
          defaultMonthShiftTypeId,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, authorization.group.id));

      return this.readAuthorized(transaction, authorization);
    });
  }

  public async updateMine(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateMemberCalendarPreferences,
  ): Promise<CalendarPreferences> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const defaultMonthShiftTypeId = await this.validateShiftTypeId(
        transaction,
        authorization.group.id,
        input.defaultMonthShiftTypeId,
      );

      await transaction
        .update(groupMemberships)
        .set({
          calendarViewOverride: input.defaultView,
          monthShiftTypeOverrideId: defaultMonthShiftTypeId,
          version: sql`${groupMemberships.version} + 1`,
        })
        .where(eq(groupMemberships.id, authorization.membership.id));

      return this.readAuthorized(transaction, authorization);
    });
  }

  private async readAuthorized(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
  ): Promise<CalendarPreferences> {
    const [groupRow] = await transaction
      .select({
        defaultMonthShiftTypeId: groups.defaultMonthShiftTypeId,
        defaultView: groups.defaultCalendarView,
      })
      .from(groups)
      .where(eq(groups.id, authorization.group.id))
      .limit(1);
    const [membershipRow] = await transaction
      .select({
        defaultMonthShiftTypeId: groupMemberships.monthShiftTypeOverrideId,
        defaultView: groupMemberships.calendarViewOverride,
      })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, authorization.membership.id))
      .limit(1);

    if (groupRow === undefined || membershipRow === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '日历偏好暂时无法读取，请刷新后重试。',
      });
    }

    const groupDefaultMonthShiftTypeId = await this.normalizeStoredShiftTypeId(
      transaction,
      authorization.group.id,
      groupRow.defaultMonthShiftTypeId,
    );
    const memberDefaultMonthShiftTypeId = await this.normalizeStoredShiftTypeId(
      transaction,
      authorization.group.id,
      membershipRow.defaultMonthShiftTypeId,
    );

    return {
      canManageGroupDefaults:
        authorization.user.isDeveloperAdmin ||
        authorization.membership.role === 'owner' ||
        authorization.membership.role === 'administrator',
      effectiveMonthShiftTypeId: memberDefaultMonthShiftTypeId ?? groupDefaultMonthShiftTypeId,
      effectiveView: membershipRow.defaultView ?? groupRow.defaultView,
      groupDefaultMonthShiftTypeId,
      groupDefaultView: groupRow.defaultView,
      groupId: authorization.group.id,
      memberDefaultMonthShiftTypeId,
      memberDefaultView: membershipRow.defaultView,
      membershipId: authorization.membership.id,
    };
  }

  private async validateShiftTypeId(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeId: string | null,
  ): Promise<string | null> {
    if (shiftTypeId === null) return null;
    const normalized = await this.normalizeStoredShiftTypeId(transaction, groupId, shiftTypeId);
    if (normalized === null) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '请选择当前群组中已启用的班种。',
      });
    }
    return normalized;
  }

  private async normalizeStoredShiftTypeId(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeId: string | null,
  ): Promise<string | null> {
    if (shiftTypeId === null) return null;
    const [shiftType] = await transaction
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.id, shiftTypeId),
          eq(shiftTypes.groupId, groupId),
          eq(shiftTypes.isEnabled, 1),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1);
    return shiftType?.id ?? null;
  }
}
