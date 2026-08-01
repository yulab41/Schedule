<script setup lang="ts">
import type { CalendarReadModel, GroupSummary } from '@schedule/contracts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from '../../api/conflict-handler.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import DataConflictDialog from '../../components/DataConflictDialog.vue';
import {
  addBusinessMonths,
  createLatestRequestTracker,
  filterCalendarAssignments,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<CalendarReadModel>();
const errorMessage = ref<string>();
const conflictMessage = ref('');
const conflictSummary = ref<string>();
const conflictVisible = ref(false);
const isLoading = ref(false);
const membershipIds = ref<string[]>([]);
const onlyChanges = ref(false);
const roleIds = ref<string[]>([]);
const shiftTypeIds = ref<string[]>([]);
const requestTracker = createLatestRequestTracker();
const today = getCurrentBusinessMonth();

const visibleAssignments = computed(() =>
  filterCalendarAssignments(calendar.value?.assignments ?? [], {
    membershipIds: membershipIds.value,
    onlyChanges: onlyChanges.value,
    roleIds: roleIds.value,
    shiftTypeIds: shiftTypeIds.value,
  }),
);
const roleOptions = computed(() =>
  (calendar.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const shiftTypeOptions = computed(() =>
  (calendar.value?.shiftTypes ?? []).map((shiftType) => ({
    label: `${shiftType.name}（${shiftType.abbreviation}）`,
    value: shiftType.id,
  })),
);
const memberOptions = computed(() =>
  (calendar.value?.members ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);

watch(
  () => [props.group.id, businessMonth.value],
  () => {
    void loadCalendar();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
});

function onWindowFocus(): void {
  void loadCalendar();
}

async function loadCalendar(): Promise<void> {
  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  calendar.value = undefined;

  try {
    const nextCalendar = await api.getCalendar(props.group.id, businessMonth.value);
    if (requestTracker.isCurrent(request)) {
      calendar.value = nextCalendar;
    }
  } catch (error) {
    if (requestTracker.isCurrent(request)) {
      if (isDataConflictError(error)) {
        conflictMessage.value = getConflictMessage(error);
        conflictSummary.value = getVersionConflictSummary(getConflictLatestData(error));
        conflictVisible.value = true;
      } else {
        errorMessage.value = getErrorMessage(error);
      }
    }
  } finally {
    if (requestTracker.isCurrent(request)) {
      isLoading.value = false;
    }
  }
}

function refreshAfterConflict(): void {
  conflictVisible.value = false;
  void loadCalendar();
}

function goToPreviousMonth(): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, -1);
}

function goToNextMonth(): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, 1);
}

function goToToday(): void {
  businessMonth.value = getCurrentBusinessMonth();
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '排班日历暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section class="calendar-view" :aria-busy="isLoading">
    <h2>排班日历</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="calendar-toolbar">
      <div class="month-navigation">
        <t-button variant="outline" @click="goToPreviousMonth">上一月</t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button variant="outline" @click="goToNextMonth">下一月</t-button>
        <t-button variant="outline" @click="goToToday">今天</t-button>
        <label class="month-picker">
          年月
          <input v-model="businessMonth" type="month" />
        </label>
      </div>
      <div class="calendar-filters">
        <label class="changes-filter">
          <input v-model="onlyChanges" type="checkbox" />
          只看变动
        </label>
        <label v-if="roleOptions.length > 0" class="filter-field">
          排班角色
          <t-select v-model="roleIds" multiple :options="roleOptions" clearable />
        </label>
        <label v-if="shiftTypeOptions.length > 0" class="filter-field">
          班种
          <t-select v-model="shiftTypeIds" multiple :options="shiftTypeOptions" clearable />
        </label>
        <label v-if="memberOptions.length > 0" class="filter-field">
          成员
          <t-select v-model="membershipIds" multiple :options="memberOptions" clearable />
        </label>
      </div>
    </div>
    <t-loading v-if="isLoading" text="正在加载排班日历" />
    <template v-else-if="calendar !== undefined">
      <MonthGrid
        v-if="visibleAssignments.length > 0"
        :assignments="visibleAssignments"
        :business-month="calendar.businessMonth"
        :members="calendar.members"
        :today="today"
      />
      <p v-else class="calendar-empty">
        {{ onlyChanges ? '本月没有带变动标记的班次。' : '本月暂无已发布排班。' }}
      </p>
    </template>
    <DataConflictDialog
      :message="conflictMessage"
      :summary="conflictSummary"
      :visible="conflictVisible"
      @close="conflictVisible = false"
      @refresh="refreshAfterConflict"
    />
  </section>
</template>

<style scoped>
.calendar-view {
  display: grid;
  gap: 12px;
}

.calendar-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.calendar-toolbar {
  display: grid;
  gap: 8px;
}

.month-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.month-navigation strong {
  min-width: 96px;
  font-size: 16px;
  text-align: center;
}

.month-picker {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #374151;
  font-size: 14px;
}

.month-picker input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.calendar-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.changes-filter {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #374151;
  font-size: 14px;
}

.filter-field {
  display: grid;
  gap: 4px;
  min-width: 160px;
  color: #374151;
  font-size: 14px;
}

.calendar-empty {
  padding: 24px;
  color: #6b7280;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
</style>
