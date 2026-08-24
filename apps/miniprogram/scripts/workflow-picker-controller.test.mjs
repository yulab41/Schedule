import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadPickerDefinition() {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/subpackages/workflows/components/workflow-picker/index.ts');
  return definition;
}

function createPickerInstance(definition, properties) {
  const instance = {
    data: structuredClone(definition.data),
    properties: {
      disabled: false,
      mode: 'selector',
      options: [],
      selectedIndex: -1,
      value: '',
      ...properties,
    },
    setData(patch, callback) {
      Object.assign(this.data, patch);
      callback?.();
    },
    triggerEvent: vi.fn(),
  };
  return instance;
}

describe('P7 Web-parity workflow picker controller', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies a Web-style selector option immediately and closes the dropdown', async () => {
    const definition = await loadPickerDefinition();
    const options = [
      { label: '进修', value: 'training' },
      { label: '病假', value: 'sick' },
    ];
    const instance = createPickerInstance(definition, {
      mode: 'selector',
      options,
      selectedIndex: 1,
      value: '1',
    });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.open).toBe(true);
    expect(instance.data.draftDisplayValue).toBe('病假');
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'pickerrequestopen',
      {},
      { bubbles: true, composed: true },
    );
    instance.triggerEvent.mockClear();
    definition.methods.handleOptionTap.call(instance, { currentTarget: { dataset: { index: 0 } } });
    expect(instance.data.draftDisplayValue).toBe('进修');
    expect(instance.triggerEvent).toHaveBeenCalledOnce();
    expect(instance.triggerEvent).toHaveBeenCalledWith('change', {
      index: 0,
      option: options[0],
      value: '0',
    });
    expect(instance.data.open).toBe(false);
  });

  it('exposes a parent close method without emitting a value change', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, {
      mode: 'selector',
      options: [{ label: '病假', value: 'sick' }],
      selectedIndex: 0,
    });
    instance.data.open = true;

    definition.methods.closeFromParent.call(instance);

    expect(instance.data.open).toBe(false);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
  });

  it('closes the previously open member or assignment picker before opening another', async () => {
    const definition = await loadPickerDefinition();
    const options = [{ label: '冯钦', value: 'member-1' }];
    const first = createPickerInstance(definition, { mode: 'selector', options });
    const second = createPickerInstance(definition, { mode: 'selector', options });
    definition.lifetimes.attached.call(first);
    definition.lifetimes.attached.call(second);

    definition.methods.handleOpen.call(first);
    expect(first.data.open).toBe(true);
    definition.methods.handleOpen.call(second);

    expect(first.data.open).toBe(false);
    expect(second.data.open).toBe(true);
    definition.lifetimes.detached.call(first);
    definition.lifetimes.detached.call(second);
  });

  it('opens a selector upward when the Web-sized option list would overflow the viewport', async () => {
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }) });
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, {
      mode: 'selector',
      options: Array.from({ length: 6 }, (_, index) => ({
        label: `成员${index + 1}`,
        value: String(index + 1),
      })),
    });
    instance.createSelectorQuery = () => ({
      boundingClientRect() {
        return this;
      },
      exec(callback) {
        callback([{ bottom: 810, height: 44, left: 16, right: 374, top: 766, width: 358 }]);
      },
      select() {
        return this;
      },
    });

    definition.methods.handleOpen.call(instance);

    expect(instance.data.popoverPlacement).toBe('up');
    definition.lifetimes.detached.call(instance);
  });

  it('keeps only the weekend token red before and after an option is selected', async () => {
    const definition = await loadPickerDefinition();
    const options = [
      {
        isWeekend: true,
        label: '2026-09-27 全天班（周日） · 徐漫彬',
        value: 'assignment-weekend',
      },
    ];
    const instance = createPickerInstance(definition, {
      mode: 'selector',
      options,
      selectedIndex: 0,
      value: '0',
    });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.renderedOptions).toEqual([
      {
        ...options[0],
        leadingLabel: '2026-09-27 全天班',
        trailingLabel: ' · 徐漫彬',
        weekendLabel: '（周日）',
      },
    ]);
    expect(instance.data.selectedOptionIndex).toBe(0);
  });

  it('uses the Web month wheel draft summary and only emits the completed month', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月');
    expect(instance.data.draftIndices).toEqual([5, 7, 0]);
    expect(instance.data.yearWheelTop).toBe(5 * 44);
    expect(instance.data.monthWheelTop).toBe(7 * 44);
    instance.triggerEvent.mockClear();
    definition.methods.handleMonthWheelScroll.call(instance, { detail: { scrollTop: 8 * 44 } });
    expect(instance.data.draftDisplayValue).toBe('2026年9月');
    expect(instance.data.draftIndices).toEqual([5, 8, 0]);
    expect(instance.triggerEvent).not.toHaveBeenCalled();

    definition.methods.handleYearWheelScroll.call(instance, { detail: { scrollTop: 6 * 44 } });
    expect(instance.data.draftDisplayValue).toBe('2027年9月');
    expect(instance.data.draftIndices).toEqual([6, 8, 0]);

    definition.methods.handleConfirm.call(instance);
    expect(instance.triggerEvent).toHaveBeenCalledWith('change', { value: '2027-09' });
    expect(instance.data.open).toBe(false);
  });

  it('keeps inertia running, then snaps an idle wheel to the nearest 44px row', async () => {
    vi.useFakeTimers();
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);

    definition.methods.handleMonthWheelScroll.call(instance, {
      detail: { scrollTop: 8 * 44 + 17 },
    });
    expect(instance._monthWheelLatestTop).toBe(8 * 44 + 17);
    expect(instance.data.monthWheelTop).toBe(7 * 44);
    expect(instance.data.draftIndices[1]).toBe(8);
    vi.advanceTimersByTime(99);
    expect(instance.data.monthWheelTop).toBe(7 * 44);
    vi.advanceTimersByTime(1);
    expect(instance.data.monthWheelTop).toBe(8 * 44);
    expect(instance.data.wheelSnapAnimating).toBe(true);
    vi.advanceTimersByTime(240);
    expect(instance.data.wheelSnapAnimating).toBe(false);
    definition.lifetimes.detached.call(instance);
  });

  it('interpolates wheel typography while the scroll position crosses the selection rail', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);
    definition.methods.handleMonthWheelScroll.call(instance, {
      detail: { scrollTop: 7 * 44 + 11 },
    });

    const current = instance.data.monthWheelItems[7];
    expect(current.fontSize).toBeGreaterThan(19);
    expect(current.fontSize).toBeLessThan(24);
    expect(current.opacity).toBeGreaterThan(0.58);
    expect(current.opacity).toBeLessThan(1);
    definition.lifetimes.detached.call(instance);
  });

  it('never starts the idle snap while the user is still holding the wheel', async () => {
    vi.useFakeTimers();
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);
    definition.methods.handleMonthWheelTouchStart.call(instance);
    definition.methods.handleMonthWheelScroll.call(instance, {
      detail: { scrollTop: 9 * 44 + 8 },
    });

    vi.advanceTimersByTime(250);
    expect(instance.data.monthWheelTop).toBe(7 * 44);
    expect(instance.data.wheelSnapAnimating).toBe(false);
    definition.methods.handleMonthWheelTouchEnd.call(instance);
    vi.advanceTimersByTime(100);
    expect(instance.data.monthWheelTop).toBe(9 * 44);
    expect(instance.data.wheelSnapAnimating).toBe(true);
    definition.lifetimes.detached.call(instance);
  });

  it('builds the Web calendar date grid and confirms the selected day', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'date', value: '2026-08-24' });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月24日');
    instance.triggerEvent.mockClear();
    expect(instance.data.dateCells).toHaveLength(42);
    expect(instance.data.dateCells.find((cell) => cell.value === '2026-08-24')).toMatchObject({
      isSelected: true,
      muted: false,
    });
    definition.methods.handleDateSelect.call(instance, {
      currentTarget: { dataset: { value: '2026-08-25' } },
    });
    expect(instance.data.draftDisplayValue).toBe('2026年8月25日');
    expect(instance.triggerEvent).not.toHaveBeenCalled();

    definition.methods.handleConfirm.call(instance);
    expect(instance.triggerEvent).toHaveBeenCalledWith('change', { value: '2026-08-25' });
    expect(instance.data.open).toBe(false);
  });

  it('supports horizontal date month paging and a today locator without emitting early', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'date', value: '2026-08-24' });
    definition.methods.handleOpen.call(instance);
    definition.methods.handleDateSwiperChange.call(instance, { detail: { current: 2 } });

    expect(instance.data.datePanels).toHaveLength(3);
    expect(instance.data.draftMonth).toBe(9);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
    definition.methods.handleDateToday.call(instance);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
  });
});
