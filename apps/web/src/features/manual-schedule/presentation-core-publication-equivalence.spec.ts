import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  canConfirmSchedulePeriodMutation,
  createScheduleDraftBatchPublishIntent,
  createSchedulePeriodMutationIntent,
  groupScheduleDraftBatches,
  groupScheduleVersionMonths,
  hasSchedulePeriodMutationBlockers,
  hasSchedulePeriodPastDates,
  isSchedulePeriodPastMonth,
  requiresSchedulePeriodMutationAcknowledgement,
  type ScheduleDraftBatch,
  type SchedulePeriodMutationAction,
  type ScheduleVersionMonthGroup,
} from '@schedule/presentation-core';
import {
  schedulePublicationGoldenBusinessDate,
  schedulePublicationGoldenCurrentMonth,
  schedulePublicationGoldenHistory,
  type SchedulePublicationGoldenHistoryItem,
} from '@schedule/presentation-core/testing';
import { describe, expect, it, vi } from 'vitest';

type HistoryItem = SchedulePublicationGoldenHistoryItem;

describe('schedule publication presentation-core equivalence', () => {
  it('groups draft ranges without changing order, fallback, identity, or nullish semantics', () => {
    const history = schedulePublicationGoldenHistory;
    const legacy = legacyGroupDraftBatches(history);
    const shared = groupScheduleDraftBatches(history);

    expect(shared).toEqual(legacy);
    expect(shared.flatMap((batch) => batch.items)).toEqual(legacy.flatMap((batch) => batch.items));
    expect(shared[0]?.items[0]).toBe(legacy[0]?.items[0]);
    expect(history.map((item) => item.id)).toEqual(
      schedulePublicationGoldenHistory.map((item) => item.id),
    );
  });

  it('groups current, past, archived, and uncategorized publication history identically', () => {
    const history = schedulePublicationGoldenHistory;
    const legacy = legacyGroupVersionMonths(history);
    const shared = groupScheduleVersionMonths(history);

    expect(shared).toEqual(legacy);
    expect(shared[0]?.items[0]).toBe(legacy[0]?.items[0]);
    expect(shared.flatMap((group) => group.items).some((item) => item.status === 'draft')).toBe(
      false,
    );
    expect(
      shared.flatMap((group) => group.items).some((item) => item.status === 'pending_publication'),
    ).toBe(true);
  });

  it('keeps business-month and past-date comparisons plus clock call counts exact', () => {
    const cases = [
      { id: 'published-july', expected: true, monthCalls: 1, dateCalls: 0 },
      { id: 'published-september', expected: false, monthCalls: 2, dateCalls: 0 },
      { id: 'published-current-started', expected: true, monthCalls: 2, dateCalls: 1 },
      { id: 'past-current', expected: true, monthCalls: 2, dateCalls: 1 },
      { id: 'published-current-today', expected: false, monthCalls: 2, dateCalls: 1 },
      { id: 'published-current-empty-start', expected: true, monthCalls: 2, dateCalls: 1 },
    ] as const;

    for (const fixture of cases) {
      const item = schedulePublicationGoldenHistory.find(
        (candidate) => candidate.id === fixture.id,
      )!;
      const legacyMonth = vi.fn(() => schedulePublicationGoldenCurrentMonth);
      const legacyDate = vi.fn(() => schedulePublicationGoldenBusinessDate);
      const sharedMonth = vi.fn(() => schedulePublicationGoldenCurrentMonth);
      const sharedDate = vi.fn(() => schedulePublicationGoldenBusinessDate);

      expect(legacyIsPastMonth(item, legacyMonth())).toBe(
        isSchedulePeriodPastMonth(item, sharedMonth()),
      );
      legacyMonth.mockClear();
      sharedMonth.mockClear();

      expect(legacyHasPastDates(item, legacyMonth, legacyDate)).toBe(
        hasSchedulePeriodPastDates(item, {
          getBusinessDate: sharedDate,
          getCurrentBusinessMonth: sharedMonth,
        }),
      );
      expect(
        legacyHasPastDates(
          item,
          () => schedulePublicationGoldenCurrentMonth,
          () => schedulePublicationGoldenBusinessDate,
        ),
      ).toBe(fixture.expected);
      expect(sharedMonth).toHaveBeenCalledTimes(fixture.monthCalls);
      expect(sharedDate).toHaveBeenCalledTimes(fixture.dateCalls);
      expect(legacyMonth).toHaveBeenCalledTimes(fixture.monthCalls);
      expect(legacyDate).toHaveBeenCalledTimes(fixture.dateCalls);
    }
  });

  it('preserves blocker, acknowledgement, and confirm conditions for both actions', () => {
    const cases = [
      {
        acknowledgePastDates: false,
        acknowledgeWorkflowRevocations: false,
        action: 'withdraw',
        hardConflicts: [],
        hasPastDates: false,
        hasTarget: true,
        vacancies: [],
        workflowImpacts: [],
      },
      {
        acknowledgePastDates: false,
        acknowledgeWorkflowRevocations: false,
        action: 'publish',
        hardConflicts: [{}],
        hasPastDates: false,
        hasTarget: true,
        vacancies: [],
        workflowImpacts: [],
      },
      {
        acknowledgePastDates: true,
        acknowledgeWorkflowRevocations: true,
        action: 'publish',
        hardConflicts: [],
        hasPastDates: true,
        hasTarget: true,
        vacancies: [{}],
        workflowImpacts: [{}],
      },
      {
        acknowledgePastDates: false,
        acknowledgeWorkflowRevocations: true,
        action: 'withdraw',
        hardConflicts: [{}],
        hasPastDates: true,
        hasTarget: true,
        vacancies: [{}],
        workflowImpacts: [],
      },
      {
        acknowledgePastDates: true,
        acknowledgeWorkflowRevocations: true,
        action: 'withdraw',
        hardConflicts: [{}],
        hasPastDates: true,
        hasTarget: false,
        vacancies: [{}],
        workflowImpacts: [{}],
      },
    ] as const;

    for (const fixture of cases) {
      const legacyBlockers = legacyHasBlockers(
        fixture.action,
        fixture.hardConflicts,
        fixture.vacancies,
      );
      const sharedBlockers = hasSchedulePeriodMutationBlockers(fixture.action, {
        hardConflicts: fixture.hardConflicts,
        vacancies: fixture.vacancies,
      });
      expect(sharedBlockers).toBe(legacyBlockers);

      const legacyRequires = legacyRequiresAcknowledgement(
        legacyBlockers,
        fixture.hasPastDates,
        fixture.workflowImpacts,
      );
      const sharedRequires = requiresSchedulePeriodMutationAcknowledgement({
        hasBlockers: sharedBlockers,
        hasPastDates: fixture.hasPastDates,
        workflowImpacts: fixture.workflowImpacts,
      });
      expect(sharedRequires).toBe(legacyRequires);
      expect(
        canConfirmSchedulePeriodMutation({
          acknowledgePastDates: fixture.acknowledgePastDates,
          acknowledgeWorkflowRevocations: fixture.acknowledgeWorkflowRevocations,
          hasPastDates: fixture.hasPastDates,
          hasTarget: fixture.hasTarget,
          requiresAcknowledgement: sharedRequires,
        }),
      ).toBe(
        legacyCanConfirm({
          acknowledgePastDates: fixture.acknowledgePastDates,
          acknowledgeWorkflowRevocations: fixture.acknowledgeWorkflowRevocations,
          hasPastDates: fixture.hasPastDates,
          hasTarget: fixture.hasTarget,
          requiresAcknowledgement: legacyRequires,
        }),
      );
    }
  });

  it('builds the same request bodies while leaving operation IDs in the controller', () => {
    const batch = legacyGroupDraftBatches(schedulePublicationGoldenHistory)[0]!;
    expect(
      createScheduleDraftBatchPublishIntent(batch, {
        acknowledgeBlockers: true,
        acknowledgeWorkflowRevocations: true,
        replacePublished: true,
      }),
    ).toEqual(
      legacyBatchIntent(batch, {
        acknowledgeBlockers: true,
        acknowledgeWorkflowRevocations: true,
        replacePublished: true,
      }),
    );
    expect(createScheduleDraftBatchPublishIntent(batch)).toEqual({
      schedulePeriodIds: batch.items.map((item) => item.id),
    });

    const target = schedulePublicationGoldenHistory.find(
      (item) => item.id === 'published-current-started',
    )!;
    expect(
      createSchedulePeriodMutationIntent(target, {
        acknowledgeWorkflowRevocations: true,
        action: 'withdraw',
        hasBlockers: true,
      }),
    ).toEqual(
      legacyPeriodIntent(target, {
        acknowledgeWorkflowRevocations: true,
        action: 'withdraw',
        hasBlockers: true,
      }),
    );
    expect(
      createSchedulePeriodMutationIntent(target, {
        action: 'withdraw',
        hasBlockers: true,
      }),
    ).toEqual({
      action: 'withdraw',
      request: { expectedVersion: target.version },
      schedulePeriodId: target.id,
    });
    expect(
      createSchedulePeriodMutationIntent(target, {
        action: 'publish',
        hasBlockers: false,
      }),
    ).toEqual({
      action: 'publish',
      request: { expectedVersion: target.version, replacePublished: true },
      schedulePeriodId: target.id,
    });
    expect(
      createSchedulePeriodMutationIntent(target, {
        acknowledgeWorkflowRevocations: true,
        action: 'publish',
        hasBlockers: true,
      }),
    ).toEqual(
      legacyPeriodIntent(target, {
        acknowledgeWorkflowRevocations: true,
        action: 'publish',
        hasBlockers: true,
      }),
    );
  });

  it('wires the Web view to shared publication logic without moving controller effects', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../views/schedules/ManualScheduleView.vue', import.meta.url)),
      'utf8',
    );

    for (const sharedCall of [
      'groupScheduleDraftBatches(history.value)',
      'groupScheduleVersionMonths(history.value)',
      'hasSchedulePeriodPastDates(item,',
      'createScheduleDraftBatchPublishIntent(batch,',
      'createSchedulePeriodMutationIntent(target,',
      'canConfirmSchedulePeriodMutation({',
    ]) {
      expect(source).toContain(sharedCall);
    }
    expect(source).toContain('operationId: crypto.randomUUID()');
    expect(source).toContain('await api.publishScheduleDraftBatch(');
    expect(source).toContain('await api.withdrawSchedulePeriod(');
    expect(source).toContain('await api.publishSchedulePeriod(');
  });
});

