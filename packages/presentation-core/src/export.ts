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
  readonly cancellation?: ExportCancellation | undefined;
  readonly onProgress?: ((event: ExportPollProgress) => void) | undefined;
}

export interface ExportPollProgress {
  readonly phase: 'request-start' | 'request-end';
  readonly count: number;
  readonly status?: string;
}

export interface ExportCancellation {
  readonly cancelled: boolean;
  cancel(): void;
  subscribe(listener: () => void): () => void;
}

export function createExportCancellation(): ExportCancellation {
  let cancelled = false;
  const listeners = new Set<() => void>();
  return {
    get cancelled() {
      return cancelled;
    },
    cancel() {
      cancelled = true;
      for (const listener of listeners) listener();
      listeners.clear();
    },
    subscribe(listener) {
      if (cancelled) listener();
      else listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ExportWaitResult<T> =
  | { readonly status: 'finished'; readonly value: T }
  | { readonly status: 'timed_out' }
  | { readonly status: 'cancelled' };

/** Bounds the whole operation, including authentication and unresolved native bridges. */
export function waitForExportOperation<T>(
  operation: (isStopped: () => boolean) => Promise<T>,
  timeoutMs: number,
  cancellation?: ExportCancellation,
): Promise<ExportWaitResult<T>> {
  return new Promise((resolve, reject) => {
    let stopped = false;
    let unsubscribe: () => void = () => undefined;
    const finish = (result: ExportWaitResult<T>): void => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      unsubscribe?.();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'timed_out' }), timeoutMs);
    unsubscribe =
      cancellation?.subscribe(() => finish({ status: 'cancelled' })) ?? (() => undefined);
    if (stopped) return;
    void Promise.resolve()
      .then(() => {
        if (stopped) return undefined;
        return operation(() => stopped);
      })
      .then(
        (value) => {
          if (!stopped) finish({ status: 'finished', value: value as T });
        },
        (error: unknown) => {
          if (stopped) return;
          stopped = true;
          clearTimeout(timer);
          unsubscribe?.();
          reject(error);
        },
      );
  });
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

  let sleepTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await waitForExportOperation<ExportPollResult<Job>>(
      async (isStopped) => {
        let count = 0;
        while (true) {
          if (isStopped() || options.isCancelled?.() === true) return { status: 'cancelled' };
          count += 1;
          options.onProgress?.({ phase: 'request-start', count });
          const job = await getJob(exportJobId);
          if (isStopped() || options.isCancelled?.() === true) return { status: 'cancelled' };
          options.onProgress?.({ phase: 'request-end', count, status: job.status });
          if (isExportJobFinished(job)) return { job, status: 'finished' };
          const remaining = deadline - now();
          if (remaining <= 0) return { exportJobId, status: 'timed_out' };
          if (options.sleep) await sleep(Math.min(pollIntervalMs, remaining));
          else
            await new Promise<void>((resolve) => {
              sleepTimer = setTimeout(resolve, Math.min(pollIntervalMs, remaining));
            });
        }
      },
      timeoutMs,
      options.cancellation,
    );
    return result.status === 'finished'
      ? result.value
      : result.status === 'timed_out'
        ? { status: 'timed_out', exportJobId }
        : { status: 'cancelled' };
  } finally {
    if (sleepTimer !== undefined) clearTimeout(sleepTimer);
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
