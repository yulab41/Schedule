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
  it('resolves real server calendar targets by exact VM action ID', () => {
    const resolve = (actionId: string, role: GroupRole) =>
      resolveCalendarRouteAction(actionId, role, [goldenViewModel]);

    expect(resolve('date:2026-09-16', 'member')).toMatchObject({
      day: { businessDate: '2026-09-16' },
      kind: 'date',
    });
    expect(resolve('assignment:3da0f9ff-90ca-40db-8376-5dbdb0c7c708', 'member')).toMatchObject({
      assignment: { assignmentId: '3da0f9ff-90ca-40db-8376-5dbdb0c7c708' },
      kind: 'assignment',
    });
    expect(resolve('3da0f9ff-90ca-40db-8376-5dbdb0c7c708:marker:swap:0', 'member')).toMatchObject({
      assignment: { assignmentId: '3da0f9ff-90ca-40db-8376-5dbdb0c7c708' },
      kind: 'events',
    });
    expect(
      resolve('512bb311-ca97-4a96-ac61-4dfd40405a16:marker:overtime:0', 'guest'),
    ).toMatchObject({
      assignment: { assignmentId: '512bb311-ca97-4a96-ac61-4dfd40405a16' },
      kind: 'assignment',
    });
    expect(resolve('2f2c325d-76c9-484c-a7a9-aa9b10fe8bd0:phone:长号', 'member')).toMatchObject({
      assignment: { assignmentId: '2f2c325d-76c9-484c-a7a9-aa9b10fe8bd0' },
      kind: 'phone',
      phoneAction: { actionId: '2f2c325d-76c9-484c-a7a9-aa9b10fe8bd0:phone:长号' },
    });
  });

  it('ignores invalid, stale, and unknown action IDs', () => {
    for (const actionId of [
      '',
      'date:2026-10-05',
      'assignment:missing',
      '3da0f9ff-90ca-40db-8376-5dbdb0c7c708:marker:swap:9',
      '3da0f9ff-90ca-40db-8376-5dbdb0c7c708:phone:长号',
      'not-an-action',
    ]) {
      expect(resolveCalendarRouteAction(actionId, 'member', [goldenViewModel])).toBeUndefined();
    }
    expect(resolveCalendarRouteAction('date:2026-09-16', 'member', [])).toBeUndefined();
  });
});
