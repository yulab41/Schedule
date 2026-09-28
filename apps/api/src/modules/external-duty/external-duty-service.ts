import { createHash } from 'node:crypto';

import type { DatabaseClient } from '@schedule/database';
import {
  externalDutyChecks,
  groupMemberships,
  groups,
  memberScheduleRoles,
  platformJobRuns,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';
import { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { SwapService } from '../swaps/swap-service.js';
import { ExternalDutySource } from './external-duty-source.js';
import { classifyExternalDuty } from './classify-external-duty.js';

const ROLE_NAME = '一线';
const SHIFT_NAME = '全天班';

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
    return this.client.database
      .select()
      .from(externalDutyChecks)
      .where(
        and(
          gte(externalDutyChecks.businessDate, today),
          inArray(externalDutyChecks.status, ['pending', 'processing', 'blocked', 'aligned']),
        ),
      )
      .orderBy(externalDutyChecks.businessDate);
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

    const assignments = await this.client.database
      .select({
        date: shiftAssignments.businessDate,
        id: shiftAssignments.id,
        name: shiftAssignments.actualMemberName,
        plannedName: shiftAssignments.plannedMemberName,
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
      );
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
    const observations = [...remote.duties].filter(([date]) => date >= today);
    let newDifferences = 0;
    await withTransaction(this.client, async (tx) => {
      // Serialize cron and manual scans across API processes before reading prior snapshots.
      await tx.execute(sql`SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`);
      const priorRows = await tx
        .select()
        .from(externalDutyChecks)
        .where(gte(externalDutyChecks.businessDate, today));
      const priorByDate = new Map(priorRows.map((row) => [row.businessDate, row]));
      const notifiedDates: string[] = [];
      for (const [date, remoteName] of observations) {
        const matches = byDate.get(date) ?? [];
        const assignment = matches.length === 1 ? matches[0]! : undefined;
        const localName = assignment?.name ?? assignment?.plannedName ?? null;
        const reason =
          matches.length !== 1
            ? `本系统当日匹配班次数量为 ${matches.length}`
            : eligibleCount(remoteName, date) !== 1
              ? '网页值班人无法唯一匹配本系统一线成员'
              : localName !== null &&
                  (!remote.people.includes(localName) || eligibleCount(localName, date) !== 1)
                ? '本系统值班人无法唯一匹配网页人员'
                : null;
        const fingerprint = hash([date, remoteName, localName, assignment?.id ?? null]);
        const previous = priorByDate.get(date);
        const { changeSource, status, newDifference } = classifyExternalDuty({
          previous,
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
          localName,
          assignmentId: assignment?.id ?? null,
          changeSource,
          status,
          blockReason: reason,
          fingerprint,
          observedAt: new Date(),
        } as const;
        if (!previous)
          await tx.insert(externalDutyChecks).values({ businessDate: date, ...values });
        else if (changed || previous.status !== status || previous.blockReason !== reason) {
          await tx
            .update(externalDutyChecks)
            .set(values)
            .where(eq(externalDutyChecks.businessDate, date));
        }
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
    await this.authorize(identity);
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
      !row.localName ||
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
      (currentLocal[0]?.name ?? currentLocal[0]?.plannedName) !== row.localName
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
      await this.source.write(date, row.localName);
      const verified = await this.source.read();
      if (verified.duties.get(date) !== row.localName)
        throw conflict('网页保存后回读不一致，请重新校对');
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

  public async markProcessing(
    identity: AuthenticatedIdentity,
    date: string,
    expectedFingerprint: string,
  ): Promise<void> {
    await this.authorize(identity);
    await this.client.database
      .update(externalDutyChecks)
      .set({ status: 'processing' })
      .where(
        and(
          eq(externalDutyChecks.businessDate, date),
          eq(externalDutyChecks.status, 'pending'),
          eq(externalDutyChecks.fingerprint, expectedFingerprint),
        ),
      );
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
    if (kind === 'duty') {
      return new DutyAdjustmentService(this.client).preview(identity, target.groupId, {
        coveredAssignmentId: target.assignmentId,
        overtimeMembershipId: target.membershipId,
      });
    }
    if (!targetAssignmentId) throw conflict('请选择用于交换的第二个班次');
    const [covered] = await this.client.database
      .select({ membershipId: shiftAssignments.actualMembershipId })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.id, target.assignmentId))
      .limit(1);
    if (!covered?.membershipId) throw conflict('本系统值班人无法唯一对应成员');
    return new SwapService(this.client).preview(identity, target.groupId, {
      initiatorMembershipId: covered.membershipId,
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
    const operationId = deterministicOperationId([
      date,
      expectedFingerprint,
      kind,
      targetAssignmentId,
    ]);
    let result: unknown;
    if (kind === 'duty') {
      result = await new DutyAdjustmentService(this.client).createDirect(identity, target.groupId, {
        coveredAssignmentId: target.assignmentId,
        overtimeMembershipId: target.membershipId,
        reason: '排班网页校对',
        operationId,
      });
    } else {
      if (!targetAssignmentId) throw conflict('请选择用于交换的第二个班次');
      result = await new SwapService(this.client).createDirect(identity, target.groupId, {
        initiatorAssignmentId: target.assignmentId,
        targetAssignmentId,
        operationId,
      });
    }
    await this.markProcessing(identity, date, expectedFingerprint);
    return result;
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
      row.fingerprint !== fingerprint ||
      !row.assignmentId ||
      row.blockReason
    )
      throw conflict('排班已变化，请重新确认');
    const remote = await this.source.read();
    const local = await this.readLocalDate(row.groupId, date);
    if (
      remote.duties.get(date) !== row.remoteName ||
      local.length !== 1 ||
      local[0]?.id !== row.assignmentId ||
      (local[0]?.name ?? local[0]?.plannedName) !== row.localName
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
    return { groupId: row.groupId, assignmentId: row.assignmentId, membershipId: people[0]!.id };
  }

  private async authorize(identity: AuthenticatedIdentity): Promise<void> {
    await withTransaction(this.client, async (tx) => {
      await requirePlatformAdmin(tx, identity, this.adminUids);
    });
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
        plannedName: shiftAssignments.plannedMemberName,
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
      );
  }
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
