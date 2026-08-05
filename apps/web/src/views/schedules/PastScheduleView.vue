<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  SchedulingConfig,
  SchedulingGroupMember,
} from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import {
  addBusinessMonths,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';

interface StagedPaint {
  readonly memberId: string;
  readonly shiftTypeId: string;
}

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const config = ref<SchedulingConfig>();
const periods = ref<readonly PastSchedulePeriod[]>([]);
const businessMonth = ref(getCurrentBusinessMonth());
const roleId = ref('');
const shiftTypes = computed(() =>
  (config.value?.shiftTypes ?? []).filter((shiftType) => shiftType.isEnabled),
);
const members = computed<readonly SchedulingGroupMember[]>(() => config.value?.groupMembers ?? []);
const calendar = ref<CalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const staged = ref<ReadonlyMap<string, StagedPaint>>(new Map());
const records = ref<readonly PastScheduleBackfillRecord[]>([]);
const activeShiftTypeId = ref('');
const activeMemberId = ref('');
const reason = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref<string>();
const infoMessage = ref<string>();

const today = getBusinessDate();
const roleOptions = computed(() =>
  (config.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const assignmentsByDate = computed(() => {
  const map = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of calendar.value?.assignments ?? []) {
    const list = map.get(assignment.businessDate) ?? [];
    list.push(assignment);
    map.set(assignment.businessDate, list);
  }
  return map;
});
const pendingStages = computed(() =>
  [...staged.value.entries()]
    .map(([date, paint]) => ({
      date,
      memberName:
        members.value.find((member) => member.membershipId === paint.memberId)?.realName ?? '',
      shiftTypeName:
        shiftTypes.value.find((shiftType) => shiftType.id === paint.shiftTypeId)?.name ?? '',
    }))
    .sort((first, second) => first.date.localeCompare(second.date)),
);
const stagedDateSet = computed(() => new Set(staged.value.keys()));

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
    config.value = nextConfig;
    if (roleId.value === '' && nextConfig.roles.length > 0) {
      roleId.value = nextConfig.roles[0]?.id ?? '';
    }
    await loadCalendar();
    await loadRecords();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function loadCalendar(): Promise<void> {
  calendar.value = undefined;
  holidays.value = new Map();
  if (roleId.value === '') {
    return;
  }
  const period = periods.value.find(
    (candidate) =>
      candidate.businessMonth === businessMonth.value && candidate.scheduleRoleId === roleId.value,
  );
  try {
    const [nextCalendar, nextHolidays] = await Promise.all([
      period === undefined
        ? Promise.resolve(buildEmptyCalendar())
        : api.getSchedulePeriodCalendar(props.group.id, period.id),
      loadHolidays(),
    ]);
    calendar.value = nextCalendar;
    holidays.value = nextHolidays;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

async function loadHolidays(): Promise<ReadonlyMap<string, ConfirmedHolidayDate>> {
  const year = Number(businessMonth.value.slice(0, 4));
  const result = await api.getHolidays(year);
  return new Map(result.dates.map((date) => [date.date, date] as const));
}

async function loadRecords(): Promise<void> {
  try {
    records.value = await api.listPastScheduleBackfillRecords(props.group.id);
  } catch {
    records.value = [];
  }
}

function buildEmptyCalendar(): CalendarReadModel {
  const role = config.value?.roles.find((candidate) => candidate.id === roleId.value);
  return {
    assignments: [],
    businessMonth: businessMonth.value,
    groupId: props.group.id,
    members: members.value.map((member) => ({
      isConfirmed: false,
      membershipId: member.membershipId,
      realName: member.realName,
    })),
    roles: role === undefined ? [] : [{ id: role.id, name: role.name }],
    shiftTypes: shiftTypes.value.map((shiftType) => ({
      abbreviation: shiftType.abbreviation,
      color: shiftType.color,
      crossesMidnight: shiftType.crossesMidnight,
      ...(shiftType.endTime === undefined ? {} : { endTime: shiftType.endTime }),
      id: shiftType.id,
      isAllDay: shiftType.isAllDay,
      name: shiftType.name,
      ...(shiftType.startTime === undefined ? {} : { startTime: shiftType.startTime }),
      textColor: shiftType.textColor,
    })),
  };
}

function changeMonth(delta: number): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  void loadCalendar();
}

function onMonthInput(value: string): void {
  if (/^\d{4}-\d{2}$/u.test(value)) {
    businessMonth.value = value;
    void loadCalendar();
  }
}

function onRoleChange(value: string | number | boolean | object | null): void {
  roleId.value = String(value ?? '');
  void loadCalendar();
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
  clickDate(date);
}

function clickDate(date: string): void {
  errorMessage.value = undefined;
  if (staged.value.has(date)) {
    removeStage(date);
    return;
  }
  if (activeShiftTypeId.value === '' || activeMemberId.value === '') {
    infoMessage.value = '请先选择班种和成员（保持选中），再点击既往日期进行配班。';
    return;
  }
  if (date >= today) {
    errorMessage.value = `该日期（${date}）尚未过去，请使用正常排班功能修改。`;
    return;
  }
  const existing = assignmentsByDate.value.get(date)?.[0];
  if (
    existing !== undefined &&
    (existing.actualMembershipId ?? existing.plannedMembershipId) === activeMemberId.value &&
    existing.shiftTypeId === activeShiftTypeId.value
  ) {
    infoMessage.value = `该日期（${date}）已是此配班，无需重复补录。`;
    return;
  }
  const next = new Map(staged.value);
  next.set(date, { memberId: activeMemberId.value, shiftTypeId: activeShiftTypeId.value });
  staged.value = next;
}

function removeStage(date: string): void {
  const next = new Map(staged.value);
  next.delete(date);
  staged.value = next;
}

function clearStaged(): void {
  staged.value = new Map();
  infoMessage.value = '已清空待确认的补录项。';
}

async function confirmStaged(): Promise<void> {
  if (staged.value.size === 0) {
    infoMessage.value = '没有待确认的补录项。';
    return;
  }
  isSaving.value = true;
  errorMessage.value = undefined;
  let confirmedCount = 0;
  try {
    for (const [date, paint] of [...staged.value.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      await api.createPastScheduleAssignment(props.group.id, {
        actualMembershipId: paint.memberId,
        businessDate: date,
        ...(reason.value.trim() === '' ? {} : { reason: reason.value.trim() }),
        scheduleRoleId: roleId.value,
        shiftTypeId: paint.shiftTypeId,
      });
      confirmedCount += 1;
    }
    staged.value = new Map();
    infoMessage.value = `已确认补录 ${confirmedCount} 条，并留下“排班补录”事件记录。`;
    await loadData();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    infoMessage.value = `已确认 ${confirmedCount} 条，其余未提交成功，请重试。`;
  } finally {
    isSaving.value = false;
  }
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
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
      message="仅管理员与群主可进入，可自由切换既往月份/年份。先选择班种和成员（再次点击取消选中），再点击日历中的既往日期配班；确认后才会生效并留下“排班补录”事件记录。"
    />
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载既往排班" />
    <template v-else>
      <div class="controls">
        <label>
          排班岗位
          <t-select
            :value="roleId"
            :options="roleOptions"
            placeholder="请选择排班岗位"
            @change="onRoleChange"
          />
        </label>
        <label>
          月份
          <span class="month-nav">
            <t-button variant="outline" size="small" @click="changeMonth(-1)">上一月</t-button>
            <input
              :value="businessMonth"
              class="month-input"
              type="month"
              @change="onMonthInput(($event.target as HTMLInputElement).value)"
            />
            <t-button variant="outline" size="small" @click="changeMonth(1)">下一月</t-button>
          </span>
        </label>
        <span class="month-label">{{ getBusinessMonthLabel(businessMonth) }}</span>
      </div>

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
              {{ shiftType.name }}
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
            补录说明（选填，作用于本次确认）
            <t-textarea v-model="reason" :maxlength="1000" placeholder="记录本次补录原因" />
          </label>
        </div>

        <div v-if="pendingStages.length > 0" class="staged-panel">
          <strong>待确认补录（{{ pendingStages.length }}）</strong>
          <span
            v-for="item in pendingStages"
            :key="item.date"
            class="staged-item"
            @click="removeStage(item.date)"
          >
            {{ item.date }}：{{ item.memberName }} · {{ item.shiftTypeName }}（点击移除）
          </span>
          <t-space size="small">
            <t-button theme="primary" :loading="isSaving" @click="confirmStaged">
              确认补录
            </t-button>
            <t-button variant="outline" :disabled="isSaving" @click="clearStaged">
              清空草稿
            </t-button>
          </t-space>
        </div>

        <p class="paint-hint">
          提示：灰色为未来日期（不可补录），正常底色为既往日期；可连续点击多个日期加入待确认（蓝色描边），再统一点击“确认补录”一次性生效；再次点击已加入的日期可取消该项（不会生成记录）。
        </p>

        <MonthGrid
          :assignments="calendar.assignments"
          :business-month="calendar.businessMonth"
          :highlighted-dates="stagedDateSet"
          :holidays="holidays"
          :invert-past-colors="true"
          :members="calendar.members"
          :hide-marker-types="['manual-adjustment']"
          :today="today"
          @click="onCalendarClick"
        />
      </template>

      <section v-if="records.length > 0" class="events-section">
        <h3>最近补录记录</h3>
        <ul>
          <li v-for="record in records" :key="record.assignmentId">
            <span class="event-time">{{ formatEventTime(record.backfilledAt) }}</span>
            {{ record.businessDate }} · {{ record.actualMemberName ?? '' }} ·
            {{ record.shiftTypeName }}
            <template v-if="record.reason !== undefined"> · {{ record.reason }}</template>
            <template v-if="record.operatorName !== ''">
              · 操作人：{{ record.operatorName }}</template
            >
          </li>
        </ul>
      </section>
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

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: end;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.controls label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 13px;
}

.month-nav {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.month-input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.month-label {
  align-self: center;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
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

.reason-field {
  display: grid;
  gap: 4px;
  max-width: 480px;
  color: #374151;
  font-size: 13px;
}

.staged-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 12px;
  color: #1f2937;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
}

.staged-item {
  padding: 4px 8px;
  color: #1f5aa6;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  cursor: pointer;
}

.staged-item:hover {
  background: #dbeafe;
}

.paint-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.events-section {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.events-section h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.events-section ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}

.events-section li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed #e5e7eb;
}

.event-time {
  color: #6b7280;
}
</style>
