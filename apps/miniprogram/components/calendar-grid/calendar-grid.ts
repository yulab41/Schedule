import type { CalendarDutyAssignment } from '@schedule/contracts';

interface CalendarGridDuty {
  readonly assignmentId: string;
  readonly color: string;
  readonly label: string;
  readonly textColor: string;
}

interface CalendarGridDay {
  readonly duties: readonly CalendarGridDuty[];
  readonly isPlaceholder: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly key: string;
  readonly label: string;
}

interface CalendarGridWeek {
  readonly days: readonly CalendarGridDay[];
  readonly key: string;
}

interface CalendarGridData {
  readonly weeks: readonly CalendarGridWeek[];
}

Component({
  properties: {
    assignments: { type: Array, value: [] as CalendarDutyAssignment[] },
    month: { type: Number, value: 0 },
    today: { type: String, value: '' },
    year: { type: Number, value: 0 },
  },

  data: {
    weeks: [] as readonly CalendarGridWeek[],
  } as CalendarGridData,

  observers: {
    'assignments, month, today, year': function buildGrid(
      assignments: CalendarDutyAssignment[],
      month: number,
      today: string,
      year: number,
    ) {
      this.setData({ weeks: buildWeeks(year, month, assignments, today) });
    },
  },

  methods: {
    handleDutyTap(event: WechatMiniprogram.TouchEvent) {
      const assignmentId = event.currentTarget.dataset.assignmentId;
      if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
        return;
      }
      this.triggerEvent('dutytap', { assignmentId });
    },
  },
});

function buildWeeks(
  year: number,
  month: number,
  assignments: readonly CalendarDutyAssignment[],
  today: string,
): readonly CalendarGridWeek[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }

  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dutiesByDate = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of assignments) {
    const duties = dutiesByDate.get(assignment.businessDate) ?? [];
    duties.push(assignment);
    dutiesByDate.set(assignment.businessDate, duties);
  }

  const weeks: CalendarGridWeek[] = [];
  let week: CalendarGridDay[] = [];
  let weekIndex = 0;

  for (let index = 0; index < firstWeekday; index += 1) {
    week.push(buildDay('', '', week.length, today, [], true));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
      day,
    ).padStart(2, '0')}`;
    const duties = (dutiesByDate.get(date) ?? [])
      .slice()
      .sort((first, second) => first.slotPosition - second.slotPosition)
      .map((assignment) => ({
        assignmentId: assignment.id,
        color: assignment.shiftTypeColor,
        label: assignment.shiftTypeAbbreviation,
        textColor: assignment.shiftTypeTextColor,
      }));
    week.push(buildDay(date, String(day), week.length, today, duties, false));
    if (week.length === 7) {
      weeks.push({ days: week, key: `${year}-${month}-${weekIndex}` });
      week = [];
      weekIndex += 1;
    }
  }

  while (week.length > 0 && week.length < 7) {
    week.push(buildDay('', '', week.length, today, [], true));
  }
  if (week.length > 0) {
    weeks.push({ days: week, key: `${year}-${month}-${weekIndex}` });
  }

  return weeks;
}

function buildDay(
  date: string,
  label: string,
  position: number,
  today: string,
  duties: readonly CalendarGridDuty[],
  isPlaceholder: boolean,
): CalendarGridDay {
  return {
    duties,
    isPlaceholder,
    isToday: !isPlaceholder && date === today,
    isWeekend: position === 5 || position === 6,
    key: isPlaceholder ? `placeholder-${position}` : date,
    label,
  };
}
