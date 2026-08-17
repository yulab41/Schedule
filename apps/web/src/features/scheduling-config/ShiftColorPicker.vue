<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const palette = ['#0A66D5', '#287D70', '#4C5BD4', '#9A6A13', '#C33D56'] as const;
const fallbackCustomColor = '#7A4FD6';

const props = defineProps<{
  readonly modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const customOpen = ref(false);
const customColor = ref(fallbackCustomColor);
const customHex = ref(fallbackCustomColor);
const customColorError = ref(false);
const customHue = ref(260);
const customSaturation = ref(63);
const customValue = ref(84);
const spectrumPointerId = ref<number>();
const isPresetColor = computed(() =>
  palette.some((color) => color.toLowerCase() === props.modelValue.toLowerCase()),
);
const spectrumStyle = computed(() => ({
  '--picker-hue': String(customHue.value),
  '--picker-x': `${customSaturation.value}%`,
  '--picker-y': `${100 - customValue.value}%`,
}));

watch(
  () => props.modelValue,
  (value) => {
    if (!palette.some((color) => color.toLowerCase() === value.toLowerCase())) {
      syncCustomColor(value);
    }
  },
  { immediate: true },
);

function normalizeHex(value: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/iu.exec(value.trim());
  return match?.[1] === undefined ? undefined : `#${match[1].toUpperCase()}`;
}

function selectPreset(color: string): void {
  customOpen.value = false;
  customColorError.value = false;
  emit('update:modelValue', color);
}

function toggleCustom(): void {
  customOpen.value = !customOpen.value;
  customColorError.value = false;
  if (customOpen.value) {
    const startingColor = isPresetColor.value ? customColor.value : props.modelValue;
    syncCustomColor(startingColor);
  }
}

function syncCustomColor(value: string): void {
  const normalized = normalizeHex(value) ?? fallbackCustomColor;
  const hsv = hexToHsv(normalized);
  customColor.value = normalized;
  customHex.value = normalized;
  customHue.value = hsv.hue;
  customSaturation.value = hsv.saturation;
  customValue.value = hsv.value;
}

function commitHsvColor(): void {
  const value = hsvToHex(customHue.value, customSaturation.value, customValue.value);
  customColor.value = value;
  customHex.value = value;
  customColorError.value = false;
  emit('update:modelValue', value);
}

function onSpectrumPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return;
  spectrumPointerId.value = event.pointerId;
  const spectrum = event.currentTarget as HTMLElement;
  spectrum.setPointerCapture(event.pointerId);
  updateSpectrum(event, spectrum);
}

function onSpectrumPointerMove(event: PointerEvent): void {
  if (spectrumPointerId.value !== event.pointerId) return;
  updateSpectrum(event, event.currentTarget as HTMLElement);
}

function onSpectrumPointerEnd(event: PointerEvent): void {
  if (spectrumPointerId.value !== event.pointerId) return;
  spectrumPointerId.value = undefined;
  const spectrum = event.currentTarget as HTMLElement;
  if (spectrum.hasPointerCapture(event.pointerId)) spectrum.releasePointerCapture(event.pointerId);
}

function updateSpectrum(event: PointerEvent, spectrum: HTMLElement): void {
  event.preventDefault();
  const bounds = spectrum.getBoundingClientRect();
  customSaturation.value = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
  customValue.value = 100 - clamp(((event.clientY - bounds.top) / bounds.height) * 100);
  commitHsvColor();
}

function applyHue(event: Event): void {
  customHue.value = Number((event.target as HTMLInputElement).value);
  commitHsvColor();
}

function adjustSpectrum(event: KeyboardEvent): void {
  const step = event.shiftKey ? 10 : 2;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    customSaturation.value = clamp(
      customSaturation.value + (event.key === 'ArrowRight' ? step : -step),
    );
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    customValue.value = clamp(customValue.value + (event.key === 'ArrowUp' ? step : -step));
  } else {
    return;
  }
  commitHsvColor();
}

