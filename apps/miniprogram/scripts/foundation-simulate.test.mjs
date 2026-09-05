// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderSwitch(properties) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/ui/ui-switch/index.ts');
  const workingDirectory = process.cwd();
  const appRoot = workingDirectory.replaceAll('\\', '/').endsWith('/apps/miniprogram')
    ? workingDirectory
    : path.join(workingDirectory, 'apps', 'miniprogram');
  const template = readFileSync(
    path.join(appRoot, 'src', 'components', 'ui', 'ui-switch', 'index.wxml'),
    'utf8',
  );
  const id = simulate.load({ ...definition, template });
  const component = simulate.render(id, properties);
  component.attach(globalThis.document.body);
  return component;
}

describe('P1 native foundation simulate smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders the custom switch tree and dispatches its controlled change event', async () => {
    const component = await renderSwitch({
      checked: false,
      disabled: false,
      label: '微信值班提醒',
      loading: false,
    });
    const changeListener = vi.fn();
    component.addEventListener('change', changeListener);
    const hitArea = component.querySelector('.ui-switch__hit-area');

    expect(hitArea).toBeDefined();
    expect(hitArea.toJSON().event.tap.handler).toBe('handleToggle');
    component.instance.handleToggle();
    expect(changeListener).toHaveBeenCalledOnce();
    expect(changeListener.mock.calls[0][0].detail).toEqual({ checked: true });
  });

  it('keeps the same switch painted while loading, blocks taps, and preserves permanent disabled styling', async () => {
    const component = await renderSwitch({ checked: true, label: '设置', loading: false });
    const track = component.querySelector('.ui-switch__track').dom;
    const changeListener = vi.fn();
    component.addEventListener('change', changeListener);
    component.setData({ loading: true });
    expect(component.querySelector('.ui-switch__track').dom).toBe(track);
    expect(component.querySelector('.ui-switch__hit-area').dom.className).not.toContain(
      'is-inactive',
    );
    expect(component.querySelector('.ui-switch__track').dom.className).toContain('is-checked');
    component.instance.handleToggle();
    expect(changeListener).not.toHaveBeenCalled();
    component.setData({ loading: false });
    expect(component.querySelector('.ui-switch__track').dom).toBe(track);
    component.setData({ disabled: true });
    expect(component.querySelector('.ui-switch__hit-area').dom.className).toContain('is-inactive');
    component.instance.handleToggle();
    expect(changeListener).not.toHaveBeenCalled();
    component.detach();
  });

  it('reuses an explicit checked color without changing the off track or default color contract', async () => {
    const component = await renderSwitch({ checked: true, color: '#1F5AA6' });
    expect(component.querySelector('.ui-switch__track').dom.style.backgroundColor).toBe(
      'rgb(31, 90, 166)',
    );
    component.setData({ checked: false });
    expect(component.querySelector('.ui-switch__track').dom.style.backgroundColor).toBe('');
    component.setData({ checked: true, color: '' });
    expect(component.querySelector('.ui-switch__track').dom.style.backgroundColor).toBe('');
    component.detach();
  });
});
