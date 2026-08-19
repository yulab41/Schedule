export type ManualMatrixMode = 'daily' | 'maximum';

export interface ManualMatrixShiftType {
  readonly abbreviation: string;
  readonly color: string;
  readonly id: string;
  readonly name: string;
  readonly textColor: string;
}

export interface ManualMatrixCellAssignment {
  readonly abbreviation: string;
  readonly color: string;
  readonly shiftTypeId: string;
  readonly textColor: string;
}

export interface ManualMatrixCell extends ManualMatrixCellAssignment {
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly columnIndex: number;
  readonly isSelected: boolean;
  readonly isStale: boolean;
  readonly key: string;
  readonly membershipId: string;
  readonly rowIndex: number;
}

export interface ManualMatrixColumn {
  readonly businessDate: string;
  readonly cycleDay: number;
  readonly dateLabel: string;
  readonly holidayLabel: string;
  readonly isWeekend: boolean;
  readonly isWorkday: boolean;
  readonly weekdayLabel: string;
}

export interface ManualMatrixRow {
  readonly cells: readonly ManualMatrixCell[];
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly realName: string;
  readonly rowIndex: number;
}

export interface ManualMatrixLocation {
  readonly columnIndex: number;
  readonly rowIndex: number;
}

export interface ManualMatrixPocViewModel {
  readonly activeShiftTypeId: string;
  readonly canUndo: boolean;
  readonly columns: readonly ManualMatrixColumn[];
  readonly contentWidth: number;
  readonly dimensionLabel: string;
  readonly logicalCellCount: number;
  readonly matrixViewportHeight: number;
  readonly mode: ManualMatrixMode;
  readonly modeLabel: string;
  readonly rows: readonly ManualMatrixRow[];
  readonly scrollHint: string;
  readonly scrollProgressOffset: number;
  readonly scrollProgressPercent: number;
  readonly selectedLocation: ManualMatrixLocation;
  readonly shiftTypes: readonly ManualMatrixShiftType[];
  readonly title: string;
}

const MEMBER_COLUMN_WIDTH = 104;
const DATE_COLUMN_WIDTH = 72;

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

const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const;

export const manualMatrixPocShiftTypes: readonly ManualMatrixShiftType[] = [
  {
    abbreviation: 'A',
    color: '#DCEEFF',
    id: 'shift-a',
    name: '白班',
    textColor: '#084FA6',
  },
  {
    abbreviation: 'P',
    color: '#EAF8EF',
    id: 'shift-p',
    name: '夜班',
    textColor: '#17672C',
  },
  {
    abbreviation: '备',
    color: '#FFF4D6',
    id: 'shift-standby',
    name: '备班',
    textColor: '#8A5200',
  },
];

export function createManualMatrixPocViewModel(mode: ManualMatrixMode): ManualMatrixPocViewModel {
  const memberCount = mode === 'daily' ? 7 : 20;
  const dayCount = mode === 'daily' ? 7 : 30;
  const columns = Array.from({ length: dayCount }, (_, columnIndex) => createColumn(columnIndex));
  const selectedLocation = { columnIndex: 2, rowIndex: 1 } as const;
  const rows = memberNames.slice(0, memberCount).map((realName, rowIndex) => {
    const membershipId = `member-${rowIndex + 1}`;
    const isStale = mode === 'maximum' && rowIndex === memberCount - 1;
    return {
      cells: columns.map((column, columnIndex) =>
        createCell({
          column,
          columnIndex,
          isSelected:
            rowIndex === selectedLocation.rowIndex && columnIndex === selectedLocation.columnIndex,
          isStale: isStale && column.cycleDay === 8,
          membershipId,
          realName,
          rowIndex,
        }),
      ),
      isStale,
      membershipId,
      realName,
      rowIndex,
    };
  });

  return {
    activeShiftTypeId: 'shift-a',
    canUndo: false,
    columns,
    contentWidth: MEMBER_COLUMN_WIDTH + dayCount * DATE_COLUMN_WIDTH,
    dimensionLabel: `${memberCount} 人 × ${dayCount} 天 = ${memberCount * dayCount} 个逻辑格`,
    logicalCellCount: memberCount * dayCount,
    matrixViewportHeight: 82 + rows.length * 44,
    mode,
    modeLabel: mode === 'daily' ? '常用' : '上限',
    rows,
    scrollHint: '向左滑动查看其余日期，人员列保持固定',
    scrollProgressOffset: 0,
    scrollProgressPercent: 0,
    selectedLocation,
    shiftTypes: manualMatrixPocShiftTypes,
    title: mode === 'daily' ? '日常手工排班' : '最大手工排班',
  };
}

export function getManualMatrixCellAssignment(cell: ManualMatrixCell): ManualMatrixCellAssignment {
  return {
    abbreviation: cell.abbreviation,
    color: cell.color,
    shiftTypeId: cell.shiftTypeId,
    textColor: cell.textColor,
  };
}

export function updateManualMatrixCell(
  cell: ManualMatrixCell,
  assignment: ManualMatrixCellAssignment,
  isSelected: boolean,
): ManualMatrixCell {
  const shiftType = manualMatrixPocShiftTypes.find(
    (candidate) => candidate.id === assignment.shiftTypeId,
  );
  const state = shiftType === undefined ? '未排班' : `已排${shiftType.name}`;
  const stale = cell.isStale ? '，配置失效' : '';
  return {
    ...cell,
    ...assignment,
    ariaLabel: `${cell.businessDate}，${findMemberName(cell.membershipId)}，${state}${stale}`,
    isSelected,
  };
}

function createCell(options: {
  readonly column: ManualMatrixColumn;
  readonly columnIndex: number;
  readonly isSelected: boolean;
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly realName: string;
  readonly rowIndex: number;
}): ManualMatrixCell {
  const seed = options.rowIndex + options.column.cycleDay;
  const shiftType =
    seed % 5 === 0 ? undefined : manualMatrixPocShiftTypes[seed % manualMatrixPocShiftTypes.length];
  const state = shiftType === undefined ? '未排班' : `已排${shiftType.name}`;
  const stale = options.isStale ? '，配置失效' : '';
  return {
    abbreviation: shiftType?.abbreviation ?? '',
    ariaLabel: `${options.column.businessDate}，${options.realName}，${state}${stale}`,
    businessDate: options.column.businessDate,
    color: shiftType?.color ?? '',
    columnIndex: options.columnIndex,
    isSelected: options.isSelected,
    isStale: options.isStale,
    key: `${options.column.cycleDay}:${options.membershipId}`,
    membershipId: options.membershipId,
    rowIndex: options.rowIndex,
    shiftTypeId: shiftType?.id ?? '',
    textColor: shiftType?.textColor ?? '',
  };
}

function createColumn(columnIndex: number): ManualMatrixColumn {
  const cycleDay = columnIndex + 1;
  const date = new Date(Date.UTC(2026, 9, cycleDay));
  const dateLabel = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
  return {
    businessDate: `2026-${dateLabel}`,
    cycleDay,
    dateLabel,
    holidayLabel: cycleDay === 1 || cycleDay === 2 ? '国庆节' : '',
    isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    isWorkday: cycleDay === 10,
    weekdayLabel: `周${weekdays[date.getUTCDay()] ?? '日'}`,
  };
}

function findMemberName(membershipId: string): string {
  const memberIndex = Number(membershipId.slice('member-'.length)) - 1;
  return memberNames[memberIndex] ?? '未知成员';
}
