import { createHash, randomUUID } from 'node:crypto';

import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  externalDutyChecks,
  externalDutyActions,
  dutyAdjustments,
  groupMemberships,
  groups,
  memberScheduleRoles,
  platformJobRuns,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  swapRequests,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';
import { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { SwapService } from '../swaps/swap-service.js';
import { ExternalDutySource } from './external-duty-source.js';
import { classifyExternalDuty, scopedExternalDutyDates } from './classify-external-duty.js';
import { suggestExternalDuty } from './suggest-external-duty.js';

const ROLE_NAME = '一线';
const SHIFT_NAME = '全天班';
const GROUP_NAME = '头颈外科医生';

function effectivePublishedAssignment<
  T extends {
    name: string | null;
    membershipId: string | null;
    plannedName: string | null;
    plannedMembershipId: string | null;
  },
>(assignment: T) {
  return {
    ...assignment,
    name: assignment.name ?? assignment.plannedName,
    membershipId: assignment.membershipId ?? assignment.plannedMembershipId,
  };
}

export class ExternalDutyService {
  private readonly notificationWriter = new NotificationWriter();

  public constructor(
    private readonly client: DatabaseClient,
    private readonly adminUids: ReadonlySet<string>,
    private readonly source = new ExternalDutySource(),
  ) {}

  public async list(identity: AuthenticatedIdentity) {
    await this.authorize(identity);
    const today = chinaToday();
    const rows = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(
        and(
          gte(externalDutyChecks.businessDate, today),
          eq(externalDutyChecks.isInScope, 1),
          inArray(externalDutyChecks.status, ['pending', 'processing', 'blocked']),
        ),
      )
      .orderBy(externalDutyChecks.businessDate);
    const all = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(and(gte(externalDutyChecks.businessDate, today), eq(externalDutyChecks.isInScope, 1)));
    const suggestions = suggestExternalDuty(all);
    return rows.map((row) => ({ ...row, suggestion: suggestions.get(row.businessDate) ?? null }));
  }

  public async status(identity: AuthenticatedIdentity) {
    await this.authorize(identity);
    const [run] = await this.client.database
      .select({ status: platformJobRuns.status, finishedAt: platformJobRuns.finishedAt })
      .from(platformJobRuns)
      .where(eq(platformJobRuns.jobName, 'external-duty-check'))
      .orderBy(desc(platformJobRuns.startedAt))
      .limit(1);
    return {
      status: run?.status ?? 'never',
      checkedAt: run?.finishedAt ?? null,
      coverageEnded: chinaToday() > '2027-06-30',
    };
  }

  public async history(identity: AuthenticatedIdentity) {
    await this.authorize(identity);
    const actions = await this.client.database
      .select()
      .from(externalDutyActions)
      .where(gte(externalDutyActions.businessDate, chinaToday()))
      .orderBy(desc(externalDutyActions.createdAt));
    const dutyIds = actions
      .filter((action) => action.workflowKind === 'duty' && action.workflowId)
      .map((action) => action.workflowId!);
    const swapIds = actions
      .filter((action) => action.workflowKind === 'swap' && action.workflowId)
      .map((action) => action.workflowId!);
    const [duties, swaps] = await Promise.all([
      dutyIds.length
        ? this.client.database
            .select({ id: dutyAdjustments.id, status: dutyAdjustments.status })
            .from(dutyAdjustments)
            .where(inArray(dutyAdjustments.id, dutyIds))
        : [],
      swapIds.length
        ? this.client.database
            .select({ id: swapRequests.id, status: swapRequests.status })
            .from(swapRequests)
            .where(inArray(swapRequests.id, swapIds))
        : [],
    ]);
    const workflowStatus = new Map([...duties, ...swaps].map((item) => [item.id, item.status]));
    return actions.map((action) => ({
      ...action,
      workflowStatus: action.workflowId ? (workflowStatus.get(action.workflowId) ?? null) : null,
    }));
  }

  public async previewUndo(identity: AuthenticatedIdentity, actionId: string) {
    await this.authorize(identity);
    const [action] = await this.client.database
      .select()
      .from(externalDutyActions)
      .where(eq(externalDutyActions.id, actionId))
      .limit(1);
    if (
      !action ||
      !['applied', 'applying'].includes(action.status) ||
      action.businessDate < chinaToday()
    )
      throw conflict('该变动已撤回或日期已过');
    if (action.status === 'applying' && Date.now() - action.updatedAt.valueOf() < 30_000)
      throw conflict('网页写入仍在核验，请稍后再撤回');
    const local = await this.readLocalDate(action.groupId, action.businessDate);
    if (local.length !== 1 || !local[0]?.plannedName)
      throw conflict('当前正式发布班次无法唯一确定，不能撤回');
    const remote = await this.source.read();
    const remoteName = remote.duties.get(action.businessDate);
    if (!remoteName) throw conflict('网页已无该日期的排班，无法撤回');
    const currentName = action.side === 'external' ? remoteName : (local[0]?.name ?? null);
    return {
      actionId,
      side: action.side,
      date: action.businessDate,
      currentName,
      baselineName: local[0].plannedName,
      expectedFingerprint: hash([
        actionId,
        action.status,
        local[0].periodId,
        local[0].plannedName,
        local[0].version,
        remoteName,
        local[0]?.name ?? null,
      ]),
    };
  }

  public async undo(identity: AuthenticatedIdentity, actionId: string, fingerprint: string) {
    const preview = await this.previewUndo(identity, actionId);
    if (preview.expectedFingerprint !== fingerprint) throw conflict('撤回预览已过期，请重新确认');
    const [action] = await this.client.database
      .select()
      .from(externalDutyActions)
      .where(
        and(
          eq(externalDutyActions.id, actionId),
          inArray(externalDutyActions.status, ['applied', 'applying']),
        ),
      )
      .limit(1);
    if (!action) throw conflict('该变动已撤回');
    const originalActionStatus = action.status;
    const [claimed] = await this.client.database
      .update(externalDutyActions)
      .set({ status: 'reverting' })
      .where(
        and(
          eq(externalDutyActions.id, actionId),
          inArray(externalDutyActions.status, ['applied', 'applying']),
        ),
      );
    if (claimed.affectedRows !== 1) throw conflict('该变动正在撤回，请刷新');
    try {
      if (action.side === 'external') {
        if (preview.currentName !== preview.baselineName) {
          await this.source.write(action.businessDate, preview.baselineName);
          const verified = await this.source.read();
          if (verified.duties.get(action.businessDate) !== preview.baselineName)
            throw conflict('网页恢复后回读不一致，请重新校对');
        }
      } else {
        await this.undoLocalWorkflow(identity, action, preview.baselineName);
        const after = await this.readLocalDate(action.groupId, action.businessDate);
        if (after.length !== 1) throw conflict('本系统当前发布班次已变化，请重新校对');
        if (after[0]?.name !== preview.baselineName) {
          await this.client.database
            .update(externalDutyActions)
            .set({ status: 'applied' })
            .where(
              and(
                eq(externalDutyActions.id, actionId),
                eq(externalDutyActions.status, 'reverting'),
              ),
            );
          await this.scan();
          return { verified: false, processing: true };
        }
      }
      await this.client.database
        .update(externalDutyActions)
        .set({ status: 'reverted', revertedAt: new Date() })
        .where(
          and(eq(externalDutyActions.id, actionId), eq(externalDutyActions.status, 'reverting')),
        );
      await this.scan();
      return { verified: true };
    } catch (error) {
      await this.client.database
        .update(externalDutyActions)
        .set({ status: originalActionStatus })
        .where(
          and(eq(externalDutyActions.id, actionId), eq(externalDutyActions.status, 'reverting')),
        );
      throw error;
    }
  }

  private async undoLocalWorkflow(
    identity: AuthenticatedIdentity,
    action: typeof externalDutyActions.$inferSelect,
    baselineName: string,
  ): Promise<void> {
    const operationId = deterministicOperationId([action.id, 'undo']);
    const currentPublished = await this.readLocalDate(action.groupId, action.businessDate);
    if (currentPublished.length !== 1) throw conflict('当前发布班次无法唯一确定');
    const samePublication = currentPublished[0]?.periodId === action.schedulePeriodId;
    try {
      if (samePublication && action.workflowKind === 'duty' && action.workflowId) {
        const [workflow] = await this.client.database
          .select({ status: dutyAdjustments.status, version: dutyAdjustments.version })
          .from(dutyAdjustments)
          .where(eq(dutyAdjustments.id, action.workflowId))
          .limit(1);
        if (workflow?.status === 'completed')
          await new DutyAdjustmentService(this.client).revoke(
            identity,
            action.groupId,
            action.workflowId,
            { expectedVersion: workflow.version, operationId, reason: '排班网页校对撤回' },
          );
        else if (workflow?.status === 'pending_target' || workflow?.status === 'pending_approval')
          await new DutyAdjustmentService(this.client).cancel(
            identity,
            action.groupId,
            action.workflowId,
            { expectedVersion: workflow.version, operationId },
          );
      } else if (samePublication && action.workflowKind === 'swap' && action.workflowId) {
        const [workflow] = await this.client.database
          .select({ status: swapRequests.status, version: swapRequests.version })
          .from(swapRequests)
          .where(eq(swapRequests.id, action.workflowId))
          .limit(1);
        if (workflow?.status === 'completed')
          await new SwapService(this.client).revokeCompleted(
            identity,
            action.groupId,
            action.workflowId,
            { expectedVersion: workflow.version, operationId, reason: '排班网页校对撤回' },
          );
        else if (workflow?.status === 'pending_target' || workflow?.status === 'pending_approval')
          await new SwapService(this.client).cancel(identity, action.groupId, action.workflowId, {
            expectedVersion: workflow.version,
            operationId,
          });
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.statusCode === 409)) throw error;
      // A later workflow can make the original revocation invalid. Try a new
      // reviewed adjustment toward the current published baseline below.
    }
    const current = await this.readLocalDate(action.groupId, action.businessDate);
    if (current.length !== 1 || current[0]?.name === baselineName) return;
    const baselineMembershipId = await this.findMembershipId(
      action.groupId,
      action.businessDate,
      baselineName,
    );
    await new DutyAdjustmentService(this.client).createDirect(identity, action.groupId, {
      coveredAssignmentId: current[0]!.id,
      overtimeMembershipId: baselineMembershipId,
      reason: '排班网页校对：恢复发布基线',
      operationId: deterministicOperationId([action.id, 'restore-baseline']),
    });
  }

  public async scan(): Promise<{ readonly checked: number; readonly newDifferences: number }> {
    const remote = await this.source.read();
    const today = chinaToday();
    const end = '2027-06-30';
    if (today > end) return { checked: 0, newDifferences: 0 };
    const groupId = await this.findGroup();
    const roles = await this.client.database
      .select({ id: scheduleRoles.id })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.groupId, groupId),
          eq(scheduleRoles.name, ROLE_NAME),
          isNull(scheduleRoles.deletedAt),
        ),
      );
    const shifts = await this.client.database
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, groupId),
          eq(shiftTypes.name, SHIFT_NAME),
          eq(shiftTypes.isEnabled, 1),
          isNull(shiftTypes.deletedAt),
        ),
      );
    if (roles.length !== 1 || shifts.length !== 1)
      throw new Error('External duty group role or shift is ambiguous');

    const assignments = (
      await this.client.database
        .select({
          date: shiftAssignments.businessDate,
          id: shiftAssignments.id,
          name: shiftAssignments.actualMemberName,
          membershipId: shiftAssignments.actualMembershipId,
          plannedName: shiftAssignments.plannedMemberName,
          plannedMembershipId: shiftAssignments.plannedMembershipId,
          version: shiftAssignments.version,
          periodId: schedulePeriods.id,
        })
        .from(shiftAssignments)
        .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
        .where(
          and(
            eq(schedulePeriods.groupId, groupId),
            eq(schedulePeriods.scheduleRoleId, roles[0]!.id),
            eq(schedulePeriods.status, 'published'),
            eq(shiftAssignments.shiftTypeId, shifts[0]!.id),
            gte(shiftAssignments.businessDate, today),
            isNull(schedulePeriods.deletedAt),
            isNull(shiftAssignments.deletedAt),
          ),
        )
    ).map(effectivePublishedAssignment);
    const byDate = new Map<string, typeof assignments>();
    for (const assignment of assignments)
      byDate.set(assignment.date, [...(byDate.get(assignment.date) ?? []), assignment]);
    const permittedNames = await this.client.database
      .select({
        name: userProfiles.realName,
        from: memberScheduleRoles.effectiveFrom,
        to: memberScheduleRoles.effectiveTo,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(memberScheduleRoles, eq(memberScheduleRoles.membershipId, groupMemberships.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          eq(memberScheduleRoles.scheduleRoleId, roles[0]!.id),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
          isNull(memberScheduleRoles.deletedAt),
        ),
      );
    const eligibleCount = (name: string, date: string) =>
      permittedNames.filter(
        (row) =>
          row.name === name &&
          (row.from === null || row.from <= date) &&
          (row.to === null || row.to >= date),
      ).length;
    const observations = scopedExternalDutyDates(
      remote.duties,
      new Map([...byDate].map(([date, matches]) => [date, matches.length])),
      today,
    );
    let newDifferences = 0;
    await withTransaction(this.client, async (tx) => {
      // Serialize cron and manual scans across API processes before reading prior snapshots.
      await lockExternalDutyGroup(tx, groupId);
      const priorRows = await tx
        .select()
        .from(externalDutyChecks)
        .where(gte(externalDutyChecks.businessDate, today));
      const priorByDate = new Map(priorRows.map((row) => [row.businessDate, row]));
      const activeActions = await tx
        .select()
        .from(externalDutyActions)
        .where(
          and(
            eq(externalDutyActions.groupId, groupId),
            gte(externalDutyActions.businessDate, today),
            inArray(externalDutyActions.status, ['applying', 'applied']),
          ),
        );
      const dutyIds = activeActions
        .filter((action) => action.workflowKind === 'duty' && action.workflowId)
        .map((action) => action.workflowId!);
      const swapIds = activeActions
        .filter((action) => action.workflowKind === 'swap' && action.workflowId)
        .map((action) => action.workflowId!);
      const [dutyWorkflowRows, swapWorkflowRows] = await Promise.all([
        dutyIds.length
          ? tx
              .select({ id: dutyAdjustments.id, status: dutyAdjustments.status })
              .from(dutyAdjustments)
              .where(inArray(dutyAdjustments.id, dutyIds))
          : [],
        swapIds.length
          ? tx
              .select({ id: swapRequests.id, status: swapRequests.status })
              .from(swapRequests)
              .where(inArray(swapRequests.id, swapIds))
          : [],
      ]);
      const workflowStatus = new Map(
        [...dutyWorkflowRows, ...swapWorkflowRows].map((row) => [row.id, row.status]),
      );
      const processingDates = new Set(
        activeActions
          .filter(
            (action) =>
              action.status === 'applying' ||
              (action.workflowId !== null &&
                ['pending_target', 'pending_approval'].includes(
                  workflowStatus.get(action.workflowId) ?? '',
                )),
          )
          .map((action) => action.businessDate),
      );
      const notifiedDates: string[] = [];
      for (const [date, remoteName] of observations) {
        const matches = byDate.get(date) ?? [];
        const assignment = matches.length === 1 ? matches[0]! : undefined;
        const localName = assignment?.name ?? null;
        const baselineName = assignment?.plannedName ?? null;
        const reason =
          matches.length !== 1
            ? `本系统当日匹配班次数量为 ${matches.length}`
            : baselineName === null || eligibleCount(baselineName, date) !== 1
              ? '发布排班基线无法唯一对应本系统一线成员'
              : localName === null
                ? '本系统当前班次无人值班，网页无法表示空缺'
                : eligibleCount(remoteName, date) !== 1
                  ? '网页值班人无法唯一匹配本系统一线成员'
                  : localName !== null &&
                      (!remote.people.includes(localName) || eligibleCount(localName, date) !== 1)
                    ? '本系统值班人无法唯一匹配网页人员'
                    : null;
        const fingerprint = hash([
          date,
          remoteName,
          baselineName,
          localName,
          assignment?.periodId ?? null,
          assignment?.id ?? null,
          assignment?.version ?? null,
        ]);
        const persisted = priorByDate.get(date);
        const previous =
          persisted?.status === 'processing' && !processingDates.has(date)
            ? { ...persisted, status: 'pending' as const }
            : persisted;
        const { changeSource, status, newDifference } = classifyExternalDuty({
          previous,
          baselineName,
          remoteName,
          localName,
          fingerprint,
          blockReason: reason,
        });
        const changed = previous?.fingerprint !== fingerprint;
        if (newDifference) {
          newDifferences++;
          notifiedDates.push(date);
        }
        const values = {
          groupId,
          remoteName,
          baselineName,
          localName,
          schedulePeriodId: assignment?.periodId ?? null,
          assignmentId: assignment?.id ?? null,
          assignmentVersion: assignment?.version ?? null,
          isInScope: 1,
          changeSource,
          status,
          blockReason: reason,
          fingerprint,
          observedAt: new Date(),
        } as const;
        if (!previous)
          await tx.insert(externalDutyChecks).values({ businessDate: date, ...values });
        else if (changed || persisted?.status !== status || persisted?.blockReason !== reason) {
          await tx
            .update(externalDutyChecks)
            .set(values)
            .where(eq(externalDutyChecks.businessDate, date));
        }
      }
      const observedDates = new Set(observations.map(([date]) => date));
      for (const previous of priorRows) {
        if (observedDates.has(previous.businessDate) && byDate.has(previous.businessDate)) continue;
        if (previous.isInScope === 1)
          await tx
            .update(externalDutyChecks)
            .set({ isInScope: 0 })
            .where(eq(externalDutyChecks.businessDate, previous.businessDate));
      }
      const unverifiedWrites = await tx
        .select({
          id: externalDutyActions.id,
          date: externalDutyActions.businessDate,
          name: externalDutyActions.afterName,
        })
        .from(externalDutyActions)
        .where(
          and(
            eq(externalDutyActions.side, 'external'),
            eq(externalDutyActions.status, 'applying'),
            gte(externalDutyActions.businessDate, today),
          ),
        );
      for (const action of unverifiedWrites) {
        if (remote.duties.get(action.date) !== action.name) continue;
        await tx
          .update(externalDutyActions)
          .set({ status: 'applied' })
          .where(
            and(eq(externalDutyActions.id, action.id), eq(externalDutyActions.status, 'applying')),
          );
      }
      if (notifiedDates.length) {
        const admins = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(eq(users.isDeveloperAdmin, 1), eq(users.status, 'active'), isNull(users.deletedAt)),
          );
        if (admins.length)
          await this.notificationWriter.append(tx, {
            groupId,
            recipientUserIds: admins.map((row) => row.id),
            notificationType: 'schedule_changed',
            objectType: 'external_duty_check',
            title: '排班网页校对有新差异',
            body: `${notifiedDates.length} 个日期的值班人需要校对`,
            payload: {
              startDate: notifiedDates[0]!,
              endDate: notifiedDates.at(-1)!,
              externalDutyCheck: true,
            },
          });
      }
    });
    return { checked: observations.length, newDifferences };
  }

  public async pushToExternal(
    identity: AuthenticatedIdentity,
    date: string,
    expectedFingerprint: string,
  ) {
    const actorUserId = await this.authorize(identity);
    if (date < chinaToday() || date > '2027-06-30') throw conflict('日期已不在校对范围');
    const [row] = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(eq(externalDutyChecks.businessDate, date))
      .limit(1);
    if (
      !row ||
      row.fingerprint !== expectedFingerprint ||
      row.status !== 'pending' ||
      row.isInScope !== 1 ||
      row.changeSource !== 'local' ||
      !row.localName ||
      !row.baselineName ||
      !row.schedulePeriodId ||
      !row.assignmentId ||
      row.blockReason
    ) {
      throw conflict('排班已变化，请刷新后重新确认');
    }
    const current = await this.source.read();
    if (current.duties.get(date) !== row.remoteName || !current.people.includes(row.localName)) {
      throw conflict('网页排班已变化，请重新校对');
    }
    const currentLocal = await this.readLocalDate(row.groupId, date);
    if (
      currentLocal.length !== 1 ||
      currentLocal[0]?.id !== row.assignmentId ||
      currentLocal[0]?.version !== row.assignmentVersion ||
      currentLocal[0]?.periodId !== row.schedulePeriodId ||
      currentLocal[0]?.plannedName !== row.baselineName ||
      currentLocal[0]?.name !== row.localName
    ) {
      throw conflict('本系统排班已变化，请重新校对');
    }
    const [claimed] = await this.client.database
      .update(externalDutyChecks)
      .set({ status: 'processing' })
      .where(
        and(
          eq(externalDutyChecks.businessDate, date),
          eq(externalDutyChecks.fingerprint, expectedFingerprint),
          eq(externalDutyChecks.status, 'pending'),
        ),
      );
    if (claimed.affectedRows !== 1) throw conflict('排班正在处理，请刷新后重新确认');
    try {
      const actionId = randomUUID();
      await this.client.database.insert(externalDutyActions).values({
        id: actionId,
        businessDate: date,
        groupId: row.groupId,
        schedulePeriodId: row.schedulePeriodId,
        assignmentId: row.assignmentId,
        side: 'external',
        baselineName: row.baselineName,
        beforeName: row.remoteName,
        afterName: row.localName,
        status: 'applying',
        actorUserId,
      });
      await this.source.write(date, row.localName);
      const verified = await this.source.read();
      if (verified.duties.get(date) !== row.localName)
        throw conflict('网页保存后回读不一致，请重新校对');
      await this.client.database
        .update(externalDutyActions)
        .set({ status: 'applied' })
        .where(
          and(eq(externalDutyActions.id, actionId), eq(externalDutyActions.status, 'applying')),
        );
      await this.scan();
    } catch (error) {
      await this.client.database
        .update(externalDutyChecks)
        .set({ status: 'pending' })
        .where(
          and(
            eq(externalDutyChecks.businessDate, date),
            eq(externalDutyChecks.fingerprint, expectedFingerprint),
            eq(externalDutyChecks.status, 'processing'),
          ),
        );
      throw error;
    }
    return { verified: true };
  }

  public async inboundCandidates(
    identity: AuthenticatedIdentity,
    date: string,
    expectedFingerprint: string,
  ) {
    const target = await this.inboundTarget(identity, date, expectedFingerprint);
    const candidates = await this.client.database
      .select({
        id: shiftAssignments.id,
        date: shiftAssignments.businessDate,
        shiftName: shiftAssignments.shiftTypeName,
        name: shiftAssignments.actualMemberName,
      })
      .from(shiftAssignments)
      .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
      .where(
        and(
          eq(schedulePeriods.groupId, target.groupId),
          eq(schedulePeriods.status, 'published'),
          eq(shiftAssignments.actualMembershipId, target.membershipId),
          gte(shiftAssignments.businessDate, chinaToday()),
          isNull(schedulePeriods.deletedAt),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    return candidates.filter((candidate) => candidate.id !== target.assignmentId).slice(0, 100);
  }

  public async previewInbound(
    identity: AuthenticatedIdentity,
    date: string,
    expectedFingerprint: string,
    kind: 'duty' | 'swap',
    targetAssignmentId?: string,
  ) {
    const target = await this.inboundTarget(identity, date, expectedFingerprint);
    await this.assertSuggestedAction(date, kind, targetAssignmentId);
    if (kind === 'duty') {
      return new DutyAdjustmentService(this.client).preview(identity, target.groupId, {
        coveredAssignmentId: target.assignmentId,
        overtimeMembershipId: target.membershipId,
      });
    }
    if (!targetAssignmentId) throw conflict('请选择用于交换的第二个班次');
    if (!target.localMembershipId) throw conflict('本系统值班人无法唯一对应成员');
    return new SwapService(this.client).preview(identity, target.groupId, {
      initiatorMembershipId: target.localMembershipId,
      initiatorAssignmentId: target.assignmentId,
      targetAssignmentId,
      targetMembershipId: target.membershipId,
    });
  }

  public async applyInbound(
    identity: AuthenticatedIdentity,
    date: string,
    expectedFingerprint: string,
    kind: 'duty' | 'swap',
    targetAssignmentId?: string,
  ) {
    const target = await this.inboundTarget(identity, date, expectedFingerprint);
    await this.assertSuggestedAction(date, kind, targetAssignmentId);
    const operationId = deterministicOperationId([
      date,
      expectedFingerprint,
      kind,
      targetAssignmentId,
    ]);
    const [claimed] = await this.client.database
      .update(externalDutyChecks)
      .set({ status: 'processing' })
      .where(
        and(
          eq(externalDutyChecks.businessDate, date),
          eq(externalDutyChecks.fingerprint, expectedFingerprint),
          eq(externalDutyChecks.status, 'pending'),
        ),
      );
    if (claimed.affectedRows !== 1) throw conflict('排班正在处理，请刷新后重新确认');
    try {
      if (kind === 'swap') {
        const result = await this.applySwapPlan(identity, date, target.schedulePeriodId);
        await this.scan();
        return result;
      }
      const result = await new DutyAdjustmentService(this.client).createDirect(
        identity,
        target.groupId,
        {
          coveredAssignmentId: target.assignmentId,
          overtimeMembershipId: target.membershipId,
          reason: '排班网页校对',
          operationId,
        },
      );
      const actorUserId = await this.authorize(identity);
      await this.client.database.insert(externalDutyActions).values({
        id: operationId,
        businessDate: date,
        groupId: target.groupId,
        schedulePeriodId: target.schedulePeriodId,
        assignmentId: target.assignmentId,
        side: 'local',
        baselineName: target.baselineName,
        beforeName: target.localName,
        afterName: target.remoteName,
        workflowKind: 'duty',
        workflowId: result.id,
        actorUserId,
      });
      await this.scan();
      return result;
    } catch (error) {
      await this.client.database
        .update(externalDutyChecks)
        .set({ status: 'pending' })
        .where(
          and(
            eq(externalDutyChecks.businessDate, date),
            eq(externalDutyChecks.fingerprint, expectedFingerprint),
            eq(externalDutyChecks.status, 'processing'),
          ),
        );
      throw error;
    }
  }

  private async applySwapPlan(
    identity: AuthenticatedIdentity,
    date: string,
    schedulePeriodId: string,
  ) {
    const rows = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(
        and(
          eq(externalDutyChecks.schedulePeriodId, schedulePeriodId),
          eq(externalDutyChecks.isInScope, 1),
        ),
      );
    const suggestion = suggestExternalDuty(
      rows.map((row) =>
        row.businessDate === date && row.status === 'processing'
          ? { ...row, status: 'pending' as const }
          : row,
      ),
    ).get(date);
    if (suggestion?.kind !== 'swap' || suggestion.steps[0]?.date !== date)
      throw conflict('换班方案已变化，请重新预览');
    const rowByDate = new Map(rows.map((row) => [row.businessDate, row]));
    const expected = new Map(rows.map((row) => [row.businessDate, row.localName]));
    const results: string[] = [];
    const actorUserId = await this.authorize(identity);
    for (const [index, step] of suggestion.steps.entries()) {
      const initiator = rowByDate.get(step.date);
      const partner = rowByDate.get(step.targetDate);
      if (!initiator || !partner || !initiator.baselineName || !initiator.assignmentId)
        throw conflict('换班方案的班次已变化');
      const [current, other] = await Promise.all([
        this.readLocalDate(initiator.groupId, step.date),
        this.readLocalDate(initiator.groupId, step.targetDate),
      ]);
      const remote = await this.source.read();
      if (
        current.length !== 1 ||
        other.length !== 1 ||
        current[0]?.periodId !== schedulePeriodId ||
        other[0]?.periodId !== schedulePeriodId ||
        current[0]?.id !== initiator.assignmentId ||
        other[0]?.id !== step.targetAssignmentId ||
        current[0]?.name !== expected.get(step.date) ||
        other[0]?.name !== expected.get(step.targetDate) ||
        !current[0]?.membershipId ||
        !other[0]?.membershipId ||
        rows.some((row) => remote.duties.get(row.businessDate) !== row.remoteName)
      )
        throw conflict('换班方案执行期间排班已变化，请重新校对');
      const swap = new SwapService(this.client);
      const preview = await swap.preview(identity, initiator.groupId, {
        initiatorMembershipId: current[0].membershipId,
        initiatorAssignmentId: current[0].id,
        targetMembershipId: other[0].membershipId,
        targetAssignmentId: other[0].id,
      });
      if (preview.conflicts.length) throw conflict('换班业务校验未通过，请检查原流程的冲突说明');
      const stepOperationId = deterministicOperationId([date, schedulePeriodId, index, step]);
      const completed = await swap.createDirect(identity, initiator.groupId, {
        initiatorAssignmentId: current[0].id,
        targetAssignmentId: other[0].id,
        operationId: stepOperationId,
      });
      await this.client.database.insert(externalDutyActions).values({
        id: stepOperationId,
        businessDate: step.date,
        groupId: initiator.groupId,
        schedulePeriodId,
        assignmentId: current[0].id,
        side: 'local',
        baselineName: initiator.baselineName,
        beforeName: current[0].name,
        afterName: other[0].name,
        workflowKind: 'swap',
        workflowId: completed.id,
        actorUserId,
      });
      expected.set(step.date, other[0].name);
      expected.set(step.targetDate, current[0].name);
      results.push(completed.id);
    }
    return { workflowIds: results, completedSteps: results.length };
  }

  private async inboundTarget(identity: AuthenticatedIdentity, date: string, fingerprint: string) {
    await this.authorize(identity);
    if (date < chinaToday()) throw conflict('日期已过，无法校对');
    const [row] = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(eq(externalDutyChecks.businessDate, date))
      .limit(1);
    if (
      !row ||
      row.status !== 'pending' ||
      row.isInScope !== 1 ||
      row.changeSource !== 'remote' ||
      row.fingerprint !== fingerprint ||
      !row.assignmentId ||
      !row.baselineName ||
      !row.schedulePeriodId ||
      row.blockReason
    )
      throw conflict('排班已变化，请重新确认');
    const remote = await this.source.read();
    const local = await this.readLocalDate(row.groupId, date);
    if (
      remote.duties.get(date) !== row.remoteName ||
      local.length !== 1 ||
      local[0]?.id !== row.assignmentId ||
      local[0]?.version !== row.assignmentVersion ||
      local[0]?.periodId !== row.schedulePeriodId ||
      local[0]?.plannedName !== row.baselineName ||
      local[0]?.name !== row.localName
    ) {
      throw conflict('排班已变化，请重新确认');
    }
    const people = await this.client.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(memberScheduleRoles, eq(memberScheduleRoles.membershipId, groupMemberships.id))
      .innerJoin(scheduleRoles, eq(scheduleRoles.id, memberScheduleRoles.scheduleRoleId))
      .where(
        and(
          eq(groupMemberships.groupId, row.groupId),
          eq(groupMemberships.status, 'active'),
          eq(userProfiles.realName, row.remoteName),
          eq(scheduleRoles.name, ROLE_NAME),
          or(
            isNull(memberScheduleRoles.effectiveFrom),
            lte(memberScheduleRoles.effectiveFrom, date),
          ),
          or(isNull(memberScheduleRoles.effectiveTo), gte(memberScheduleRoles.effectiveTo, date)),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
          isNull(memberScheduleRoles.deletedAt),
          isNull(scheduleRoles.deletedAt),
        ),
      );
    if (people.length !== 1) throw conflict('网页值班人无法唯一对应本系统成员');
    return {
      groupId: row.groupId,
      assignmentId: row.assignmentId,
      membershipId: people[0]!.id,
      localMembershipId: local[0]?.membershipId ?? null,
      schedulePeriodId: row.schedulePeriodId,
      baselineName: row.baselineName,
      localName: row.localName,
      remoteName: row.remoteName,
    };
  }

  private async authorize(identity: AuthenticatedIdentity): Promise<string> {
    return withTransaction(this.client, (tx) => requirePlatformAdmin(tx, identity, this.adminUids));
  }

  private async findMembershipId(groupId: string, date: string, name: string): Promise<string> {
    const matches = await this.client.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(memberScheduleRoles, eq(memberScheduleRoles.membershipId, groupMemberships.id))
      .innerJoin(scheduleRoles, eq(scheduleRoles.id, memberScheduleRoles.scheduleRoleId))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          eq(userProfiles.realName, name),
          eq(scheduleRoles.name, ROLE_NAME),
          or(
            isNull(memberScheduleRoles.effectiveFrom),
            lte(memberScheduleRoles.effectiveFrom, date),
          ),
          or(isNull(memberScheduleRoles.effectiveTo), gte(memberScheduleRoles.effectiveTo, date)),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
          isNull(memberScheduleRoles.deletedAt),
          isNull(scheduleRoles.deletedAt),
        ),
      );
    if (matches.length !== 1) throw conflict('发布基线人员无法唯一对应当前一线成员');
    return matches[0]!.id;
  }

  private async assertSuggestedAction(
    date: string,
    kind: 'duty' | 'swap',
    targetAssignmentId?: string,
  ): Promise<void> {
    const [row] = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(eq(externalDutyChecks.businessDate, date))
      .limit(1);
    if (!row?.schedulePeriodId) throw conflict('当前发布排班无法确定，请重新检测');
    const periodRows = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(
        and(
          eq(externalDutyChecks.schedulePeriodId, row.schedulePeriodId),
          eq(externalDutyChecks.isInScope, 1),
        ),
      );
    const suggested = suggestExternalDuty(periodRows).get(date);
    if (!suggested || suggested.kind !== kind) throw conflict('后台建议已变化，请刷新后重新预览');
    if (
      kind === 'swap' &&
      (suggested.kind !== 'swap' ||
        suggested.steps[0]?.date !== date ||
        suggested.steps[0]?.targetAssignmentId !== targetAssignmentId)
    )
      throw conflict('请按后台换班方案的下一步执行');
  }

  private async findGroup(): Promise<string> {
    const found = await this.client.database
      .selectDistinct({ id: groups.id })
      .from(groups)
      .innerJoin(scheduleRoles, eq(scheduleRoles.groupId, groups.id))
      .innerJoin(shiftTypes, eq(shiftTypes.groupId, groups.id))
      .where(
        and(
          eq(scheduleRoles.name, ROLE_NAME),
          eq(shiftTypes.name, SHIFT_NAME),
          eq(groups.name, GROUP_NAME),
          eq(shiftTypes.isEnabled, 1),
          isNull(groups.deletedAt),
          isNull(scheduleRoles.deletedAt),
          isNull(shiftTypes.deletedAt),
        ),
      );
    if (found.length !== 1) throw new Error('External duty group is not uniquely identified');
    return found[0]!.id;
  }

  private readLocalDate(groupId: string, date: string) {
    return this.client.database
      .select({
        id: shiftAssignments.id,
        name: shiftAssignments.actualMemberName,
        membershipId: shiftAssignments.actualMembershipId,
        plannedName: shiftAssignments.plannedMemberName,
        plannedMembershipId: shiftAssignments.plannedMembershipId,
        version: shiftAssignments.version,
        periodId: schedulePeriods.id,
      })
      .from(shiftAssignments)
      .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
      .innerJoin(scheduleRoles, eq(scheduleRoles.id, schedulePeriods.scheduleRoleId))
      .innerJoin(shiftTypes, eq(shiftTypes.id, shiftAssignments.shiftTypeId))
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.status, 'published'),
          eq(scheduleRoles.name, ROLE_NAME),
          eq(shiftTypes.name, SHIFT_NAME),
          eq(shiftAssignments.businessDate, date),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .then((rows) => rows.map(effectivePublishedAssignment));
  }
}

export async function lockExternalDutyGroup(
  transaction: DatabaseTransaction,
  groupId: string,
): Promise<void> {
  await transaction
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, groupId))
    .for('update');
}

function chinaToday(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function deterministicOperationId(value: unknown): string {
  const digest = hash(value);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function conflict(message: string): ApiError {
  return new ApiError({ code: 'CONFLICT', statusCode: 409, userMessage: message });
}