function applyCustomColor(closeAfterApply = false): void {
  const value = normalizeHex(customHex.value);
  customColorError.value = value === undefined;
  if (value === undefined) return;
  syncCustomColor(value);
  emit('update:modelValue', value);
  if (closeAfterApply) customOpen.value = false;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function hexToHsv(hex: string): { hue: number; saturation: number; value: number } {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return {
    hue: Math.round(hue),
    saturation: maximum === 0 ? 0 : Math.round((delta / maximum) * 100),
    value: Math.round(maximum * 100),
  };
}

function hsvToHex(hue: number, saturation: number, value: number): string {
  const chroma = (value / 100) * (saturation / 100);
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = value / 100 - chroma;
  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}
</script>

<template>
  <fieldset class="color-control">
    <legend>颜色</legend>
    <button
      v-for="color in palette"
      :key="color"
      type="button"
      class="color-swatch"
      :class="{ selected: modelValue.toLowerCase() === color.toLowerCase() }"
      :style="{ '--swatch': color }"
      :aria-label="`选择颜色 ${color}`"
      :aria-pressed="modelValue.toLowerCase() === color.toLowerCase()"
      @click="selectPreset(color)"
    />
    <button
      type="button"
      class="custom-color-trigger color-swatch"
      :class="{ selected: !isPresetColor }"
      :style="{ '--swatch': customColor }"
      aria-label="自定义颜色"
      :aria-expanded="customOpen"
      :aria-pressed="!isPresetColor"
      @click="toggleCustom"
    />
    <Transition name="color-popover">
      <div v-if="customOpen" class="custom-color-panel" aria-label="自定义颜色调色板">
        <div class="color-picker-field">
          <span>调色板</span>
          <button
            type="button"
            class="color-spectrum"
            :style="spectrumStyle"
            aria-label="选择自定义颜色的饱和度和明度"
            @keydown="adjustSpectrum"
            @pointercancel="onSpectrumPointerEnd"
            @pointerdown="onSpectrumPointerDown"
            @pointermove="onSpectrumPointerMove"
            @pointerup="onSpectrumPointerEnd"
          >
            <span class="spectrum-cursor" aria-hidden="true" />
          </button>
          <input
            :value="customHue"
            class="hue-slider"
            type="range"
            min="0"
            max="359"
            aria-label="色相"
            @input="applyHue"
          />
        </div>
        <label class="hex-color-field">
          <span>HEX</span>
          <input
            v-model="customHex"
            maxlength="7"
            spellcheck="false"
            aria-label="自定义颜色 HEX"
            :aria-invalid="customColorError"
            @blur="applyCustomColor()"
            @keyup.enter.prevent="applyCustomColor()"
          />
        </label>
        <button class="apply-custom-color" type="button" @click="applyCustomColor(true)">
          应用
        </button>
        <small v-if="customColorError">请输入 #RRGGBB</small>
      </div>
    </Transition>
  </fieldset>
</template>

<style scoped>
.color-control {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  border: 0;
}

.color-control legend {
  width: 100%;
  margin-bottom: 2px;
  color: var(--ui-color-text-muted);
  font-size: 10px;
  font-weight: var(--ui-font-weight-semibold);
}

.color-swatch {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.color-swatch::before {
  position: absolute;
  inset: 6px;
  background: var(--swatch);
  border: 3px solid var(--ui-color-white);
  border-radius: 50%;
  box-shadow: 0 0 0 1px #aab7c6;
  content: '';
}

.color-swatch.selected::before {
  box-shadow: 0 0 0 3px var(--ui-color-primary);
}

.custom-color-trigger::after {
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 16px;
  height: 16px;
  background:
    linear-gradient(var(--ui-color-primary), var(--ui-color-primary)) center / 8px 2px no-repeat,
    linear-gradient(var(--ui-color-primary), var(--ui-color-primary)) center / 2px 8px no-repeat,
    var(--ui-color-white);
  border: 1px solid #b6c8dc;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(22 32 42 / 18%);
  content: '';
}

.custom-color-trigger.selected::after {
  background:
    linear-gradient(var(--ui-color-white), var(--ui-color-white)) center / 8px 2px no-repeat,
    linear-gradient(var(--ui-color-white), var(--ui-color-white)) center / 2px 8px no-repeat,
    var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.custom-color-panel {
  display: grid;
  width: 100%;
  padding: 9px;
  grid-template-columns: minmax(112px, 1fr) auto;
  align-items: end;
  gap: 8px;
  background: rgb(255 255 255 / 90%);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgb(38 73 109 / 9%);
}

.custom-color-panel label,
.color-picker-field {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.custom-color-panel label > span,
.color-picker-field > span {
  color: var(--ui-color-text-muted);
  font-size: 9px;
  font-weight: 700;
}

.hex-color-field input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 4px 8px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-white);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.color-picker-field {
  grid-column: 1 / -1;
}

.color-spectrum {
  position: relative;
  width: 100%;
  height: 92px;
  padding: 0;
  overflow: hidden;
  touch-action: none;
  background:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, hsl(var(--picker-hue) 100% 50%));
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 9px;
  cursor: crosshair;
}

.spectrum-cursor {
  position: absolute;
  top: var(--picker-y);
  left: var(--picker-x);
  width: 14px;
  height: 14px;
  background: transparent;
  border: 2px solid var(--ui-color-white);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(22 32 42 / 55%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hue-slider {
  width: 100%;
  height: 18px;
  margin: 1px 0 0;
  appearance: none;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.hue-slider::-webkit-slider-thumb {
  width: 20px;
  height: 20px;
  appearance: none;
  background: var(--ui-color-white);
  border: 2px solid var(--ui-color-text-primary);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(22 32 42 / 24%);
}

.hue-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--ui-color-white);
  border: 2px solid var(--ui-color-text-primary);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(22 32 42 / 24%);
}

.apply-custom-color {
  min-width: 62px;
  min-height: 42px;
  padding: 0 12px;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.custom-color-panel > small {
  grid-column: 1 / -1;
  color: var(--ui-color-danger);
  font-size: 9px;
}

.color-popover-enter-active,
.color-popover-leave-active {
  transition:
    opacity 160ms ease,
    translate 160ms ease;
}

.color-popover-enter-from,
.color-popover-leave-to {
  opacity: 0;
  translate: 0 -4px;
}

@media (max-width: 640px) {
  .custom-color-panel {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .apply-custom-color {
    min-height: 44px;
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .color-popover-enter-active,
  .color-popover-leave-active {
    transition: none;
  }
}
</style>
