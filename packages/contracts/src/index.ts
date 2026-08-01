export interface SystemStatus {
  component: 'api' | 'web';
  ready: boolean;
  summary: string;
}

export const workspaceName = 'medical-staff-scheduling-system';
