export const EXPORT_POLL_INTERVAL_MS = 1_000;
export const EXPORT_POLL_TIMEOUT_MS = 90_000;

export type ScheduleExportTypeLike = 'schedule' | 'statistics';

export interface ScheduleExportJobLike {
  readonly error?: string | undefined;
  readonly exportType?: ScheduleExportTypeLike | undefined;
  readonly id?: string | undefined;
  readonly period?: string | undefined;
  readonly status: string;
}

export type ExportPollResult<Job extends ScheduleExportJobLike = ScheduleExportJobLike> =
  | { readonly status: 'cancelled' }
  | { readonly job: Job; readonly status: 'finished' }
  | { readonly exportJobId: string; readonly status: 'timed_out' };

export interface ExportPollOptions {
  readonly isCancelled?: (() => boolean) | undefined;
  readonly now?: (() => number) | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly sleep?: ((milliseconds: number) => Promise<void>) | undefined;
  readonly timeoutMs?: number | undefined;
}

export function buildExportFileName(exportType: ScheduleExportTypeLike, period: string): string {
  return `${exportType}-export-${period}.csv`;
}

export function isExportJobFinished(job: ScheduleExportJobLike): boolean {
  return job.status === 'completed' || job.status === 'failed';
}

export async function pollExportJob<Job extends ScheduleExportJobLike>(
  exportJobId: string,
  getJob: (exportJobId: string) => Promise<Job>,
  options: ExportPollOptions = {},
): Promise<ExportPollResult<Job>> {
  const now = options.now ?? Date.now;
  const pollIntervalMs = options.pollIntervalMs ?? EXPORT_POLL_INTERVAL_MS;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const timeoutMs = options.timeoutMs ?? EXPORT_POLL_TIMEOUT_MS;
  const deadline = now() + timeoutMs;

  while (true) {
    if (options.isCancelled?.() === true) return { status: 'cancelled' };
    const job = await getJob(exportJobId);
    if (options.isCancelled?.() === true) return { status: 'cancelled' };
    if (isExportJobFinished(job)) return { job, status: 'finished' };

    const remaining = deadline - now();
    if (remaining <= 0) return { exportJobId, status: 'timed_out' };
    await sleep(Math.min(pollIntervalMs, remaining));
  }
}

export function getExportPeriodLabel(period: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/u.exec(period);
  return monthMatch === null ? `${period}年` : `${monthMatch[1]}年${Number(monthMatch[2])}月`;
}

export function getExportSelectionSummary(
  exportType: ScheduleExportTypeLike,
  period: string,
): string {
  return `${exportType === 'schedule' ? '排班' : '统计'} · ${getExportPeriodLabel(period)}`;
}
