<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed } from 'vue';

const props = defineProps<{
  readonly groups: readonly GroupSummary[];
  readonly modelValue: string | undefined;
}>();

const emit = defineEmits<{
  'update:modelValue': [groupId: string];
}>();

const selectedGroup = computed(
  () => props.groups.find((group) => group.id === props.modelValue) ?? props.groups[0],
);

const groupOptions = computed(() =>
  props.groups.map((group) => ({
    label: group.name,
    value: group.id,
  })),
);

function selectGroup(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (props.groups.some((group) => group.id === value)) {
    emit('update:modelValue', value);
  }
}

function roleLabel(role: GroupSummary['role'] | undefined): string {
  if (role === 'owner') {
    return '群主';
  }

  if (role === 'administrator') {
    return '管理员';
  }

  return role === 'guest' ? '访客' : '成员';
}
</script>

<template>
  <label v-if="groups.length > 0" class="group-switcher">
    <span class="group-switcher-copy">
      {{ selectedGroup?.name }} · {{ roleLabel(selectedGroup?.role) }}
    </span>
    <span class="group-switcher-arrow" aria-hidden="true">▾</span>
    <select
      id="group-switcher"
      :value="modelValue ?? ''"
      aria-label="切换排班群组"
      @change="selectGroup"
    >
      <option v-for="option in groupOptions" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.group-switcher {
  position: relative;
  display: flex;
  width: fit-content;
  max-width: 100%;
  min-height: 15px;
  padding-right: 18px;
  align-items: center;
  color: var(--ui-color-text-secondary);
  border-radius: 6px;
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-medium);
  line-height: 15px;
}

.group-switcher-copy {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-switcher-arrow {
  position: absolute;
  right: 3px;
  pointer-events: none;
}

.group-switcher select {
  position: absolute;
  top: 50%;
  right: -13px;
  width: calc(100% + 13px);
  min-width: var(--ui-touch-target-minimum);
  min-height: var(--ui-touch-target-minimum);
  cursor: pointer;
  opacity: 0;
  transform: translateY(-50%);
}

.group-switcher:focus-within {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}
</style>
