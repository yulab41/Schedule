import {
  clamp,
  FALLBACK_CUSTOM_COLOR,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  SHIFT_COLOR_PRESETS,
  type HsvColor,
} from './color.js';

interface TouchPoint {
  readonly identifier: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly pageX?: number;
  readonly pageY?: number;
}
interface TouchEvent {
  readonly touches?: readonly TouchPoint[];
  readonly changedTouches?: readonly TouchPoint[];
}
interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
interface ScrollOffset {
  readonly scrollLeft: number;
  readonly scrollTop: number;
}
interface PickerQuery {
  select(selector: string): PickerQuery;
  boundingClientRect(): PickerQuery;
  selectViewport(): PickerQuery;
  scrollOffset(): PickerQuery;
  exec(callback: (results: readonly unknown[]) => void): void;
}
interface Gesture {
  readonly area: 'spectrum' | 'hue';
  readonly identifier: number;
  point: TouchPoint;
  ended: boolean;
  bounds?: Bounds;
  scroll?: ScrollOffset | undefined;
}
interface PickerData {
  readonly value: string;
  readonly disabled: boolean;
  readonly selectedColor: string;
  readonly isPresetColor: boolean;
  readonly customOpen: boolean;
  readonly customColor: string;
  readonly customHex: string;
  readonly customColorError: boolean;
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly spectrumColor: string;
  readonly spectrumCursorStyle: string;
  readonly hueCursorStyle: string;
}
interface PickerInstance {
  readonly data: PickerData;
  _gesture?: Gesture | undefined;
  setData(patch: Partial<PickerData>): void;
  triggerEvent(name: 'change', detail: { value: string }): void;
  createSelectorQuery(): PickerQuery;
}

const fallbackHsv = hexToHsv(FALLBACK_CUSTOM_COLOR) as HsvColor;

Component({
  properties: {
    value: { type: String, value: '#0A66D5' },
    disabled: { type: Boolean, value: false },
    largeText: { type: Boolean, value: false },
  },
  data: {
    palette: SHIFT_COLOR_PRESETS,
    selectedColor: '#0A66D5',
    isPresetColor: true,
    customOpen: false,
    customColor: FALLBACK_CUSTOM_COLOR,
    customHex: FALLBACK_CUSTOM_COLOR,
    customColorError: false,
    ...hsvView(fallbackHsv),
  },
  observers: {
    value(this: PickerInstance, value: string): void {
      const normalized = normalizeHex(value);
      if (normalized === undefined) return;
      const isPresetColor = SHIFT_COLOR_PRESETS.includes(normalized);
      this.setData({ selectedColor: normalized, isPresetColor });
      // A parent echo must not reset a drag's hue at black/white or at the red endpoint.
      if (!isPresetColor && normalized !== this.data.customColor) syncCustom(this, normalized);
    },
    disabled(this: PickerInstance, disabled: boolean): void {
      if (disabled) this._gesture = undefined;
    },
  },
  lifetimes: {
    detached(this: PickerInstance): void {
      this._gesture = undefined;
    },
  },
  pageLifetimes: {
    resize(this: PickerInstance): void {
      this._gesture = undefined;
    },
    hide(this: PickerInstance): void {
      this._gesture = undefined;
    },
  },
  methods: {
    handlePreset(
      this: PickerInstance,
      event: { readonly currentTarget: { readonly dataset: { readonly color?: string } } },
    ): void {
      if (this.data.disabled) return;
      const color = normalizeHex(event.currentTarget.dataset.color ?? '');
      if (color === undefined || !SHIFT_COLOR_PRESETS.includes(color)) return;
      this._gesture = undefined;
      this.setData({ customOpen: false, customColorError: false });
      emitColor(this, color);
    },
    handleCustomToggle(this: PickerInstance): void {
      if (this.data.disabled) return;
      this._gesture = undefined;
      const customOpen = !this.data.customOpen;
      if (customOpen)
        syncCustom(this, this.data.isPresetColor ? this.data.customColor : this.data.selectedColor);
      this.setData({ customOpen, customColorError: false });
    },
    handleHexInput(
      this: PickerInstance,
      event: { readonly detail: { readonly value: string } },
    ): void {
      if (this.data.disabled) return;
      this.setData({ customHex: event.detail.value, customColorError: false });
    },
    handleHexConfirm(this: PickerInstance): void {
      applyHex(this, false);
    },
    handleApply(this: PickerInstance): void {
      applyHex(this, true);
    },
    handleSpectrumStart(this: PickerInstance, event: TouchEvent): void {
      startGesture(this, 'spectrum', event);
    },
    handleHueStart(this: PickerInstance, event: TouchEvent): void {
      startGesture(this, 'hue', event);
    },
    handleTouchMove(this: PickerInstance, event: TouchEvent): void {
      updateGesture(this, event, false);
    },
    handleTouchEnd(this: PickerInstance, event: TouchEvent): void {
      updateGesture(this, event, true);
    },
    handleTouchCancel(this: PickerInstance): void {
      this._gesture = undefined;
    },
  },
});

