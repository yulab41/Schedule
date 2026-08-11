import type { GroupRole } from '@schedule/contracts';

export interface WorkflowContext {
  readonly groupId: string;
  readonly groupRole: GroupRole;
  readonly groupVersion: number;
  readonly userId: string;
}

export interface WorkflowConflictSummary {
  readonly conflictCount?: number;
  readonly periodVersions?: Readonly<Record<string, number>>;
  readonly reasons?: readonly string[];
  readonly rulesVersion?: number;
  readonly status?: string;
  readonly vacancyCount?: number;
  readonly version?: number;
  readonly workflowBlockerCount?: number;
}

export interface WorkflowConflictState {
  readonly message: string;
  readonly summary?: WorkflowConflictSummary;
}

export type WorkflowOperationEvent =
  | { readonly kind: 'preview-invalidated' }
  | ({ readonly kind: 'conflict' } & WorkflowConflictState);

export interface WorkflowOperationRuntimeOptions {
  readonly publish?: (event: WorkflowOperationEvent) => void;
  readonly refresh: (context: WorkflowContext) => Promise<void>;
}

export interface WorkflowOperationRuntime<Preview = unknown> {
  readonly lastConflict: WorkflowConflictState | undefined;
  readonly lastError: unknown;
  activate(context: WorkflowContext): void;
  getPreview(fingerprint: string): Preview | undefined;
  run<Result>(key: string, mutate: () => Promise<Result>): Promise<Result>;
  setPreview(fingerprint: string, preview: Preview): void;
}

interface StoredPreview<Preview> {
  readonly context: WorkflowContext;
  readonly fingerprint: string;
  readonly generation: number;
  readonly value: Preview;
}

type FingerprintValue = boolean | number | string | undefined;

function isCurrentContext(left: WorkflowContext | undefined, right: WorkflowContext): boolean {
  return (
    left?.groupId === right.groupId &&
    left.groupRole === right.groupRole &&
    left.groupVersion === right.groupVersion &&
    left.userId === right.userId
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 500 ? value : undefined;
}

function getVersion(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function getCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function getPeriodVersions(value: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(value)) return undefined;
  const periodVersions: Record<string, number> = {};
  for (const [key, version] of Object.entries(value)) {
    if (
      key.length === 0 ||
      key.length > 128 ||
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version <= 0
    )
      continue;
    periodVersions[key] = version;
    if (Object.keys(periodVersions).length === 24) break;
  }
  return Object.keys(periodVersions).length === 0 ? undefined : periodVersions;
}

function getReasons(...values: readonly unknown[]): readonly string[] | undefined {
  const reasons: string[] = [];
  for (const value of values) {
    if (typeof value === 'string') {
      const message = getString(value);
      if (message !== undefined && !reasons.includes(message)) reasons.push(message);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!isRecord(item)) continue;
      const message = getString(item.message);
      if (message !== undefined && !reasons.includes(message)) reasons.push(message);
      if (reasons.length === 8) return reasons;
    }
  }
  return reasons.length === 0 ? undefined : reasons;
}

export function buildWorkflowContextKey(context: WorkflowContext): string {
  return `${context.userId}:${context.groupId}:${context.groupRole}:${context.groupVersion}`;
}