function legacyGroupDraftBatches(
  history: readonly HistoryItem[],
): readonly ScheduleDraftBatch<HistoryItem>[] {
  const groups = new Map<string, HistoryItem[]>();
  for (const item of history) {
    if (item.status !== 'draft') continue;
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

function legacyGroupVersionMonths(
  history: readonly HistoryItem[],
): readonly ScheduleVersionMonthGroup<HistoryItem>[] {
  const groups = new Map<
    string,
    { businessMonth: string; items: HistoryItem[]; roleName: string }
  >();
  for (const item of history) {
    if (item.status === 'draft') continue;
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

function legacyIsPastMonth(item: HistoryItem, currentMonth: string): boolean {
  return item.businessMonth.slice(0, 7) < currentMonth;
}

function legacyHasPastDates(
  item: HistoryItem,
  getCurrentBusinessMonth: () => string,
  getBusinessDate: () => string,
): boolean {
  if (legacyIsPastMonth(item, getCurrentBusinessMonth())) return true;
  const month = item.businessMonth.slice(0, 7);
  if (month > getCurrentBusinessMonth()) return false;
  const startDate = item.applyStartDate ?? `${month}-01`;
  return startDate < getBusinessDate();
}

function legacyHasBlockers(
  action: SchedulePeriodMutationAction,
  hardConflicts: readonly unknown[] | undefined,
  vacancies: readonly unknown[] | undefined,
): boolean {
  return action === 'publish' && ((hardConflicts?.length ?? 0) > 0 || (vacancies?.length ?? 0) > 0);
}

function legacyRequiresAcknowledgement(
  hasBlockers: boolean,
  hasPastDates: boolean,
  workflowImpacts: readonly unknown[] | undefined,
): boolean {
  return hasBlockers || hasPastDates || (workflowImpacts?.length ?? 0) > 0;
}

function legacyCanConfirm(input: {
  readonly acknowledgePastDates: boolean;
  readonly acknowledgeWorkflowRevocations: boolean;
  readonly hasPastDates: boolean;
  readonly hasTarget: boolean;
  readonly requiresAcknowledgement: boolean;
}): boolean {
  return !(
    !input.hasTarget ||
    (input.requiresAcknowledgement && !input.acknowledgeWorkflowRevocations) ||
    (input.hasPastDates && !input.acknowledgePastDates)
  );
}

function legacyBatchIntent(
  batch: ScheduleDraftBatch<HistoryItem>,
  input: {
    readonly acknowledgeBlockers: boolean;
    readonly acknowledgeWorkflowRevocations: boolean;
    readonly replacePublished: boolean;
  },
) {
  return {
    ...(input.acknowledgeBlockers ? { acknowledgeBlockers: true } : {}),
    ...(input.acknowledgeWorkflowRevocations ? { acknowledgeWorkflowRevocations: true } : {}),
    ...(input.replacePublished ? { replacePublished: true } : {}),
    schedulePeriodIds: batch.items.map((item) => item.id),
  };
}

function legacyPeriodIntent(
  target: HistoryItem,
  input: {
    readonly acknowledgeWorkflowRevocations: boolean;
    readonly action: SchedulePeriodMutationAction;
    readonly hasBlockers: boolean;
  },
) {
  const request = {
    ...(input.action === 'publish' && input.hasBlockers ? { acknowledgeBlockers: true } : {}),
    ...(input.acknowledgeWorkflowRevocations ? { acknowledgeWorkflowRevocations: true } : {}),
    expectedVersion: target.version,
    ...(input.action === 'publish' ? { replacePublished: true as const } : {}),
  };
  return { action: input.action, request, schedulePeriodId: target.id };
}
