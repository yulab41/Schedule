import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  createDatabaseClient,
  dutyAdjustments,
  groups,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  swapRequests,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import { ScheduleRepository } from './modules/schedules/schedule-repository.js';
import { StatisticsService } from './modules/statistics/statistics-service.js';

const recoveryInputSchema = z.object({
  actorUserId: z.string().uuid(),
  archivePeriodId: z.string().uuid(),
  archiveVersion: z.number().int().positive(),
  currentPeriodId: z.string().uuid(),
  currentVersion: z.number().int().positive(),
  groupId: z.string().uuid(),
  scheduleRoleId: z.string().uuid(),
});

export type DecemberRecoveryInput = z.infer<typeof recoveryInputSchema>;

/** One-off, fail-closed recovery of the known 2026-12 monthly overwrite. */
export async function recoverDecember2026(
  client: DatabaseClient,
  input: DecemberRecoveryInput,
  apply: boolean,
): Promise<{ state: 'ready' | 'restored'; activeDays: number; revision: number }> {
  recoveryInputSchema.parse(input);
  return withTransaction(client, async (transaction) => {
    // Match normal publication's lock order: group/role scope, then periods and shifts.
    const [scope] = await transaction
      .select({ id: scheduleRoles.id })
      .from(scheduleRoles)
      .innerJoin(groups, eq(groups.id, scheduleRoles.groupId))
      .where(
        and(
          eq(scheduleRoles.id, input.scheduleRoleId),
          eq(groups.id, input.groupId),
          isNull(scheduleRoles.deletedAt),
          isNull(groups.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (scope === undefined) throw new Error('Recovery scope guard failed; no data changed.');
    const periods = await transaction
      .select()
      .from(schedulePeriods)
      .where(inArray(schedulePeriods.id, [input.currentPeriodId, input.archivePeriodId]))
      .for('update');
    const current = periods.find((period) => period.id === input.currentPeriodId);
    const archive = periods.find((period) => period.id === input.archivePeriodId);
    if (
      periods.length !== 2 ||
      current?.groupId !== input.groupId ||
      archive?.groupId !== input.groupId ||
      current.scheduleRoleId !== input.scheduleRoleId ||
      archive.scheduleRoleId !== input.scheduleRoleId ||
      current.businessMonth !== '2026-12-01' ||
      archive.businessMonth !== current.businessMonth ||
      current.status !== 'published' ||
      archive.status !== 'replaced' ||
      current.deletedAt !== null ||
      archive.deletedAt !== null ||
      current.version !== input.currentVersion ||
      archive.version !== input.archiveVersion ||
      current.rulesVersion !== archive.rulesVersion
    ) {
      throw new Error('Recovery period/version/rules guard failed; no data changed.');
    }
    const currentRows = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(eq(shiftAssignments.schedulePeriodId, current.id), isNull(shiftAssignments.deletedAt)),
      )
      .for('update');
    const archivedRows = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(eq(shiftAssignments.schedulePeriodId, archive.id), isNull(shiftAssignments.deletedAt)),
      )
      .for('update');
    const missingDates = Array.from(
      { length: 30 },
      (_, index) => `2026-12-${String(index + 1).padStart(2, '0')}`,
    );
    if (
      currentRows.length !== 1 ||
      currentRows[0]?.businessDate !== '2026-12-31' ||
      archivedRows.length !== 30 ||
      archivedRows
        .map((row) => row.businessDate)
        .sort()
        .some((date, index) => date !== missingDates[index])
    ) {
      throw new Error('Recovery date-set guard failed; no data changed.');
    }
    const archivedIds = archivedRows.map((row) => row.id);
    const [swaps, adjustments] = await Promise.all([
      transaction
        .select({ id: swapRequests.id })
        .from(swapRequests)
        .where(
          or(
            inArray(swapRequests.initiatorAssignmentId, archivedIds),
            inArray(swapRequests.targetAssignmentId, archivedIds),
          ),
        )
        .limit(1),
      transaction
        .select({ id: dutyAdjustments.id })
        .from(dutyAdjustments)
        .where(inArray(dutyAdjustments.coveredAssignmentId, archivedIds))
        .limit(1),
    ]);
    if (swaps.length > 0 || adjustments.length > 0) {
      throw new Error('Archived shifts have workflow records; recovery paused without writing.');
    }
    if (!apply) return { state: 'ready', activeDays: 1, revision: current.revision };

    const repository = new ScheduleRepository(client);
    const merged = await repository.mergePublishedInTransaction(transaction, {
      actorUserId: input.actorUserId,
      expectedVersion: archive.version,
      operationId: randomUUID(),
      schedulePeriodId: archive.id,
    });
    await new StatisticsService(client).refreshInTransaction(
      transaction,
      input.groupId,
      '2026-12-01',
    );
    const after = await transaction
      .select({ businessDate: shiftAssignments.businessDate, id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(
        and(eq(shiftAssignments.schedulePeriodId, current.id), isNull(shiftAssignments.deletedAt)),
      );
    const expectedDays = [...missingDates, '2026-12-31'];
    if (
      merged.id !== current.id ||
      after.length !== 31 ||
      after
        .map((row) => row.businessDate)
        .sort()
        .some((date, index) => date !== expectedDays[index]) ||
      after.find((row) => row.businessDate === '2026-12-31')?.id !== currentRows[0]?.id
    ) {
      throw new Error('Recovery readback failed; transaction rolled back.');
    }
    return { state: 'restored', activeDays: after.length, revision: merged.revision };
  });
}

function parseArguments(args: readonly string[]): { apply: boolean; input: DecemberRecoveryInput } {
  const [
    action,
    groupId,
    scheduleRoleId,
    currentPeriodId,
    archivePeriodId,
    currentVersion,
    archiveVersion,
    actorUserId,
  ] = args;
  if ((action !== 'inspect' && action !== 'restore') || args.length !== 8) {
    throw new Error(
      'Usage: inspect|restore GROUP ROLE CURRENT ARCHIVE CURRENT_VERSION ARCHIVE_VERSION ACTOR',
    );
  }
  return {
    apply: action === 'restore',
    input: recoveryInputSchema.parse({
      actorUserId,
      archivePeriodId,
      archiveVersion: Number(archiveVersion),
      currentPeriodId,
      currentVersion: Number(currentVersion),
      groupId,
      scheduleRoleId,
    }),
  };
}

async function run(): Promise<void> {
  const { apply, input } = parseArguments(process.argv.slice(2));
  const environment = z
    .object({
      MYSQL_HOST: z.string().min(1),
      MYSQL_PORT: z.coerce.number().int().min(1).max(65535),
      MYSQL_DATABASE: z.string().min(1),
      MYSQL_USER: z.string().min(1),
      MYSQL_PASSWORD: z.string().min(1),
    })
    .parse(process.env);
  const client = createDatabaseClient({
    host: environment.MYSQL_HOST,
    port: environment.MYSQL_PORT,
    database: environment.MYSQL_DATABASE,
    user: environment.MYSQL_USER,
    password: environment.MYSQL_PASSWORD,
  });
  try {
    process.stdout.write(`${JSON.stringify(await recoverDecember2026(client, input, apply))}\n`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void run().catch(() => {
    process.stderr.write(
      'December recovery guard failed; no details or business data were printed.\n',
    );
    process.exitCode = 1;
  });
}
