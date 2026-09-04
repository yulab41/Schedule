<script setup lang="ts">
import type {
  CalendarReadModel,
  GroupSummary,
  ScheduleEvent,
  ScheduleEventDetail,
  VisitorAccessLog,
} from '@schedule/contracts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import SharedIcon from '../../components/SharedIcon.vue';
import { getCurrentBusinessMonth } from '../../features/calendar/calendar-logic.js';
import EventFilters from '../../features/events/EventFilters.vue';
import EventTimeline from '../../features/events/EventTimeline.vue';
import {
  buildEventDateGroups,
  buildEventNarrative,
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
const collapsedDates = ref<string[]>([]);
const expandedEventIds = ref<string[]>([]);

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
const eventDateGroups = computed(() => buildEventDateGroups(events.value));
const allDatesCollapsed = computed(
  () =>
    eventDateGroups.value.length > 0 &&
    eventDateGroups.value.every((group) => collapsedDates.value.includes(group.businessDate)),
);
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
  collapsedDates.value = [];
  expandedEventIds.value = [];
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
  const names = event.affectedMembershipIds
    .map((membershipId) => memberNameById.value.get(membershipId) ?? '未知成员')
    .join('、');
  return names === '' ? '未指定成员' : names;
}

function isDateCollapsed(businessDate: string): boolean {
  return collapsedDates.value.includes(businessDate);
}

function toggleDateGroup(businessDate: string): void {
  collapsedDates.value = isDateCollapsed(businessDate)
    ? collapsedDates.value.filter((date) => date !== businessDate)
    : [...collapsedDates.value, businessDate];
}

function toggleAllDates(): void {
  collapsedDates.value = allDatesCollapsed.value
    ? []
    : eventDateGroups.value.map((group) => group.businessDate);
}

function isEventExpanded(eventId: string): boolean {
  return expandedEventIds.value.includes(eventId);
}

function toggleEventDetails(eventId: string): void {
  expandedEventIds.value = isEventExpanded(eventId)
    ? expandedEventIds.value.filter((id) => id !== eventId)
    : [...expandedEventIds.value, eventId];
}

function eventTimeLabel(event: ScheduleEvent): string {
  return formatEventTime(event.occurredAt).slice(11);
}

function eventTone(event: ScheduleEvent): string {
  if (event.eventType.includes('swap')) return 'swap';
  if (event.eventType.includes('leave')) return 'leave';
  if (event.eventType.includes('adjustment')) return 'adjustment';
  if (event.eventType.includes('schedule')) return 'schedule';
  return 'neutral';
}

function eventStatusLabel(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    cancelled: '已取消',
    completed: '已完成',
    pending: '处理中',
    rejected: '已拒绝',
  };
  return labels[status] ?? status;
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
        <template #icon><SharedIcon name="filter-funnel" /></template>
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
        <header class="timeline-toolbar">
          <div>
            <strong>事件时间轴</strong>
            <span>{{ events.length }} 条事件 · {{ eventDateGroups.length }} 个日期</span>
          </div>
          <button type="button" class="fold-all-button" @click="toggleAllDates">
            {{ allDatesCollapsed ? '展开全部日期' : '折叠全部日期' }}
          </button>
        </header>
        <div class="event-timeline-page">
          <section
            v-for="dateGroup in eventDateGroups"
            :key="dateGroup.businessDate"
            class="event-date-group"
          >
            <header class="date-group-heading">
              <div>
                <strong>{{ dateGroup.label }}</strong>
                <span>{{ dateGroup.events.length }} 条</span>
              </div>
              <button
                type="button"
                class="date-fold-button"
                :aria-expanded="!isDateCollapsed(dateGroup.businessDate)"
                @click="toggleDateGroup(dateGroup.businessDate)"
              >
                {{ isDateCollapsed(dateGroup.businessDate) ? '展开' : '折叠' }}
              </button>
            </header>
            <ol v-if="!isDateCollapsed(dateGroup.businessDate)" class="event-timeline-list">
              <li v-for="event in dateGroup.events" :key="event.id" class="timeline-event">
                <time>{{ eventTimeLabel(event) }}</time>
                <span class="timeline-line" aria-hidden="true">
                  <span class="timeline-node" :class="`is-${eventTone(event)}`" />
                </span>
                <article class="timeline-event-card">
                  <header>
                    <span class="event-type-badge" :class="`is-${eventTone(event)}`">
                      {{ getEventTypeLabel(event.eventType) }}
                    </span>
                    <span class="event-status">{{ eventStatusLabel(event.eventStatus) }}</span>
                  </header>
                  <p class="event-narrative">
                    {{ buildEventNarrative(event) ?? getEventTypeLabel(event.eventType) }}
                  </p>
                  <p class="event-members">涉及：{{ affectedMemberNames(event) }}</p>
                  <div class="timeline-card-actions">
                    <button
                      type="button"
                      class="inline-detail-button"
                      :aria-expanded="isEventExpanded(event.id)"
                      @click="toggleEventDetails(event.id)"
                    >
                      {{ isEventExpanded(event.id) ? '收起详情' : '展开详情' }}
                    </button>
                    <button
                      type="button"
                      class="open-detail-button"
                      :disabled="isLoadingDetail"
                      @click="openDetail(event)"
                    >
                      {{ isLoadingDetail ? '加载中…' : '关联链' }}
                    </button>
                  </div>
                  <dl v-if="isEventExpanded(event.id)" class="inline-event-details">
                    <div>
                      <dt>原因</dt>
                      <dd>{{ event.reason ?? '未填写' }}</dd>
                    </div>
                    <div>
                      <dt>对象</dt>
                      <dd>{{ event.objectType }}</dd>
                    </div>
                    <div>
                      <dt>操作编号</dt>
                      <dd>{{ event.operationId }}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            </ol>
          </section>
        </div>
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

