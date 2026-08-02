import type { DatabaseClient } from '@schedule/database';
import {
  groups,
  notificationPreferences,
  notificationSettings,
  schedulePeriods,
  shiftAssignments,
  withTransaction,
} from '@schedule/database';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';

import { NotificationWriter } from '../modules/notifications/notification-writer.js';
import { normalizeReminderHours } from '../modules/notifications/reminder-hours.js';
import { claimBatch } from './notification-batch.js';

const defaultDutyReminderHours: readonly number[] = [24, 2];
const maximumReminderHours = 720;

export interface DutyReminderRunResult {
  readonly created: number;
  readonly duplicate: number;
  readonly skipped: number;
}

interface DutyAssignmentRow {
  readonly actualMembershipId: string | null;
  readonly businessDate: string;
  readonly groupId: string;
  readonly id: string;
  readonly plannedMembershipId: string | null;
  readonly shiftTypeName: string;
  readonly startsAt: Date;
}

export class DutyReminderJob {
  private readonly notificationWriter = new NotificationWriter();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async run(now = new Date()): Promise<DutyReminderRunResult> {
    const context = await this.loadContext(now);
    let created = 0;
    let duplicate = 0;
    let skipped = 0;

    for (const assignment of context.assignments) {
      const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
      if (membershipId === null) {
        const outcome = await this.writeVacancyReminder(assignment, context, now);
        if (outcome === 'created') {
          created += 1;
        } else if (outcome === 'duplicate') {
          duplicate += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      const groupLeads = context.groupLeadsByGroupId.get(assignment.groupId) ?? [
        ...defaultDutyReminderHours,
      ];
      const memberLeads = context.preferencesByMembershipId.get(membershipId);
      const effectiveLeads =
        memberLeads === undefined ? groupLeads : normalizeReminderHours(memberLeads, groupLeads);

      for (const leadHours of effectiveLeads) {
        if (!isInsideReminderWindow(assignment.startsAt, leadHours, now)) {
          continue;
        }
        const outcome = await this.writeDutyReminder(assignment, membershipId, leadHours);
        if (outcome === 'created') {
          created += 1;
        } else if (outcome === 'duplicate') {
          duplicate += 1;
        } else {
          skipped += 1;
        }
      }
    }

    return { created, duplicate, skipped };
  }

  private async loadContext(now: Date): Promise<{
    readonly assignments: readonly DutyAssignmentRow[];
    readonly groupLeadsByGroupId: ReadonlyMap<string, number[]>;
    readonly preferencesByMembershipId: ReadonlyMap<string, number[] | null>;
  }> {
    const maxLeadHours = await this.loadMaximumLeadHours();

    return withTransaction(this.databaseClient, async (transaction) => {
      const [rows, settingsRows, preferenceRows] = await Promise.all([
        transaction
          .select({
            actualMembershipId: shiftAssignments.actualMembershipId,
            businessDate: shiftAssignments.businessDate,
            groupId: schedulePeriods.groupId,
            id: shiftAssignments.id,
            plannedMembershipId: shiftAssignments.plannedMembershipId,
            shiftTypeName: shiftAssignments.shiftTypeName,
            startsAt: shiftAssignments.startsAt,
          })
          .from(shiftAssignments)
          .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
          .innerJoin(groups, and(eq(groups.id, schedulePeriods.groupId), isNull(groups.deletedAt)))
          .where(
            and(
              eq(schedulePeriods.status, 'published'),
              isNull(schedulePeriods.deletedAt),
              isNull(shiftAssignments.deletedAt),
              gt(shiftAssignments.startsAt, now),
              lte(shiftAssignments.startsAt, addHours(now, maxLeadHours)),
            ),
          ),
        transaction.select().from(notificationSettings),
        transaction.select().from(notificationPreferences),
      ]);

      const groupLeadsByGroupId = new Map(
        settingsRows.map((row) => [
          row.groupId,
          normalizeReminderHours(row.dutyReminderHours, defaultDutyReminderHours),
        ]),
      );
      const preferencesByMembershipId = new Map(
        preferenceRows.map((row) => [
          row.membershipId,
          row.dutyReminderHours === null ? null : row.dutyReminderHours,
        ]),
      );

      return {
        assignments: rows,
        groupLeadsByGroupId,
        preferencesByMembershipId,
      };
    });
  }

  private async loadMaximumLeadHours(): Promise<number> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [settingsRows, preferenceRows] = await Promise.all([
        transaction
          .select({ dutyReminderHours: notificationSettings.dutyReminderHours })
          .from(notificationSettings),
        transaction
          .select({ dutyReminderHours: notificationPreferences.dutyReminderHours })
          .from(notificationPreferences),
      ]);

      let maximum = Math.max(...defaultDutyReminderHours);
      for (const row of settingsRows) {
        for (const hour of normalizeReminderHours(row.dutyReminderHours, [])) {
          maximum = Math.max(maximum, hour);
        }
      }
      for (const row of preferenceRows) {
        if (row.dutyReminderHours !== null) {
          for (const hour of normalizeReminderHours(row.dutyReminderHours, [])) {
            maximum = Math.max(maximum, hour);
          }
        }
      }

      return Math.min(maximum, maximumReminderHours);
    });
  }

  private async writeDutyReminder(
    assignment: DutyAssignmentRow,
    membershipId: string,
    leadHours: number,
  ): Promise<'created' | 'duplicate' | 'skipped'> {
    const batchKey = `duty-reminder:${assignment.id}:${leadHours}`;
    return withTransaction(this.databaseClient, async (transaction) => {
      if (!(await claimBatch(transaction, batchKey, 'duty_reminder'))) {
        return 'duplicate';
      }

      await this.notificationWriter.append(transaction, {
        body: `您在 ${assignment.businessDate} 的 ${assignment.shiftTypeName} 值班将在 ${leadHours} 小时后开始。`,
        groupId: assignment.groupId,
        notificationType: 'duty_reminder',
        objectId: assignment.id,
        objectType: 'shift_assignment',
        payload: { leadHours },
        recipientMembershipIds: [membershipId],
        shiftAssignmentId: assignment.id,
        title: '值班提醒',
      });

      return 'created';
    });
  }

  private async writeVacancyReminder(
    assignment: DutyAssignmentRow,
    context: {
      readonly groupLeadsByGroupId: ReadonlyMap<string, number[]>;
    },
    now: Date,
  ): Promise<'created' | 'duplicate' | 'skipped'> {
    const groupLeads = context.groupLeadsByGroupId.get(assignment.groupId) ?? [
      ...defaultDutyReminderHours,
    ];
    const largestLead = Math.max(...groupLeads);
    if (!isInsideReminderWindow(assignment.startsAt, largestLead, now)) {
      return 'skipped';
    }

    const batchKey = `vacancy-reminder:${assignment.id}`;
    return withTransaction(this.databaseClient, async (transaction) => {
      if (!(await claimBatch(transaction, batchKey, 'vacancy_reminder'))) {
        return 'duplicate';
      }

      await this.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: `您在 ${assignment.businessDate} 的 ${assignment.shiftTypeName} 值班暂时无人值守，请尽快安排补位。`,
        groupId: assignment.groupId,
        notificationType: 'vacancy_reminder',
        objectId: assignment.id,
        objectType: 'shift_assignment',
        payload: { leadHours: largestLead },
        shiftAssignmentId: assignment.id,
        title: '值班空缺提醒',
      });

      return 'created';
    });
  }
}

function isInsideReminderWindow(startsAt: Date, leadHours: number, now: Date): boolean {
  const windowStart = new Date(startsAt.valueOf() - leadHours * 60 * 60 * 1000);
  return now >= windowStart && now < startsAt;
}

function addHours(value: Date, hours: number): Date {
  return new Date(value.valueOf() + hours * 60 * 60 * 1000);
}
