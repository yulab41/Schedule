import { workspaceName } from '@schedule/contracts/workspace-name';

export { calculateReadableTextColor, calculateShiftEndDate } from './shift-time.js';
export {
  findLeaveOverlappingAssignments,
  intervalsOverlap,
  leaveOverlapsInterval,
  type BusinessDateIntervalInput,
  type LeaveIntervalInput,
  type MemberTimeInterval,
  type TimeIntervalInput,
} from './leave/overlap.js';
export {
  assertSchedulePeriodTransition,
  canTransitionSchedulePeriod,
  schedulePeriodStatuses,
  type SchedulePeriodStatus,
} from './schedule-period.js';
export {
  assertBusinessMonthContainsDate,
  chinaStandardTimeOffsetMilliseconds,
  formatChinaDateTime,
  formatChinaStandardTime,
  getChinaStandardTimeBusinessDate,
  getChinaStandardTimeCalendarDate,
  getCurrentBusinessMonth,
  isPastBusinessDate,
  isPastBusinessMonth,
  toChinaStandardTimeUtcTimestamp,
  toChinaStandardTimeShiftRange,
  type ChinaDateTimeFormatOptions,
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
export { findContinuousDutyWarnings, findScheduleHardConflicts } from './conflicts.js';
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

export { assertBusinessDate, getBusinessDates } from './business-dates.js';
export { createAssignmentBusinessKey } from './assignment-key.js';
export type {
  ScheduleAssignmentSnapshot,
  ScheduleHardConflict,
  ContinuousDutyWarning,
  ScheduleVacancy,
} from './assignment-types.js';
