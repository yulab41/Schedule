export * from './errors.js';
export * from './concurrency.js';
export * from './events.js';
export * from './groups.js';
export * from './manual-schedules.js';
export * from './schedules.js';
export * from './scheduling-config.js';
export * from './users.js';
export * from './calendar.js';

export interface SystemStatus {
  component: 'api' | 'web';
  ready: boolean;
  summary: string;
}

export const workspaceName = 'medical-staff-scheduling-system';
