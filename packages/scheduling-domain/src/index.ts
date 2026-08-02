import { workspaceName } from '@schedule/contracts';

export { calculateReadableTextColor, calculateShiftEndDate } from './shift-time.js';
export {
  findLeaveOverlappingAssignments,
  intervalsOverlap,
  type MemberTimeInterval,
  type TimeIntervalInput,
} from './leave/overlap.js';
export {
  reflowLeaveAssignments,
  type LeaveReflowInput,
  type LeaveReflowInterval,
  type LeaveReflowResult,
  type LeaveReflowStrategy,
  type ReflowAssignment,
  type ReflowConflict,
  type ReflowMember,
  type ReflowRotationRule,
  type ReflowVacancy,
} from './leave/reflow.js';
export {
  assertSchedulePeriodTransition,
  canTransitionSchedulePeriod,
  schedulePeriodStatuses,
  type SchedulePeriodStatus,
} from './schedule-period.js';
export {
  assertBusinessMonthContainsDate,
  getChinaStandardTimeBusinessDate,
  toChinaStandardTimeShiftRange,
  type ChinaStandardTimeShiftRange,
  type ChinaStandardTimeShiftRangeInput,
} from './time.js';
export {
  calculateMonthStatistics,
  mergeMonthStatistics,
  type StatisticsCalculationInput,
  type StatisticsAssignmentInput,
  type StatisticsHolidayInput,
  type StatisticsMemberNameInput,
  type StatisticsWorkflowCountInput,
} from './statistics/calculate.js';
export { findContinuousDutyWarnings, findRotationHardConflicts } from './conflicts.js';
export {
  assertBusinessDate,
  assertRotationRule,
  findEligibleRotationMember,
  getBusinessDates,
  getRotationCursor,
  isRotationMemberEligible,
} from './rotation/cursor.js';
export { createRotationBusinessKey, generateRotation } from './rotation/generate.js';
export type {
  ContinuousDutyWarning,
  GeneratedRotationAssignment,
  RotationCursor,
  RotationCursorInput,
  RotationGenerationInput,
  RotationGenerationResult,
  RotationHardConflict,
  RotationMember,
  RotationRule,
  RotationShiftType,
  RotationVacancy,
} from './rotation/types.js';
export {
  applyManualTemplate,
  createManualAssignmentBusinessKey,
  type ManualApplyCell,
  type ManualApplyConflict,
  type ManualApplyMember,
  type ManualApplyResult,
  type ManualApplyShiftType,
  type ManualApplyTemplateInput,
  type ManualApplyVacancy,
  type ManualLeaveInterval,
} from './manual/apply-template.js';

export function createDomainSummary(): string {
  return `${workspaceName} domain is ready.`;
}
