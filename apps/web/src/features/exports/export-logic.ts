import type { ScheduleExportJob, ScheduleExportType } from '@schedule/contracts';

export function buildExportFileName(exportType: ScheduleExportType, period: string): string {
  return `${exportType}-export-${period}.csv`;
}

export function isExportJobFinished(job: ScheduleExportJob): boolean {
  return job.status === 'completed' || job.status === 'failed';
}

export function getExportPeriodLabel(period: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/u.exec(period);
  if (monthMatch !== null) {
    return `${monthMatch[1]}年${Number(monthMatch[2])}月`;
  }
  return `${period}年`;
}
