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
    expect(first.data.yearWheelRuntimeKey).not.toBe(second.data.yearWheelRuntimeKey);
    expect(first.data.monthWheelRuntimeKey).not.toBe(second.data.monthWheelRuntimeKey);

    definition.methods.handleOpen.call(first);
    expect(first.data.open).toBe(true);
    const firstGeneration = first.data.wheelGeneration;
    definition.methods.handleOpen.call(second);

    expect(first.data.open).toBe(false);
    expect(first.data.wheelGeneration).toBeGreaterThan(firstGeneration);
    expect(second.data.open).toBe(true);
    definition.lifetimes.detached.call(first);
    definition.lifetimes.detached.call(second);
  });

  it('opens a selector upward when the Web-sized option list would overflow the viewport', async () => {
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }) });
    const definition = await loadPickerDefinition();
    let resolvePlacement;
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
        resolvePlacement = callback;
      },
      select() {
        return this;
      },
    });

    definition.methods.handleOpen.call(instance);

    expect(instance.data.popoverPlacementReady).toBe(false);
    resolvePlacement([{ bottom: 810, height: 44, left: 16, right: 374, top: 766, width: 358 }]);
    expect(instance.data.popoverPlacement).toBe('up');
    expect(instance.data.popoverPlacementReady).toBe(true);
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
    definition.lifetimes.attached.call(instance);

    definition.methods.handleOpen.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月');
    expect(instance.data.draftIndices).toEqual([5, 7, 0]);
    expect(instance.data.yearWheelItems[5]).toMatchObject({ label: '2026' });
    expect(instance.data.monthWheelItems[7]).toMatchObject({ label: '8' });
    expect(instance.data.yearWheelRuntimeKey).toMatch(/^workflow-picker-\d+-year$/u);
    expect(instance.data.monthWheelRuntimeKey).toMatch(/^workflow-picker-\d+-month$/u);
    const generation = instance.data.wheelGeneration;
    instance.triggerEvent.mockClear();
    definition.methods.handleMonthWheelPreview.call(instance, {
      detail: {
        generation,
        index: 8,
        offset: -8 * 44,
        runtimeKey: instance.data.monthWheelRuntimeKey,
        sequence: 1,
      },
    });
    expect(instance.data.draftDisplayValue).toBe('2026年9月');
    expect(instance.data.draftIndices).toEqual([5, 8, 0]);
    expect(instance.triggerEvent).not.toHaveBeenCalled();

    definition.methods.handleYearWheelPreview.call(instance, {
      detail: {
        generation,
        index: 6,
        offset: -6 * 44,
        runtimeKey: instance.data.yearWheelRuntimeKey,
        sequence: 1,
      },
    });
    expect(instance.data.draftDisplayValue).toBe('2027年9月');
    expect(instance.data.draftIndices).toEqual([6, 8, 0]);

    definition.methods.handleConfirm.call(instance);
    expect(instance.triggerEvent).toHaveBeenCalledWith('change', { value: '2027-09' });
    expect(instance.data.open).toBe(false);
    definition.lifetimes.detached.call(instance);
  });

  it('rejects stale wheel reports and isolates year/month sequences', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);
    const generation = instance.data.wheelGeneration;
    const monthRuntimeKey = instance.data.monthWheelRuntimeKey;
    const yearRuntimeKey = instance.data.yearWheelRuntimeKey;
    const report = (overrides = {}) => ({
      generation,
      index: 9,
      offset: -9 * 44,
      runtimeKey: monthRuntimeKey,
      sequence: 1,
      ...overrides,
    });

    definition.methods.handleMonthWheelPreview.call(instance, { detail: report() });
    expect(instance.data.draftIndices[1]).toBe(9);
    definition.methods.handleMonthWheelPreview.call(instance, {
      detail: report({ index: 8, sequence: 1 }),
    });
    definition.methods.handleMonthWheelPreview.call(instance, {
      detail: report({ generation: generation - 1, index: 8, sequence: 2 }),
    });
    definition.methods.handleMonthWheelPreview.call(instance, {
      detail: report({ index: 8, runtimeKey: 'wrong', sequence: 3 }),
    });
    expect(instance.data.draftIndices[1]).toBe(9);

    definition.methods.handleYearWheelPreview.call(instance, {
      detail: report({ index: 6, runtimeKey: yearRuntimeKey }),
    });
    expect(instance.data.draftIndices).toEqual([6, 9, 0]);
    definition.methods.handleMonthWheelSettled.call(instance, {
      detail: report({ index: 10, sequence: 2 }),
    });
    expect(instance.data.monthWheelSettledIndex).toBe(10);
    expect(instance.data.draftIndices).toEqual([6, 10, 0]);
    definition.lifetimes.detached.call(instance);
  });

  it('invalidates wheel generations on cancel without emitting a value', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);
    const generation = instance.data.wheelGeneration;
    instance.triggerEvent.mockClear();

    definition.methods.handleClose.call(instance);

    expect(instance.data.open).toBe(false);
    expect(instance.data.wheelGeneration).toBeGreaterThan(generation);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T18:00:00.000Z'));
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'date', value: '2026-08-24' });
    definition.lifetimes.attached.call(instance);
    definition.methods.handleOpen.call(instance);
    definition.methods.handleDateSwiperChange.call(instance, { detail: { current: 2 } });

    expect(instance.data.datePanels).toHaveLength(3);
    expect(instance.data.datePanels.map((panel) => panel.key)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(instance.data.draftMonth).toBe(9);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
    definition.methods.handleDateToday.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月24日');
    expect(instance.data.dateLocateAnimating).toBe(true);
    vi.advanceTimersByTime(519);
    expect(instance.data.dateLocateAnimating).toBe(true);
    vi.advanceTimersByTime(1);
    expect(instance.data.dateLocateAnimating).toBe(false);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith('change', expect.anything());
    definition.lifetimes.detached.call(instance);
  });
});
