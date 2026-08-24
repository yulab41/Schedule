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
  afterEach(() => vi.unstubAllGlobals());

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
});
