import { randomUUID } from 'node:crypto';

import type {
  CreateManualScheduleTemplateRequest,
  ManualScheduleTemplate,
  ManualScheduleTemplateCell,
  ManualScheduleTemplateMember,
  UpdateManualScheduleTemplateRequest,
} from '@schedule/contracts';
import {
  groupMemberships,
  manualScheduleCells,
  manualScheduleTemplateMembers,
  manualScheduleTemplates,
  memberScheduleRoles,
  scheduleRoles,
  shiftTypes,
  userProfiles,
  users,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';

const maximumCycleDays = 31;
const maximumTemplateMembers = 100;
const maximumTemplateCells = 5_000;

interface TemplateRow {
  readonly cycleDays: number;
  readonly groupId: string;
  readonly id: string;
  readonly scheduleRoleId: string;
  readonly startDate: string;
  readonly version: number;
}

interface CurrentRoleMemberRow {
  readonly isAvailable: boolean;
  readonly membershipId: string;
  readonly version: number;
}

interface CurrentShiftTypeRow {
  readonly abbreviation: string;
  readonly color: string;
  readonly configurationVersion: number;
  readonly id: string;
  readonly isEnabled: number;
  readonly name: string;
  readonly textColor: string;
}

export class ManualScheduleTemplateService {
  private readonly eventWriter = new EventWriter();
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async list(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<ManualScheduleTemplate[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const templates = await transaction
        .select()
        .from(manualScheduleTemplates)
        .where(
          and(
            eq(manualScheduleTemplates.groupId, authorization.group.id),
            isNull(manualScheduleTemplates.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleTemplates.createdAt), asc(manualScheduleTemplates.id));

      return this.readTemplates(
        transaction,
        templates.map((template) => template.id),
      );
    });
  }

  public async create(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const templateId = randomUUID();
      const references = await this.validateAndCaptureReferences(transaction, authorization, input);

      await transaction.insert(manualScheduleTemplates).values({
        cycleDays: input.cycleDays,
        groupId: authorization.group.id,
        id: templateId,
        scheduleRoleId: input.scheduleRoleId,
        startDate: input.startDate,
      });
      await this.replaceTemplateMembers(
        transaction,
        templateId,
        input.membershipIds,
        references.memberVersionsById,
      );
      await this.replaceTemplateCells(
        transaction,
        templateId,
        input.cells,
        references.shiftTypeVersionsById,
      );
      await this.eventWriter.append(transaction, {
        affectedMembershipIds: input.membershipIds,
        afterData: {
          cycleDays: input.cycleDays,
          scheduleRoleId: input.scheduleRoleId,
          startDate: input.startDate,
        },
        eventStatus: 'completed',
        eventType: 'manual_schedule_template_created',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: templateId,
        objectType: 'manual_schedule_template',
        operationId: randomUUID(),
        operatorUserId: authorization.user.id,
      });

      const [template] = await this.readTemplates(transaction, [templateId]);
      if (template === undefined) {
        throw new Error('A created manual schedule template could not be read back.');
      }

      return template;
    });
  }

  public async update(
    identity: AuthenticatedIdentity,
    groupId: string,
    templateId: string,
    input: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const template = await this.lockTemplate(transaction, authorization.group.id, templateId);
      assertExpectedVersion({
        actualVersion: template.version,
        expectedVersion: input.expectedVersion,
        id: template.id,
        objectType: 'manual_schedule_template',
        userMessage: '模板已被其他管理员更新，请刷新后重试。',
      });

      const references = await this.validateAndCaptureReferences(transaction, authorization, input);
      await transaction
        .update(manualScheduleTemplates)
        .set({
          cycleDays: input.cycleDays,
          startDate: input.startDate,
          version: sql`${manualScheduleTemplates.version} + 1`,
        })
        .where(eq(manualScheduleTemplates.id, template.id));
      await this.softDeleteTemplateContent(transaction, template.id);
      await this.replaceTemplateMembers(
        transaction,
        template.id,
        input.membershipIds,
        references.memberVersionsById,
      );
      await this.replaceTemplateCells(
        transaction,
        template.id,
        input.cells,
        references.shiftTypeVersionsById,
      );
      await this.eventWriter.append(transaction, {
        affectedMembershipIds: input.membershipIds,
        afterData: {
          cycleDays: input.cycleDays,
          scheduleRoleId: input.scheduleRoleId,
          startDate: input.startDate,
          version: template.version + 1,
        },
        beforeData: {
          cycleDays: template.cycleDays,
          scheduleRoleId: template.scheduleRoleId,
          startDate: template.startDate,
          version: template.version,
        },
        eventStatus: 'completed',
        eventType: 'manual_schedule_template_updated',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: template.id,
        objectType: 'manual_schedule_template',
        operationId: randomUUID(),
        operatorUserId: authorization.user.id,
      });

      const [updated] = await this.readTemplates(transaction, [template.id]);
      if (updated === undefined) {
        throw new Error('An updated manual schedule template could not be read back.');
      }

      return updated;
    });
  }

  public async delete(
    identity: AuthenticatedIdentity,
    groupId: string,
    templateId: string,
  ): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const template = await this.lockTemplate(transaction, authorization.group.id, templateId);
      await transaction
        .update(manualScheduleTemplates)
        .set({
          deletedAt: sql`current_timestamp(3)`,
          version: sql`${manualScheduleTemplates.version} + 1`,
        })
        .where(eq(manualScheduleTemplates.id, template.id));
      await this.softDeleteTemplateContent(transaction, template.id);
      await this.eventWriter.append(transaction, {
        afterData: {
          scheduleRoleId: template.scheduleRoleId,
          version: template.version + 1,
        },
        beforeData: {
          cycleDays: template.cycleDays,
          scheduleRoleId: template.scheduleRoleId,
          startDate: template.startDate,
          version: template.version,
        },
        eventStatus: 'completed',
        eventType: 'manual_schedule_template_deleted',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: template.id,
        objectType: 'manual_schedule_template',
        operationId: randomUUID(),
        operatorUserId: authorization.user.id,
      });
    });
  }

  private async validateAndCaptureReferences(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: CreateManualScheduleTemplateRequest,
  ): Promise<{
    readonly memberVersionsById: ReadonlyMap<string, number>;
    readonly shiftTypeVersionsById: ReadonlyMap<string, number>;
  }> {
    validateTemplateInput(input);

    const [role] = await transaction
      .select({ id: scheduleRoles.id })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, input.scheduleRoleId),
          eq(scheduleRoles.groupId, authorization.group.id),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (role === undefined) {
      throw notFound('排班角色不存在或不可用。');
    }

    const memberRows = await this.readRoleMembersForUpdate(
      transaction,
      role.id,
      input.membershipIds,
    );
    if (memberRows.length !== input.membershipIds.length) {
      throw validationError('模板成员必须是该排班角色的有效成员。');
    }
    const memberVersionsById = new Map(
      memberRows.map((member) => [member.membershipId, member.version]),
    );

    const shiftTypeIds = [...new Set(input.cells.map((cell) => cell.shiftTypeId))];
    const shiftTypeRows =
      shiftTypeIds.length === 0
        ? []
        : await transaction
            .select({
              configurationVersion: shiftTypes.configurationVersion,
              id: shiftTypes.id,
              isEnabled: shiftTypes.isEnabled,
            })
            .from(shiftTypes)
            .where(
              and(
                eq(shiftTypes.groupId, authorization.group.id),
                inArray(shiftTypes.id, shiftTypeIds),
                isNull(shiftTypes.deletedAt),
              ),
            )
            .for('update');
    if (shiftTypeRows.length !== shiftTypeIds.length) {
      throw validationError('部分班种不存在或不属于该群组。');
    }
    const disabledShiftType = shiftTypeRows.find((shiftType) => shiftType.isEnabled !== 1);
    if (disabledShiftType !== undefined) {
      throw validationError('已停用的班种不能填入模板。');
    }
    const shiftTypeVersionsById = new Map(
      shiftTypeRows.map((shiftType) => [shiftType.id, shiftType.configurationVersion]),
    );

    return { memberVersionsById, shiftTypeVersionsById };
  }

  private async readRoleMembersForUpdate(
    transaction: DatabaseTransaction,
    scheduleRoleId: string,
    membershipIds: readonly string[],
  ): Promise<ReadonlyArray<{ readonly membershipId: string; readonly version: number }>> {
    return transaction
      .select({
        membershipId: memberScheduleRoles.membershipId,
        version: memberScheduleRoles.version,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(memberScheduleRoles.scheduleRoleId, scheduleRoleId),
          inArray(memberScheduleRoles.membershipId, membershipIds),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          isNull(memberScheduleRoles.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .for('update');
  }

  private async lockTemplate(
    transaction: DatabaseTransaction,
    groupId: string,
    templateId: string,
  ): Promise<TemplateRow> {
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

  private async replaceTemplateMembers(
    transaction: DatabaseTransaction,
    templateId: string,
    membershipIds: readonly string[],
    memberVersionsById: ReadonlyMap<string, number>,
  ): Promise<void> {
    if (membershipIds.length === 0) {
      return;
    }

    await transaction.insert(manualScheduleTemplateMembers).values(
      membershipIds.map((membershipId) => {
        const memberScheduleRoleVersion = memberVersionsById.get(membershipId);
        if (memberScheduleRoleVersion === undefined) {
          throw new Error('A validated template member is missing its role version.');
        }

        return {
          id: randomUUID(),
          membershipId,
          memberScheduleRoleVersion,
          templateId,
        };
      }),
    );
  }

  private async replaceTemplateCells(
    transaction: DatabaseTransaction,
    templateId: string,
    cells: CreateManualScheduleTemplateRequest['cells'],
    shiftTypeVersionsById: ReadonlyMap<string, number>,
  ): Promise<void> {
    if (cells.length === 0) {
      return;
    }

    await transaction.insert(manualScheduleCells).values(
      cells.map((cell) => {
        const shiftTypeConfigurationVersion = shiftTypeVersionsById.get(cell.shiftTypeId);
        if (shiftTypeConfigurationVersion === undefined) {
          throw new Error('A validated template cell is missing its shift type version.');
        }

        return {
          cycleDay: cell.cycleDay,
          id: randomUUID(),
          membershipId: cell.membershipId,
          shiftTypeConfigurationVersion,
          shiftTypeId: cell.shiftTypeId,
          templateId,
        };
      }),
    );
  }

  private async softDeleteTemplateContent(
    transaction: DatabaseTransaction,
    templateId: string,
  ): Promise<void> {
    await Promise.all([
      transaction
        .update(manualScheduleTemplateMembers)
        .set({
          deletedAt: sql`current_timestamp(3)`,
          version: sql`${manualScheduleTemplateMembers.version} + 1`,
        })
        .where(
          and(
            eq(manualScheduleTemplateMembers.templateId, templateId),
            isNull(manualScheduleTemplateMembers.deletedAt),
          ),
        ),
      transaction
        .update(manualScheduleCells)
        .set({
          deletedAt: sql`current_timestamp(3)`,
          version: sql`${manualScheduleCells.version} + 1`,
        })
        .where(
          and(
            eq(manualScheduleCells.templateId, templateId),
            isNull(manualScheduleCells.deletedAt),
          ),
        ),
    ]);
  }

  private async readTemplates(
    transaction: DatabaseTransaction,
    templateIds: readonly string[],
  ): Promise<ManualScheduleTemplate[]> {
    if (templateIds.length === 0) {
      return [];
    }

    const [templates, members, cells] = await Promise.all([
      transaction
        .select()
        .from(manualScheduleTemplates)
        .where(
          and(
            inArray(manualScheduleTemplates.id, templateIds),
            isNull(manualScheduleTemplates.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleTemplates.createdAt), asc(manualScheduleTemplates.id)),
      transaction
        .select()
        .from(manualScheduleTemplateMembers)
        .where(
          and(
            inArray(manualScheduleTemplateMembers.templateId, templateIds),
            isNull(manualScheduleTemplateMembers.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleTemplateMembers.membershipId)),
      transaction
        .select()
        .from(manualScheduleCells)
        .where(
          and(
            inArray(manualScheduleCells.templateId, templateIds),
            isNull(manualScheduleCells.deletedAt),
          ),
        )
        .orderBy(asc(manualScheduleCells.cycleDay), asc(manualScheduleCells.membershipId)),
    ]);

    const roleIds = [...new Set(templates.map((template) => template.scheduleRoleId))];
    const membershipIds = [
      ...new Set([
        ...members.map((member) => member.membershipId),
        ...cells.map((cell) => cell.membershipId),
      ]),
    ];
    const shiftTypeIds = [...new Set(cells.map((cell) => cell.shiftTypeId))];
    const [roles, currentRoleMembers, currentShiftTypes, memberNames] = await Promise.all([
      transaction
        .select({ id: scheduleRoles.id, name: scheduleRoles.name })
        .from(scheduleRoles)
        .where(and(inArray(scheduleRoles.id, roleIds), isNull(scheduleRoles.deletedAt))),
      this.readCurrentRoleMembers(transaction, roleIds, membershipIds),
      this.readCurrentShiftTypes(transaction, shiftTypeIds),
      this.readMemberNames(transaction, membershipIds),
    ]);

    const roleNamesById = new Map(roles.map((role) => [role.id, role.name]));
    const currentRoleMembersById = new Map(
      currentRoleMembers.map((member) => [member.membershipId, member]),
    );
    const currentShiftTypesById = new Map(
      currentShiftTypes.map((shiftType) => [shiftType.id, shiftType]),
    );
    const memberNamesById = new Map(
      memberNames.map((member) => [member.membershipId, member.realName]),
    );

    return templates.map((template) =>
      toTemplate(
        template,
        roleNamesById.get(template.scheduleRoleId) ?? '',
        members.filter((member) => member.templateId === template.id),
        cells.filter((cell) => cell.templateId === template.id),
        currentRoleMembersById,
        currentShiftTypesById,
        memberNamesById,
      ),
    );
  }

  private async readCurrentRoleMembers(
    transaction: DatabaseTransaction,
    scheduleRoleIds: readonly string[],
    membershipIds: readonly string[],
  ): Promise<readonly CurrentRoleMemberRow[]> {
    if (membershipIds.length === 0 || scheduleRoleIds.length === 0) {
      return [];
    }

    const rows = await transaction
      .select({
        membershipId: memberScheduleRoles.membershipId,
        version: memberScheduleRoles.version,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          inArray(memberScheduleRoles.scheduleRoleId, scheduleRoleIds),
          inArray(memberScheduleRoles.membershipId, membershipIds),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          isNull(memberScheduleRoles.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      );
    const versionsById = new Map<string, number>();
    for (const row of rows) {
      versionsById.set(row.membershipId, row.version);
    }

    return membershipIds.map((membershipId) => {
      const version = versionsById.get(membershipId);
      return version === undefined
        ? { isAvailable: false, membershipId, version: 0 }
        : { isAvailable: true, membershipId, version };
    });
  }

  private async readCurrentShiftTypes(
    transaction: DatabaseTransaction,
    shiftTypeIds: readonly string[],
  ): Promise<readonly CurrentShiftTypeRow[]> {
    if (shiftTypeIds.length === 0) {
      return [];
    }

    return transaction
      .select({
        abbreviation: shiftTypes.abbreviation,
        color: shiftTypes.color,
        configurationVersion: shiftTypes.configurationVersion,
        id: shiftTypes.id,
        isEnabled: shiftTypes.isEnabled,
        name: shiftTypes.name,
        textColor: shiftTypes.textColor,
      })
      .from(shiftTypes)
      .where(and(inArray(shiftTypes.id, shiftTypeIds), isNull(shiftTypes.deletedAt)));
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
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      );
  }
}

function validateTemplateInput(input: CreateManualScheduleTemplateRequest): void {
  if (
    !Number.isInteger(input.cycleDays) ||
    input.cycleDays < 1 ||
    input.cycleDays > maximumCycleDays
  ) {
    throw validationError(`模板周期天数必须是 1 到 ${maximumCycleDays} 之间的整数。`);
  }
  if (!isValidDate(input.startDate)) {
    throw validationError('模板开始日期必须使用有效的 YYYY-MM-DD 格式。');
  }
  if (
    input.membershipIds.length < 1 ||
    input.membershipIds.length > maximumTemplateMembers ||
    new Set(input.membershipIds).size !== input.membershipIds.length
  ) {
    throw validationError('模板至少需要一位成员，且成员不能重复。');
  }
  if (input.cells.length > maximumTemplateCells) {
    throw validationError('模板单元格数量超出限制。');
  }

  const membershipIds = new Set(input.membershipIds);
  const cellKeys = new Set<string>();
  for (const cell of input.cells) {
    if (!Number.isInteger(cell.cycleDay) || cell.cycleDay < 1 || cell.cycleDay > input.cycleDays) {
      throw validationError('模板单元格的周期日必须在模板周期天数内。');
    }
    if (!membershipIds.has(cell.membershipId)) {
      throw validationError('模板单元格的成员必须是模板选择的人员。');
    }
    const cellKey = `${cell.cycleDay}:${cell.membershipId}`;
    if (cellKeys.has(cellKey)) {
      throw validationError('同一成员在同一天只能有一个模板单元格。');
    }
    cellKeys.add(cellKey);
  }
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function toTemplate(
  template: TemplateRow,
  scheduleRoleName: string,
  members: readonly (typeof manualScheduleTemplateMembers.$inferSelect)[],
  cells: readonly (typeof manualScheduleCells.$inferSelect)[],
  currentRoleMembersById: ReadonlyMap<string, CurrentRoleMemberRow>,
  currentShiftTypesById: ReadonlyMap<string, CurrentShiftTypeRow>,
  memberNamesById: ReadonlyMap<string, string>,
): ManualScheduleTemplate {
  return {
    cells: cells.map((cell): ManualScheduleTemplateCell => {
      const currentShiftType = currentShiftTypesById.get(cell.shiftTypeId);
      return {
        cycleDay: cell.cycleDay,
        currentShiftTypeConfigurationVersion: currentShiftType?.configurationVersion ?? 0,
        isShiftTypeEnabled: currentShiftType?.isEnabled === 1,
        isStale:
          currentShiftType === undefined ||
          currentShiftType.isEnabled !== 1 ||
          currentShiftType.configurationVersion !== cell.shiftTypeConfigurationVersion,
        membershipId: cell.membershipId,
        shiftTypeAbbreviation: currentShiftType?.abbreviation ?? '',
        shiftTypeColor: currentShiftType?.color ?? '#1F5AA6',
        shiftTypeConfigurationVersion: cell.shiftTypeConfigurationVersion,
        shiftTypeId: cell.shiftTypeId,
        shiftTypeName: currentShiftType?.name ?? '',
        shiftTypeTextColor: currentShiftType?.textColor ?? '#FFFFFF',
      };
    }),
    cycleDays: template.cycleDays,
    groupId: template.groupId,
    id: template.id,
    members: members
      .map((member): ManualScheduleTemplateMember => {
        const current = currentRoleMembersById.get(member.membershipId);
        return {
          currentMemberScheduleRoleVersion: current?.version ?? 0,
          isAvailable: current?.isAvailable ?? false,
          isStale:
            current === undefined ||
            !current.isAvailable ||
            current.version !== member.memberScheduleRoleVersion,
          membershipId: member.membershipId,
          memberScheduleRoleVersion: member.memberScheduleRoleVersion,
          realName: memberNamesById.get(member.membershipId) ?? '',
        };
      })
      .sort(
        (first, second) =>
          first.realName.localeCompare(second.realName, 'zh-Hans-CN') ||
          first.membershipId.localeCompare(second.membershipId),
      ),
    scheduleRoleId: template.scheduleRoleId,
    scheduleRoleName,
    startDate: template.startDate,
    version: template.version,
  };
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}

function notFound(userMessage: string): ApiError {
  return new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage });
}
