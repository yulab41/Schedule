import { createHash } from 'node:crypto';

import type {
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  ManualApplyConflict,
  ManualApplyPreview,
  PreviewManualTemplateApplyRequest,
  ScheduleGenerationRoleCount,
  ScheduleGenerationShiftTypeCount,
  ScheduleGenerationStatistics,
  ScheduleGenerationVacancy,
  ScheduleGenerationWarning,
  SchedulePeriodSummary,
  SchedulePreviewAssignment,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  groupMemberships,
  manualScheduleCells,
  manualScheduleTemplateMembers,
  manualScheduleTemplates,
  memberScheduleRoles,
  scheduleRoles,
  schedulePeriods,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import {
  applyManualTemplate,
  type GeneratedRotationAssignment,
  type ManualApplyMember,
  type ManualApplyShiftType,
} from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';
import {
  isConflictBlockedError,
  writeConflictNotification,
} from '../notifications/conflict-notifier.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import {
  ScheduleRepository,
  type CreateShiftAssignmentInput,
} from '../schedules/schedule-repository.js';
import { toLatestData, toPeriodSummary } from '../schedules/shared.js';

interface ApplyContext {
  readonly assignments: readonly GeneratedRotationAssignment[];
  readonly preview: ManualApplyPreview;
  readonly template: ManualApplyTemplateRow;
}

interface ManualApplyTemplateRow {
  readonly cycleDays: number;
  readonly id: string;
  readonly scheduleRoleId: string;
  readonly startDate: string;
  readonly version: number;
}

interface MutableShiftTypeCount {
  assignmentCount: number;
  countedAssignmentCount: number;
  shiftTypeAbbreviation: string;
  shiftTypeId: string;
  shiftTypeName: string;
}

interface MutableRoleCount {
  assignmentCount: number;
  countedAssignmentCount: number;
  scheduleRoleId: string;
  scheduleRoleName: string;
  vacancyCount: number;
}

