<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    readonly disabled?: boolean;
    readonly label: string;
    readonly modelValue: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function toggle(): void {
  if (!props.disabled) emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    class="switch-hit-area"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="compact-switch" :class="{ active: modelValue }" aria-hidden="true">
      <span />
    </span>
  </button>
</template>

<style scoped>
.switch-hit-area {
  display: grid;
  min-width: 60px;
  min-height: 44px;
  padding: 0 4px;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}

.compact-switch {
  position: relative;
  display: block;
  width: 52px;
  height: 30px;
  background: #c8ced6;
  border-radius: var(--ui-radius-pill);
  transition: background 180ms ease;
}

.compact-switch > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  background: var(--ui-color-white);
  border-radius: 50%;
  box-shadow: 0 2px 5px rgb(22 32 42 / 24%);
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.compact-switch.active {
  background: var(--ui-color-primary);
}

.compact-switch.active > span {
  transform: translateX(22px);
}

.switch-hit-area:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.switch-hit-area:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .compact-switch,
  .compact-switch > span {
    transition: none;
  }
}
</style>
