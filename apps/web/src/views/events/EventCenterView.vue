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
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { getCurrentBusinessMonth } from '../../features/calendar/calendar-logic.js';
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
    <h2>事件中心</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="event-filters">
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
            <tr v-for="event in events" :key="event.id">
              <td>{{ formatEventTime(event.occurredAt) }}</td>
              <td>{{ getEventTypeLabel(event.eventType) }}</td>
              <td>{{ affectedMemberNames(event) }}</td>
              <td>{{ event.reason ?? '—' }}</td>
              <td>
                <t-button variant="outline" :loading="isLoadingDetail" @click="openDetail(event)">
                  详情
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

    <t-dialog
      v-model:visible="detailVisible"
      header="事件详情与关联链"
      :footer="false"
      width="640px"
    >
      <template v-if="detail !== undefined">
        <p class="detail-meta">
          {{ formatEventTime(detail.event.occurredAt) }} ·
          {{ getEventTypeLabel(detail.event.eventType) }} · 涉及成员：{{
            affectedMemberNames(detail.event)
          }}
        </p>
        <EventTimeline :events="[detail.event, ...detail.relatedEvents]" show-raw-data />
      </template>
    </t-dialog>

    <section class="visitor-logs-section">
      <h3>访客访问记录</h3>
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
          <tr v-for="log in visitorLogs" :key="log.id">
            <td>{{ formatEventTime(log.createdAt) }}</td>
            <td>{{ log.businessMonth }}</td>
            <td>{{ log.clientIp ?? '—' }}</td>
            <td>{{ log.requestId ?? '—' }}</td>
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
  </section>
</template>

<style scoped>
.event-center-view {
  display: grid;
  gap: 12px;
}

.event-center-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.event-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
}

.filter-field {
  display: grid;
  gap: 4px;
  min-width: 170px;
  color: #374151;
  font-size: 14px;
}

.filter-field input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.event-list-section {
  display: grid;
  gap: 10px;
}

.event-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #ffffff;
}

.event-table th,
.event-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.event-table th {
  color: #374151;
  background: #f8fafc;
}

.events-empty {
  margin: 0;
  padding: 24px;
  color: #6b7280;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.detail-meta {
  margin: 0 0 12px;
  color: #374151;
  font-size: 13px;
}

.visitor-logs-section {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}

.visitor-logs-section h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.visitor-logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #ffffff;
}

.visitor-logs-table th,
.visitor-logs-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.visitor-logs-table th {
  color: #374151;
  background: #f8fafc;
}
</style>
