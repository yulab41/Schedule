export type ManualCellMap<Value> = ReadonlyMap<string, Value>;

export interface ManualCellMutation<Value> {
  readonly after: Value | undefined;
  readonly before: Value | undefined;
  readonly key: string;
}

export type ManualCellMutationMode = 'replace' | 'toggle';
export type ManualSelectionMode = 'replace' | 'toggle';

export interface ManualSnapshotUndoStack<Value> {
  canUndo(): boolean;
  clear(): void;
  pop(): ManualCellMap<Value> | undefined;
  push(snapshot: ManualCellMap<Value>): void;
}

interface ManualCellMutationInput<Value> {
  readonly active: Value;
  readonly before: Value | undefined;
  readonly isSameValue?: ((left: Value, right: Value) => boolean) | undefined;
  readonly key: string;
  readonly mode: ManualCellMutationMode;
}

interface ManualSelectionInput<Selection> {
  readonly isSame: (left: Selection, right: Selection) => boolean;
  readonly mode: ManualSelectionMode;
}

export function createManualCellKey(cycleDay: number, membershipId: string): string {
  return `${cycleDay}:${membershipId}`;
}

export function getManualCellValue<Value>(
  cells: ManualCellMap<Value>,
  key: string,
): Value | undefined {
  return cells.get(key);
}

export function applyManualCellMutation<Value>(
  cells: ManualCellMap<Value>,
  mutation: ManualCellMutation<Value>,
): ManualCellMap<Value> {
  const next = new Map(cells);
  if (mutation.after === undefined) next.delete(mutation.key);
  else next.set(mutation.key, mutation.after);
  return next;
}

export function revertManualCellMutation<Value>(
  cells: ManualCellMap<Value>,
  mutation: ManualCellMutation<Value>,
): ManualCellMap<Value> {
  const next = new Map(cells);
  if (mutation.before === undefined) next.delete(mutation.key);
  else next.set(mutation.key, mutation.before);
  return next;
}

export function clearManualCell<Value>(
  cells: ManualCellMap<Value>,
  key: string,
): ManualCellMap<Value> {
  return applyManualCellMutation(cells, {
    after: undefined,
    before: cells.get(key),
    key,
  });
}

export function clearManualRow<Value>(
  cells: ManualCellMap<Value>,
  membershipId: string,
): ManualCellMap<Value> {
  const next = new Map(cells);
  const suffix = `:${membershipId}`;
  for (const key of next.keys()) {
    if (key.endsWith(suffix)) next.delete(key);
  }
  return next;
}

export function clearManualColumn<Value>(
  cells: ManualCellMap<Value>,
  cycleDay: number,
): ManualCellMap<Value> {
  const next = new Map(cells);
  const prefix = `${cycleDay}:`;
  for (const key of next.keys()) {
    if (key.startsWith(prefix)) next.delete(key);
  }
  return next;
}

export function createManualSnapshotUndoStack<Value>(): ManualSnapshotUndoStack<Value> {
  const stack: ManualCellMap<Value>[] = [];
  return {
    canUndo() {
      return stack.length > 0;
    },
    clear() {
      stack.length = 0;
    },
    pop() {
      return stack.pop();
    },
    push(snapshot) {
      stack.push(new Map(snapshot));
    },
  };
}

export function resolveManualCellMutation<Value>(
  input: ManualCellMutationInput<Value> & { readonly before: Value; readonly mode: 'replace' },
): ManualCellMutation<Value> & { readonly after: Value; readonly before: Value };
export function resolveManualCellMutation<Value>(
  input: ManualCellMutationInput<Value> & { readonly mode: 'replace' },
): ManualCellMutation<Value> & { readonly after: Value };
export function resolveManualCellMutation<Value>(
  input: ManualCellMutationInput<Value> & { readonly mode: 'toggle' },
): ManualCellMutation<Value>;
export function resolveManualCellMutation<Value>(
  input: ManualCellMutationInput<Value>,
): ManualCellMutation<Value> {
  const isSame =
    input.mode === 'toggle' &&
    input.before !== undefined &&
    (input.isSameValue === undefined
      ? Object.is(input.before, input.active)
      : input.isSameValue(input.before, input.active));
  return {
    after: input.mode === 'toggle' && isSame ? undefined : input.active,
    before: input.before,
    key: input.key,
  };
}

export function resolveManualSelection<Selection>(
  current: Selection | undefined,
  target: Selection,
  input: ManualSelectionInput<Selection> & { readonly mode: 'replace' },
): Selection;
export function resolveManualSelection<Selection>(
  current: Selection | undefined,
  target: Selection,
  input: ManualSelectionInput<Selection> & { readonly mode: 'toggle' },
): Selection | undefined;
export function resolveManualSelection<Selection>(
  current: Selection | undefined,
  target: Selection,
  input: ManualSelectionInput<Selection>,
): Selection | undefined {
  return input.mode === 'toggle' && current !== undefined && input.isSame(current, target)
    ? undefined
    : target;
}