export class ManualScheduleApplyService {
  private readonly eventWriter = new EventWriter();
  private readonly notificationWriter = new NotificationWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly repository: ScheduleRepository,
  ) {
    this.statisticsService = new StatisticsService(this.databaseClient);
  }

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    templateId: string,
    input: PreviewManualTemplateApplyRequest,
  ): Promise<ManualApplyPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const context = await this.loadApplyContext(
        transaction,
        authorization,
        templateId,
        input.expectedRulesVersion,
        input.endDate,
      );

      return context.preview;
    });
  }

  public async apply(
    identity: AuthenticatedIdentity,
    groupId: string,
    templateId: string,
    input: ApplyManualScheduleTemplateRequest,
  ): Promise<AppliedManualScheduleTemplateResult> {
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );

        return withIdempotentOperation(
          transaction,
          {
            actorUserId: authorization.user.id,
            operationId: input.operationId,
            requestFingerprint: createApplyFingerprint({
              acknowledgeBlockers: input.acknowledgeBlockers === true,
              endDate: input.endDate ?? null,
              expectedRulesVersion: input.expectedRulesVersion,
              groupId: authorization.group.id,
              publishMode: input.publishMode ?? null,
              replacePublished: input.replacePublished === true,
              replaceExistingDrafts: input.replaceExistingDrafts === true,
              templateId,
            }),
            scope: 'manual_schedule_template_apply',
          },
          () => this.runApplication(transaction, authorization, templateId, input),
        );
      });
    } catch (error) {
      if (error instanceof ApiError && isConflictBlockedError(error)) {
        await writeConflictNotification(this.databaseClient, {
          groupId,
          identity,
          operationId: input.operationId,
          preview: error.latestData?.preview,
        });
      }
      throw error;
    }
  }

  private async runApplication(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    templateId: string,
    input: ApplyManualScheduleTemplateRequest,
  ): Promise<AppliedManualScheduleTemplateResult> {
    const context = await this.loadApplyContext(
      transaction,
      authorization,
      templateId,
      input.expectedRulesVersion,
      input.endDate,
    );
    const publishMode = input.publishMode ?? authorization.group.schedulePublishMode;
    assertPublicationBlockers(context.preview, publishMode, input.acknowledgeBlockers === true);

    const assignmentsByMonth = groupAssignmentsByMonth(context.assignments);
    if (input.replaceExistingDrafts === true) {
      for (const businessMonth of [...assignmentsByMonth.keys()]) {
        await this.repository.softDeleteDraftsInTransaction(
          transaction,
          authorization.group.id,
          context.template.scheduleRoleId,
          businessMonth,
        );
      }
    }
    if (publishMode === 'published' && input.replacePublished !== true) {
      for (const businessMonth of [...assignmentsByMonth.keys()]) {
        const [existingPublished] = await transaction
          .select({ id: schedulePeriods.id })
          .from(schedulePeriods)
          .where(
            and(
              eq(schedulePeriods.groupId, authorization.group.id),
              eq(schedulePeriods.scheduleRoleId, context.template.scheduleRoleId),
              eq(schedulePeriods.businessMonth, `${businessMonth}-01`),
              eq(schedulePeriods.status, 'published'),
              isNull(schedulePeriods.deletedAt),
            ),
          )
          .limit(1)
          .for('update');
        if (existingPublished !== undefined) {
          throw new ApiError({
            code: 'CONFLICT',
            latestData: toLatestData({
              existingPublishedPeriodId: existingPublished.id,
              status: 'published',
            }),
            statusCode: 409,
            userMessage: '该岗位该月份已有已发布排班，请确认覆盖发布。',
          });
        }
      }
    }
    const periods: SchedulePeriodSummary[] = [];
    const appliedEventIds: string[] = [];
    for (const businessMonth of [...assignmentsByMonth.keys()].sort()) {
      const assignments = assignmentsByMonth.get(businessMonth);
      if (assignments === undefined || assignments.length === 0) {
        continue;
      }
      const draft = await this.repository.createDraftInTransaction(transaction, {
        actorUserId: authorization.user.id,
        assignments,
        businessMonth,
        expectedRulesVersion: input.expectedRulesVersion,
        groupId: authorization.group.id,
        operationId: input.operationId,
        scheduleRoleId: context.template.scheduleRoleId,
      });
      const period =
        publishMode === 'published'
          ? await this.repository.publishInTransaction(transaction, {
              actorUserId: authorization.user.id,
              expectedVersion: draft.version,
              operationId: input.operationId,
              schedulePeriodId: draft.id,
            })
          : draft;
      periods.push(toPeriodSummary(period));

      const appliedEventId = await this.eventWriter.append(transaction, {
        affectedMembershipIds: getAffectedMembershipIds(context.assignments),
        afterData: {
          applyEndDate: context.preview.applyEndDate,
          applyStartDate: context.preview.applyStartDate,
          businessMonth,
          cycleDays: context.template.cycleDays,
          publishMode,
          rulesVersion: context.preview.rulesVersion,
          templateId: context.template.id,
          templateVersion: context.template.version,
        },
        eventStatus: 'completed',
        eventType: 'manual_schedule_template_applied',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: context.template.id,
        objectType: 'manual_schedule_template',
        operationId: input.operationId,
        operatorUserId: authorization.user.id,
        schedulePeriodId: period.id,
      });
      appliedEventIds.push(appliedEventId);
      if (publishMode === 'published') {
        await this.statisticsService.refreshInTransaction(
          transaction,
          authorization.group.id,
          `${businessMonth}-01`,
          appliedEventId,
        );
      }
    }
    const firstAppliedEventId = appliedEventIds[0];
    if (publishMode === 'published' && firstAppliedEventId !== undefined) {
      await this.notificationWriter.append(transaction, {
        body: '手动模板已应用并发布，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_generated',
        objectId: context.template.id,
        objectType: 'manual_schedule_template',
        payload: { publishMode, source: 'manual_template', templateId: context.template.id },
        recipientMembershipIds: getAffectedMembershipIds(context.assignments),
        scheduleEventId: firstAppliedEventId,
        title: '排班已生成',
      });
    }

    return {
      operationId: input.operationId,
      periods,
      preview: context.preview,
      publishMode,
      status: publishMode === 'published' ? 'published' : 'draft',
      templateId: context.template.id,
      templateVersion: context.template.version,
    };
  }

  private async loadApplyContext(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    templateId: string,
    expectedRulesVersion: number,
    endDate: string | undefined,
  ): Promise<ApplyContext> {
    if (authorization.group.rulesVersion !== expectedRulesVersion) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { rulesVersion: authorization.group.rulesVersion },
        statusCode: 409,
        userMessage: '排班规则已更新，请刷新后重新应用模板。',
      });
    }

    const template = await this.lockTemplate(transaction, authorization.group.id, templateId);
    const [role] = await transaction
      .select({ name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, template.scheduleRoleId),
          eq(scheduleRoles.groupId, authorization.group.id),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    if (role === undefined) {
      throw notFound('模板关联的排班角色不存在或不可用。');
    }

    const [templateMembers, templateCells] = await Promise.all([
      transaction
        .select()
        .from(manualScheduleTemplateMembers)
        .where(
          and(
            eq(manualScheduleTemplateMembers.templateId, template.id),
            isNull(manualScheduleTemplateMembers.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleTemplateMembers.membershipId)),
      transaction
        .select()
        .from(manualScheduleCells)
        .where(
          and(
            eq(manualScheduleCells.templateId, template.id),
            isNull(manualScheduleCells.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleCells.cycleDay), asc(manualScheduleCells.membershipId)),
    ]);

    const membershipIds = [...new Set(templateMembers.map((member) => member.membershipId))];
    const shiftTypeIds = [...new Set(templateCells.map((cell) => cell.shiftTypeId))];
    const [currentMembers, currentShiftTypes, memberNames] = await Promise.all([
      this.readCurrentRoleMembers(transaction, template.scheduleRoleId, membershipIds),
      this.readCurrentShiftTypes(transaction, authorization.group.id, shiftTypeIds),
      this.readMemberNames(transaction, membershipIds),
    ]);

    const currentMembersById = new Map(
      currentMembers.map((member) => [member.membershipId, member]),
    );
    const currentShiftTypesById = new Map(
      currentShiftTypes.map((shiftType) => [shiftType.id, shiftType]),
    );
    const memberNamesById = new Map(
      memberNames.map((member) => [member.membershipId, member.realName]),
    );

    const members: ManualApplyMember[] = templateMembers.map((templateMember) => {
      const current = currentMembersById.get(templateMember.membershipId);
      return {
        ...(current?.effectiveFrom === undefined ? {} : { effectiveFrom: current.effectiveFrom }),
        ...(current?.effectiveTo === undefined ? {} : { effectiveTo: current.effectiveTo }),
        currentMemberScheduleRoleVersion: current?.version ?? 0,
        isActive: current?.isActive ?? false,
        membershipId: templateMember.membershipId,
        realName: memberNamesById.get(templateMember.membershipId) ?? '',
      };
    });
    const shiftTypesForApply: ManualApplyShiftType[] = templateCells.map((cell) => {
      const shiftType = currentShiftTypesById.get(cell.shiftTypeId);
      if (
        shiftType === undefined ||
        shiftType.isEnabled !== 1 ||
        shiftType.startTime === null ||
        shiftType.endTime === null
      ) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          latestData: {
            shiftTypeId: cell.shiftTypeId,
            templateId: template.id,
          },
          statusCode: 400,
          userMessage: '模板包含已停用或不再可用的班种，请先修正模板后再应用。',
        });
      }

      return toManualApplyShiftType(shiftType);
    });
    const distinctShiftTypes = [
      ...new Map(
        shiftTypesForApply.map((shiftType) => [shiftType.id, shiftType] as const),
      ).values(),
    ];

    const domainResult = applyManualTemplate({
      cells: templateCells.map((cell) => ({
        cycleDay: cell.cycleDay,
        membershipId: cell.membershipId,
        shiftTypeId: cell.shiftTypeId,
      })),
      cycleDays: template.cycleDays,
      ...(endDate === undefined ? {} : { endDate }),
      members,
      scheduleRoleId: template.scheduleRoleId,
      shiftTypes: distinctShiftTypes,
      startDate: template.startDate,
    });

    return {
      assignments: domainResult.assignments,
      preview: buildPreview({
        applyStartDate: template.startDate,
        cycleDays: template.cycleDays,
        domainResult,
        endDate,
        memberNamesById,
        roleName: role.name,
        rulesVersion: expectedRulesVersion,
        scheduleRoleId: template.scheduleRoleId,
        shiftTypesById: currentShiftTypesById,
        templateId: template.id,
        templateVersion: template.version,
      }),
      template,
    };
  }

  private async lockTemplate(
    transaction: DatabaseTransaction,
    groupId: string,
    templateId: string,
  ): Promise<ManualApplyTemplateRow> {
    const [template] = await transaction
      .select()
      .from(manualScheduleTemplates)
      .where(
        and(
          eq(manualScheduleTemplates.id, templateId),
          eq(manualScheduleTemplates.groupId, groupId),
          isNull(manualScheduleTemplates.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (template === undefined) {
      throw notFound('手动排班模板不存在或不可用。');
    }

    return template;
  }

  private async readCurrentRoleMembers(
    transaction: DatabaseTransaction,
    scheduleRoleId: string,
    membershipIds: readonly string[],
  ): Promise<
    ReadonlyArray<{
      readonly effectiveFrom?: string;
      readonly effectiveTo?: string;
      readonly isActive: boolean;
      readonly membershipId: string;
      readonly version: number;
    }>
  > {
    if (membershipIds.length === 0) {
      return [];
    }

    const rows = await transaction
      .select({
        effectiveFrom: memberScheduleRoles.effectiveFrom,
        effectiveTo: memberScheduleRoles.effectiveTo,
        memberScheduleRoleDeletedAt: memberScheduleRoles.deletedAt,
        membershipDeletedAt: groupMemberships.deletedAt,
        membershipId: memberScheduleRoles.membershipId,
        membershipStatus: groupMemberships.status,
        userDeletedAt: users.deletedAt,
        userStatus: users.status,
        version: memberScheduleRoles.version,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(
        and(
          eq(memberScheduleRoles.scheduleRoleId, scheduleRoleId),
          inArray(memberScheduleRoles.membershipId, membershipIds),
          isNull(memberScheduleRoles.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
        ),
      )
      .for('update');
    const membersById = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      membersById.set(row.membershipId, row);
    }

    return membershipIds.flatMap((membershipId) => {
      const row = membersById.get(membershipId);
      if (row === undefined) {
        return [];
      }

      return [
        {
          ...(row.effectiveFrom === null ? {} : { effectiveFrom: row.effectiveFrom }),
          ...(row.effectiveTo === null ? {} : { effectiveTo: row.effectiveTo }),
          isActive:
            row.membershipStatus === 'active' &&
            row.userStatus === 'active' &&
            row.memberScheduleRoleDeletedAt === null &&
            row.membershipDeletedAt === null &&
            row.userDeletedAt === null,
          membershipId,
          version: row.version,
        },
      ];
    });
  }

  private async readCurrentShiftTypes(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeIds: readonly string[],
  ) {
    if (shiftTypeIds.length === 0) {
      return [];
    }

    return transaction
      .select()
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, groupId),
          inArray(shiftTypes.id, shiftTypeIds),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .for('update');
  }

  private async readMemberNames(
    transaction: DatabaseTransaction,
    membershipIds: readonly string[],
  ): Promise<readonly { readonly membershipId: string; readonly realName: string }[]> {
    if (membershipIds.length === 0) {
      return [];
    }

    return transaction
      .select({ membershipId: groupMemberships.id, realName: userProfiles.realName })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          inArray(groupMemberships.id, membershipIds),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      );
  }
}

function buildPreview(input: {
  readonly applyStartDate: string;
  readonly cycleDays: number;
  readonly domainResult: ReturnType<typeof applyManualTemplate>;
  readonly endDate: string | undefined;
  readonly memberNamesById: ReadonlyMap<string, string>;
  readonly roleName: string;
  readonly rulesVersion: number;
  readonly scheduleRoleId: string;
  readonly shiftTypesById: ReadonlyMap<string, typeof shiftTypes.$inferSelect>;
  readonly templateId: string;
  readonly templateVersion: number;
}): ManualApplyPreview {
  const assignments = input.domainResult.assignments.map((assignment) =>
    toPreviewAssignment(assignment, input.roleName, input.memberNamesById, input.shiftTypesById),
  );
  const memberNamesById = input.memberNamesById;

  return {
    applyEndDate: getApplyEndDate(input.applyStartDate, input.cycleDays, input.endDate),
    applyStartDate: input.applyStartDate,
    assignments,
    conflicts: input.domainResult.conflicts.map((conflict): ManualApplyConflict => {
      const memberName = memberNamesById.get(conflict.membershipId);
      return {
        assignmentBusinessKeys: conflict.assignmentBusinessKeys,
        code: conflict.code,
        ...(memberName === undefined ? {} : { memberName }),
        membershipId: conflict.membershipId,
      };
    }),
    continuousDutyWarnings: input.domainResult.continuousDutyWarnings.map(
      (warning): ScheduleGenerationWarning => {
        const memberName = memberNamesById.get(warning.membershipId);
        return {
          assignmentBusinessKeys: warning.assignmentBusinessKeys,
          code: warning.code,
          endsAt: warning.endsAt.toISOString(),
          membershipId: warning.membershipId,
          ...(memberName === undefined ? {} : { memberName }),
          startsAt: warning.startsAt.toISOString(),
        };
      },
    ),
    cycleDays: input.cycleDays,
    rulesVersion: input.rulesVersion,
    scheduleRoleId: input.scheduleRoleId,
    scheduleRoleName: input.roleName,
    statistics: buildStatistics(
      input.domainResult.assignments,
      input.domainResult.vacancies,
      input.shiftTypesById,
      input.roleName,
    ),
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    vacancies: input.domainResult.vacancies.map((vacancy): ScheduleGenerationVacancy => ({
      assignmentBusinessKey: vacancy.assignmentBusinessKey,
      businessDate: vacancy.businessDate,
      code: vacancy.code,
      scheduleRoleId: vacancy.scheduleRoleId,
      slotPosition: vacancy.slotPosition,
    })),
  };
}

function toPreviewAssignment(
  assignment: GeneratedRotationAssignment,
  roleName: string,
  memberNamesById: ReadonlyMap<string, string>,
  shiftTypesById: ReadonlyMap<string, typeof shiftTypes.$inferSelect>,
): SchedulePreviewAssignment {
  const shiftType = shiftTypesById.get(assignment.shiftTypeId);
  if (shiftType === undefined) {
    throw new Error('The manual apply references an unknown shift type.');
  }
  const memberName =
    assignment.plannedMembershipId === null
      ? undefined
      : memberNamesById.get(assignment.plannedMembershipId);

  return {
    businessDate: assignment.businessDate,
    endsAt: assignment.endsAt.toISOString(),
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMemberId: assignment.plannedMembershipId }),
    ...(memberName === undefined ? {} : { plannedMemberName: memberName }),
    scheduleRoleId: assignment.scheduleRoleId,
    scheduleRoleName: roleName,
    shiftTypeAbbreviation: shiftType.abbreviation,
    shiftTypeColor: shiftType.color,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: shiftType.name,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt.toISOString(),
  };
}

