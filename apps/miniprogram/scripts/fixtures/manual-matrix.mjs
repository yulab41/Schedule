// Deterministic synthetic manual-schedule matrices shared by the performance budget and the
// matrix/WXS tests. Plain JavaScript so the standalone `check:performance` script and the vitest
// suites can both use one source; the product limits themselves stay in
// `@schedule/contracts/manual-schedule-limits` and `manual-schedule-limits.test.mjs` asserts that
// this fixture mirrors them.

export const MANUAL_MATRIX_MODE_LIMITS = Object.freeze({
  daily: Object.freeze({ days: 7, members: 7 }),
  maximum: Object.freeze({ days: 30, members: 20 }),
});

export const MANUAL_MATRIX_HEADER_HEIGHT = 82;
export const MANUAL_MATRIX_ROW_HEIGHT = 44;
export const MANUAL_MATRIX_VISIBLE_ROWS = 7;

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
];
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export const manualMatrixShiftTypes = Object.freeze([
  Object.freeze({
    abbreviation: 'A',
    color: '#DCEEFF',
    id: 'shift-a',
    name: '白班',
    textColor: '#084FA6',
  }),
  Object.freeze({
    abbreviation: 'P',
    color: '#EAF8EF',
    id: 'shift-p',
    name: '夜班',
    textColor: '#17672C',
  }),
  Object.freeze({
    abbreviation: '备',
    color: '#FFF4D6',
    id: 'shift-standby',
    name: '备班',
    textColor: '#8A5200',
  }),
]);

export function createManualMatrixViewModel(mode) {
  if (mode !== 'daily' && mode !== 'maximum') {
    throw new Error(`unknown manual matrix mode: ${mode}`);
  }
  const { days: dayCount, members: memberCount } = MANUAL_MATRIX_MODE_LIMITS[mode];
  const logicalCellCount = memberCount * dayCount;
  const columns = Array.from({ length: dayCount }, (_, columnIndex) => createColumn(columnIndex));
  const selectedLocation = { columnIndex: 2, rowIndex: 1 };
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
  const matrixContentHeight = MANUAL_MATRIX_HEADER_HEIGHT + rows.length * MANUAL_MATRIX_ROW_HEIGHT;
  const matrixViewportHeight = Math.min(
    matrixContentHeight,
    MANUAL_MATRIX_HEADER_HEIGHT + MANUAL_MATRIX_VISIBLE_ROWS * MANUAL_MATRIX_ROW_HEIGHT,
  );

  return {
    activeShiftTypeId: 'shift-a',
    canUndo: false,
    columns,
    contentWidth: MEMBER_COLUMN_WIDTH + dayCount * DATE_COLUMN_WIDTH,
    dimensionLabel: `${memberCount} 人 × ${dayCount} 天 = ${memberCount * dayCount} 个逻辑格`,
    logicalCellCount,
    matrixBodyViewportHeight: matrixViewportHeight - MANUAL_MATRIX_HEADER_HEIGHT,
    matrixContentHeight,
    matrixViewportHeight,
    mode,
    modeLabel: mode === 'daily' ? '常用' : '上限',
    rows,
    scrollHint: '向左滑动查看其余日期，人员列保持固定',
    scrollProgressOffset: 0,
    scrollProgressPercent: 0,
    selectedLocation,
    shiftTypes: manualMatrixShiftTypes,
    title: mode === 'daily' ? '日常手工排班' : '最大手工排班',
  };
}

export function getManualMatrixCellAssignment(cell) {
  return {
    abbreviation: cell.abbreviation,
    color: cell.color,
    shiftTypeId: cell.shiftTypeId,
    textColor: cell.textColor,
  };
}

export function updateManualMatrixCell(cell, assignment, isSelected) {
  const shiftType = manualMatrixShiftTypes.find(
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

function createCell(options) {
  const seed = options.rowIndex + options.column.cycleDay;
  const shiftType =
    seed % 5 === 0 ? undefined : manualMatrixShiftTypes[seed % manualMatrixShiftTypes.length];
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

function createColumn(columnIndex) {
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

function findMemberName(membershipId) {
  const memberIndex = Number(membershipId.slice('member-'.length)) - 1;
  return memberNames[memberIndex] ?? '未知成员';
}
