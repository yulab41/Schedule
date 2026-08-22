export type SchedulePeriodMutationAction = 'publish' | 'withdraw';

export interface SchedulePublicationHistoryItemLike {
  readonly applyEndDate?: string | undefined;
  readonly applyStartDate?: string | undefined;
  readonly businessMonth: string;
  readonly id: string;
  readonly operationId?: string | undefined;
  readonly revision: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly status: string;
  readonly version: number;
}

export interface ScheduleDraftBatch<
  Item extends SchedulePublicationHistoryItemLike = SchedulePublicationHistoryItemLike,
> {
  readonly items: readonly Item[];
  readonly key: string;
  readonly rangeEnd: string;
  readonly rangeStart: string;
  readonly roleName: string;
}

export interface ScheduleVersionMonthGroup<
  Item extends SchedulePublicationHistoryItemLike = SchedulePublicationHistoryItemLike,
> {
  readonly archived: readonly Item[];
  readonly businessMonth: string;
  readonly current: readonly Item[];
  readonly items: readonly Item[];
  readonly past: readonly Item[];
  readonly roleName: string;
}

export interface SchedulePublicationClock {
  readonly getBusinessDate: () => string;
  readonly getCurrentBusinessMonth: () => string;
}

export interface SchedulePeriodMutationPreviewLike {
  readonly hardConflicts?: readonly unknown[] | undefined;
  readonly vacancies?: readonly unknown[] | undefined;
}

export interface SchedulePeriodMutationAcknowledgementInput {
  readonly hasBlockers: boolean;
  readonly hasPastDates: boolean;
  readonly workflowImpacts?: readonly unknown[] | undefined;
}

export interface SchedulePeriodMutationConfirmationInput {
  readonly acknowledgePastDates: boolean;
  readonly acknowledgeWorkflowRevocations: boolean;
  readonly hasPastDates: boolean;
  readonly hasTarget: boolean;
  readonly requiresAcknowledgement: boolean;
}

export interface ScheduleDraftBatchPublishIntent {
  readonly acknowledgeBlockers?: true;
  readonly acknowledgeWorkflowRevocations?: true;
  readonly replacePublished?: true;
  readonly schedulePeriodIds: readonly string[];
}

export interface ScheduleDraftBatchPublishIntentInput {
  readonly acknowledgeBlockers?: boolean | undefined;
  readonly acknowledgeWorkflowRevocations?: boolean | undefined;
  readonly replacePublished?: boolean | undefined;
}

interface SchedulePeriodMutationRequestIntent {
  readonly acknowledgeBlockers?: true;
  readonly acknowledgeWorkflowRevocations?: true;
  readonly expectedVersion: number;
  readonly replacePublished?: true;
}

export type SchedulePeriodMutationIntent =
  | {
      readonly action: 'publish';
      readonly request: SchedulePeriodMutationRequestIntent & {
        readonly replacePublished: true;
      };
      readonly schedulePeriodId: string;
    }
  | {
      readonly action: 'withdraw';
      readonly request: SchedulePeriodMutationRequestIntent;
      readonly schedulePeriodId: string;
    };

export interface SchedulePeriodMutationIntentInput {
  readonly acknowledgeWorkflowRevocations?: boolean | undefined;
  readonly action: SchedulePeriodMutationAction;
  readonly hasBlockers?: boolean | undefined;
}

export function groupScheduleDraftBatches<Item extends SchedulePublicationHistoryItemLike>(
  history: readonly Item[],
): readonly ScheduleDraftBatch<Item>[] {
  const groups = new Map<string, Item[]>();
  for (const item of history) {
    if (item.status !== 'draft') {
      continue;
    }
    const key = item.operationId ?? item.id;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.values()]
    .map((items) => {
      const sorted = [...items].sort(
        (first, second) =>
          first.businessMonth.localeCompare(second.businessMonth) ||
          first.revision - second.revision,
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        items: sorted,
        key: first?.operationId ?? first?.id ?? '',
        rangeEnd: last?.applyEndDate ?? `${last?.businessMonth ?? ''}-01`,
        rangeStart: first?.applyStartDate ?? `${first?.businessMonth ?? ''}-01`,
        roleName: first?.scheduleRoleName ?? '',
      };
    })
    .sort((first, second) =>
      (second.items[0]?.businessMonth ?? '').localeCompare(first.items[0]?.businessMonth ?? ''),
    );
}

