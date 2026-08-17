import type { ConfirmedHolidayDate, ShiftType } from '@schedule/contracts';

import {
  createCellKey,
  getTemplateDateColumns,
  type ManualGridRow,
  type ManualGridSelection,
  type TemplateCellMap,
  type TemplateDateColumn,
} from '../../features/manual-schedule/manual-schedule-logic.js';

export type MiniprogramMatrixMode = 'daily' | 'maximum';

export interface MiniprogramMatrixFixture {
  readonly cells: TemplateCellMap;
  readonly columns: readonly TemplateDateColumn[];
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly logicalCellCount: number;
  readonly rows: readonly ManualGridRow[];
  readonly selectedCell: ManualGridSelection;
  readonly shiftTypes: readonly ShiftType[];
  readonly staleCellKeys: ReadonlySet<string>;
}

const memberNames = [
  '林医生',
  '陈护士',
  '王医生',
  '周护士',
  '黄医生',
  '郑护士',
  '李医生',
  '许护士',
  '吴医生',
  '赵护士',
  '孙医生',
  '马护士',
  '朱医生',
  '胡护士',
  '郭医生',
  '何护士',
  '高医生',
  '罗护士',
  '梁医生',
  '宋护士',
] as const;

export const parityShiftTypes: readonly ShiftType[] = [
  {
    abbreviation: 'A',
    color: '#DCEEFF',
    configurationVersion: 1,
    countsTowardStatistics: true,
    crossesMidnight: false,
    displayOrder: 1,
    endTime: '18:00',
    id: 'shift-a',
    isAllDay: false,
    isBuiltIn: false,
    isEnabled: true,
    name: '白班',
    startTime: '08:00',
    textColor: '#084FA6',
    version: 1,
  },
  {
    abbreviation: 'P',
    color: '#EAF8EF',
    configurationVersion: 1,
    countsTowardStatistics: true,
    crossesMidnight: true,
    displayOrder: 2,
    endTime: '08:00',
    id: 'shift-p',
    isAllDay: false,
    isBuiltIn: false,
    isEnabled: true,
    name: '夜班',
    startTime: '18:00',
    textColor: '#17672C',
    version: 1,
  },
  {
    abbreviation: '备',
    color: '#FFF4D6',
    configurationVersion: 1,
    countsTowardStatistics: false,
    crossesMidnight: false,
    displayOrder: 3,
    id: 'shift-standby',
    isAllDay: true,
    isBuiltIn: false,
    isEnabled: true,
    name: '备班',
    textColor: '#8A5200',
    version: 1,
  },
];

function createHoliday(
  date: string,
  holidayName: string,
  isOffDay: boolean,
  isWorkday: boolean,
): ConfirmedHolidayDate {
  return { date, holidayName, isOffDay, isWorkday };
}

export function createMiniprogramMatrixFixture(
  mode: MiniprogramMatrixMode,
): MiniprogramMatrixFixture {
  const memberCount = mode === 'daily' ? 7 : 20;
  const dayCount = mode === 'daily' ? 7 : 30;
  const rows = memberNames.slice(0, memberCount).map((realName, index) => ({
    isStale: mode === 'maximum' && index === memberCount - 1,
    membershipId: `member-${index + 1}`,
    realName,
  }));
  const columns = getTemplateDateColumns('2026-10-01', dayCount);
  const cells = new Map<string, string>();

  for (const [rowIndex, row] of rows.entries()) {
    for (const column of columns) {
      const seed = rowIndex + column.cycleDay;
      if (seed % 5 !== 0) {
        cells.set(
          createCellKey(column.cycleDay, row.membershipId),
          parityShiftTypes[seed % parityShiftTypes.length]?.id ?? 'shift-a',
        );
      }
    }
  }

  const holidays = new Map<string, ConfirmedHolidayDate>([
    ['2026-10-01', createHoliday('2026-10-01', '国庆节', true, false)],
    ['2026-10-02', createHoliday('2026-10-02', '国庆节', true, false)],
    ['2026-10-10', createHoliday('2026-10-10', '调休', false, true)],
  ]);
  const selectedCell = { cycleDay: 3, membershipId: 'member-2' } as const;
  const staleCellKeys =
    mode === 'maximum' ? new Set([createCellKey(8, `member-${memberCount}`)]) : new Set<string>();

  return {
    cells,
    columns,
    holidays,
    logicalCellCount: memberCount * dayCount,
    rows,
    selectedCell,
    shiftTypes: parityShiftTypes,
    staleCellKeys,
  };
}
