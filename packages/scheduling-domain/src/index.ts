import { workspaceName } from '@schedule/contracts';

export function createDomainSummary(): string {
  return `${workspaceName} domain is ready.`;
}
