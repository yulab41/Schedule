import type { GroupRole } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { getGoldenCalendar, goldenHolidays, goldenToday } from './calendar-golden-data.js';
import { resolveCalendarRouteAction } from './calendar-routing.js';
import { buildCalendarMonthViewModel } from './calendar-view-model.js';

const goldenViewModel = buildCalendarMonthViewModel({
  calendar: getGoldenCalendar('2026-09'),
  filters: {},
  holidays: goldenHolidays,
  status: 'ready',
  today: goldenToday,
});

describe('calendar route actions', () => {
  it('resolves synthetic calendar targets by exact VM action ID', () => {
    const resolve = (actionId: string, role: GroupRole) =>
      resolveCalendarRouteAction(actionId, role, [goldenViewModel]);

    expect(resolve('date:2026-09-16', 'member')).toMatchObject({
      day: { businessDate: '2026-09-16' },
      kind: 'date',
    });
    expect(resolve('assignment:fixture-assignment-2026-09-16', 'member')).toMatchObject({
      assignment: { assignmentId: 'fixture-assignment-2026-09-16' },
      kind: 'assignment',
    });
    expect(resolve('fixture-assignment-2026-09-16:marker:swap:0', 'member')).toMatchObject({
      assignment: { assignmentId: 'fixture-assignment-2026-09-16' },
      kind: 'events',
    });
    expect(resolve('fixture-assignment-2026-09-18:marker:overtime:0', 'guest')).toMatchObject({
      assignment: { assignmentId: 'fixture-assignment-2026-09-18' },
      kind: 'assignment',
    });
    expect(resolve('fixture-assignment-2026-09-04:phone:长号', 'member')).toMatchObject({
      assignment: { assignmentId: 'fixture-assignment-2026-09-04' },
      kind: 'phone',
      phoneAction: { actionId: 'fixture-assignment-2026-09-04:phone:长号' },
    });
  });

  it('ignores invalid, stale, and unknown action IDs', () => {
    for (const actionId of [
      '',
      'date:2026-10-05',
      'assignment:missing',
      'fixture-assignment-2026-09-16:marker:swap:9',
      'fixture-assignment-2026-09-16:phone:长号',
      'not-an-action',
    ]) {
      expect(resolveCalendarRouteAction(actionId, 'member', [goldenViewModel])).toBeUndefined();
    }
    expect(resolveCalendarRouteAction('date:2026-09-16', 'member', [])).toBeUndefined();
  });
});
