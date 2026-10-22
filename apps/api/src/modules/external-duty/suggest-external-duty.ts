export interface DutySuggestionRow {
  readonly businessDate: string;
  readonly schedulePeriodId: string | null;
  readonly assignmentId: string | null;
  readonly remoteName: string;
  readonly localName: string | null;
  readonly changeSource: 'initial' | 'remote' | 'local' | 'both';
  readonly status: 'aligned' | 'pending' | 'processing' | 'blocked';
}

export interface SwapStep {
  readonly date: string;
  readonly targetDate: string;
  readonly targetAssignmentId: string;
}

export type DutySuggestion =
  | { readonly kind: 'duty'; readonly detail: string; readonly dates: readonly string[] }
  | {
      readonly kind: 'swap';
      readonly detail: string;
      readonly dates: readonly string[];
      readonly steps: readonly SwapStep[];
    }
  | { readonly kind: 'blocked'; readonly detail: string };

export function suggestExternalDuty(
  rows: readonly DutySuggestionRow[],
  mode: 'automatic' | 'manual' = 'automatic',
): Map<string, DutySuggestion> {
  const result = new Map<string, DutySuggestion>();
  const byPeriod = new Map<string, DutySuggestionRow[]>();
  for (const row of rows) {
    if (!row.schedulePeriodId) continue;
    byPeriod.set(row.schedulePeriodId, [...(byPeriod.get(row.schedulePeriodId) ?? []), row]);
  }
  for (const periodRows of [...byPeriod.values()].flatMap(relatedDifferences)) {
    const sorted = [...periodRows].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
    const pending = sorted.filter(
      (row) => row.status === 'pending' && (mode === 'manual' || row.changeSource === 'remote'),
    );
    if (!pending.length) continue;
    const unresolved = sorted.some(
      (row) =>
        row.remoteName !== row.localName &&
        ((mode === 'automatic' && row.changeSource !== 'remote') || row.status !== 'pending'),
    );
    if (unresolved || sorted.some((row) => !row.localName || !row.assignmentId)) {
      for (const row of pending)
        result.set(row.businessDate, {
          kind: 'blocked',
          detail: '关联日期仍有冲突、正在处理或无法唯一对应的班次，请选择方向或重新校对',
        });
      continue;
    }
    const count = (names: readonly string[]) => {
      const counts = new Map<string, number>();
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
      return [...counts].sort(([a], [b]) => a.localeCompare(b));
    };
    const local = sorted.map((row) => row.localName!);
    const target = sorted.map((row) => row.remoteName);
    if (JSON.stringify(count(local)) !== JSON.stringify(count(target))) {
      for (const row of pending)
        result.set(row.businessDate, {
          kind: 'duty',
          dates: sorted.map((item) => item.businessDate),
          detail: '关联日期人员值班次数有增减，建议逐日加扣班',
        });
      continue;
    }
    const steps: SwapStep[] = [];
    const working = [...local];
    for (let i = 0; i < sorted.length; i++) {
      if (working[i] === target[i]) continue;
      const partner = working.findIndex((name, index) => index > i && name === target[i]);
      if (partner < 0) throw new Error('Invalid external duty permutation');
      steps.push({
        date: sorted[i]!.businessDate,
        targetDate: sorted[partner]!.businessDate,
        targetAssignmentId: sorted[partner]!.assignmentId!,
      });
      [working[i], working[partner]] = [working[partner]!, working[i]!];
    }
    for (const row of pending)
      result.set(row.businessDate, {
        kind: 'swap',
        dates: sorted.map((item) => item.businessDate),
        detail: `${steps.length} 步换班；每步执行后重新预览剩余步骤`,
        steps,
      });
  }
  return result;
}

// Only differences that share a person can participate in the same exchange.
// An aligned date supplies no missing person and must not enlarge the plan.
function relatedDifferences(rows: readonly DutySuggestionRow[]): DutySuggestionRow[][] {
  const remaining = new Set(rows.filter((row) => row.remoteName !== row.localName));
  const components: DutySuggestionRow[][] = [];
  for (const first of remaining) {
    const component = [first];
    remaining.delete(first);
    for (const current of component) {
      const names = new Set([current.localName, current.remoteName].filter(Boolean));
      for (const candidate of remaining) {
        if (!names.has(candidate.localName) && !names.has(candidate.remoteName)) continue;
        component.push(candidate);
        remaining.delete(candidate);
      }
    }
    components.push(component);
  }
  return components;
}
