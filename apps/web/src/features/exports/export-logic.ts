import type { ScheduleExportJob, ScheduleExportType } from '@schedule/contracts';

export const EXPORT_POLL_INTERVAL_MS = 1_000;
export const EXPORT_POLL_TIMEOUT_MS = 90_000;

export type ExportPollResult =
  | { readonly status: 'cancelled' }
  | { readonly job: ScheduleExportJob; readonly status: 'finished' }
  | { readonly exportJobId: string; readonly status: 'timed_out' };

interface ExportPollOptions {
  readonly isCancelled?: () => boolean;
  readonly now?: () => number;
  readonly pollIntervalMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly timeoutMs?: number;
}

export function buildExportFileName(exportType: ScheduleExportType, period: string): string {
  return `${exportType}-export-${period}.csv`;
}

export function isExportJobFinished(job: ScheduleExportJob): boolean {
  return job.status === 'completed' || job.status === 'failed';
}

export async function pollExportJob(
  exportJobId: string,
  getJob: (exportJobId: string) => Promise<ScheduleExportJob>,
  options: ExportPollOptions = {},
): Promise<ExportPollResult> {
  const now = options.now ?? Date.now;
  const pollIntervalMs = options.pollIntervalMs ?? EXPORT_POLL_INTERVAL_MS;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise((resolve) => {
        globalThis.setTimeout(resolve, milliseconds);
      }));
  const timeoutMs = options.timeoutMs ?? EXPORT_POLL_TIMEOUT_MS;
  const deadline = now() + timeoutMs;

  while (true) {
    if (options.isCancelled?.() === true) {
      return { status: 'cancelled' };
    }
    const job = await getJob(exportJobId);
    if (options.isCancelled?.() === true) {
      return { status: 'cancelled' };
    }
    if (isExportJobFinished(job)) {
      return { job, status: 'finished' };
    }

    const remaining = deadline - now();
    if (remaining <= 0) {
      return { exportJobId, status: 'timed_out' };
    }
    await sleep(Math.min(pollIntervalMs, remaining));
  }
}

export function getExportPeriodLabel(period: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/u.exec(period);
  if (monthMatch !== null) {
    return `${monthMatch[1]}年${Number(monthMatch[2])}月`;
  }
  return `${period}年`;
}

export function getExportSelectionSummary(exportType: ScheduleExportType, period: string): string {
  return `${exportType === 'schedule' ? '排班' : '统计'} · ${getExportPeriodLabel(period)}`;
}
