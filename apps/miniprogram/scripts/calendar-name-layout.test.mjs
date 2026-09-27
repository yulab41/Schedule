import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('shares the cache across separately bundled pages and components through the app runtime', async () => {
  vi.resetModules();
  const screen = vi.fn(() => ({ windowWidth: 360 }));
  const app = { globalData: {} };
  vi.stubGlobal('wx', { getWindowInfo: screen });
  vi.stubGlobal('getApp', () => app);
  const home = await import('../src/components/calendar/calendar-name-layout.ts');
  const page = home.getCalendarNameLayout('page');
  vi.resetModules();
  const component = await import('../src/components/calendar/calendar-name-layout.ts');
  const dialog = component.getCalendarNameLayout('dialog', true);
  expect(component.getCalendarNameLayout('page')).toBe(page);
  expect(home.getCalendarNameLayout('dialog', true)).toBe(dialog);
  expect(screen).toHaveBeenCalledTimes(1);
});

it('reads the screen once and returns one shared value per calendar layout, independent of row count', async () => {
  vi.resetModules();
  const screen = vi.fn(() => ({ windowWidth: 390 }));
  vi.stubGlobal('wx', { getWindowInfo: screen });
  const { getCalendarNameLayout } =
    await import('../src/components/calendar/calendar-name-layout.ts');
  const page = getCalendarNameLayout('page');
  const dialog = getCalendarNameLayout('dialog', true);
  for (let i = 0; i < 600; i++) {
    expect(getCalendarNameLayout('page')).toBe(page);
    expect(getCalendarNameLayout('dialog', true)).toBe(dialog);
  }
  expect(screen).toHaveBeenCalledTimes(1);
  expect(dialog.cardWidth).toBeLessThan(page.cardWidth);
  expect(dialog.style).not.toBe(page.style);
});

it('fits the fixed three-character plus badge budget at each real container width and caps enlargement', async () => {
  const { createCalendarNameLayout } =
    await import('../src/components/calendar/calendar-name-layout.ts');
  for (const width of [320, 360, 390, 393, 768]) {
    for (const [layout, compact] of [
      ['page', false],
      ['preview', false],
      ['backfill', false],
      ['dialog', true],
    ]) {
      const metrics = createCalendarNameLayout(layout, compact, width);
      const available = (metrics.cardWidth - 2) / 7 - 5;
      expect(metrics.monthScale).toBeLessThanOrEqual(1.18);
      expect((3 * (compact ? 9 : 11) + 13 + 1) * metrics.monthScale).toBeLessThanOrEqual(
        available + 0.01,
      );
    }
  }
});
