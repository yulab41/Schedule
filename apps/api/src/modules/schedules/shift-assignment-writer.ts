import { shiftAssignments, type DatabaseTransaction } from '@schedule/database';
import { sql, type SQL } from 'drizzle-orm';
import type { MySqlUpdateSetSource } from 'drizzle-orm/mysql-core/query-builders/update';

type ShiftAssignmentUpdateSet = Omit<
  MySqlUpdateSetSource<typeof shiftAssignments>,
  'startsAt' | 'version'
>;

export async function updateShiftAssignments(
  transaction: DatabaseTransaction,
  where: SQL | undefined,
  changes: ShiftAssignmentUpdateSet,
): Promise<void> {
  await transaction
    .update(shiftAssignments)
    .set({
      ...changes,
      // Why: CynosDB runs with explicit_defaults_for_timestamp=OFF, so a
      // TIMESTAMP column can be silently rewritten by an implicit ON UPDATE
      // CURRENT_TIMESTAMP; re-pinning starts_at keeps every assignment update
      // from moving the shift time.
      startsAt: sql`${shiftAssignments.startsAt}`,
      version: sql`${shiftAssignments.version} + 1`,
    })
    .where(where);
}
