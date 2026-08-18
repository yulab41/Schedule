// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderCalendarCell(properties) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/calendar/calendar-cell/index.ts');
  const workingDirectory = process.cwd();
  const appRoot = workingDirectory.replaceAll('\\', '/').endsWith('/apps/miniprogram')
    ? workingDirectory
    : path.join(workingDirectory, 'apps', 'miniprogram');
  const template = readFileSync(
    path.join(appRoot, 'src', 'components', 'calendar', 'calendar-cell', 'index.wxml'),
    'utf8',
  );
  const id = simulate.load({ ...definition, template });
  const component = simulate.render(id, properties);
  component.attach(globalThis.document.body);
  return component;
}

describe('P1 native calendar simulate smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders combined today/selected/holiday state and emits a date selection', async () => {
    const component = await renderCalendarCell({
      ariaLabel: '2026-10-14，国庆，王护士，换班',
      businessDate: '2026-10-14',
      day: '14',
      holiday: '国庆',
      isCurrentMonth: true,
      isHoliday: true,
      isSelected: true,
      isToday: true,
      isWeekend: false,
      marker: '换',
      person: '王护士',
    });
    const selectListener = vi.fn();
    component.addEventListener('select', selectListener);

    const cell = component.querySelector('.calendar-cell');
    expect(cell).toBeDefined();
    expect(component.querySelector('.date-number')).toBeDefined();
    expect(component.querySelector('.holiday-chip')).toBeDefined();
    expect(component.querySelector('.month-person')).toBeDefined();
    expect(component.querySelector('.change-mark')).toBeDefined();
    expect(cell.toJSON().event.tap.handler).toBe('handleSelect');
    component.instance.handleSelect();
    expect(selectListener).toHaveBeenCalledOnce();
    expect(selectListener.mock.calls[0][0].detail).toEqual({ businessDate: '2026-10-14' });
  });
});
