import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const galleryComponentNames = [
  'ui-alert',
  'ui-button',
  'ui-checkbox',
  'ui-chip',
  'ui-input-shell',
  'ui-picker',
  'ui-radio',
  'ui-switch',
];
const componentNames = [...galleryComponentNames, 'ui-loading'];

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

async function captureDefinition(componentName) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  if (componentName === 'ui-switch') {
    await import('../src/components/ui/ui-switch/index.ts');
  } else if (componentName === 'ui-button') {
    await import('../src/components/ui/ui-button/index.ts');
  } else {
    throw new Error(`unsupported definition fixture: ${componentName}`);
  }
  return definition;
}

describe('P1 native foundation component boundary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the approved control set without a third-party UI dependency', () => {
    const pageConfig = JSON.parse(readSource('pages/index/index.json'));
    expect(pageConfig.usingComponents).toEqual(
      Object.fromEntries(
        galleryComponentNames.map((name) => [
          `ui-${name.slice(3)}`,
          `/components/ui/${name}/index`,
        ]),
      ),
    );

    for (const componentName of componentNames) {
      const componentConfig = JSON.parse(readSource(`components/ui/${componentName}/index.json`));
      expect(componentConfig.component).toBe(true);
    }

    expect(JSON.parse(readSource('components/ui/ui-button/index.json')).usingComponents).toEqual({
      'ui-loading': '/components/ui/ui-loading/index',
    });

    expect(readSource('app.wxss')).toContain('@import "./styles/tokens.wxss";');
  });

  it('keeps the switch geometry and accessibility contract from the Web golden', () => {
    const template = readSource('components/ui/ui-switch/index.wxml');
    const stylesheet = readSource('components/ui/ui-switch/index.wxss');

    expect(template).toContain('aria-role="switch"');
    expect(template).toContain('aria-checked="{{checked}}"');
    expect(template).toContain('aria-label="{{label}}"');
    expect(stylesheet).toMatch(/width:\s*60px/u);
    expect(stylesheet).toMatch(/min-height:\s*44px/u);
    expect(stylesheet).toMatch(/width:\s*52px/u);
    expect(stylesheet).toMatch(/height:\s*30px/u);
    expect(stylesheet).toMatch(/translateX\(22px\)/u);
  });

  it('emits one controlled switch change and blocks disabled or loading interaction', async () => {
    const definition = await captureDefinition('ui-switch');
    expect(definition).toBeDefined();
    const handleToggle = definition.methods.handleToggle;
    const triggerEvent = vi.fn();
    const instance = {
      properties: { checked: false, disabled: false, loading: false },
      triggerEvent,
    };

    handleToggle.call(instance);
    expect(triggerEvent).toHaveBeenCalledOnce();
    expect(triggerEvent).toHaveBeenCalledWith('change', { checked: true });

    triggerEvent.mockClear();
    instance.properties.disabled = true;
    handleToggle.call(instance);
    instance.properties.disabled = false;
    instance.properties.loading = true;
    handleToggle.call(instance);
    expect(triggerEvent).not.toHaveBeenCalled();
  });

  it('blocks disabled and loading buttons before emitting the semantic press event', async () => {
    const definition = await captureDefinition('ui-button');
    expect(definition).toBeDefined();
    const handlePress = definition.methods.handlePress;
    const triggerEvent = vi.fn();
    const instance = {
      properties: { disabled: false, loading: false, variant: 'primary' },
      triggerEvent,
    };

    handlePress.call(instance);
    expect(triggerEvent).toHaveBeenCalledWith('press', { variant: 'primary' });

    triggerEvent.mockClear();
    instance.properties.loading = true;
    handlePress.call(instance);
    instance.properties.loading = false;
    instance.properties.disabled = true;
    handlePress.call(instance);
    expect(triggerEvent).not.toHaveBeenCalled();
  });
});
