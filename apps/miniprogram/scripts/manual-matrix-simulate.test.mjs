// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderManualScheduleCell(properties) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/manual-schedule/manual-schedule-cell/index.ts');
  const workingDirectory = process.cwd();
  const appRoot = workingDirectory.replaceAll('\\', '/').endsWith('/apps/miniprogram')
    ? workingDirectory
    : path.join(workingDirectory, 'apps', 'miniprogram');
  const template = readFileSync(
    path.join(
      appRoot,
      'src',
      'components',
      'manual-schedule',
      'manual-schedule-cell',
      'index.wxml',
    ),
    'utf8',
  );
  const id = simulate.load({ ...definition, template });
  const component = simulate.render(id, properties);
  component.attach(globalThis.document.body);
  return component;
}

describe('P1 native manual schedule cell simulate smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders selected stale shift state and emits one indexed selection', async () => {
    const component = await renderManualScheduleCell({
      abbreviation: 'A',
      ariaLabel: '2026-10-08，宋护士，已排白班，配置失效',
      columnIndex: 7,
      color: '#DCEEFF',
      disabled: false,
      isSelected: true,
      isStale: true,
      keyValue: '8:member-20',
      rowIndex: 19,
      textColor: '#084FA6',
    });
    const selectListener = vi.fn();
    component.addEventListener('select', selectListener);

    expect(component.querySelector('.manual-schedule-cell')).toBeDefined();
    expect(component.querySelector('.cell-shift')).toBeDefined();
    expect(component.querySelector('.stale-badge')).toBeDefined();
    component.instance.handleSelect();

    expect(selectListener).toHaveBeenCalledOnce();
    expect(selectListener.mock.calls[0][0].detail).toEqual({
      columnIndex: 7,
      key: '8:member-20',
      rowIndex: 19,
    });
  });

  it('keeps disabled cells inert', async () => {
    const component = await renderManualScheduleCell({
      ariaLabel: '禁用排班格',
      columnIndex: 0,
      disabled: true,
      keyValue: '1:member-1',
      rowIndex: 0,
    });
    const selectListener = vi.fn();
    component.addEventListener('select', selectListener);

    component.instance.handleSelect();
    expect(selectListener).not.toHaveBeenCalled();
  });
});
