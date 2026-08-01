import { workspaceName } from '@schedule/contracts';

export { calculateReadableTextColor, calculateShiftEndDate } from './shift-time.js';

export function createDomainSummary(): string {
  return `${workspaceName} domain is ready.`;
}
