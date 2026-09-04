<script setup lang="ts">
import { MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS } from '@schedule/contracts';
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
import {
  createBackfillStageKey,
  createPastScheduleBackfillBatchSnapshot,
  filterPastScheduleBackfillStages,
  getPastScheduleBackfillBatchFingerprint,
  summarizePastScheduleBackfillStages,
  toggleBackfillSelection,
  toggleBackfillStage,
  type PastScheduleBackfillStageMap,
} from '@schedule/presentation-core';
import { computed, onMounted, ref, watch } from 'vue';
import type { SelectValue } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import SharedIcon from '../../components/SharedIcon.vue';
import TemporalPicker from '../../components/TemporalPicker.vue';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import {
  addBusinessMonths,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';
import {
  resolvePastScheduleBackfillAttempt,
  type PastScheduleBackfillAttempt,
} from './past-schedule-batch.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
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
const staged = ref<PastScheduleBackfillStageMap>(new Map());
const records = ref<readonly PastScheduleBackfillRecord[]>([]);
const activeShiftTypeId = ref('');
const activeMemberId = ref('');
const reason = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const batchAttempt = ref<PastScheduleBackfillAttempt>();

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
  summarizePastScheduleBackfillStages(staged.value, {
    memberNames: new Map(
      members.value.map((member) => [member.membershipId, member.realName] as const),
    ),
    shiftTypeNames: new Map(
      shiftTypes.value.map((shiftType) => [shiftType.id, shiftType.name] as const),
    ),
  }),
);
const currentStages = computed(() =>
  filterPastScheduleBackfillStages(staged.value, {
    businessMonth: businessMonth.value,
    scheduleRoleId: roleId.value,
  }),
);
const stagedDateSet = computed(
  () => new Set([...currentStages.value.values()].map((item) => item.businessDate)),
);
const activeShiftTypeName = computed(
  () =>
    shiftTypes.value.find((shiftType) => shiftType.id === activeShiftTypeId.value)?.name ??
    '未选择班种',
);
const activeMemberName = computed(
  () =>
    members.value.find((member) => member.membershipId === activeMemberId.value)?.realName ??
    '未选择成员',
);
const isPaintReady = computed(() => activeShiftTypeId.value !== '' && activeMemberId.value !== '');
const paintStatusText = computed(() => {
  if (isPaintReady.value) {
    return '可以连续点选既往日期';
  }
  if (activeShiftTypeId.value === '' && activeMemberId.value === '') {
    return '请选择班种和成员';
  }
  return activeShiftTypeId.value === '' ? '还需选择班种' : '还需选择成员';
});

onMounted(() => {
  void loadData();
});

