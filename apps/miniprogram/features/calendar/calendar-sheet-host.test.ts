import { describe, expect, it } from 'vitest';

import {
  completeCalendarSheetClose,
  getCalendarSheetKind,
  getCalendarSheetTitle,
  openCalendarSheet,
  requestCalendarSheetClose,
  resetCalendarSheet,
  type CalendarSheetHostState,
} from './calendar-sheet-host.js';
import type { CalendarAssignmentViewModel, CalendarDayViewModel } from './calendar-view-model.js';

const assignment = {
  assignmentId: 'assignment-1',
  backgroundColor: '#123456',
  borderToken: 'color-border-strong',
  compactShiftLabel: '日',
  foregroundColor: '#FFFFFF',
  markers: [],
  memberName: '值班医生',
  phoneActions: [],
  roleId: 'role-1',
  roleName: '门诊',
  routeActionId: 'assignment:assignment-1',
  schedulePeriodId: 'period-1',
  shiftTypeAbbreviation: 'D',
  shiftTypeId: 'shift-1',
  shiftTypeName: '日班',
  slotPosition: 1,
  timeRange: '08:00–16:00',
} satisfies CalendarAssignmentViewModel;

const day = {
  assignments: [assignment],
  businessDate: '2026-08-15',
  dayNumber: 15,
  id: 'day:2026-08-15',
  isEmpty: false,
  isPast: false,
  isToday: true,
  isWeekend: false,
  kind: 'day',
  routeActionId: 'date:2026-08-15',
  weekdayLabel: '六',
} satisfies CalendarDayViewModel;

const initial: CalendarSheetHostState = { sheetKey: 0, visible: false };

describe('calendar sheet host', () => {
  it('opens a date sheet and retains content until the matching close completes', () => {
    const opened = openCalendarSheet(initial, { day, kind: 'date' });
    expect(opened).toMatchObject({ content: { kind: 'date' }, sheetKey: 1, visible: true });
    expect(getCalendarSheetKind(opened)).toBe('date');
    expect(getCalendarSheetTitle(opened)).toBe('日期详情');

    const closing = requestCalendarSheetClose(opened);
    expect(closing).toEqual({ ...opened, visible: false });
    expect(requestCalendarSheetClose(closing)).toBe(closing);

    const closed = completeCalendarSheetClose(closing, opened.sheetKey);
    expect(closed).toEqual({ sheetKey: 1, visible: false });
    expect(getCalendarSheetKind(closed)).toBe('none');
    expect(getCalendarSheetTitle(closed)).toBe('');
  });

  it('keeps a newly opened sheet when an older close completion arrives late', () => {
    const events = openCalendarSheet(initial, { assignment, kind: 'events' });
    const closing = requestCalendarSheetClose(events);
    const phone = openCalendarSheet(closing, { assignment, kind: 'phone', phoneActions: [] });

    expect(phone).toMatchObject({ content: { kind: 'phone' }, sheetKey: 2, visible: true });
    expect(completeCalendarSheetClose(phone, events.sheetKey)).toBe(phone);
    expect(getCalendarSheetTitle(phone)).toBe('电话联系');
  });

  it('removes sensitive content and invalidates late close events when the page hides', () => {
    const events = openCalendarSheet(initial, { assignment, kind: 'events' });

    const reset = resetCalendarSheet(events);

    expect(reset).toEqual({ sheetKey: 2, visible: false });
    expect(getCalendarSheetKind(reset)).toBe('none');
    expect(completeCalendarSheetClose(reset, events.sheetKey)).toBe(reset);
  });
});
