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

  return role === 'administrator' ? '管理员' : '成员';
}
</script>

<template>
  <section v-if="groups.length > 0" class="group-switcher" aria-label="当前群组">
    <label for="group-switcher">当前群组</label>
    <t-select
      id="group-switcher"
      :value="modelValue ?? ''"
      :options="groupOptions"
      @change="selectGroup"
    />
  </section>
</template>
