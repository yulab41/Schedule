const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;
const visibleAccessMonthCount = 4;

export interface VisitorAccessAggregateLike {
  readonly accessCount: string;
  readonly accessMonth: string;
  readonly businessMonth: string;
}

export interface VisitorAccessAggregateCardLike {
  readonly accessCountLabel: string;
  readonly accessMonth: string;
  readonly accessMonthLabel: string;
  readonly barHeight: number;
}

export function formatVisitorAccessDateTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) return '访问时间未知';
  const shifted = new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)}`;
}

/** Web renders the business month as the API's stable YYYY-MM value. */
export function formatVisitorAccessMonth(value: string): string {
  return value;
}

export function buildVisitorAccessAggregateCards(
  rows: readonly VisitorAccessAggregateLike[],
): readonly VisitorAccessAggregateCardLike[] {
  const visibleRows = getVisibleAggregateRows(rows);
  const maxCount = Math.max(...visibleRows.map((row) => Number(row.accessCount)), 1);
  return visibleRows.map((row) => ({
    accessCountLabel: String(row.accessCount),
    accessMonth: row.accessMonth,
    accessMonthLabel: formatAggregateMonth(row.accessMonth),
    barHeight: Math.max(12, Math.round((Number(row.accessCount) / maxCount) * 100)),
  }));
}

export function sumVisitorAccessCounts(rows: readonly VisitorAccessAggregateLike[]): string {
  const total = getVisibleAggregateRows(rows).reduce(
    (sum, row) => sum + Number(row.accessCount),
    0,
  );
  return `${total} 次`;
}

export function maskVisitorAccessIp(value: string | undefined): string {
  if (value === undefined || value.length === 0) return '来源已脱敏';
  const parts = value.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part))) {
    return `${parts.slice(0, 3).join('.')}.*`;
  }
  return '来源已脱敏';
}

export function maskVisitorAccessRequestId(value: string | undefined): string {
  if (value === undefined || value.length === 0) return '请求标识已隐藏';
  if (value.length <= 10) return `请求 ${value.slice(0, 4)}…`;
  return `请求 ${value.slice(0, 7)}…${value.slice(-4)}`;
}

function formatAggregateMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);
  return match === null ? value : `${match[2]}月`;
}

function getVisibleAggregateRows(
  rows: readonly VisitorAccessAggregateLike[],
): readonly VisitorAccessAggregateLike[] {
  const totalsByAccessMonth = new Map<string, number>();
  for (const row of rows) {
    totalsByAccessMonth.set(
      row.accessMonth,
      (totalsByAccessMonth.get(row.accessMonth) ?? 0) + Number(row.accessCount),
    );
  }
  return [...totalsByAccessMonth.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-visibleAccessMonthCount)
    .map(([accessMonth, accessCount]) => ({
      accessCount: String(accessCount),
      accessMonth,
      businessMonth: accessMonth,
    }));
}
