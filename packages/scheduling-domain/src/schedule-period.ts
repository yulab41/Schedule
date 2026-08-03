export const schedulePeriodStatuses = [
  'draft',
  'pending_publication',
  'published',
  'withdrawn',
  'replaced',
] as const;

export type SchedulePeriodStatus = (typeof schedulePeriodStatuses)[number];

const permittedTransitions: Readonly<
  Record<SchedulePeriodStatus, readonly SchedulePeriodStatus[]>
> = {
  draft: ['pending_publication', 'published', 'withdrawn'],
  pending_publication: ['draft', 'published', 'withdrawn'],
  published: ['withdrawn', 'replaced'],
  replaced: ['published'],
  withdrawn: ['published'],
};

export function canTransitionSchedulePeriod(
  from: SchedulePeriodStatus,
  to: SchedulePeriodStatus,
): boolean {
  return permittedTransitions[from].includes(to);
}

export function assertSchedulePeriodTransition(
  from: SchedulePeriodStatus,
  to: SchedulePeriodStatus,
): void {
  if (!canTransitionSchedulePeriod(from, to)) {
    throw new Error(`A schedule period cannot transition from ${from} to ${to}.`);
  }
}