.timeline-toolbar {
  display: flex;
  min-height: 56px;
  padding: 8px 10px 8px 14px;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
  background: linear-gradient(110deg, var(--ui-color-primary-light), #f8fbff 74%);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-large);
}

.timeline-toolbar > div {
  display: grid;
  gap: 2px;
}

.timeline-toolbar strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
}

.timeline-toolbar span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.fold-all-button,
.date-fold-button,
.inline-detail-button,
.open-detail-button {
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.fold-all-button,
.date-fold-button,
.inline-detail-button {
  color: var(--ui-color-primary);
  background: transparent;
  border: 1px solid transparent;
}

.fold-all-button:hover,
.date-fold-button:hover,
.inline-detail-button:hover {
  background: var(--ui-color-primary-light);
}

.event-timeline-page {
  display: grid;
  gap: 12px;
}

.event-date-group {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 18px;
  box-shadow: var(--ui-shadow-card);
}

.date-group-heading {
  display: flex;
  min-height: 54px;
  padding: 5px 8px 5px 16px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fbfcfe;
  border-bottom: 1px solid var(--ui-color-border);
}

.date-group-heading > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.date-group-heading strong {
  color: var(--ui-color-text-primary);
  font-size: 15px;
}

.date-group-heading span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.event-timeline-list {
  margin: 0;
  padding: 12px 14px 14px;
  list-style: none;
}

.timeline-event {
  display: grid;
  min-width: 0;
  grid-template-columns: 48px 24px minmax(0, 1fr);
  align-items: stretch;
}

.timeline-event > time {
  padding-top: 15px;
  color: var(--ui-color-text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.timeline-line {
  position: relative;
  display: flex;
  justify-content: center;
}

.timeline-line::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: #d5dfeb;
  content: '';
  transform: translateX(-50%);
}

.timeline-event:first-child .timeline-line::before {
  top: 20px;
}

.timeline-event:last-child .timeline-line::before {
  bottom: calc(100% - 20px);
}

.timeline-node {
  position: relative;
  z-index: 1;
  width: 12px;
  height: 12px;
  margin-top: 16px;
  background: var(--ui-color-primary);
  border: 3px solid var(--ui-color-surface);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--ui-color-primary);
}

.timeline-node.is-leave {
  background: #9a6a13;
  box-shadow: 0 0 0 2px #9a6a13;
}

.timeline-node.is-adjustment {
  background: #c33d56;
  box-shadow: 0 0 0 2px #c33d56;
}

.timeline-node.is-schedule {
  background: #287d70;
  box-shadow: 0 0 0 2px #287d70;
}

.timeline-node.is-neutral {
  background: #697788;
  box-shadow: 0 0 0 2px #697788;
}

.timeline-event-card {
  display: grid;
  min-width: 0;
  margin-bottom: 10px;
  padding: 12px 13px;
  gap: 7px;
  background: #fbfdff;
  border: 1px solid #d5e3f2;
  border-radius: 14px;
}

.timeline-event-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.event-type-badge.is-leave {
  color: #7a5310;
  background: #fff5d9;
}

.event-type-badge.is-adjustment {
  color: #a12f45;
  background: #fff0f3;
}

.event-type-badge.is-schedule {
  color: #1f6a5e;
  background: #eaf8f5;
}

.event-type-badge.is-neutral {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
}

.event-status {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.event-narrative,
.event-members {
  margin: 0;
}

.event-narrative {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  line-height: 1.55;
}

.event-members {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.timeline-card-actions {
  display: flex;
  margin: 0 -4px -4px;
  justify-content: flex-end;
  gap: 4px;
}

.open-detail-button {
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
}

.open-detail-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.inline-event-details {
  display: grid;
  margin: 2px 0 0;
  padding: 9px 10px;
  gap: 6px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 10px;
}

.inline-event-details div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
}

.inline-event-details dt,
.inline-event-details dd {
  margin: 0;
  font-size: var(--ui-font-size-xs);
  overflow-wrap: anywhere;
}

.inline-event-details dt {
  color: var(--ui-color-text-muted);
}

.inline-event-details dd {
  color: var(--ui-color-text-secondary);
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

  .timeline-toolbar {
    align-items: flex-start;
  }

  .fold-all-button {
    flex: none;
  }

  .event-timeline-list {
    padding: 10px 8px 12px;
  }

  .timeline-event {
    grid-template-columns: 42px 20px minmax(0, 1fr);
  }

  .timeline-event-card {
    padding: 11px;
  }

  .timeline-card-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .inline-detail-button,
  .open-detail-button {
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
