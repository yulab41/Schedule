import type { SystemStatus } from '@schedule/contracts';
import { createDomainSummary } from '@schedule/scheduling-domain';

export { EnvironmentValidationError, loadEnvironment } from './config/env.js';

export function getApiStatus(): SystemStatus {
  return {
    component: 'api',
    ready: true,
    summary: createDomainSummary(),
  };
}
