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

export function createDomainSummary(): string {
  return `${workspaceName} domain is ready.`;
}
