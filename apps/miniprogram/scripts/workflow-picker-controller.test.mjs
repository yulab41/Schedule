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

  it('uses the Web month wheel draft summary and only emits the completed month', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'month', value: '2026-08' });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月');
    expect(instance.data.draftIndices).toEqual([5, 7, 0]);
    definition.methods.handlePickerViewChange.call(instance, { detail: { value: [5, 8, 0] } });
    expect(instance.data.draftDisplayValue).toBe('2026年9月');
    expect(instance.triggerEvent).not.toHaveBeenCalled();

    definition.methods.handleConfirm.call(instance);
    expect(instance.triggerEvent).toHaveBeenCalledWith('change', { value: '2026-09' });
    expect(instance.data.open).toBe(false);
  });

  it('builds the Web calendar date grid and confirms the selected day', async () => {
    const definition = await loadPickerDefinition();
    const instance = createPickerInstance(definition, { mode: 'date', value: '2026-08-24' });

    definition.methods.handleOpen.call(instance);
    expect(instance.data.draftDisplayValue).toBe('2026年8月24日');
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