export function buildWorkflowPreviewFingerprint(
  value: Readonly<Record<string, FingerprintValue>>,
): string {
  const entries = Object.entries(value)
    .filter(([, field]) => field !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
}

export function summarizeWorkflowLatestData(value: unknown): WorkflowConflictSummary | undefined {
  if (!isRecord(value)) return undefined;
  const summary: WorkflowConflictSummary = {
    ...(getCount(value.conflicts) === undefined
      ? {}
      : { conflictCount: getCount(value.conflicts) }),
    ...(getPeriodVersions(value.periodVersions) === undefined
      ? {}
      : { periodVersions: getPeriodVersions(value.periodVersions) }),
    ...(getReasons(
      value.reason,
      value.revocationBlockedReason,
      value.conflicts,
      value.workflowBlockers,
    ) === undefined
      ? {}
      : {
          reasons: getReasons(
            value.reason,
            value.revocationBlockedReason,
            value.conflicts,
            value.workflowBlockers,
          ),
        }),
    ...(getVersion(value.rulesVersion) === undefined
      ? {}
      : { rulesVersion: getVersion(value.rulesVersion) }),
    ...(getString(value.status) === undefined ? {} : { status: getString(value.status) }),
    ...(getCount(value.vacancies) === undefined ? {} : { vacancyCount: getCount(value.vacancies) }),
    ...(getVersion(value.version) === undefined ? {} : { version: getVersion(value.version) }),
    ...(getCount(value.workflowBlockers) === undefined
      ? {}
      : { workflowBlockerCount: getCount(value.workflowBlockers) }),
  };
  return Object.keys(summary).length === 0 ? undefined : summary;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '请求失败，请稍后重试。';
}

function isConflictError(error: unknown): error is {
  readonly code?: unknown;
  readonly latestData?: unknown;
  readonly status?: unknown;
} {
  return isRecord(error) && (error.status === 409 || error.code === 'CONFLICT');
}

export function createWorkflowOperationRuntime<Preview = unknown>(
  options: WorkflowOperationRuntimeOptions,
): WorkflowOperationRuntime<Preview> {
  const inFlight = new Map<string, Promise<unknown>>();
  let activeContext: WorkflowContext | undefined;
  let generation = 0;
  let lastError: unknown;
  let preview: StoredPreview<Preview> | undefined;
  let lastConflict: WorkflowConflictState | undefined;

  const isCurrent = (context: WorkflowContext, operationGeneration: number): boolean =>
    operationGeneration === generation && isCurrentContext(activeContext, context);

  return {
    get lastConflict() {
      return lastConflict;
    },
    get lastError() {
      return lastError;
    },
    activate(context) {
      if (isCurrentContext(activeContext, context)) return;
      activeContext = { ...context };
      generation += 1;
      preview = undefined;
      lastConflict = undefined;
      lastError = undefined;
    },
    getPreview(fingerprint) {
      return preview?.fingerprint === fingerprint &&
        activeContext !== undefined &&
        isCurrentContext(preview.context, activeContext) &&
        preview.generation === generation
        ? preview.value
        : undefined;
    },
    run<Result>(key: string, mutate: () => Promise<Result>): Promise<Result> {
      const context = activeContext;
      if (context === undefined) return Promise.reject(new Error('工作流上下文不可用。'));
      const operationKey = `${generation}:${buildWorkflowContextKey(context)}:${key}`;
      const existing = inFlight.get(operationKey) as Promise<Result> | undefined;
      if (existing !== undefined) return existing;
      const operationGeneration = generation;
      const operation = (async (): Promise<Result> => {
        try {
          return await mutate();
        } catch (error) {
          if (!isConflictError(error) || !isCurrent(context, operationGeneration)) throw error;
          lastError = error;
          if (preview !== undefined) {
            preview = undefined;
            options.publish?.({ kind: 'preview-invalidated' });
          }
          try {
            await options.refresh(context);
          } catch {
            // A failed refresh must not replace the original conflict.
          }
          if (isCurrent(context, operationGeneration)) {
            const conflict: WorkflowConflictState = {
              message: getErrorMessage(error),
              ...(summarizeWorkflowLatestData(error.latestData) === undefined
                ? {}
                : { summary: summarizeWorkflowLatestData(error.latestData) }),
            };
            lastConflict = conflict;
            options.publish?.({ kind: 'conflict', ...conflict });
          }
          throw error;
        }
      })();
      inFlight.set(operationKey, operation);
      void operation.then(
        () => {
          if (inFlight.get(operationKey) === operation) inFlight.delete(operationKey);
        },
        () => {
          if (inFlight.get(operationKey) === operation) inFlight.delete(operationKey);
        },
      );
      return operation;
    },
    setPreview(fingerprint, value) {
      if (activeContext === undefined) throw new Error('工作流上下文不可用。');
      preview = { context: activeContext, fingerprint, generation, value };
      lastConflict = undefined;
      lastError = undefined;
    },
  };
}
