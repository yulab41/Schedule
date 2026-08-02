export type ScheduleExportType = 'schedule' | 'statistics';
export type ScheduleExportPeriodType = 'month' | 'year';
export type ScheduleExportStatus = 'completed' | 'failed' | 'pending' | 'running';

export interface CreateScheduleExportInput {
  readonly exportType: ScheduleExportType;
  readonly membershipId?: string;
  readonly period: string;
  readonly roleId?: string;
}

export interface ScheduleExportJob {
  readonly completedAt?: string;
  readonly createdAt: string;
  readonly error?: string;
  readonly expiresAt?: string;
  readonly exportType: ScheduleExportType;
  readonly groupId: string;
  readonly id: string;
  readonly membershipId?: string;
  readonly period: string;
  readonly periodType: ScheduleExportPeriodType;
  readonly roleId?: string;
  readonly rowCount?: number;
  readonly status: ScheduleExportStatus;
}
