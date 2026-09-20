import { randomUUID } from 'node:crypto';

import type {
  CalendarChangeEntry,
  CalendarChangeKind,
  CalendarChangesReadModel,
} from '@schedule/contracts';
import {
  groupCalendarChanges,
  groups,
  holidayCalendarVersions,
  schedulePeriods,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { CalendarLedgerProbeCache } from './calendar-ledger-probe-cache.js';

/** Rows kept per group before the oldest deltas are pruned. */
export const CALENDAR_CHANGE_RETENTION = 500;
/** Retention age in days; pruning by age also forces a resync for stale cursors. */
export const CALENDAR_CHANGE_MAX_AGE_DAYS = 90;

export interface CalendarChangeInput {
  readonly businessMonth?: string | null | undefined;
  readonly kind: CalendarChangeKind;
}

/**
 * Appends one calendar change for a group.
 *
 * Callers must already be inside the transaction that performs the write, so a
 * committed business change always has a committed ledger row. `seq` mirrors
 * the group's monotonic `calendar_revision`, which is what clients use as their
 * incremental cursor.
 */
export async function recordCalendarChange(
  transaction: DatabaseTransaction,
  groupId: string,
  change: CalendarChangeInput,
): Promise<number> {
  await transaction
    .update(groups)
    .set({ calendarRevision: sql`${groups.calendarRevision} + 1` })
    .where(eq(groups.id, groupId));
  const [row] = await transaction
    .select({ revision: groups.calendarRevision })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  const seq = row?.revision ?? 0;
  if (seq === 0) {
    // The group vanished underneath us; the write is already failing elsewhere.
    return 0;
  }
  await transaction.insert(groupCalendarChanges).values({
    businessMonth: normalizeBusinessMonth(change.businessMonth),
    groupId,
    id: randomUUID(),
    kind: change.kind,
    seq,
  });
  if (seq > CALENDAR_CHANGE_RETENTION) await pruneCalendarChanges(transaction, groupId, seq);
  return seq;
}

/**
 * Resolves the business month a schedule period belongs to.
 *
 * Returns `null` when the period is unknown, which the client reads as "every
 * cached month may be stale".
 */
export async function resolvePeriodBusinessMonth(
  transaction: DatabaseTransaction,
  groupId: string,
  schedulePeriodId: string | null | undefined,
): Promise<string | null> {
  if (schedulePeriodId === null || schedulePeriodId === undefined) return null;
  const [row] = await transaction
    .select({ businessMonth: schedulePeriods.businessMonth })
    .from(schedulePeriods)
    .where(and(eq(schedulePeriods.id, schedulePeriodId), eq(schedulePeriods.groupId, groupId)))
    .limit(1);
  return row === undefined ? null : row.businessMonth.slice(0, 7);
}

export class CalendarChangeQuery {
  private readonly permissionService = new GroupPermissionService();
  private readonly ledgerProbes = new CalendarLedgerProbeCache();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async authorize(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
    await withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
    });
  }

  public async readChanges(
    identity: AuthenticatedIdentity,
    groupId: string,
    since: number,
  ): Promise<CalendarChangesReadModel> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const group = authorization.group.id;

      const changes = await this.readDelta(transaction, group, since);
      const revision = await readGroupRevision(transaction, group);
      const diverged = await this.ledgerProbes.check(group, revision, () =>
        calendarLedgerDiverged(transaction, group),
      );
      const holidayVersions = await this.readHolidayVersions(transaction);

      if (!diverged) {
        return {
          changes,
          holidayVersions,
          resync: needsResync(since, changes, revision),
          revision,
        };
      }

      // A write path forgot to bump the ledger. Absorb the divergence instead of
      // serving a delta that silently omits it: record a catch-all change now so
      // the next validation settles, and ask this client for a full window read.
      await recordCalendarChange(transaction, group, { businessMonth: null, kind: 'config' });
      const repairedRevision = await readGroupRevision(transaction, group);
      return {
        changes: await this.readDelta(transaction, group, since),
        holidayVersions,
        resync: true,
        revision: repairedRevision,
      };
    });
  }

  private async readDelta(
    transaction: DatabaseTransaction,
    groupId: string,
    since: number,
  ): Promise<readonly CalendarChangeEntry[]> {
    if (since <= 0) return [];
    const rows = await transaction
      .select({
        businessMonth: groupCalendarChanges.businessMonth,
        changedAt: groupCalendarChanges.changedAt,
        kind: groupCalendarChanges.kind,
        seq: groupCalendarChanges.seq,
      })
      .from(groupCalendarChanges)
      .where(and(eq(groupCalendarChanges.groupId, groupId), gt(groupCalendarChanges.seq, since)))
      .orderBy(asc(groupCalendarChanges.seq))
      .limit(CALENDAR_CHANGE_RETENTION);
    return rows.map((row) => ({
      ...(row.businessMonth === null ? {} : { businessMonth: row.businessMonth }),
      changedAt: row.changedAt.toISOString(),
      kind: row.kind,
      seq: row.seq,
    }));
  }

  private async readHolidayVersions(
    transaction: DatabaseTransaction,
  ): Promise<readonly { readonly version: number; readonly year: number }[]> {
    const rows = await transaction
      .select({
        version: sql<number>`max(${holidayCalendarVersions.version})`,
        year: holidayCalendarVersions.year,
      })
      .from(holidayCalendarVersions)
      .where(
        and(
          isNull(holidayCalendarVersions.deletedAt),
          eq(holidayCalendarVersions.status, 'confirmed'),
        ),
      )
      .groupBy(holidayCalendarVersions.year)
      .orderBy(asc(holidayCalendarVersions.year));
    return rows.map((row) => ({ version: Number(row.version) || 0, year: row.year }));
  }
}

