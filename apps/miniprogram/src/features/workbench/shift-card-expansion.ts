import type { WorkbenchDetail } from './workbench-model.js';

export interface ShiftCardExpansion {
  readonly context: string;
  readonly overrides: Readonly<Record<string, boolean>>;
  readonly expanded: Readonly<Record<string, boolean>>;
}
export function reconcileShiftCardExpansion(
  previous: ShiftCardExpansion | undefined,
  context: readonly string[],
  groups: readonly WorkbenchDetail[],
): ShiftCardExpansion {
  const key = JSON.stringify(context);
  const old = previous?.context === key ? previous.overrides : {};
  const overrides: Record<string, boolean> = {};
  const expanded: Record<string, boolean> = {};
  for (const group of groups) {
    if (old[group.key] !== undefined) overrides[group.key] = old[group.key]!;
    expanded[group.key] = overrides[group.key] ?? !group.defaultCollapsed;
  }
  return { context: key, overrides, expanded };
}
export function toggleShiftCardExpansion(
  state: ShiftCardExpansion,
  key: string,
): ShiftCardExpansion {
  if (state.expanded[key] === undefined) return state;
  const expanded = { ...state.expanded, [key]: !state.expanded[key] };
  return { ...state, expanded, overrides: { ...state.overrides, [key]: expanded[key]! } };
}
