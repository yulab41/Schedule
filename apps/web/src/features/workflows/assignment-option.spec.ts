import type { CalendarDutyAssignment } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { createAssignmentOption, formatAssignmentOption } from './assignment-option.js';

function assignment(
  id: string,
  businessDate: string,
  shiftTypeName = '全天班',
): CalendarDutyAssignment {
  return {
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000Z`,
    id,
    plannedMemberName: '张医生',
    plannedMembershipId: 'me',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName,
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: `${businessDate}T00:00:00.000Z`,
  };
}

describe('assignment option formatting', () => {
  it('formats assignment options with weekday and without abbreviation', () => {
    expect(formatAssignmentOption(assignment('1', '2026-08-08'))).toBe(
      '2026-08-08 全天班（周六）· 张医生',
    );
    expect(formatAssignmentOption(assignment('2', '2026-08-10', '早班'))).toBe(
      '2026-08-10 早班（周一）· 张医生',
    );
  });

  it('marks weekend weekday in dropdown content', () => {
    const weekendContent = createAssignmentOption(assignment('1', '2026-08-08')).content();
    const weekdayContent = createAssignmentOption(assignment('2', '2026-08-10', '早班')).content();
    const weekendChildren = weekendContent.children as readonly unknown[];
    const weekdayChildren = weekdayContent.children as readonly unknown[];
    const weekendSpan = weekendChildren[1] as { props?: { class?: string } };
    const weekdaySpan = weekdayChildren[1] as { props?: { class?: string } };

    expect(weekendSpan.props?.class).toContain('is-weekend');
    expect(weekdaySpan.props?.class).not.toContain('is-weekend');
  });
});
