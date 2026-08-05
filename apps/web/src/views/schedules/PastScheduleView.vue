<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  PastSchedulePeriod,
  ShiftType,
  SchedulingGroupMember,
} from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const periods = ref<readonly PastSchedulePeriod[]>([]);
const selectedPeriodId = ref('');
const shiftTypes = ref<readonly ShiftType[]>([]);
const members = ref<readonly SchedulingGroupMember[]>([]);
const calendar = ref<CalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const activeShiftTypeId = ref('');
const activeMemberId = ref('');
const reason = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref<string>();
const infoMessage = ref<string>();

const today = getBusinessDate();
const assignmentsByDate = computed(() => {
  const map = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of calendar.value?.assignments ?? []) {
    const list = map.get(assignment.businessDate) ?? [];
    list.push(assignment);
    map.set(assignment.businessDate, list);
  }
  return map;
});

onMounted(() => {
  void loadData();
});

async function loadData(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const [nextPeriods, nextConfig] = await Promise.all([
      api.listPastSchedulePeriods(props.group.id),
      api.getSchedulingConfig(props.group.id),
    ]);
    periods.value = nextPeriods;
    shiftTypes.value = nextConfig.shiftTypes.filter((shiftType) => shiftType.isEnabled);
    members.value = nextConfig.groupMembers;
    const nextPeriodId = periods.value.some((period) => period.id === selectedPeriodId.value)
      ? selectedPeriodId.value
      : (periods.value[0]?.id ?? '');
    await loadCalendar(nextPeriodId);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function loadCalendar(periodId: string): Promise<void> {
  selectedPeriodId.value = periodId;
  calendar.value = undefined;
  holidays.value = new Map();
  if (periodId === '') {
    return;
  }
  try {
    const [nextCalendar, nextHolidays] = await Promise.all([
      api.getSchedulePeriodCalendar(props.group.id, periodId),
      loadHolidays(periodId),
    ]);
    calendar.value = nextCalendar;
    holidays.value = nextHolidays;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

async function loadHolidays(periodId: string): Promise<ReadonlyMap<string, ConfirmedHolidayDate>> {
  const period = periods.value.find((candidate) => candidate.id === periodId);
  const year = Number(period?.businessMonth.slice(0, 4) ?? new Date().getFullYear());
  const result = await api.getHolidays(year);
  return new Map(result.dates.map((date) => [date.date, date] as const));
}

function selectShiftType(shiftTypeId: string): void {
  activeShiftTypeId.value = activeShiftTypeId.value === shiftTypeId ? '' : shiftTypeId;
}

function selectMember(memberId: string): void {
  activeMemberId.value = activeMemberId.value === memberId ? '' : memberId;
}

function onCalendarClick(event: MouseEvent): void {
  const cell = (event.target as HTMLElement | null)?.closest?.('.day-cell') as
    HTMLElement | undefined;
  const date = cell?.dataset.date;
  if (date === undefined || date === '') {
    return;
  }
  void paintDate(date);
}

async function paintDate(date: string): Promise<void> {
  errorMessage.value = undefined;
  if (activeShiftTypeId.value === '' || activeMemberId.value === '') {
    infoMessage.value = '请先在下方选择班种和成员（保持选中），再点击日历日期进行补录。';
    return;
  }
  if (date >= today) {
    errorMessage.value = `该日期（${date}）尚未过去，请使用正常排班功能修改。`;
    return;
  }

  const assignments = assignmentsByDate.value.get(date) ?? [];
  if (assignments.length === 0) {
    infoMessage.value = `该日期（${date}）没有可补录的班次；补录仅用于修改既往已存在的班次。`;
    return;
  }
  const target = assignments[0];
  if (target === undefined) {
    infoMessage.value = `该日期（${date}）没有可补录的班次；补录仅用于修改既往已存在的班次。`;
    return;
  }
  const matches =
    target.actualMembershipId === activeMemberId.value &&
    target.shiftTypeId === activeShiftTypeId.value;
  if (matches) {
    if (target.plannedMembershipId === null || target.plannedMembershipId === undefined) {
      infoMessage.value = `该班次没有计划成员可恢复，请直接选择其他成员补录。`;
      return;
    }
    const restored = await savePaint(target, {
      actualMembershipId: target.plannedMembershipId,
    });
    if (restored) {
      infoMessage.value = `已取消 ${date} 的补录，恢复为计划成员（${target.plannedMemberName ?? ''}）。`;
    }
    return;
  }

  const member = members.value.find((candidate) => candidate.membershipId === activeMemberId.value);
  const saved = await savePaint(target, {
    actualMembershipId: activeMemberId.value,
    shiftTypeId: activeShiftTypeId.value,
  });
  if (saved) {
    infoMessage.value =
      assignments.length > 1
        ? `已补录 ${date}（该日共 ${assignments.length} 个班次，本次修改第 1 个）。`
        : `已补录 ${date}：${member?.realName ?? ''} · ${shiftTypes.value.find((item) => item.id === activeShiftTypeId.value)?.name ?? ''}，并留下“排班补录”事件记录。`;
  }
}

async function savePaint(
  target: CalendarDutyAssignment,
  input: { readonly actualMembershipId: string; readonly shiftTypeId?: string },
): Promise<boolean> {
  if (selectedPeriodId.value === '') {
    return false;
  }
  isSaving.value = true;
  try {
    await api.updatePastScheduleAssignment(props.group.id, selectedPeriodId.value, target.id, {
      actualMembershipId: input.actualMembershipId,
      ...(input.shiftTypeId === undefined ? {} : { shiftTypeId: input.shiftTypeId }),
      ...(reason.value.trim() === '' ? {} : { reason: reason.value.trim() }),
    });
    await loadCalendar(selectedPeriodId.value);
    return true;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    return false;
  } finally {
    isSaving.value = false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '排班补录暂时无法完成，请稍后重试。';
}
</script>

<template>
  <section class="past-schedule-view" :aria-busy="isLoading || isSaving">
    <h2>排班补录</h2>
    <t-alert
      theme="info"
      message="仅管理员与群主可进入。可补录既往月份与年份的排班；先选择班种和成员（再次点击取消选中），再点击日历中的已过日期进行配班，每次修改都会留下“排班补录”事件记录。"
    />
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载既往排班" />
    <template v-else>
      <label class="period-select">
        既往排班月份
        <t-select
          :value="selectedPeriodId"
          :options="
            periods.map((period) => ({
              label: `${period.businessMonth} · ${period.scheduleRoleName}`,
              value: period.id,
            }))
          "
          placeholder="请选择要补录的排班"
          @change="
            (value: string | number | boolean | object | null) => loadCalendar(String(value ?? ''))
          "
        />
      </label>

      <template v-if="calendar !== undefined">
        <div class="palette-section">
          <div class="palette-row">
            <span class="palette-label">班种</span>
            <button
              v-for="shiftType in shiftTypes"
              :key="shiftType.id"
              type="button"
              class="palette-button shift-type-button"
              :class="{ 'is-active': activeShiftTypeId === shiftType.id }"
              :style="{
                backgroundColor: shiftType.color,
                color: shiftType.textColor,
              }"
              @click="selectShiftType(shiftType.id)"
            >
              {{ shiftType.abbreviation }}
              <span class="palette-name">{{ shiftType.name }}</span>
            </button>
          </div>
          <div class="palette-row">
            <span class="palette-label">成员</span>
            <button
              v-for="member in members"
              :key="member.membershipId"
              type="button"
              class="palette-button member-button"
              :class="{ 'is-active': activeMemberId === member.membershipId }"
              @click="selectMember(member.membershipId)"
            >
              {{ member.realName }}
            </button>
          </div>
          <label class="reason-field">
            补录说明（选填，作用于下一次补录）
            <t-textarea v-model="reason" :maxlength="1000" placeholder="记录本次补录原因" />
          </label>
          <p class="paint-hint">
            提示：点击日历中已过日期的格子完成配班；再次点击已相同配班的日期可取消补录（恢复计划成员）。
          </p>
        </div>

        <MonthGrid
          :assignments="calendar.assignments"
          :business-month="calendar.businessMonth"
          :holidays="holidays"
          :members="calendar.members"
          :today="today"
          @click="onCalendarClick"
        />
      </template>
      <div v-else class="empty-hint">暂无既往排班可补录。</div>
    </template>
  </section>
</template>

<style scoped>
.past-schedule-view {
  display: grid;
  gap: 14px;
}

.past-schedule-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.period-select {
  display: grid;
  gap: 4px;
  max-width: 420px;
  color: #374151;
  font-size: 14px;
}

.empty-hint {
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.palette-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.palette-label {
  min-width: 40px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.palette-button {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.palette-button.is-active {
  outline: 2px solid #1f5aa6;
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgb(31 90 166 / 18%);
}

.member-button {
  color: #1f2937;
  background: #f8fafc;
}

.member-button.is-active {
  color: #ffffff;
  background: #1f5aa6;
  border-color: #1f5aa6;
}

.shift-type-button.is-active {
  outline-color: #1f5aa6;
}

.palette-name {
  font-weight: 400;
}

.reason-field {
  display: grid;
  gap: 4px;
  max-width: 480px;
  color: #374151;
  font-size: 13px;
}

.paint-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}
</style>
