import {
  type DatabaseTransaction,
  groupMemberships,
  userProfiles,
  swapRequests,
  dutyAdjustments,
  leaveRequests,
  shiftAssignments,
  schedulePeriods,
  scheduleEvents,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';
import type { NotificationWriteInput } from '../notifications/notification-writer.js';
import {
  chinaDateTime,
  notificationStatus,
  type BusinessTemplateKind,
  type NotificationSnapshot,
} from './wechat-template-profiles.js';

/** Capture business facts inside the successful operation's transaction, before later edits. */
export async function snapshotWechatNotification(
  tx: DatabaseTransaction,
  input: NotificationWriteInput,
  kind: BusinessTemplateKind,
): Promise<NotificationSnapshot> {
  const groupId = input.groupId;
  const snapshot: Record<string, string> = {
    status: notificationStatus(input.notificationType, input.payload),
  };
  if (!groupId) return snapshot;
  const nameForUser = async (userId: string | undefined) => {
    if (!userId) return '';
    const [profile] = await tx
      .select({ name: userProfiles.realName })
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
      .limit(1);
    return profile?.name ?? '';
  };
  const nameForMember = async (id: string) => {
    const [member] = await tx
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.id, id), eq(groupMemberships.groupId, groupId)))
      .limit(1);
    return nameForUser(member?.userId);
  };
  const assignment = async (id: string) => {
    const [row] = await tx
      .select({
        date: shiftAssignments.businessDate,
        shift: shiftAssignments.shiftTypeName,
        abbreviation: shiftAssignments.shiftTypeAbbreviation,
      })
      .from(shiftAssignments)
      .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
      .where(and(eq(shiftAssignments.id, id), eq(schedulePeriods.groupId, groupId)))
      .limit(1);
    return row;
  };
  snapshot.actorName = await nameForUser(input.actorUserId);
  const payload = input.payload ?? {};
  if (kind === 'business') {
    const start = payload.startDate,
      end = payload.endDate,
      month = payload.businessMonth;
    if (typeof start === 'string' && typeof end === 'string') {
      snapshot.startDate = start;
      snapshot.endDate = end;
    } else if (typeof month === 'string' && /^\d{4}-\d{2}(?:-01)?$/u.test(month)) {
      const first = `${month.slice(0, 7)}-01`;
      const date = new Date(`${first}T00:00:00Z`);
      snapshot.startDate = first;
      snapshot.endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
    }
    return snapshot;
  }
  let eventReason: string | null = null;
  if (input.scheduleEventId) {
    const [event] = await tx
      .select({ reason: scheduleEvents.reason })
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, input.scheduleEventId), eq(scheduleEvents.groupId, groupId)))
      .limit(1);
    eventReason = event?.reason ?? null;
  }
  if (kind === 'swap') {
    const id = input.objectId ?? payload.swapRequestId;
    if (typeof id !== 'string') return snapshot;
    const [request] = await tx
      .select()
      .from(swapRequests)
      .where(and(eq(swapRequests.id, id), eq(swapRequests.groupId, groupId)))
      .limit(1);
    if (!request) return snapshot;
    const first = await assignment(request.initiatorAssignmentId),
      second = await assignment(request.targetAssignmentId);
    if (first && second) {
      const dates = [first.date, second.date].sort();
      snapshot.startDate = dates[0]!;
      snapshot.endDate = dates[1]!;
      snapshot.shiftName =
        first.shift === second.shift ? first.shift : `${first.shift}→${second.shift}`;
    }
    const initiator = await nameForMember(request.initiatorMembershipId),
      target = await nameForMember(request.targetMembershipId);
    snapshot.participants = initiator && target ? `${initiator}→${target}` : '';
    snapshot.initiatorName = initiator;
    snapshot.targetName = target;
    if (first && second) {
      snapshot.initiatorDate = first.date;
      snapshot.targetDate = second.date;
      snapshot.initiatorShift = first.abbreviation;
      snapshot.targetShift = second.abbreviation;
    }
    snapshot.reason = eventReason || request.revocationReason || '未填写原因';
  } else if (kind === 'dutyAdjustment') {
    const id = input.objectId ?? payload.dutyAdjustmentId;
    if (typeof id !== 'string') return snapshot;
    const [request] = await tx
      .select()
      .from(dutyAdjustments)
      .where(and(eq(dutyAdjustments.id, id), eq(dutyAdjustments.groupId, groupId)))
      .limit(1);
    if (!request) return snapshot;
    const shift = await assignment(request.coveredAssignmentId);
    if (shift) {
      snapshot.startDate = shift.date;
      snapshot.endDate = shift.date;
      snapshot.shiftName = shift.shift;
    }
    snapshot.reason = eventReason || request.reason || '未填写备注';
  } else {
    const id = input.objectId ?? payload.leaveRequestId;
    if (typeof id !== 'string') return snapshot;
    const [request] = await tx
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.groupId, groupId)))
      .limit(1);
    if (!request) return snapshot;
    snapshot.subjectName = await nameForMember(request.membershipId);
    snapshot.leaveType = {
      training: '进修',
      rotation: '轮转',
      sick: '病假',
      maternity: '产假',
      other: '其他',
    }[request.leaveType];
    snapshot.reason = request.reason || '未填写事由';
    snapshot.appliedAt = chinaDateTime(request.createdAt);
  }
  return snapshot;
}
