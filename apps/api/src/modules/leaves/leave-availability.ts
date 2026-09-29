import { leaveRequests, type DatabaseTransaction } from '@schedule/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  getChinaStandardTimeCalendarDate,
  leaveOverlapsInterval,
} from '@schedule/scheduling-domain';
import { ApiError } from '../../plugins/error-handler.js';

export const publishedLeaveConflictMessage =
  '请假期间仍有已发布班次，暂不能提交。请先通过“换班”或“加扣班”调整班次，或联系管理员撤回相关排班发布。';

export async function loadBlockingLeaves(transaction: DatabaseTransaction, groupId: string) {
  return transaction
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.groupId, groupId),
        inArray(leaveRequests.status, ['pending', 'approved']),
        isNull(leaveRequests.deletedAt),
      ),
    );
}

export function leaveIntersectsDateRange(
  leave: typeof leaveRequests.$inferSelect,
  startDate: string,
  endDate: string,
): boolean {
  if (leave.isAllDay === 1) {
    return (
      getChinaStandardTimeCalendarDate(leave.startsAt) <= endDate &&
      getChinaStandardTimeCalendarDate(leave.endsAt) > startDate
    );
  }
  return (
    leave.startsAt.valueOf() < new Date(`${endDate}T00:00:00+08:00`).valueOf() + 86_400_000 &&
    leave.endsAt > new Date(`${startDate}T00:00:00+08:00`)
  );
}

export async function assertMembersAvailableInRange(
  transaction: DatabaseTransaction,
  groupId: string,
  membershipIds: readonly string[],
  startDate: string,
  endDate: string,
  memberNames?: ReadonlyMap<string, string>,
): Promise<void> {
  const selected = new Set(membershipIds);
  const blocked = (await loadBlockingLeaves(transaction, groupId)).filter(
    (leave) =>
      selected.has(leave.membershipId) && leaveIntersectsDateRange(leave, startDate, endDate),
  );
  if (blocked.length > 0)
    throw new ApiError({
      code: 'CONFLICT',
      statusCode: 409,
      userMessage: `所选成员${[...new Set(blocked.map((leave) => memberNames?.get(leave.membershipId) ?? ''))].filter(Boolean).join('、')}在排班期间有待审批或已批准请假，请调整成员或日期后重试。`,
    });
}

export async function assertAssignmentsAvailable(
  transaction: DatabaseTransaction,
  groupId: string,
  assignments: readonly {
    readonly businessDate: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly actualMembershipId?: string | null;
    readonly plannedMembershipId: string | null;
  }[],
): Promise<void> {
  const leaves = await loadBlockingLeaves(transaction, groupId);
  if (
    assignments.some((assignment) =>
      leaves.some(
        (leave) =>
          leave.membershipId ===
            (assignment.actualMembershipId ?? assignment.plannedMembershipId) &&
          leaveOverlapsInterval(leave, assignment),
      ),
    )
  )
    throw leaveSchedulingConflict();
}

function leaveSchedulingConflict() {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '所选成员在排班期间有待审批或已批准请假，请调整成员或日期后重试。',
  });
}
