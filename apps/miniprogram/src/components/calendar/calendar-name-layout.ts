export type CalendarNameLayout = 'page' | 'preview' | 'backfill' | 'dialog';

/** Match the existing page gutters and preview dialog padding; never inspect a name or cell. */
export function createCalendarNameLayout(
  layout: CalendarNameLayout,
  compact: boolean,
  windowWidth: number,
) {
  const cardWidth =
    layout === 'dialog'
      ? Math.min(windowWidth - 28, 362) - 2 - (windowWidth <= 360 ? 20 : 32)
      : windowWidth -
        (layout === 'page' ? 24 : windowWidth <= 340 ? (layout === 'preview' ? 20 : 24) : 28);
  const columnWidth = (cardWidth - 2) / 7;
  const font = compact ? 9 : 11;
  const monthScale =
    Math.floor(Math.min(1.18, (columnWidth - 5) / (3 * font + 13 + 1)) * 10000) / 10000;
  const weekScale =
    Math.floor(Math.min(1, (columnWidth - (compact ? 9 : 11)) / 36) * 10000) / 10000;
  const px = (value: number) => `${Math.floor(value * 10000) / 10000}px`;
  const style = [
    `--calendar-month-name-size:${px(font * monthScale)}`,
    `--calendar-month-badge-size:${px(13 * monthScale)}`,
    `--calendar-month-badge-font:${px(8 * monthScale)}`,
    `--calendar-month-gap:${px(monthScale)}`,
    `--calendar-month-line-height:${px(14 * Math.max(1, monthScale))}`,
    `--calendar-week-name-size:${px(12 * weekScale)}`,
    `--calendar-week-badge-font:${px(8 * weekScale)}`,
    `--calendar-week-badge-width:${px(12 * weekScale)}`,
    `--calendar-week-badge-height:${px(14 * weekScale)}`,
    `--calendar-week-gap:${px(2 * weekScale)}`,
  ].join(';');
  return { cardWidth, monthScale, weekScale, style };
}

let screenWidth: number | undefined;
const layouts = new Map<string, ReturnType<typeof createCalendarNameLayout>>();

export function getCalendarNameLayout(layout: CalendarNameLayout = 'page', compact = false) {
  screenWidth ??= typeof wx === 'undefined' ? 390 : (wx.getWindowInfo?.().windowWidth ?? 390);
  const key = `${layout}:${compact}`;
  let result = layouts.get(key);
  if (!result) {
    result = createCalendarNameLayout(layout, compact, screenWidth);
    layouts.set(key, result);
  }
  return result;
}
