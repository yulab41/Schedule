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

  it('uses the clipping scroll boundary instead of spare window space', async () => {
    const { definition, instance } = await createSelector();
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }) });
    instance.properties.placementBoundary = { bottom: 520, top: 200 };
    const query = {
      select: () => query,
      boundingClientRect: () => query,
      exec: (callback) => callback([{ top: 470, bottom: 514 }]),
    };
    instance.createSelectorQuery = () => query;

    definition.methods.handleOpen.call(instance);

    expect(instance.data.popoverPlacement).toBe('up');
    expect(instance.data.popoverMaxHeight).toBe(262);
    expect(instance.data.popoverPlacementReady).toBe(true);
    definition.lifetimes.detached.call(instance);
  });

  it('bounds the popover on the larger side and falls back from an invalid boundary', async () => {
    const { resolveSelectorPlacement } =
      await import('../src/components/ui/ui-selector/selector.ts');

    expect(
      resolveSelectorPlacement({ bottom: 144, top: 100 }, 100, 844, {
        bottom: 700,
        top: 0,
      }),
    ).toEqual({ maxHeight: 300, placement: 'down' });
    expect(
      resolveSelectorPlacement({ bottom: 244, top: 200 }, 100, 844, {
        bottom: 270,
        top: 180,
      }),
    ).toEqual({ maxHeight: 18, placement: 'down' });
    expect(
      resolveSelectorPlacement({ bottom: 834, top: 790 }, 100, 844, {
        bottom: 100,
        top: 600,
      }),
    ).toEqual({ maxHeight: 300, placement: 'up' });
  });

  it('ignores a placement result that arrives after the selector closes', async () => {
    const { definition, instance } = await createSelector();
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }) });
    let resolvePlacement;
    const query = {
      select: () => query,
      boundingClientRect: () => query,
      exec: (callback) => {
        resolvePlacement = callback;
      },
    };
    instance.createSelectorQuery = () => query;

    definition.methods.handleOpen.call(instance);
    definition.methods.handleClose.call(instance);
    resolvePlacement([{ top: 790, bottom: 834 }]);

    expect(instance.data.open).toBe(false);
    expect(instance.data.popoverPlacementReady).toBe(false);
    definition.lifetimes.detached.call(instance);
  });
});