function buildStatistics(
  assignments: readonly GeneratedRotationAssignment[],
  vacancies: readonly ScheduleGenerationVacancy[],
  shiftTypesById: ReadonlyMap<string, typeof shiftTypes.$inferSelect>,
  roleName: string,
): ScheduleGenerationStatistics {
  const shiftTypeCounts = new Map<string, MutableShiftTypeCount>();
  let countedAssignmentCount = 0;
  for (const assignment of assignments) {
    const shiftType = shiftTypesById.get(assignment.shiftTypeId);
    if (shiftType === undefined) {
      continue;
    }
    const counted = shiftType.countsTowardStatistics === 1 ? 1 : 0;
    countedAssignmentCount += counted;
    const shiftTypeCount = shiftTypeCounts.get(shiftType.id) ?? {
      assignmentCount: 0,
      countedAssignmentCount: 0,
      shiftTypeAbbreviation: shiftType.abbreviation,
      shiftTypeId: shiftType.id,
      shiftTypeName: shiftType.name,
    };
    shiftTypeCount.assignmentCount += 1;
    shiftTypeCount.countedAssignmentCount += counted;
    shiftTypeCounts.set(shiftType.id, shiftTypeCount);
  }

  const roleCounts = new Map<string, MutableRoleCount>();
  for (const assignment of assignments) {
    const roleCount = roleCounts.get(assignment.scheduleRoleId) ?? {
      assignmentCount: 0,
      countedAssignmentCount: 0,
      scheduleRoleId: assignment.scheduleRoleId,
      scheduleRoleName: roleName,
      vacancyCount: 0,
    };
    const shiftType = shiftTypesById.get(assignment.shiftTypeId);
    roleCount.assignmentCount += 1;
    roleCount.countedAssignmentCount += shiftType?.countsTowardStatistics === 1 ? 1 : 0;
    roleCounts.set(assignment.scheduleRoleId, roleCount);
  }
  for (const vacancy of vacancies) {
    const roleCount = roleCounts.get(vacancy.scheduleRoleId);
    if (roleCount !== undefined) {
      roleCount.vacancyCount += 1;
    }
  }

  return {
    assignmentCount: assignments.length,
    byRole: [...roleCounts.values()].map((roleCount): ScheduleGenerationRoleCount => ({
      assignmentCount: roleCount.assignmentCount,
      countedAssignmentCount: roleCount.countedAssignmentCount,
      scheduleRoleId: roleCount.scheduleRoleId,
      scheduleRoleName: roleCount.scheduleRoleName,
      vacancyCount: roleCount.vacancyCount,
    })),
    byShiftType: [...shiftTypeCounts.values()].map(
      (shiftTypeCount): ScheduleGenerationShiftTypeCount => ({
        assignmentCount: shiftTypeCount.assignmentCount,
        countedAssignmentCount: shiftTypeCount.countedAssignmentCount,
        shiftTypeAbbreviation: shiftTypeCount.shiftTypeAbbreviation,
        shiftTypeId: shiftTypeCount.shiftTypeId,
        shiftTypeName: shiftTypeCount.shiftTypeName,
      }),
    ),
    countedAssignmentCount,
    vacancyCount: vacancies.length,
  };
}

