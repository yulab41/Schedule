<script setup lang="ts">
import type { ShiftType } from '@schedule/contracts';

defineProps<{
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
        :style="{ backgroundColor: shiftType.color, color: shiftType.textColor }"
        :title="shiftType.name"
        @click="emit('select', shiftType.id)"
      >
        {{ shiftType.abbreviation }}
        <span class="palette-name">{{ shiftType.name }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.shift-palette {
  display: grid;
  gap: 8px;
}

.shift-palette h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.palette-empty {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.palette-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.palette-buttons button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.palette-buttons button:hover {
  filter: brightness(1.08);
}

.palette-buttons button:focus-visible {
  outline: 2px solid #1f5aa6;
  outline-offset: 2px;
}

.palette-name {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.9;
}
</style>
