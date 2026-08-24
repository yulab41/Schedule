export interface WorkflowOperationAttempt<Payload extends Readonly<Record<string, unknown>>> {
  readonly fingerprint: string;
  readonly snapshot: Readonly<Payload & { readonly operationId: string }>;
}

export function resolveWorkflowOperationAttempt<Payload extends Readonly<Record<string, unknown>>>(
  previous: WorkflowOperationAttempt<Payload> | undefined,
  payload: Payload,
  createOperationId: () => string,
): {
  readonly attempt: WorkflowOperationAttempt<Payload>;
  readonly snapshot: Readonly<Payload & { readonly operationId: string }>;
} {
  const fingerprint = getWorkflowOperationFingerprint(payload);
  if (previous !== undefined && previous.fingerprint === fingerprint) {
    return Object.freeze({ attempt: previous, snapshot: previous.snapshot });
  }
  const frozenPayload = freezeWorkflowValue(payload) as Payload;
  const snapshot = Object.freeze({
    ...frozenPayload,
    operationId: createOperationId(),
  }) as Readonly<Payload & { readonly operationId: string }>;
  const attempt = Object.freeze({ fingerprint, snapshot });
  return Object.freeze({ attempt, snapshot });
}

export function getWorkflowOperationFingerprint(value: unknown): string {
  return JSON.stringify(normalizeWorkflowValue(value));
}

function normalizeWorkflowValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWorkflowValue(item));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeWorkflowValue(item)]),
    );
  }
  throw new Error('Workflow operation payload must contain only JSON values.');
}

function freezeWorkflowValue(value: unknown): unknown {
  const normalized = normalizeWorkflowValue(value);
  if (Array.isArray(normalized)) {
    return Object.freeze(normalized.map((item) => freezeWorkflowValue(item)));
  }
  if (normalized !== null && typeof normalized === 'object') {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(normalized).map(([key, item]) => [key, freezeWorkflowValue(item)]),
      ),
    );
  }
  return normalized;
}
