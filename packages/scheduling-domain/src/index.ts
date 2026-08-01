import { workspaceName } from '@schedule/contracts';

export { calculateReadableTextColor, calculateShiftEndDate } from './shift-time.js';
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

export function createDomainSummary(): string {
  return `${workspaceName} domain is ready.`;
}