function syncCustom(instance: PickerInstance, value: string): void {
  const normalized = normalizeHex(value);
  if (normalized === undefined) return;
  const hsv = hexToHsv(normalized);
  if (hsv === undefined) return;
  instance.setData({
    customColor: normalized,
    customHex: normalized,
    customColorError: false,
    ...hsvView(hsv),
  });
}

function emitColor(instance: PickerInstance, value: string): void {
  instance.setData({ selectedColor: value, isPresetColor: SHIFT_COLOR_PRESETS.includes(value) });
  // This is a draft/preview event. Persistence remains owned by the form's Save action.
  instance.triggerEvent('change', { value });
}

function applyHex(instance: PickerInstance, close: boolean): void {
  if (instance.data.disabled || !instance.data.customOpen) return;
  const value = normalizeHex(instance.data.customHex);
  instance.setData({ customColorError: value === undefined });
  if (value === undefined) return;
  instance._gesture = undefined;
  syncCustom(instance, value);
  emitColor(instance, value);
  if (close) instance.setData({ customOpen: false });
}

function hsvView(hsv: HsvColor) {
  const x = clamp(hsv.saturation);
  const y = 1 - clamp(hsv.value);
  const huePosition = clamp(hsv.hue / 360);
  return {
    hue: hsv.hue,
    saturation: x,
    brightness: hsv.value,
    spectrumColor: hsvToHex({ hue: hsv.hue, saturation: 1, value: 1 }),
    // Position the whole indicator within the control, including at all four corners.
    spectrumCursorStyle: `left:calc(${x * 100}% - ${x * 14}px);top:calc(${y * 100}% - ${y * 14}px);`,
    hueCursorStyle: `left:calc(${huePosition * 100}% - ${huePosition * 20}px);`,
  };
}

function startGesture(instance: PickerInstance, area: Gesture['area'], event: TouchEvent): void {
  // An ended tap may still await measurement. The next tap supersedes it; the
  // query callback's object-identity check below rejects the obsolete response.
  if (
    instance.data.disabled ||
    !instance.data.customOpen ||
    (instance._gesture !== undefined && !instance._gesture.ended)
  )
    return;
  const point = event.touches?.[0];
  if (point === undefined) return;
  const gesture: Gesture = { area, identifier: point.identifier, point, ended: false };
  instance._gesture = gesture;
  // Query in this component, once per gesture: rect and client coordinates are logical px.
  // Fresh queries account for scrolling and resized controls without a global listener.
  const query = instance.createSelectorQuery();
  query
    .select(area === 'spectrum' ? '#shift-color-spectrum' : '#shift-color-hue')
    .boundingClientRect();
  query.selectViewport().scrollOffset();
  query.exec((results) => {
    if (instance._gesture !== gesture || instance.data.disabled) return;
    const bounds = results[0] as Bounds | undefined;
    if (
      !bounds ||
      ![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      instance._gesture = undefined;
      return;
    }
    gesture.bounds = bounds;
    gesture.scroll = results[1] as ScrollOffset | undefined;
    commitGesture(instance, gesture);
    if (gesture.ended) instance._gesture = undefined;
  });
}

function updateGesture(instance: PickerInstance, event: TouchEvent, ended: boolean): void {
  const gesture = instance._gesture;
  if (gesture === undefined || instance.data.disabled) return;
  const point = (ended ? event.changedTouches : event.touches)?.find(
    (touch) => touch.identifier === gesture.identifier,
  );
  if (point === undefined) return;
  gesture.point = point;
  gesture.ended = ended;
  if (gesture.bounds !== undefined) {
    commitGesture(instance, gesture);
    if (ended) instance._gesture = undefined;
  }
}

function commitGesture(instance: PickerInstance, gesture: Gesture): void {
  const bounds = gesture.bounds;
  if (bounds === undefined) return;
  const { point, scroll } = gesture;
  const clientX =
    point.clientX ??
    (point.pageX === undefined || scroll === undefined ? NaN : point.pageX - scroll.scrollLeft);
  const clientY =
    point.clientY ??
    (point.pageY === undefined || scroll === undefined ? NaN : point.pageY - scroll.scrollTop);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
  const x = clamp((clientX - bounds.left) / bounds.width);
  const hsv =
    gesture.area === 'hue'
      ? { hue: x * 360, saturation: instance.data.saturation, value: instance.data.brightness }
      : {
          hue: instance.data.hue,
          saturation: x,
          value: 1 - clamp((clientY - bounds.top) / bounds.height),
        };
  const color = hsvToHex(hsv);
  instance.setData({
    customColor: color,
    customHex: color,
    customColorError: false,
    ...hsvView(hsv),
  });
  emitColor(instance, color);
}