export function groupScheduleVersionMonths<Item extends SchedulePublicationHistoryItemLike>(
  history: readonly Item[],
): readonly ScheduleVersionMonthGroup<Item>[] {
  const groups = new Map<
    string,
    {
      businessMonth: string;
      items: Item[];
      roleName: string;
    }
  >();
  for (const item of history) {
    if (item.status === 'draft') {
      continue;
    }
    const key = `${item.businessMonth}|${item.scheduleRoleId}`;
    const group = groups.get(key) ?? {
      businessMonth: item.businessMonth,
      items: [],
      roleName: item.scheduleRoleName,
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      archived: [...group.items]
        .filter((item) => item.status === 'replaced' || item.status === 'withdrawn')
        .sort((first, second) => second.revision - first.revision),
      current: [...group.items].filter((item) => item.status === 'published'),
      past: [...group.items].filter((item) => item.status === 'past'),
      items: [...group.items].sort((first, second) => second.revision - first.revision),
    }))
    .sort((first, second) => second.businessMonth.localeCompare(first.businessMonth));
}

export function isSchedulePeriodPastMonth(
  item: Pick<SchedulePublicationHistoryItemLike, 'businessMonth'>,
  currentBusinessMonth: string,
): boolean {
  return item.businessMonth.slice(0, 7) < currentBusinessMonth;
}

export function hasSchedulePeriodPastDates(
  item: Pick<SchedulePublicationHistoryItemLike, 'applyStartDate' | 'businessMonth'>,
  clock: SchedulePublicationClock,
): boolean {
  const { getBusinessDate, getCurrentBusinessMonth } = clock;
  if (isSchedulePeriodPastMonth(item, getCurrentBusinessMonth())) {
    return true;
  }
  const month = item.businessMonth.slice(0, 7);
  if (month > getCurrentBusinessMonth()) {
    return false;
  }
  const startDate = item.applyStartDate ?? `${month}-01`;
  return startDate < getBusinessDate();
}

export function hasSchedulePeriodMutationBlockers(
  action: SchedulePeriodMutationAction,
  preview: SchedulePeriodMutationPreviewLike | undefined,
): boolean {
  return (
    action === 'publish' &&
    ((preview?.hardConflicts?.length ?? 0) > 0 || (preview?.vacancies?.length ?? 0) > 0)
  );
}

export function requiresSchedulePeriodMutationAcknowledgement({
  hasBlockers,
  hasPastDates,
  workflowImpacts,
}: SchedulePeriodMutationAcknowledgementInput): boolean {
  return hasBlockers || hasPastDates || (workflowImpacts?.length ?? 0) > 0;
}

export function canConfirmSchedulePeriodMutation({
  acknowledgePastDates,
  acknowledgeWorkflowRevocations,
  hasPastDates,
  hasTarget,
  requiresAcknowledgement,
}: SchedulePeriodMutationConfirmationInput): boolean {
  return !(
    !hasTarget ||
    (requiresAcknowledgement && !acknowledgeWorkflowRevocations) ||
    (hasPastDates && !acknowledgePastDates)
  );
}

export function createScheduleDraftBatchPublishIntent<Item extends { readonly id: string }>(
  batch: { readonly items: readonly Item[] },
  input: ScheduleDraftBatchPublishIntentInput = {},
): ScheduleDraftBatchPublishIntent {
  return {
    ...(input.acknowledgeBlockers ? { acknowledgeBlockers: true as const } : {}),
    ...(input.acknowledgeWorkflowRevocations
      ? { acknowledgeWorkflowRevocations: true as const }
      : {}),
    ...(input.replacePublished ? { replacePublished: true as const } : {}),
    schedulePeriodIds: batch.items.map((item) => item.id),
  };
}

export function createSchedulePeriodMutationIntent(
  target: Pick<SchedulePublicationHistoryItemLike, 'id' | 'version'>,
  input: SchedulePeriodMutationIntentInput,
): SchedulePeriodMutationIntent {
  const request = {
    ...(input.action === 'publish' && input.hasBlockers
      ? { acknowledgeBlockers: true as const }
      : {}),
    ...(input.acknowledgeWorkflowRevocations
      ? { acknowledgeWorkflowRevocations: true as const }
      : {}),
    expectedVersion: target.version,
  };

  if (input.action === 'publish') {
    return {
      action: 'publish',
      request: { ...request, replacePublished: true },
      schedulePeriodId: target.id,
    };
  }
  return { action: 'withdraw', request, schedulePeriodId: target.id };
}
