import { needsCurrentRuntimeSkyline3172UiCompatibility } from '../../../platform/runtime-ui-compatibility.js';

interface UiWheelColumnItem {
  readonly ariaLabel?: string;
  readonly label: string;
  readonly unit?: string;
}

interface UiWheelReport {
  readonly generation: number;
  readonly index: number;
  readonly offset: number;
  readonly runtimeKey: string;
  readonly sequence: number;
}

interface UiWheelTapEvent {
  readonly currentTarget: { readonly dataset: { readonly index?: number } };
}

interface UiWheelConfig {
  readonly animateCommand: boolean;
  readonly commandRevision: number;
  readonly generation: number;
  readonly itemCount: number;
  readonly runtimeKey: string;
  readonly selectedIndex: number;
}

interface UiWheelColumnInstance {
  _acceptedGeneration?: number;
  _acceptedSequence?: number;
  _localCommandRevision?: number;
  readonly data: {
    readonly internalSelectedIndex: number;
    readonly skyline3172UiCompatibility: boolean;
    readonly wheelConfig: UiWheelConfig;
    readonly wheelLayoutIndex: number;
    readonly wheelLayoutOffset: number;
    readonly wheelTrackOffset: number;
    readonly wheelTrackStyle: string;
  };
  readonly properties: {
    readonly animateCommand: boolean;
    readonly ariaLabel: string;
    readonly commandRevision: number;
    readonly generation: number;
    readonly items: readonly UiWheelColumnItem[];
    readonly runtimeKey: string;
    readonly selectedIndex: number;
    readonly unit: string;
  };
  setData(patch: Readonly<Record<string, unknown>>): void;
  triggerEvent(name: 'previewchange' | 'settle', detail: UiWheelReport): void;
}

const uiWheelItemHeight = 44;

Component({
  properties: {
    animateCommand: { type: Boolean, value: false },
    ariaLabel: { type: String, value: '滚轮选择' },
    commandRevision: { type: Number, value: 0 },
    generation: { type: Number, value: 0 },
    items: { type: Array, value: [] },
    runtimeKey: { type: String, value: 'ui-wheel' },
    selectedIndex: { type: Number, value: 0 },
    unit: { type: String, value: '' },
  },

  data: {
    internalSelectedIndex: 0,
    wheelConfig: {
      animateCommand: false,
      commandRevision: 0,
      generation: 0,
      itemCount: 0,
      runtimeKey: 'ui-wheel',
      selectedIndex: 0,
    } as UiWheelConfig,
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
    wheelLayoutIndex: 0,
    wheelLayoutOffset: 0,
    wheelTrackOffset: 0,
    wheelTrackStyle: '',
  },

  observers: {
    'items,selectedIndex,runtimeKey,generation,commandRevision,animateCommand'(
      this: UiWheelColumnInstance,
    ): void {
      syncWheelConfig(this);
    },
  },

  lifetimes: {
    attached(this: UiWheelColumnInstance): void {
      syncWheelConfig(this);
    },
  },

  methods: {
    handleItemTap(this: UiWheelColumnInstance, event: UiWheelTapEvent): void {
      const index = boundedIndex(event.currentTarget.dataset.index, this.properties.items.length);
      if (index === undefined) return;
      const nextRevision =
        Math.max(
          normalizedInteger(this.properties.commandRevision),
          normalizedInteger(this._localCommandRevision),
          normalizedInteger(this.data.wheelConfig.commandRevision),
        ) + 1;
      this._localCommandRevision = nextRevision;
      this.setData({
        internalSelectedIndex: index,
        wheelConfig: createWheelConfig(this, {
          animateCommand: true,
          commandRevision: nextRevision,
          selectedIndex: index,
        }),
      });
    },

    handleWheelPreview(this: UiWheelColumnInstance, detail: UiWheelReport): void {
      acceptWheelReport(this, 'previewchange', detail);
    },

    handleWheelSettled(this: UiWheelColumnInstance, detail: UiWheelReport): void {
      acceptWheelReport(this, 'settle', detail);
    },
  },
});

