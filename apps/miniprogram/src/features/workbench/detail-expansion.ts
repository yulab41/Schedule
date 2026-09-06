import type { WorkbenchDetail } from './workbench-model.js';

export interface DetailExpansion {
  readonly context: string;
  readonly signatures: Readonly<Record<string, string>>;
  readonly identities: Readonly<Record<string, string>>;
  readonly expanded: Readonly<Record<string, boolean>>;
}

export function reconcileDetailExpansion(
  previous: DetailExpansion | undefined,
  context: readonly string[],
  groups: readonly WorkbenchDetail[],
): DetailExpansion {
  const contextKey = JSON.stringify(context);
  const compatible = previous?.context === contextKey ? previous : undefined;
  const signatures: Record<string, string> = {};
  const identities: Record<string, string> = {};
  const expanded: Record<string, boolean> = {};
  for (const group of groups) {
    const members = [...new Set(group.rows.map((row) => row.membershipId).filter(Boolean))].sort();
    const signature = JSON.stringify(members);
    signatures[group.key] = signature;
    for (const row of group.rows) {
      const identity = JSON.stringify([group.key, row.key, row.membershipId]);
      identities[row.key] = identity;
      expanded[row.key] =
        compatible?.signatures[group.key] === signature &&
        compatible.identities[row.key] === identity
          ? (compatible.expanded[row.key] ?? false)
          : members.length === 1 && row.membershipId !== '';
    }
  }
  return { context: contextKey, signatures, identities, expanded };
}

export function toggleDetailExpansion(state: DetailExpansion, key: string): DetailExpansion {
  if (!Object.hasOwn(state.identities, key)) return state;
  return { ...state, expanded: { ...state.expanded, [key]: !state.expanded[key] } };
}
