export * from './errors.js';
export * from './groups.js';
export * from './users.js';

export interface SystemStatus {
  component: 'api' | 'web';
  ready: boolean;
  summary: string;
}

export const workspaceName = 'medical-staff-scheduling-system';