function getApplyEndDate(
  applyStartDate: string,
  cycleDays: number,
  endDate: string | undefined,
): string {
  if (endDate !== undefined) {
    return endDate;
  }

  return addDays(applyStartDate, cycleDays - 1);
}

function groupAssignmentsByMonth(
  assignments: readonly GeneratedRotationAssignment[],
): ReadonlyMap<string, CreateShiftAssignmentInput[]> {
  const assignmentsByMonth = new Map<string, CreateShiftAssignmentInput[]>();
  for (const assignment of assignments) {
    const businessMonth = assignment.businessDate.slice(0, 7);
    const inputs = assignmentsByMonth.get(businessMonth) ?? [];
    inputs.push({
      businessDate: assignment.businessDate,
      shiftTypeId: assignment.shiftTypeId,
      slotPosition: assignment.slotPosition,
      ...(assignment.plannedMembershipId === null
        ? {}
        : { plannedMembershipId: assignment.plannedMembershipId }),
    });
    assignmentsByMonth.set(businessMonth, inputs);
  }

  return assignmentsByMonth;
}

function getAffectedMembershipIds(
  assignments: readonly GeneratedRotationAssignment[],
): readonly string[] {
  return [
    ...new Set(
      assignments.flatMap((assignment) =>
        assignment.plannedMembershipId === null ? [] : [assignment.plannedMembershipId],
      ),
    ),
  ];
}

