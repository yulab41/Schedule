<script setup lang="ts">
import type {
  CalendarReadModel,
  GroupSummary,
  ScheduleEvent,
  ScheduleEventDetail,
  VisitorAccessLog,
} from '@schedule/contracts';
import { FilterIcon } from 'tdesign-icons-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { getCurrentBusinessMonth } from '../../features/calendar/calendar-logic.js';
import EventFilters from '../../features/events/EventFilters.vue';
import EventTimeline from '../../features/events/EventTimeline.vue';
import {
  buildEventTypeOptions,
  formatEventTime,
  getEventTypeLabel,
} from '../../features/events/event-timeline.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const calendar = ref<CalendarReadModel>();
const from = ref('');
const to = ref('');
const membershipId = ref('');
const operatorUserId = ref('');
const scheduleRoleId = ref('');
const eventTypes = ref<string[]>([]);
const events = ref<ScheduleEvent[]>([]);
const nextCursor = ref<string>();
const detail = ref<ScheduleEventDetail>();
const detailVisible = ref(false);
const errorMessage = ref<string>();
const isLoading = ref(false);
const isLoadingMore = ref(false);
const isLoadingDetail = ref(false);
const visitorLogs = ref<VisitorAccessLog[]>([]);
const visitorLogsError = ref<string>();
const visitorLogsLoading = ref(false);
const visitorLogsNextCursor = ref<string>();
const filterVisible = ref(false);

