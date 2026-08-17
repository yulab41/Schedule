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
const isPresetColor = computed(() =>
  palette.some((color) => color.toLowerCase() === props.modelValue.toLowerCase()),
);

watch(
  () => props.modelValue,
  (value) => {
    if (!palette.some((color) => color.toLowerCase() === value.toLowerCase())) {
      customColor.value = value;
      customHex.value = value.toUpperCase();
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
    customColor.value = startingColor;
    customHex.value = startingColor.toUpperCase();
  }
}

function applyNativeColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value.toUpperCase();
  customColor.value = value;
  customHex.value = value;
  customColorError.value = false;
  emit('update:modelValue', value);
}

function applyCustomColor(closeAfterApply = false): void {
  const value = normalizeHex(customHex.value);
  customColorError.value = value === undefined;
  if (value === undefined) return;
  customColor.value = value;
  customHex.value = value;
  emit('update:modelValue', value);
  if (closeAfterApply) customOpen.value = false;
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
        <label class="color-picker-field">
          <span>调色板</span>
          <input
            :value="customColor"
            type="color"
            aria-label="选择自定义颜色"
            @input="applyNativeColor"
          />
        </label>
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
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  color: var(--ui-color-primary);
  background: var(--ui-color-white);
  border: 1px solid #b6c8dc;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(22 32 42 / 18%);
  content: '+';
  font-size: 12px;
  font-weight: 800;
}

.custom-color-trigger.selected::after {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
  content: '✓';
  font-size: 9px;
}

.custom-color-panel {
  display: grid;
  width: 100%;
  padding: 9px;
  grid-template-columns: minmax(112px, 1fr) minmax(120px, 1fr) auto;
  align-items: end;
  gap: 8px;
  background: rgb(255 255 255 / 90%);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgb(38 73 109 / 9%);
}

.custom-color-panel label {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.custom-color-panel label > span {
  color: var(--ui-color-text-muted);
  font-size: 9px;
  font-weight: 700;
}

.color-picker-field input,
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

.color-picker-field input {
  padding: 3px;
  cursor: pointer;
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