function syncWheelConfig(instance: UiWheelColumnInstance): void {
  const nextConfig = createWheelConfig(instance);
  const previousConfig = instance.data.wheelConfig;
  const shouldReposition =
    previousConfig.runtimeKey !== nextConfig.runtimeKey ||
    previousConfig.generation !== nextConfig.generation;
  if (instance._acceptedGeneration !== nextConfig.generation) {
    instance._acceptedGeneration = nextConfig.generation;
    instance._acceptedSequence = 0;
  }
  instance._localCommandRevision = Math.max(
    normalizedInteger(instance._localCommandRevision),
    nextConfig.commandRevision,
  );
  const patch: Record<string, unknown> = {
    internalSelectedIndex: nextConfig.selectedIndex,
    wheelConfig: nextConfig,
  };
  // The template carries the wheel's base position and the gesture only paints its
  // delta, so a re-render can never clobber the WXS-owned transform.
  if (shouldReposition) {
    patch.wheelLayoutIndex = nextConfig.selectedIndex;
    patch.wheelLayoutOffset = -nextConfig.selectedIndex * uiWheelItemHeight;
    patch.wheelTrackOffset = 0;
    patch.wheelTrackStyle = createWheelTrackStyle(
      -nextConfig.selectedIndex * uiWheelItemHeight,
      -nextConfig.selectedIndex * uiWheelItemHeight,
      instance.data.skyline3172UiCompatibility,
    );
  }
  instance.setData(patch);
}

function createWheelConfig(
  instance: UiWheelColumnInstance,
  override: Partial<UiWheelConfig> = {},
): UiWheelConfig {
  const itemCount = instance.properties.items.length;
  const selectedIndex =
    override.selectedIndex ?? boundedIndex(instance.properties.selectedIndex, itemCount) ?? 0;
  return {
    animateCommand: override.animateCommand ?? instance.properties.animateCommand,
    commandRevision:
      override.commandRevision ??
      Math.max(
        normalizedInteger(instance.properties.commandRevision),
        normalizedInteger(instance._localCommandRevision),
      ),
    generation: normalizedInteger(instance.properties.generation),
    itemCount,
    runtimeKey: instance.properties.runtimeKey || 'ui-wheel',
    selectedIndex,
  };
}

function acceptWheelReport(
  instance: UiWheelColumnInstance,
  eventName: 'previewchange' | 'settle',
  detail: UiWheelReport,
): void {
  const index = boundedIndex(detail.index, instance.properties.items.length);
  const generation = normalizedInteger(detail.generation);
  const sequence = normalizedInteger(detail.sequence);
  if (
    index === undefined ||
    detail.runtimeKey !== instance.properties.runtimeKey ||
    generation !== normalizedInteger(instance.properties.generation)
  ) {
    return;
  }
  if (instance._acceptedGeneration !== generation) {
    instance._acceptedGeneration = generation;
    instance._acceptedSequence = 0;
  }
  if (sequence <= normalizedInteger(instance._acceptedSequence)) return;
  instance._acceptedSequence = sequence;
  const normalizedDetail = {
    generation,
    index,
    offset: Number.isFinite(detail.offset) ? detail.offset : -index * uiWheelItemHeight,
    runtimeKey: detail.runtimeKey,
    sequence,
  } as const;
  // The affected runtime drops every WXS style write, so the pixel motion has to
  // travel through data there; 3.17.3 keeps the WXS-owned transform.
  instance.setData({
    internalSelectedIndex: index,
    ...createWheelTrackStylePatch(instance, normalizedDetail.offset),
  });
  instance.triggerEvent(eventName, normalizedDetail);
}

function createWheelTrackStylePatch(
  instance: UiWheelColumnInstance,
  absoluteOffset: number,
): { wheelTrackOffset: number; wheelTrackStyle: string } {
  const baseIndex = normalizedInteger(instance.data.wheelLayoutIndex);
  const layoutOffset = -baseIndex * uiWheelItemHeight;
  const delta = absoluteOffset + baseIndex * uiWheelItemHeight;
  return {
    wheelTrackOffset: delta,
    wheelTrackStyle: createWheelTrackStyle(
      absoluteOffset,
      layoutOffset,
      instance.data.skyline3172UiCompatibility,
    ),
  };
}

// 3.17.3 keeps its original split untouched: the template owns the base through
// `margin-top` and the gesture paints only the delta. 3.17.2 drops the gesture's
// style writes and ignores an inline `margin-top`, so only there the transform
// has to carry the whole absolute offset.
function createWheelTrackStyle(
  absoluteOffset: number,
  layoutOffset: number,
  skyline3172UiCompatibility: boolean,
): string {
  return skyline3172UiCompatibility
    ? `transform:translateY(${absoluteOffset}px)`
    : `margin-top:${layoutOffset}px`;
}

function boundedIndex(value: unknown, itemCount: number): number | undefined {
  const index = Number(value);
  if (!Number.isInteger(index) || itemCount <= 0) return undefined;
  return Math.min(itemCount - 1, Math.max(0, index));
}

function normalizedInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}
