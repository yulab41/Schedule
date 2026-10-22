import { shiftAssignments, type DatabaseTransaction } from '@schedule/database';
import { inArray } from 'drizzle-orm';
import { ApiError } from '../../plugins/error-handler.js';

export interface AssignmentVersion {
  readonly id: string;
  readonly version: number;
}

// Called inside the workflow transaction, after idempotency lookup. Holding the
// assignment locks closes the gap between a preview and the domain mutation.
export async function guardAssignmentVersions(
  transaction: DatabaseTransaction,
  expected: readonly AssignmentVersion[] | undefined,
): Promise<void> {
  if (expected === undefined) return;
  const rows = await transaction
    .select({ id: shiftAssignments.id, version: shiftAssignments.version })
    .from(shiftAssignments)
    .where(
      inArray(
        shiftAssignments.id,
        expected.map((row) => row.id),
      ),
    )
    .orderBy(shiftAssignments.id)
    .for('update');
  if (
    rows.length !== expected.length ||
    expected.some(
      (row) => !rows.some((current) => current.id === row.id && current.version === row.version),
    )
  ) {
    throw new ApiError({
      code: 'CONFLICT',
      statusCode: 409,
      userMessage: '排班已变化，请重新预览。',
    });
  }
}
