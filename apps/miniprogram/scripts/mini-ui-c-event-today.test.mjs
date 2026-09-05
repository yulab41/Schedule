// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, describe, expect, it, vi } from 'vitest';

const read = (file) => readFileSync(path.join(process.cwd(), 'src', file), 'utf8');

afterEach(() => {
  globalThis.document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('task C event sheet and today marker', () => {
  it('uses half only for event records and keeps the shared title/Done header outside the scroll', () => {
    const page = read('pages/workbench/index.wxml');
    const sheet = page.match(
      /<ui-sheet\s+visible="\{\{shiftEventSheetOpen\}\}"[\s\S]*?<\/ui-sheet>/u,
    )?.[0];
    expect(sheet).toContain('size="half"');
    expect(sheet).toContain('title="班次事件记录"');
    expect(sheet).toContain('close-label="完成"');
    expect(sheet).toContain('bind:close="handleShiftEventClose"');
    expect(page.match(/size="half"/gu)).toHaveLength(1);
    const root = globalThis.document.createElement('div');
    root.innerHTML = read('components/shift-event-records/index.wxml');
    const scrolls = root.querySelectorAll('scroll-view[scroll-y]');
    expect(scrolls).toHaveLength(1);
    for (const selector of ['.shift-event-meta', '.shift-event-timeline', '.shift-event-chain']) {
      expect(scrolls[0].querySelector(selector), selector).not.toBeNull();
    }
    expect(scrolls[0].querySelector('.ui-sheet__header')).toBeNull();
  });

  it('renders the last of 80 records and the whole change chain in the same scroll content', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/shift-event-records/index.ts');
    const loading = simulate.load({ template: '<view></view>' });
    const id = simulate.load({
      ...definition,
      usingComponents: { 'ui-loading': loading },
      template: read('components/shift-event-records/index.wxml'),
    });
    const component = simulate.render(id, {
      state: 'ready',
      meta: '2026-09-05 · 全天班',
      changeChain: '首位 → 中间 → 最后一位',
      cards: Array.from({ length: 80 }, (_, index) => ({
        id: `event-${index}`,
        eventTone: 'neutral',
        eventTypeLabel: '人工调整班次',
        occurredAtLabel: `第 ${index + 1} 条`,
        narrative: '用于滚动验证的长事件记录。',
        changes: [],
      })),
    });
    component.attach(globalThis.document.body);
    const scroll = component.querySelector('.shift-event-sheet-scroll');
    // Native nodes have their own simulate query scope; inspect their projected DOM children.
    expect(scroll.dom.querySelectorAll('.shift-event-card')).toHaveLength(80);
    expect(scroll.dom.querySelector('.shift-event-chain-summary')).not.toBeNull();
    expect(scroll.dom.querySelector('.shift-event-meta')).not.toBeNull();
    const styles = read('components/shift-event-records/index.wxss');
    expect(styles).toMatch(/\.shift-event-sheet-scroll\s*\{[^}]*min-height:\s*0/u);
    expect(styles).toMatch(/\.shift-event-sheet-scroll\s*\{[^}]*height:\s*100%/u);
    // simulate cannot detach a virtual host; the projected body is cleaned in afterEach.
  });

  it.each(['4', '14'])(
    'uses a square view around the %s date text without changing date events',
    async (day) => {
      let definition;
      vi.stubGlobal('Component', (value) => {
        definition = value;
      });
      await import('../src/components/calendar/calendar-cell/index.ts');
      const id = simulate.load({
        ...definition,
        template: read('components/calendar/calendar-cell/index.wxml'),
      });
      const component = simulate.render(id, {
        day,
        isToday: true,
        isSelected: true,
        isWeekend: true,
        isHoliday: true,
        isCurrentMonth: true,
        holiday: '中秋',
        businessDate: `2026-09-${day.padStart(2, '0')}`,
      });
      component.attach(globalThis.document.body);
      const marker = component.querySelector('.calendar-date-marker');
      expect(marker).toBeDefined();
      expect(marker.dom.querySelector('.date-number')).not.toBeNull();
      expect(marker.dom.tagName.toLowerCase()).toContain('view');
      const selected = vi.fn();
      component.addEventListener('select', selected);
      component.instance.handleSelect();
      expect(selected.mock.calls[0][0].detail.businessDate).toBe(`2026-09-${day.padStart(2, '0')}`);
      expect(component.querySelector('.holiday-chip')).toBeDefined();
      component.detach();
    },
  );

  it('shares the yellow/dark token and centering geometry between month and week, independent of selection', () => {
    const markerStyles = read('styles/calendar-date-marker.wxss');
    expect(markerStyles).toContain('var(--ui-color-today-marker)');
    expect(markerStyles).toContain('var(--ui-color-near-black)');
    for (const property of [
      'width: 18px',
      'height: 18px',
      'align-items: center',
      'justify-content: center',
      'line-height: 18px',
    ]) {
      expect(markerStyles).toContain(property);
    }
    expect(markerStyles).not.toMatch(/translate|nth-child|is-selected/u);
    expect(read('components/calendar/calendar-cell/index.wxss')).toContain(
      'calendar-date-marker.wxss',
    );
    const week = read('pages/workbench/index.wxml');
    expect(week).toMatch(
      /<view[^>]*calendar-date-marker[^>]*>[\s\S]*?<text[^>]*day-number[^>]*>\{\{day.day\}\}/u,
    );
    const weekStyles = read('pages/workbench/index.wxss');
    expect(weekStyles).toContain('calendar-date-marker.wxss');
    expect(weekStyles).toMatch(
      /\.week-day\.is-selected::after\s*\{[^}]*var\(--ui-color-primary\)/u,
    );
    expect(weekStyles).not.toMatch(
      /\.week-day\.is-today \.day-number\s*\{[^}]*var\(--ui-color-primary\)/u,
    );
  });
});