watch(reason, () => {
  batchAttempt.value = undefined;
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
    errorMessage.value = toUserMessage(error, '排班补录暂时无法完成，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '排班补录暂时无法完成，请稍后重试。');
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
  if (isSaving.value) return;
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  discardMismatchedStages();
  void loadCalendar();
}

function onMonthInput(value: string): void {
  if (!isSaving.value && /^\d{4}-\d{2}$/u.test(value)) {
    businessMonth.value = value;
    discardMismatchedStages();
    void loadCalendar();
  }
}

function onRoleChange(value: SelectValue): void {
  if (isSaving.value) return;
  roleId.value = String(value ?? '');
  discardMismatchedStages();
  void loadCalendar();
}

function selectShiftType(shiftTypeId: string): void {
  if (isSaving.value) return;
  activeShiftTypeId.value = toggleBackfillSelection(activeShiftTypeId.value, shiftTypeId);
}

function selectMember(memberId: string): void {
  if (isSaving.value) return;
  activeMemberId.value = toggleBackfillSelection(activeMemberId.value, memberId);
}

function clickDate(date: string): void {
  if (isSaving.value) return;
  errorMessage.value = undefined;
  const transition = toggleBackfillStage(
    staged.value,
    {
      actualMembershipId: activeMemberId.value,
      businessDate: date,
      scheduleRoleId: roleId.value,
      shiftTypeId: activeShiftTypeId.value,
    },
    {
      businessMonth: businessMonth.value,
      maximumItems: MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS,
      today,
    },
  );
  if (transition.outcome === 'selection-required') {
    infoMessage.value = '请先选择班种和成员（保持选中），再点击既往日期进行配班。';
    return;
  }
  if (transition.outcome === 'not-past') {
    errorMessage.value = `该日期（${date}）尚未过去，请使用正常排班功能修改。`;
    return;
  }
  if (transition.outcome === 'invalid-date' || transition.outcome === 'outside-month') {
    errorMessage.value = `该日期（${date}）不属于当前补录月份，无法加入。`;
    return;
  }
  if (transition.outcome === 'limit-reached') {
    errorMessage.value = `一次最多确认 ${MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS} 条补录，请先确认当前草稿。`;
    return;
  }
  if (transition.outcome === 'added') {
    const existing = assignmentsByDate.value.get(date)?.[0];
    if (
      existing !== undefined &&
      (existing.actualMembershipId ?? existing.plannedMembershipId) === activeMemberId.value &&
      existing.shiftTypeId === activeShiftTypeId.value
    ) {
      infoMessage.value = `该日期（${date}）已是此配班，无需重复补录。`;
      return;
    }
  }
  staged.value = transition.stages;
  batchAttempt.value = undefined;
}

function removeStage(date: string, scheduleRoleId = roleId.value): void {
  if (isSaving.value) return;
  const next = new Map(staged.value);
  next.delete(createBackfillStageKey(scheduleRoleId, date));
  staged.value = next;
  batchAttempt.value = undefined;
}

function clearStaged(): void {
  if (isSaving.value) return;
  staged.value = new Map();
  batchAttempt.value = undefined;
  infoMessage.value = '已清空待确认的补录项。';
}

function discardMismatchedStages(): void {
  const next = filterPastScheduleBackfillStages(staged.value, {
    businessMonth: businessMonth.value,
    scheduleRoleId: roleId.value,
  });
  if (next.size !== staged.value.size) {
    staged.value = next;
    batchAttempt.value = undefined;
    infoMessage.value = '已清空与当前岗位或月份不匹配的补录草稿。';
  }
}

async function confirmStaged(): Promise<void> {
  if (isSaving.value) return;
  if (staged.value.size === 0) {
    infoMessage.value = '没有待确认的补录项。';
    return;
  }
  const fingerprint = getPastScheduleBackfillBatchFingerprint(
    [...staged.value.values()],
    reason.value,
  );
  const attempt = resolvePastScheduleBackfillAttempt(batchAttempt.value, fingerprint, () =>
    crypto.randomUUID(),
  );
  batchAttempt.value = attempt;
  const snapshot = createPastScheduleBackfillBatchSnapshot(
    staged.value,
    reason.value,
    attempt.operationId,
  );
  isSaving.value = true;
  errorMessage.value = undefined;
  try {
    const result = await api.submitPastScheduleBackfillBatch(props.group.id, snapshot);
    staged.value = new Map();
    batchAttempt.value = undefined;
    infoMessage.value = `已确认补录 ${result.assignments.length} 条，并留下“排班补录”事件记录。`;
    await loadData();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '排班补录暂时无法完成，请稍后重试。');
    infoMessage.value = '未能确认本批结果；草稿与重试凭据已保留，可直接重试。';
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
            :disabled="isSaving"
            placeholder="请选择排班岗位"
            @change="onRoleChange"
          />
        </label>
        <label>
          月份
          <span class="month-nav">
            <t-button variant="outline" size="small" :disabled="isSaving" @click="changeMonth(-1)">
              <template #icon><SharedIcon name="chevron-left" /></template>
              上一月
            </t-button>
            <TemporalPicker
              :model-value="businessMonth"
              class="month-input"
              :disabled="isSaving"
              kind="month"
              label="历史排班年月"
              @update:model-value="onMonthInput"
            />
            <t-button variant="outline" size="small" :disabled="isSaving" @click="changeMonth(1)">
              <template #icon><SharedIcon name="chevron-right" /></template>
              下一月
            </t-button>
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
              :aria-pressed="activeShiftTypeId === shiftType.id"
              :disabled="isSaving"
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
              :aria-pressed="activeMemberId === member.membershipId"
              :disabled="isSaving"
              @click="selectMember(member.membershipId)"
            >
              {{ member.realName }}
            </button>
          </div>
          <label class="reason-field">
            补录说明（选填，作用于本次确认）
            <t-textarea
              v-model="reason"
              :disabled="isSaving"
              :maxlength="1000"
              placeholder="记录本次补录原因"
            />
          </label>
        </div>

        <div class="paint-status" :class="{ 'is-ready': isPaintReady }" aria-live="polite">
          <span class="paint-status-label">当前配班</span>
          <strong>{{ activeMemberName }} · {{ activeShiftTypeName }}</strong>
          <span class="paint-status-message">{{ paintStatusText }}</span>
        </div>

        <div v-if="pendingStages.length > 0" class="staged-panel">
          <strong>待确认补录（{{ pendingStages.length }}）</strong>
          <button
            v-for="item in pendingStages"
            :key="`${item.scheduleRoleId}:${item.businessDate}`"
            type="button"
            class="staged-item"
            :aria-label="`移除 ${item.businessDate} ${item.memberName} ${item.shiftTypeName} 的待确认补录`"
            :disabled="isSaving"
            @click="removeStage(item.businessDate, item.scheduleRoleId)"
          >
            <span>{{ item.businessDate }}：{{ item.memberName }} · {{ item.shiftTypeName }}</span>
            <span class="staged-remove">移除</span>
          </button>
          <div class="staged-actions">
            <t-button theme="primary" :loading="isSaving" @click="confirmStaged">
              确认补录
            </t-button>
            <t-button variant="outline" :disabled="isSaving" @click="clearStaged">
              清空草稿
            </t-button>
          </div>
        </div>

        <p class="paint-hint">
          提示：灰色为未来日期（不可补录），正常底色为既往日期；可连续点击多个日期加入待确认（蓝色描边），再统一点击“确认补录”一次性生效；再次点击已加入的日期可取消该项（不会生成记录）。
        </p>

        <section class="backfill-calendar" aria-label="补录日期选择">
          <div class="backfill-calendar-heading">
            <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
            <span>点击整格加入或取消待确认补录</span>
          </div>
          <MonthGrid
            :assignments="calendar.assignments"
            :business-month="calendar.businessMonth"
            :highlighted-dates="stagedDateSet"
            :holidays="holidays"
            :invert-past-colors="true"
            :members="calendar.members"
            :today="today"
            @select-date="clickDate"
          />
        </section>
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
  gap: var(--ui-spacing-md);
}

.past-schedule-view h2 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--ui-spacing-sm) var(--ui-spacing-lg);
  align-items: end;
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.controls label {
  display: grid;
  gap: 4px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.month-nav {
  display: inline-flex;
  gap: var(--ui-spacing-xs);
  align-items: center;
}

.month-nav :deep(.t-button),
.controls :deep(.t-input__wrap) {
  min-height: var(--ui-touch-target-minimum);
}

.month-input {
  min-width: 126px;
}

.month-label {
  align-self: center;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.palette-section {
  display: grid;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  align-items: center;
}

.palette-label {
  min-width: 40px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.palette-button {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  transition:
    box-shadow var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
}

.palette-button:active {
  transform: scale(0.97);
}

.palette-button:disabled,
.staged-item:disabled {
  cursor: not-allowed;
  opacity: 0.64;
}

.palette-button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.palette-button.is-active {
  outline: 2px solid var(--ui-color-primary);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgb(31 90 166 / 18%);
}

.member-button {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
}

.member-button.is-active {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.reason-field {
  display: grid;
  gap: 4px;
  max-width: 480px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.reason-field :deep(.t-textarea__inner) {
  min-height: 88px;
  border-radius: var(--ui-radius-small);
}

.paint-status {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.paint-status.is-ready {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-color: var(--ui-color-primary-border);
}

.paint-status-label {
  color: var(--ui-color-text-muted);
  font-weight: var(--ui-font-weight-medium);
}

.paint-status strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.paint-status-message {
  font-weight: var(--ui-font-weight-medium);
}

.staged-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--ui-spacing-xs);
  align-items: center;
  padding: var(--ui-spacing-md);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.staged-panel > strong,
.staged-actions {
  grid-column: 1 / -1;
}

.staged-item {
  display: flex;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.staged-item:hover {
  background: #dbeafe;
}

.staged-item:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.staged-remove {
  flex: none;
  color: var(--ui-color-danger);
  font-weight: var(--ui-font-weight-semibold);
}

.staged-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}

.staged-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.paint-hint {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.backfill-calendar {
  display: grid;
  gap: var(--ui-spacing-xs);
}

.backfill-calendar-heading {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.backfill-calendar-heading strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.events-section {
  display: grid;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.events-section h3 {
  margin: 0;
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.events-section ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--ui-font-size-sm);
}

.events-section li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) 0;
  border-bottom: 1px dashed var(--ui-color-border);
}

.event-time {
  color: var(--ui-color-text-muted);
}

@media (max-width: 640px) {
  .controls {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--ui-spacing-sm);
  }

  .month-nav {
    display: grid;
    grid-template-columns: auto minmax(112px, 1fr) auto;
  }

  .month-input {
    width: 100%;
    min-width: 0;
  }

  .month-label {
    display: none;
  }

  .palette-section {
    padding: var(--ui-spacing-sm);
  }

  .palette-row {
    align-items: stretch;
  }

  .palette-label {
    flex: 0 0 100%;
  }

  .palette-button {
    flex: 1 1 auto;
    justify-content: center;
  }

  .reason-field {
    max-width: none;
  }

  .paint-status {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .paint-status-label {
    grid-column: 1 / -1;
  }

  .staged-panel {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--ui-spacing-sm);
  }

  .staged-actions > :deep(.t-button) {
    flex: 1 1 120px;
  }

  .backfill-calendar-heading {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
  }

  .backfill-calendar {
    width: calc(100% + 24px);
    margin-inline: -12px;
  }

  .backfill-calendar-heading {
    padding-inline: var(--ui-spacing-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .palette-button {
    transition: none;
  }
}
</style>