function toManualApplyShiftType(shiftType: typeof shiftTypes.$inferSelect): ManualApplyShiftType {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    countsTowardStatistics: shiftType.countsTowardStatistics === 1,
    crossesMidnight: shiftType.crossesMidnight === 1,
    endTime: (shiftType.endTime as string).slice(0, 5),
    id: shiftType.id,
    isAllDay: shiftType.isAllDay === 1,
    isEnabled: true,
    name: shiftType.name,
    startTime: (shiftType.startTime as string).slice(0, 5),
    textColor: shiftType.textColor,
  };
}

function createApplyFingerprint(input: {
  readonly acknowledgeBlockers: boolean;
  readonly endDate: string | null;
  readonly expectedRulesVersion: number;
  readonly groupId: string;
  readonly publishMode: string | null;
  readonly replacePublished: boolean;
  readonly replaceExistingDrafts: boolean;
  readonly templateId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function assertPublicationBlockers(
  preview: ManualApplyPreview,
  publishMode: 'draft' | 'published',
  acknowledged: boolean,
): void {
  const hasBlockers = preview.conflicts.length > 0 || preview.vacancies.length > 0;
  if (publishMode === 'published' && hasBlockers && !acknowledged) {
    throw new ApiError({
      code: 'CONFLICT',
      latestData: toLatestData({ preview }),
      statusCode: 409,
      userMessage: '应用结果包含硬冲突或待处理空缺，确认后才能发布。',
    });
  }
}

function addDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The template start date must use the YYYY-MM-DD format.');
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function notFound(userMessage: string): ApiError {
  return new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage });
}
