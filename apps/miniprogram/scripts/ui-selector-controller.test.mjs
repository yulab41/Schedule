import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function createSelector() {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/ui/ui-selector/index.ts');
  const instance = {
    data: structuredClone(definition.data),
    properties: {
      disabled: false,
      selectedIndex: 0,
      options: [
        { label: '月视图', value: 'month' },
        { label: '周视图', value: 'week' },
      ],
    },
    setData(patch) {
      Object.assign(this.data, patch);
    },
    triggerEvent: vi.fn(),
  };
  definition.lifetimes.attached.call(instance);
  return { definition, instance };
}
describe('shared group/workflow selector behavior', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());
  it('toggles the same trigger, commits one choice, and dismisses without another change', async () => {
    const { definition, instance } = await createSelector();
    definition.methods.handleOpen.call(instance);
    expect(instance.data.open).toBe(true);
    expect(instance.data.renderedOptions[1].leadingLabel).toBe('周视图');
    definition.methods.handleOpen.call(instance);
    expect(instance.data.open).toBe(false);
    definition.methods.handleOpen.call(instance);
    instance.triggerEvent.mockClear();
    definition.methods.handleOptionTap.call(instance, { currentTarget: { dataset: { index: 1 } } });
    expect(instance.triggerEvent).toHaveBeenCalledExactlyOnceWith('change', {
      index: 1,
      option: instance.properties.options[1],
      value: '1',
    });
    expect(instance.data.open).toBe(false);
    definition.methods.handleClose.call(instance);
    expect(instance.triggerEvent).toHaveBeenCalledTimes(1);
  });
  it('places upwards near the viewport edge and clears on page hide', async () => {
    const { definition, instance } = await createSelector();
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }) });
    const query = {
      select: () => query,
      boundingClientRect: () => query,
      exec: (callback) => callback([{ top: 790, bottom: 834 }]),
    };
    instance.createSelectorQuery = () => query;
    definition.methods.handleOpen.call(instance);
    expect(instance.data.popoverPlacement).toBe('up');
    expect(instance.data.popoverPlacementReady).toBe(true);
    definition.pageLifetimes.hide.call(instance);
    expect(instance.data.open).toBe(false);
    instance.properties.disabled = true;
    definition.methods.handleOpen.call(instance);
    expect(instance.data.open).toBe(false);
    definition.lifetimes.detached.call(instance);
  });
});
