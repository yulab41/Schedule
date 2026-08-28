// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderWheel(properties) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/ui/ui-wheel-column/index.ts');
  const template = readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ui', 'ui-wheel-column', 'index.wxml'),
    'utf8',
  );
  const id = simulate.load({ ...definition, template });
  const component = simulate.render(id, properties);
  component.attach(globalThis.document.body);
  return component;
}

describe('native UiWheelColumn simulate smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders accessible options and routes point selection into the same command config', async () => {
    const component = await renderWheel({
      animateCommand: false,
      ariaLabel: '年份滚轮',
      commandRevision: 1,
      generation: 3,
      items: [
        { ariaLabel: '2025年', label: '2025' },
        { ariaLabel: '2026年', label: '2026' },
        { ariaLabel: '2027年', label: '2027' },
      ],
      runtimeKey: 'simulate-year',
      selectedIndex: 1,
      unit: '年',
    });

    expect(component.querySelectorAll('.ui-wheel-item')).toHaveLength(3);
    expect(
      component.querySelectorAll('.ui-wheel-item')[1].dom.classList.contains('is-selected'),
    ).toBe(true);
    expect(component.querySelectorAll('.ui-wheel-item')[2].toJSON().event.tap.handler).toBe(
      'handleItemTap',
    );
    component.instance.handleItemTap({ currentTarget: { dataset: { index: 2 } } });
    expect(component.data.internalSelectedIndex).toBe(2);
    expect(component.data.wheelConfig).toMatchObject({
      animateCommand: true,
      generation: 3,
      runtimeKey: 'simulate-year',
      selectedIndex: 2,
    });
  });
});
