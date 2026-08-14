<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed } from 'vue';
import type { SelectValue } from 'tdesign-vue-next';

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
    label: `${group.name} (${roleLabel(group.role)})`,
    value: group.id,
  })),
);

function selectGroup(value: SelectValue): void {
  if (typeof value === 'string' && props.groups.some((group) => group.id === value)) {
    emit('update:modelValue', value);
  }
}

function roleLabel(role: GroupSummary['role']): string {
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
  <section v-if="groups.length > 0" class="group-switcher" aria-label="当前群组">
    <div class="group-switcher-summary">
      <span>当前群组：</span>
      <strong>{{ selectedGroup?.name }}</strong>
      <span v-if="selectedGroup !== undefined">（{{ roleLabel(selectedGroup.role) }}）</span>
      <span
        v-if="selectedGroup?.groupCode !== undefined"
        data-testid="current-group-code"
        class="group-code-summary"
      >
        当前群组码：{{ selectedGroup.groupCode }}
      </span>
    </div>
    <t-select
      id="group-switcher"
      :value="modelValue ?? ''"
      :options="groupOptions"
      @change="selectGroup"
    />
  </section>
</template>

<style scoped>
.group-switcher {
  display: grid;
  padding: 14px 16px;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  align-items: center;
  gap: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.group-switcher-summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: baseline;
}

.group-switcher-summary > span:first-child {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.group-switcher-summary strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.group-code-summary {
  flex-basis: 100%;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

:deep(.t-input) {
  min-height: var(--ui-touch-target-minimum);
  border-radius: var(--ui-radius-small);
}

@media (max-width: 640px) {
  .group-switcher {
    padding: 12px;
    grid-template-columns: 1fr;
  }
}
</style>
