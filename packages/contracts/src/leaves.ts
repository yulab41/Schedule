import type { ScheduleGenerationVacancy, ScheduleGenerationWarning } from './schedules.js';

export type LeaveRequestType = 'training' | 'rotation' | 'sick' | 'maternity' | 'other';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveReflowStrategy = 'keep-original-order' | 'shift-forward';
export type LeaveResolutionMode = 'manual' | 'shift-forward';

export interface CreateLeaveRequestInput {
  readonly endsAt: string;
  readonly isAllDay?: boolean;
  readonly leaveType: LeaveRequestType;
  readonly reason: string;
  readonly resolutionMode?: LeaveResolutionMode;
  readonly startsAt: string;
}

export interface LeaveAffectedShift {
  readonly assignmentId: string;
  readonly businessDate: string;
  readonly isCovered: boolean;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeName: string;
}

export interface LeaveAffectedShiftsInput {
  readonly endsAt: string;
  readonly isAllDay?: boolean;
  readonly startsAt: string;
}

export interface LeaveRequest {
  readonly approverUserId?: string;
  readonly createdAt: string;
  readonly decidedByMemberName?: string;
  readonly decidedAt?: string;
  readonly endsAt: string;
  readonly groupId: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isRevocable?: boolean;
  readonly leaveType: LeaveRequestType;
  readonly memberName?: string;
  readonly membershipId: string;
  readonly reason: string;
  readonly reflowStrategy: LeaveReflowStrategy;
  readonly revocationBlockedReason?: string;
  readonly startsAt: string;
  readonly status: LeaveRequestStatus;
  readonly version: number;
}

export interface LeaveAffectedAssignment {
  readonly assignmentId: string;
  readonly businessDate: string;
  readonly endsAt: string;
  readonly nextMemberId?: string;
  readonly nextMemberName?: string;
  readonly previousMemberId?: string;
  readonly previousMemberName?: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
  readonly slotPosition: number;
  readonly startsAt: string;
}

export interface LeaveReflowConflict {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'MEMBER_LEAVE_OVERLAP' | 'MEMBER_TIME_OVERLAP';
  readonly memberName?: string;
  readonly membershipId: string;
}

export interface LeaveMemberStatisticsDelta {
  readonly assignmentDelta: number;
  readonly countedDelta: number;
  readonly membershipId: string;
  readonly realName: string;
  readonly weekendDelta: number;
}

export interface LeaveStatisticsDelta {
  readonly byMember: readonly LeaveMemberStatisticsDelta[];
  readonly totalAssignmentDelta: number;
  readonly totalCountedDelta: number;
  readonly totalWeekendDelta: number;
}

export interface LeaveReflowPreview {
  readonly affectedAssignments: readonly LeaveAffectedAssignment[];
  readonly conflicts: readonly LeaveReflowConflict[];
  readonly continuousDutyWarnings: readonly ScheduleGenerationWarning[];
  readonly groupDefaultStrategy: LeaveReflowStrategy;
  readonly leaveRequestId: string;
  readonly leaveRequestVersion: number;
  readonly periodVersions: Readonly<Record<string, number>>;
  readonly rulesVersion: number;
  readonly statisticsDelta: LeaveStatisticsDelta;
  readonly strategy: LeaveReflowStrategy;
  readonly vacancies: readonly ScheduleGenerationVacancy[];
}

export interface PreviewLeaveRequestInput {
  readonly strategy?: LeaveReflowStrategy;
}

export interface ApproveLeaveRequestInput {
  readonly acknowledgeBlockers?: boolean;
  readonly expectedPeriodVersions: Readonly<Record<string, number>>;
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly strategy?: LeaveReflowStrategy;
}

export interface RejectLeaveRequestInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface LeaveRequestMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface LeaveRequestMutationResult {
  readonly leaveRequestId: string;
  readonly operationId: string;
  readonly status: 'cancelled' | 'revoked';
}

export interface ApprovedLeaveRequestResult {
  readonly leaveRequest: LeaveRequest;
  readonly operationId: string;
  readonly preview: LeaveReflowPreview;
  readonly status: 'approved';
  readonly strategy: LeaveReflowStrategy;
}

export interface RejectedLeaveRequestResult {
  readonly leaveRequest: LeaveRequest;
  readonly operationId: string;
  readonly status: 'rejected';
}

export interface GroupLeaveReflowStrategy {
  readonly strategy: LeaveReflowStrategy;
}

export interface UpdateGroupLeaveReflowStrategyInput {
  readonly strategy: LeaveReflowStrategy;
}