export function needsResync(
  since: number,
  changes: readonly CalendarChangeEntry[],
  revision: number,
): boolean {
  if (since === 0) {
    // No cursor at all: only safe to answer "nothing changed" when nothing was
    // ever recorded for this group.
    return revision > 0;
  }
  if (since > revision) return true;
  if (changes.length === CALENDAR_CHANGE_RETENTION) return true;
  if (changes.length !== revision - since) return true;
  return changes.some((change, index) => change.seq !== since + index + 1);
}

/**
 * Detects a calendar-affecting write that never reached the ledger.
 *
 * Every calendar table carries `updated_at`/`deleted_at`, so comparing the
 * newest such timestamp against the newest ledger row is a cheap safety net: a
 * missed bump degrades one client to a full window read instead of leaving it
 * permanently stale. Deletions count too, which a plain "max updated_at on live
 * rows" comparison would miss. `schedule_events` is append-only and has neither
 * `updated_at` nor `deleted_at`, so it contributes `occurred_at`; that value is
 * clamped to the current timestamp so a source clock running ahead can never
 * keep a group permanently divergent.
 */
export async function calendarLedgerDiverged(
  transaction: DatabaseTransaction,
  groupId: string,
): Promise<boolean> {
  const [rows] = await transaction.execute(
    sql`SELECT (
      GREATEST(
        COALESCE((SELECT MAX(GREATEST(updated_at, COALESCE(deleted_at, updated_at))) FROM schedule_periods WHERE group_id = ${groupId}), '1970-01-01 00:00:00.000'),
        COALESCE((SELECT MAX(GREATEST(sa.updated_at, COALESCE(sa.deleted_at, sa.updated_at))) FROM shift_assignments sa JOIN schedule_periods sp ON sp.id = sa.schedule_period_id WHERE sp.group_id = ${groupId}), '1970-01-01 00:00:00.000'),
        LEAST(COALESCE((SELECT MAX(occurred_at) FROM schedule_events WHERE group_id = ${groupId}), '1970-01-01 00:00:00.000'), CURRENT_TIMESTAMP(3)),
        COALESCE((SELECT MAX(GREATEST(updated_at, COALESCE(deleted_at, updated_at))) FROM shift_types WHERE group_id = ${groupId}), '1970-01-01 00:00:00.000'),
        COALESCE((SELECT MAX(GREATEST(updated_at, COALESCE(deleted_at, updated_at))) FROM schedule_roles WHERE group_id = ${groupId}), '1970-01-01 00:00:00.000'),
        COALESCE((SELECT MAX(GREATEST(gm.updated_at, COALESCE(gm.deleted_at, gm.updated_at))) FROM group_memberships gm WHERE gm.group_id = ${groupId}), '1970-01-01 00:00:00.000'),
        COALESCE((SELECT MAX(GREATEST(gmc.updated_at, COALESCE(gmc.deleted_at, gmc.updated_at))) FROM group_member_contacts gmc JOIN group_memberships gm2 ON gm2.id = gmc.membership_id WHERE gm2.group_id = ${groupId}), '1970-01-01 00:00:00.000')
      ) > COALESCE((SELECT MAX(changed_at) FROM group_calendar_changes WHERE group_id = ${groupId}), '1970-01-01 00:00:00.000')
    ) AS diverged`,
  );
  const [first] = asRows(rows);
  return Number(first?.diverged ?? 0) === 1;
}

async function readGroupRevision(
  transaction: DatabaseTransaction,
  groupId: string,
): Promise<number> {
  const [row] = await transaction
    .select({ revision: groups.calendarRevision })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  return row?.revision ?? 0;
}

/**
 * Keeps the ledger bounded: the newest {@link CALENDAR_CHANGE_RETENTION} rows or
 * {@link CALENDAR_CHANGE_MAX_AGE_DAYS} days, whichever is tighter.
 *
 * Retention is expressed purely from the cursor value, so the statement never
 * has to read the table it deletes from.
 */
async function pruneCalendarChanges(
  transaction: DatabaseTransaction,
  groupId: string,
  currentSeq: number,
): Promise<void> {
  await transaction.execute(
    sql`DELETE FROM group_calendar_changes
      WHERE group_id = ${groupId}
        AND (
          seq <= ${Math.max(currentSeq - CALENDAR_CHANGE_RETENTION, 0)}
          OR changed_at < TIMESTAMPADD(DAY, -${CALENDAR_CHANGE_MAX_AGE_DAYS}, CURRENT_TIMESTAMP(3))
        )`,
  );
}

function normalizeBusinessMonth(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return /^\d{4}-\d{2}$/u.test(value) ? value : null;
}

function asRows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? (value as readonly Record<string, unknown>[]) : [];
}
