<script setup lang="ts">
interface FilterOption {
  readonly label: string;
  readonly value: string;
}

defineProps<{
  readonly eventTypeOptions: FilterOption[];
  readonly memberOptions: FilterOption[];
  readonly operatorOptions: FilterOption[];
  readonly roleOptions: FilterOption[];
}>();

const from = defineModel<string>('from', { required: true });
const to = defineModel<string>('to', { required: true });
const membershipId = defineModel<string>('membershipId', { required: true });
const scheduleRoleId = defineModel<string>('scheduleRoleId', { required: true });
const eventTypes = defineModel<string[]>('eventTypes', { required: true });
const operatorUserId = defineModel<string>('operatorUserId', { required: true });
</script>

<template>
  <div class="event-filter-fields">
    <label class="filter-field">
      开始时间
      <input v-model="from" type="datetime-local" />
    </label>
    <label class="filter-field">
      结束时间
      <input v-model="to" type="datetime-local" />
    </label>
    <label class="filter-field">
      成员
      <t-select
        :value="membershipId"
        :options="memberOptions"
        clearable
        placeholder="全部成员"
        @change="membershipId = $event === undefined || $event === null ? '' : String($event)"
      />
    </label>
    <label class="filter-field">
      排班岗位
      <t-select
        :value="scheduleRoleId"
        :options="roleOptions"
        clearable
        placeholder="全部岗位"
        @change="scheduleRoleId = $event === undefined || $event === null ? '' : String($event)"
      />
    </label>
    <label class="filter-field">
      事件类型
      <t-select
        v-model="eventTypes"
        multiple
        :options="eventTypeOptions"
        clearable
        placeholder="全部类型"
      />
    </label>
    <label class="filter-field">
      操作者
      <t-select
        :value="operatorUserId"
        :options="operatorOptions"
        clearable
        placeholder="全部操作者"
        @change="operatorUserId = $event === undefined || $event === null ? '' : String($event)"
      />
    </label>
  </div>
</template>

<style scoped>
.event-filter-fields {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(170px, 1fr));
  gap: var(--ui-spacing-sm);
}

.filter-field {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.filter-field input {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  padding: 10px 12px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-medium);
  font: inherit;
  font-size: var(--ui-font-size-md);
}

.filter-field input:focus-visible {
  border-color: var(--ui-color-primary);
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.filter-field :deep(.t-input),
.filter-field :deep(.t-select) {
  min-height: var(--ui-touch-target-minimum);
}

@media (max-width: 900px) {
  .event-filter-fields {
    grid-template-columns: repeat(2, minmax(170px, 1fr));
  }
}

@media (max-width: 640px) {
  .event-filter-fields {
    grid-template-columns: 1fr;
    padding-top: var(--ui-spacing-sm);
  }
}
</style>
