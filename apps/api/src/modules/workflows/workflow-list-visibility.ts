import { dutyAdjustments, leaveRequests, swapRequests } from '@schedule/database';
import { getChinaStandardTimeCalendarDate } from '@schedule/scheduling-domain';
import { isNull, sql, type SQL } from 'drizzle-orm';

export function workflowListCondition(kind: 'swap' | 'duty' | 'leave'): SQL {
  const table = kind === 'swap' ? swapRequests : kind === 'duty' ? dutyAdjustments : leaveRequests;
  return isNull(table.listHiddenAt);
}

// Only the nightly maintenance job evaluates expiry; request reads use stored indexed state.
// Missing assignment dates and pending requests remain visible for investigation/review.
export function expiredWorkflowListCondition(kind: 'swap' | 'duty' | 'leave', now: Date): SQL {
  const monthStart = `${getChinaStandardTimeCalendarDate(now).slice(0, 7)}-01`;
  if (kind === 'leave') {
    const monthStartInstant = new Date(`${monthStart}T00:00:00+08:00`)
      .toISOString()
      .slice(0, 23)
      .replace('T', ' ');
    return sql`(${leaveRequests.status} IN ('approved', 'rejected')
      AND ${leaveRequests.endsAt} <= ${monthStartInstant})`;
  }
  if (kind === 'duty') {
    return sql`(${dutyAdjustments.status} IN ('completed', 'rejected', 'cancelled', 'revoked')
      AND EXISTS (SELECT 1 FROM shift_assignments AS history_shift
        WHERE history_shift.id = ${dutyAdjustments.coveredAssignmentId}
          AND history_shift.business_date < ${monthStart}))`;
  }
  return sql`(${swapRequests.status} IN ('completed', 'rejected', 'cancelled', 'revoked')
    AND EXISTS (SELECT 1 FROM shift_assignments AS history_initiator
      WHERE history_initiator.id = ${swapRequests.initiatorAssignmentId}
        AND history_initiator.business_date < ${monthStart})
    AND EXISTS (SELECT 1 FROM shift_assignments AS history_target
      WHERE history_target.id = ${swapRequests.targetAssignmentId}
        AND history_target.business_date < ${monthStart}))`;
}