const memberOptions = computed(() =>
  (calendar.value?.members ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const roleOptions = computed(() =>
  (calendar.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const operatorOptions = computed(() =>
  (calendar.value?.members ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const eventTypeOptions = computed(() => buildEventTypeOptions());
const memberNameById = computed(
  () =>
    new Map(
      (calendar.value?.members ?? []).map((member) => [member.membershipId, member.realName]),
    ),
);
const activeFilterCount = computed(
  () =>
    Number(from.value !== '') +
    Number(to.value !== '') +
    Number(membershipId.value !== '') +
    Number(operatorUserId.value !== '') +
    Number(scheduleRoleId.value !== '') +
    eventTypes.value.length,
);

watch(
  () => props.group.id,
  () => {
    resetFilters();
    void loadCalendar();
    void loadEvents();
    void loadVisitorLogs();
  },
  { immediate: true },
);

watch([from, to, membershipId, operatorUserId, scheduleRoleId, eventTypes], () => {
  void loadEvents();
});

onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
});

function onWindowFocus(): void {
  void loadEvents();
}

function resetFilters(): void {
  from.value = '';
  to.value = '';
  membershipId.value = '';
  operatorUserId.value = '';
  scheduleRoleId.value = '';
  eventTypes.value = [];
}

async function loadCalendar(): Promise<void> {
  try {
    calendar.value = await api.getCalendar(props.group.id, getCurrentBusinessMonth());
  } catch {
    calendar.value = undefined;
  }
}

async function loadEvents(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  events.value = [];
  nextCursor.value = undefined;
  try {
    const page = await api.getGroupEvents(props.group.id, buildQuery());
    events.value = [...page.events];
    nextCursor.value = page.nextCursor;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '事件数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (nextCursor.value === undefined || isLoadingMore.value) {
    return;
  }
  isLoadingMore.value = true;
  try {
    const page = await api.getGroupEvents(props.group.id, {
      ...buildQuery(),
      cursor: nextCursor.value,
    });
    events.value = [...events.value, ...page.events];
    nextCursor.value = page.nextCursor;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '事件数据暂时无法加载，请稍后重试。');
  } finally {
    isLoadingMore.value = false;
  }
}

async function loadVisitorLogs(reset = true): Promise<void> {
  if (reset) {
    visitorLogs.value = [];
    visitorLogsNextCursor.value = undefined;
  }
  visitorLogsError.value = undefined;
  visitorLogsLoading.value = true;
  try {
    const page = await api.getVisitorAccessLogs(
      props.group.id,
      reset ? undefined : visitorLogsNextCursor.value,
    );
    visitorLogs.value = reset ? [...page.logs] : [...visitorLogs.value, ...page.logs];
    visitorLogsNextCursor.value = page.nextCursor;
  } catch (error) {
    visitorLogsError.value = toUserMessage(error, '访问记录暂时无法加载，请稍后重试。');
  } finally {
    visitorLogsLoading.value = false;
  }
}

async function openDetail(event: ScheduleEvent): Promise<void> {
  isLoadingDetail.value = true;
  try {
    detail.value = await api.getEventDetail(props.group.id, event.id);
    detailVisible.value = true;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '事件数据暂时无法加载，请稍后重试。');
  } finally {
    isLoadingDetail.value = false;
  }
}

function buildQuery(): {
  readonly cursor?: string;
  readonly eventTypes?: readonly string[];
  readonly from?: string;
  readonly membershipId?: string;
  readonly operatorUserId?: string;
  readonly pageSize: number;
  readonly scheduleRoleId?: string;
  readonly to?: string;
} {
  return {
    ...(from.value === '' ? {} : { from: new Date(from.value).toISOString() }),
    ...(to.value === '' ? {} : { to: new Date(to.value).toISOString() }),
    ...(membershipId.value === '' ? {} : { membershipId: membershipId.value }),
    ...(operatorUserId.value === '' ? {} : { operatorUserId: operatorUserId.value }),
    ...(scheduleRoleId.value === '' ? {} : { scheduleRoleId: scheduleRoleId.value }),
    ...(eventTypes.value.length === 0 ? {} : { eventTypes: [...eventTypes.value] }),
    pageSize: 50,
  };
}

function affectedMemberNames(event: ScheduleEvent): string {
  return event.affectedMembershipIds
    .map((membershipId) => memberNameById.value.get(membershipId) ?? '未知成员')
    .join('、');
}
</script>

<template>
  <section class="event-center-view" :aria-busy="isLoading || isLoadingMore">
    <header class="event-heading">
      <div>
        <h2>事件中心</h2>
        <p>追踪排班变更、操作原因和访客查看记录。</p>
      </div>
      <t-button
        id="event-filter-button"
        variant="outline"
        class="mobile-event-filter"
        @click="filterVisible = true"
      >
        <template #icon><FilterIcon /></template>
        筛选<span v-if="activeFilterCount > 0">（{{ activeFilterCount }}）</span>
      </t-button>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="desktop-event-filters">
      <EventFilters
        v-model:from="from"
        v-model:to="to"
        v-model:membership-id="membershipId"
        v-model:schedule-role-id="scheduleRoleId"
        v-model:event-types="eventTypes"
        v-model:operator-user-id="operatorUserId"
        :member-options="memberOptions"
        :role-options="roleOptions"
        :event-type-options="eventTypeOptions"
        :operator-options="operatorOptions"
      />
    </div>
    <t-loading v-if="isLoading" text="正在加载事件" />
    <template v-else>
      <section v-if="events.length > 0" class="event-list-section">
        <table class="event-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>涉及成员</th>
              <th>原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in events" :key="event.id" class="event-card">
              <td class="event-time-cell" data-label="时间">
                {{ formatEventTime(event.occurredAt) }}
              </td>
              <td data-label="类型">
                <span class="event-type-badge">{{ getEventTypeLabel(event.eventType) }}</span>
              </td>
              <td data-label="涉及成员">{{ affectedMemberNames(event) }}</td>
              <td data-label="原因">{{ event.reason ?? '—' }}</td>
              <td class="event-actions" data-label="操作">
                <t-button variant="outline" :loading="isLoadingDetail" @click="openDetail(event)">
                  查看详情
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <t-button
          v-if="nextCursor !== undefined"
          variant="outline"
          :loading="isLoadingMore"
          @click="loadMore"
        >
          加载更多
        </t-button>
      </section>
      <p v-else class="events-empty">没有符合筛选条件的事件。</p>
    </template>

    <ResponsiveSheet v-model:visible="detailVisible" title="事件详情与关联链">
      <template v-if="detail !== undefined">
        <p class="detail-meta">
          {{ formatEventTime(detail.event.occurredAt) }} ·
          {{ getEventTypeLabel(detail.event.eventType) }} · 涉及成员：{{
            affectedMemberNames(detail.event)
          }}
        </p>
        <EventTimeline :events="[detail.event, ...detail.relatedEvents]" show-raw-data />
      </template>
    </ResponsiveSheet>

    <section class="visitor-logs-section">
      <header class="event-section-heading">
        <div>
          <h3>访客访问记录</h3>
          <p>仅记录排班查看时间与请求来源。</p>
        </div>
        <span>{{ visitorLogs.length }} 条</span>
      </header>
      <t-alert v-if="visitorLogsError !== undefined" theme="error" :message="visitorLogsError" />
      <t-loading v-if="visitorLogsLoading && visitorLogs.length === 0" text="正在加载访问记录" />
      <table v-else-if="visitorLogs.length > 0" class="visitor-logs-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>查看月份</th>
            <th>来源 IP</th>
            <th>请求 ID</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in visitorLogs" :key="log.id" class="visitor-log-card">
            <td class="event-time-cell" data-label="时间">{{ formatEventTime(log.createdAt) }}</td>
            <td data-label="查看月份">{{ log.businessMonth }}</td>
            <td data-label="来源 IP">{{ log.clientIp ?? '—' }}</td>
            <td data-label="请求 ID">{{ log.requestId ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="events-empty">暂无访客访问记录。</p>
      <t-button
        v-if="visitorLogsNextCursor !== undefined"
        variant="outline"
        :loading="visitorLogsLoading"
        @click="loadVisitorLogs(false)"
      >
        加载更多
      </t-button>
    </section>

    <ResponsiveSheet v-model:visible="filterVisible" title="筛选事件">
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <EventFilters
        v-model:from="from"
        v-model:to="to"
        v-model:membership-id="membershipId"
        v-model:schedule-role-id="scheduleRoleId"
        v-model:event-types="eventTypes"
        v-model:operator-user-id="operatorUserId"
        :member-options="memberOptions"
        :role-options="roleOptions"
        :event-type-options="eventTypeOptions"
        :operator-options="operatorOptions"
      />
      <t-button
        class="filter-result-button"
        theme="primary"
        :loading="isLoading"
        @click="filterVisible = false"
      >
        查看结果（{{ events.length }}）
      </t-button>
    </ResponsiveSheet>
  </section>
</template>

<style scoped>
.event-center-view {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-lg);
}

.event-heading,
.event-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.event-heading h2,
.event-section-heading h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.event-heading h2 {
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.event-section-heading h3 {
  font-size: var(--ui-font-size-lg);
}

.event-heading p,
.event-section-heading p {
  margin: var(--ui-spacing-xxs) 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.event-section-heading > span {
  flex: none;
  padding: 5px 9px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.mobile-event-filter {
  display: none;
}

.desktop-event-filters {
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.event-center-view :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.event-list-section {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
}

.event-table,
.visitor-logs-table {
  width: 100%;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-collapse: separate;
  border-radius: var(--ui-radius-large);
  border-spacing: 0;
  font-size: var(--ui-font-size-sm);
  overflow: hidden;
}

.event-table th,
.event-table td,
.visitor-logs-table th,
.visitor-logs-table td {
  padding: 11px 12px;
  text-align: left;
  border-bottom: 1px solid var(--ui-color-border);
  vertical-align: middle;
}

.event-table th,
.visitor-logs-table th {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-background);
  font-weight: var(--ui-font-weight-semibold);
}

.event-table tbody tr:last-child td,
.visitor-logs-table tbody tr:last-child td {
  border-bottom: 0;
}

.event-time-cell {
  white-space: nowrap;
}

.event-type-badge {
  display: inline-flex;
  min-height: 28px;
  padding: 4px 9px;
  align-items: center;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.events-empty {
  margin: 0;
  padding: var(--ui-spacing-xl);
  color: var(--ui-color-text-secondary);
  text-align: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  font-size: var(--ui-font-size-sm);
}

.detail-meta {
  margin: var(--ui-spacing-sm) 0 var(--ui-spacing-md);
  padding: 10px 12px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.visitor-logs-section {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
  margin-top: var(--ui-spacing-xs);
}

.filter-result-button {
  width: 100%;
  margin-top: var(--ui-spacing-lg);
}

@media (max-width: 760px) {
  .event-center-view {
    gap: var(--ui-spacing-md);
  }

  .event-heading p,
  .event-section-heading p {
    max-width: 220px;
  }

  .mobile-event-filter {
    display: inline-flex;
    flex: none;
  }

  .desktop-event-filters {
    display: none;
  }

  .event-table,
  .event-table tbody,
  .visitor-logs-table,
  .visitor-logs-table tbody {
    display: grid;
    gap: var(--ui-spacing-md);
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .event-table thead,
  .visitor-logs-table thead {
    display: none;
  }

  .event-table .event-card,
  .visitor-logs-table .visitor-log-card {
    display: grid;
    min-width: 0;
    padding: var(--ui-spacing-lg);
    gap: 10px;
    background: var(--ui-color-surface);
    border: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-large);
    box-shadow: var(--ui-shadow-card);
  }

  .event-table .event-card {
    border-color: var(--ui-color-primary-border);
    box-shadow:
      var(--ui-shadow-card),
      inset 3px 0 var(--ui-color-primary);
  }

  .event-table .event-card td,
  .visitor-logs-table .visitor-log-card td {
    display: flex;
    min-width: 0;
    min-height: 28px;
    padding: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--ui-spacing-md);
    border: 0;
    line-height: 1.45;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .event-table .event-card td::before,
  .visitor-logs-table .visitor-log-card td::before {
    min-width: 64px;
    flex: none;
    color: var(--ui-color-text-secondary);
    content: attr(data-label);
    font-size: var(--ui-font-size-xs);
    font-weight: var(--ui-font-weight-medium);
  }

  .event-table .event-card .event-actions {
    display: grid;
    min-height: var(--ui-touch-target-minimum);
    padding-top: var(--ui-spacing-xxs);
  }

  .event-table .event-card .event-actions::before {
    display: none;
  }

  .event-actions :deep(.t-button),
  .event-list-section > :deep(.t-button),
  .visitor-logs-section > :deep(.t-button) {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .event-heading,
  .event-section-heading {
    display: grid;
  }

  .mobile-event-filter,
  .event-section-heading > span {
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .event-center-view *,
  .event-center-view *::before,
  .event-center-view *::after {
    scroll-behavior: auto !important;
  }
}
</style>
