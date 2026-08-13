import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface BottomSheetInstance {
  readonly data: Record<string, unknown>;
  readonly properties: { sheetKey: number; visible: boolean };
  readonly setData: (patch: Record<string, unknown>) => void;
  readonly triggerEvent: ReturnType<typeof vi.fn>;
  clearTransitionTimer(): void;
  handlePanelTouchMove(event: unknown): void;
  handlePanelTouchStart(event: unknown): void;
  syncVisibility(): void;
}

type BottomSheetMethod = (this: BottomSheetInstance, ...arguments_: unknown[]) => unknown;

interface BottomSheetDefinition {
  readonly data: Record<string, unknown>;
  readonly detached: (this: BottomSheetInstance) => void;
  readonly methods: Readonly<Record<string, BottomSheetMethod>>;
}

function makeInstance(definition: BottomSheetDefinition, sheetKey: number): BottomSheetInstance {
  const instance = {
    data: { ...definition.data },
    properties: { sheetKey, visible: false },
    setData(this: BottomSheetInstance, patch: Record<string, unknown>): void {
      Object.assign(this.data, patch);
    },
    triggerEvent: vi.fn(),
  } as unknown as BottomSheetInstance & Record<string, unknown>;
  for (const [name, method] of Object.entries(definition.methods)) {
    instance[name] = method.bind(instance);
  }
  return instance;
}

describe('bottom sheet instance isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not let one sheet cancel another sheet transition timer', async () => {
    let definition: BottomSheetDefinition | undefined;
    vi.stubGlobal('Component', (value: unknown) => {
      definition = value as BottomSheetDefinition;
    });
    await import('./index.js');
    expect(definition).toBeDefined();

    const first = makeInstance(definition!, 1);
    const second = makeInstance(definition!, 2);
    first.properties.visible = true;
    second.properties.visible = true;
    first.syncVisibility();
    second.syncVisibility();

    definition!.detached.call(first);
    vi.runAllTimers();

    expect(first.data.phase).toBe('opening');
    expect(second.data.phase).toBe('open');
  });

  it('resets an interrupted drag when the parent hides and reopens the sheet', async () => {
    let definition: BottomSheetDefinition | undefined;
    vi.stubGlobal('Component', (value: unknown) => {
      definition = value as BottomSheetDefinition;
    });
    await import('./index.js');
    const sheet = makeInstance(definition!, 1);
    sheet.properties.visible = true;
    sheet.syncVisibility();
    vi.runAllTimers();
    sheet.handlePanelTouchStart({
      changedTouches: [],
      touches: [{ clientX: 0, clientY: 0 }],
    });
    sheet.handlePanelTouchMove({
      changedTouches: [],
      touches: [{ clientX: 0, clientY: 40 }],
    });
    expect(sheet.data.phase).toBe('dragging');

    sheet.properties.visible = false;
    sheet.syncVisibility();
    expect(sheet.data.phase).toBe('closed');
    sheet.properties.visible = true;
    sheet.syncVisibility();
    vi.runAllTimers();
    expect(sheet.data.phase).toBe('open');
  });
});
