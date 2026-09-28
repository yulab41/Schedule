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
  | { readonly kind: 'duty'; readonly detail: string }
  | { readonly kind: 'swap'; readonly detail: string; readonly steps: readonly SwapStep[] }
  | { readonly kind: 'blocked'; readonly detail: string };

export function suggestExternalDuty(
  rows: readonly DutySuggestionRow[],
): Map<string, DutySuggestion> {
  const result = new Map<string, DutySuggestion>();
  const byPeriod = new Map<string, DutySuggestionRow[]>();
  for (const row of rows) {
    if (!row.schedulePeriodId) continue;
    byPeriod.set(row.schedulePeriodId, [...(byPeriod.get(row.schedulePeriodId) ?? []), row]);
  }
  for (const periodRows of byPeriod.values()) {
    const sorted = [...periodRows].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
    const pending = sorted.filter(
      (row) => row.status === 'pending' && row.changeSource === 'remote',
    );
    if (!pending.length) continue;
    const unresolved = sorted.some(
      (row) =>
        row.remoteName !== row.localName &&
        (row.changeSource !== 'remote' || row.status !== 'pending'),
    );
    if (unresolved || sorted.some((row) => !row.localName || !row.assignmentId)) {
      for (const row of pending)
        result.set(row.businessDate, {
          kind: 'blocked',
          detail: '同一发布期间仍有冲突或无法唯一对应的班次，不能自动生成方案',
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
          detail: '本发布期间人员值班次数有增减，建议逐日加扣班',
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
        detail: `${steps.length} 步换班；每步执行后重新预览剩余步骤`,
        steps,
      });
  }
  return result;
}
