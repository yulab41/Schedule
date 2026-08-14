<script setup lang="ts">
import type { ShiftType } from '@schedule/contracts';

defineProps<{
  readonly activeShiftTypeId: string | undefined;
  readonly shiftTypes: readonly ShiftType[];
}>();

const emit = defineEmits<{
  select: [shiftTypeId: string];
}>();
</script>

<template>
  <section class="shift-palette" aria-label="班种按钮">
    <h3>选择班种</h3>
    <p v-if="shiftTypes.length === 0" class="palette-empty">
      当前岗位没有可用的启用班种，请先在排班配置中启用。
    </p>
    <div v-else class="palette-buttons">
      <button
        v-for="shiftType in shiftTypes"
        :key="shiftType.id"
        type="button"
        :class="{ 'is-active': activeShiftTypeId === shiftType.id }"
        :aria-pressed="activeShiftTypeId === shiftType.id"
        :style="{ backgroundColor: shiftType.color, color: shiftType.textColor }"
        @click="emit('select', shiftType.id)"
      >
        {{ shiftType.name }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.shift-palette {
  display: grid;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.shift-palette h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.palette-empty {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.palette-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}

.palette-buttons button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-weight: var(--ui-font-weight-semibold);
  transition:
    filter var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
}

.palette-buttons button:hover {
  filter: brightness(1.04);
}

.palette-buttons button:active {
  transform: scale(0.97);
}

.palette-buttons button.is-active {
  outline: 3px solid var(--ui-color-primary);
  outline-offset: 2px;
  box-shadow: var(--ui-shadow-focus);
}

.palette-buttons button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.palette-name {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.9;
}

@media (max-width: 640px) {
  .shift-palette {
    padding: var(--ui-spacing-sm);
  }

  .palette-buttons button {
    flex: 1 1 auto;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .palette-buttons button {
    transition: none;
  }
}
</style>
