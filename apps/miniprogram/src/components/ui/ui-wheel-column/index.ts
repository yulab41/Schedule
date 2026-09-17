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
  _compatSnapTimer?: ReturnType<typeof setTimeout>;
  _compatState?: { index: number; sequence: number; top: number };
  _localCommandRevision?: number;
  readonly data: {
    readonly compatNumberStyles: readonly string[];
    readonly compatStyles: readonly string[];
    readonly compatUnitStyles: readonly string[];
    readonly internalSelectedIndex: number;
    readonly skyline3172UiCompatibility: boolean;
    readonly scrollTop: number;
    readonly scrollWithAnimation: boolean;
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
    compatNumberStyles: [] as readonly string[],
    compatStyles: [] as readonly string[],
    compatUnitStyles: [] as readonly string[],
    internalSelectedIndex: 0,
    scrollTop: 0,
    scrollWithAnimation: false,
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
    handleCompatScroll(
      this: UiWheelColumnInstance,
      event?: { detail?: { scrollTop?: number } },
    ): void {
      if (!this.data.skyline3172UiCompatibility) return;
      const top = Number(event?.detail?.scrollTop);
      if (!Number.isFinite(top)) return;
      paintCompatFrame(this, Math.max(0, top));
      scheduleCompatSnap(this);
    },

    handleCompatTouchEnd(this: UiWheelColumnInstance): void {
      if (!this.data.skyline3172UiCompatibility) return;
      scheduleCompatSnap(this);
    },

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
    if (instance.data.skyline3172UiCompatibility) {
      // The compatible wheel scrolls natively, so its base position is a scroll
      // offset rather than a transform; re-seed it whenever the host re-opens.
      clearCompatSnap(instance);
      instance._compatState = {
        index: nextConfig.selectedIndex,
        sequence: 0,
        top: nextConfig.selectedIndex * uiWheelItemHeight,
      };
      // The resting frame is painted from data too: a stylesheet-only unit never
      // reaches this runtime, so it has to be styled on the very first render.
      const seededFrame = compatFrame(nextConfig.itemCount, instance._compatState.top);
      patch.compatStyles = seededFrame.rowStyles;
      patch.compatNumberStyles = seededFrame.numberStyles;
      patch.compatUnitStyles = seededFrame.unitStyles;
      patch.scrollTop = nextConfig.selectedIndex * uiWheelItemHeight;
      patch.scrollWithAnimation = false;
    }
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

function compatSelection(position: number, index: number): number {
  return Math.min(1, Math.max(0, 1 - Math.abs(index - position)));
}

function compatRowStyle(selection: number): string {
  return `opacity:${0.58 + 0.42 * selection};transform:scale(${0.94 + 0.06 * selection})`;
}

function compatNumberStyle(selection: number): string {
  return `transform:scale(${(19 + 5 * selection) / 24})`;
}

function compatUnitStyle(selected: boolean): string {
  // The affected runtime neither applies the `.ui-wheel-unit` stylesheet rule to
  // this node nor resolves `currentColor` there, which leaves the glyph fully
  // transparent. Carrying the same declaration inline paints it again.
  return `color:${selected ? '#16202a' : '#9aa4ae'};font-size:10px;font-weight:500;opacity:0.72`;
}

function compatFrame(
  itemCount: number,
  top: number,
): { numberStyles: string[]; rowStyles: string[]; unitStyles: string[] } {
  const position = top / uiWheelItemHeight;
  const selected = Math.round(position);
  const numberStyles: string[] = [];
  const rowStyles: string[] = [];
  const unitStyles: string[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    const selection = compatSelection(position, index);
    rowStyles.push(compatRowStyle(selection));
    numberStyles.push(compatNumberStyle(selection));
    unitStyles.push(compatUnitStyle(index === selected));
  }
  return { numberStyles, rowStyles, unitStyles };
}

function compatStateOf(instance: UiWheelColumnInstance): {
  index: number;
  sequence: number;
  top: number;
} {
  if (instance._compatState === undefined)
    instance._compatState = { index: -1, sequence: 0, top: 0 };
  return instance._compatState;
}

// The compatible runtime drops the gesture's style writes, so the very same
// interpolation the gesture applies is transported through data instead: one
// frame value per scroll event, nothing version-specific about the maths.
function paintCompatFrame(instance: UiWheelColumnInstance, top: number): void {
  const state = compatStateOf(instance);
  state.top = top;
  const itemCount = instance.properties.items.length;
  const position = top / uiWheelItemHeight;
  const frame = compatFrame(itemCount, top);
  const index = Math.min(itemCount - 1, Math.max(0, Math.round(position)));
  const patch: Record<string, unknown> = {
    compatNumberStyles: frame.numberStyles,
    compatStyles: frame.rowStyles,
    compatUnitStyles: frame.unitStyles,
  };
  if (itemCount > 0 && index !== instance.data.internalSelectedIndex) {
    patch.internalSelectedIndex = index;
  }
  instance.setData(patch);
  if (itemCount <= 0) return;
  if (index === state.index) return;
  state.index = index;
  state.sequence += 1;
  instance.triggerEvent('previewchange', {
    generation: normalizedInteger(instance.properties.generation),
    index,
    offset: -index * uiWheelItemHeight,
    runtimeKey: instance.properties.runtimeKey,
    sequence: state.sequence,
  });
}

function clearCompatSnap(instance: UiWheelColumnInstance): void {
  if (instance._compatSnapTimer !== undefined) {
    clearTimeout(instance._compatSnapTimer);
    instance._compatSnapTimer = undefined;
  }
}

function scheduleCompatSnap(instance: UiWheelColumnInstance): void {
  clearCompatSnap(instance);
  instance._compatSnapTimer = setTimeout(() => {
    instance._compatSnapTimer = undefined;
    snapCompat(instance);
  }, 140);
}

function snapCompat(instance: UiWheelColumnInstance): void {
  const itemCount = instance.properties.items.length;
  if (itemCount <= 0) return;
  const state = compatStateOf(instance);
  const index = Math.min(itemCount - 1, Math.max(0, Math.round(state.top / uiWheelItemHeight)));
  const target = index * uiWheelItemHeight;
  const patch: Record<string, unknown> = { scrollWithAnimation: true };
  if (target !== instance.data.scrollTop) patch.scrollTop = target;
  instance.setData(patch);
  paintCompatFrame(instance, target);
  state.sequence += 1;
  instance.triggerEvent('settle', {
    generation: normalizedInteger(instance.properties.generation),
    index,
    offset: -index * uiWheelItemHeight,
    runtimeKey: instance.properties.runtimeKey,
    sequence: state.sequence,
  });
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
