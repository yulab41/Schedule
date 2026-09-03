<script setup lang="ts">
import type { CalendarDutyAssignment, GroupSummary, UserProfile } from '@schedule/contracts';
import {
  buildMyProfileOverview,
  emptyMyProfileOverview,
  type MyProfileOverview,
} from '@schedule/presentation-core';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  addBusinessMonths,
  formatShiftTimeRange,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';
import { formatSelectedDateLabel } from '../../features/calendar/selected-date-duty.js';
import SharedIcon from '../../components/SharedIcon.vue';
import { useSessionStore } from '../../stores/session.js';
import { toUserMessage } from '../../utils/user-message.js';
import type { WorkbenchTabId } from '../../features/layout/workbench-nav.js';
const props = defineProps<{
  readonly group: GroupSummary;
  readonly overview?: MyProfileOverview<CalendarDutyAssignment>;
  readonly profile?: UserProfile;
}>();

const emit = defineEmits<{
  (event: 'change-password'): void;
  (event: 'navigate', tabId: WorkbenchTabId): void;
  (event: 'sign-out'): void;
}>();

const session = props.profile === undefined ? useSessionStore() : undefined;
const api = createApiClient({ auth: localAuth });
const loadedOverview =
  ref<MyProfileOverview<CalendarDutyAssignment>>(emptyMyProfileOverview<CalendarDutyAssignment>());
const overviewError = ref<string>();
const overviewLoading = ref(false);
let overviewRequestId = 0;
const profileName = computed(
  () => props.profile?.realName ?? session?.profile?.realName ?? '未完善资料',
);
const profileInitial = computed(() => profileName.value.slice(0, 1));
const overview = computed(() => props.overview ?? loadedOverview.value);
const overviewYear = getCurrentBusinessMonth().slice(0, 4);
const trendMaximum = computed(() =>
  Math.max(1, ...overview.value.trend.map((point) => point.count)),
);
const monthDeltaLabel = computed(() => {
  const delta = overview.value.monthDelta;
  if (delta === undefined) return '暂无上月对比';
  if (delta === 0) return '与上月持平';
  return `较上月 ${delta > 0 ? '+' : ''}${delta} 次`;
});
const nextDutyDateLabel = computed(() =>
  overview.value.nextDuty === undefined
    ? undefined
    : formatSelectedDateLabel(overview.value.nextDuty.businessDate),
);
const nextDutyTimeLabel = computed(() =>
  overview.value.nextDuty === undefined ? undefined : formatShiftTimeRange(overview.value.nextDuty),
);
const roleLabel = computed(() => {
  if (props.group.isDeveloperAdmin) return '平台管理员';
  if (props.group.role === 'owner') return '群主';
  if (props.group.role === 'administrator') return '管理员';
  if (props.group.role === 'guest') return '访客';
  return '成员';
});

watch(
  () => [props.group.id, props.overview] as const,
  () => {
    void loadOverview();
  },
  { immediate: true },
);

async function loadOverview(): Promise<void> {
  const requestId = ++overviewRequestId;
  overviewError.value = undefined;
  if (props.overview !== undefined || props.group.role === 'guest') {
    loadedOverview.value = emptyMyProfileOverview<CalendarDutyAssignment>();
    overviewLoading.value = false;
    return;
  }

  overviewLoading.value = true;
  const businessMonth = getCurrentBusinessMonth();
  const nextBusinessMonth = addBusinessMonths(businessMonth, 1);
  const year = Number(businessMonth.slice(0, 4));

  try {
    const members = await api.listGroupMembers(props.group.id);
    if (requestId !== overviewRequestId) return;
    const [contacts, monthStatistics, yearStatistics, currentCalendar, nextCalendar] =
      await Promise.allSettled([
        api.listGroupContacts(props.group.id),
        api.getMonthStatistics(props.group.id, businessMonth),
        api.getYearStatistics(props.group.id, year),
        api.getCalendar(props.group.id, businessMonth),
        api.getCalendar(props.group.id, nextBusinessMonth),
      ]);
    if (requestId !== overviewRequestId) return;
    loadedOverview.value = buildMyProfileOverview({
      businessDate: getBusinessDate(),
      businessMonth,
      calendars: [currentCalendar, nextCalendar].flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      ),
      contacts: contacts.status === 'fulfilled' ? contacts.value : [],
      members,
      ...(monthStatistics.status === 'fulfilled' ? { monthStatistics: monthStatistics.value } : {}),
      ...(yearStatistics.status === 'fulfilled' ? { yearStatistics: yearStatistics.value } : {}),
    });
    if (monthStatistics.status === 'rejected' && yearStatistics.status === 'rejected') {
      overviewError.value = toUserMessage(
        monthStatistics.reason,
        '个人统计暂时无法加载，请稍后重试。',
      );
    }
  } catch (error) {
    if (requestId !== overviewRequestId) return;
    loadedOverview.value = emptyMyProfileOverview<CalendarDutyAssignment>();
    overviewError.value = toUserMessage(error, '个人值班数据暂时无法加载，请稍后重试。');
  } finally {
    if (requestId === overviewRequestId) overviewLoading.value = false;
  }
}

function getTrendBarStyle(count: number): Readonly<Record<string, string>> {
  const percentage = Math.max(14, Math.round((count / trendMaximum.value) * 100));
  return { height: `${percentage}%` };
}

function navigate(tabId: WorkbenchTabId): void {
  emit('navigate', tabId);
}
</script>

<template>
  <main class="my-profile-view" aria-labelledby="my-profile-title">
    <header class="profile-heading">
      <div>
        <p class="profile-eyebrow">个人中心</p>
        <h2 id="my-profile-title">我的</h2>
        <p class="profile-heading-copy">账户、值班与安全设置</p>
      </div>
      <div class="profile-heading-avatar" aria-hidden="true">{{ profileInitial }}</div>
    </header>

    <section class="profile-identity-card" aria-labelledby="profile-identity-title">
      <div class="profile-avatar" aria-hidden="true">{{ profileInitial }}</div>
      <div class="profile-identity-copy">
        <div class="profile-name-row">
          <h3 id="profile-identity-title">{{ profileName }}</h3>
          <span class="profile-verified"><span aria-hidden="true">✓</span> 已验证</span>
        </div>
        <p>{{ roleLabel }} <span aria-hidden="true">·</span> {{ props.group.name }}</p>
        <small>当前登录状态正常</small>
      </div>
      <span class="profile-status"><i aria-hidden="true" />正常</span>
    </section>

    <template v-if="props.group.role !== 'guest'">
      <section class="profile-stats-card" aria-labelledby="profile-stats-title">
        <div class="profile-card-heading">
          <div>
            <p class="profile-eyebrow">个人数据</p>
            <h3 id="profile-stats-title">值班概览</h3>
          </div>
          <button type="button" class="profile-inline-action" @click="navigate('statistics')">
            查看完整统计 <SharedIcon class="profile-inline-chevron" name="chevron-right" />
          </button>
        </div>
        <div v-if="overviewLoading" class="profile-overview-state" aria-live="polite">
          正在汇总个人值班数据…
        </div>
        <div v-else-if="overviewError !== undefined" class="profile-overview-state is-error">
          <span>{{ overviewError }}</span>
          <button type="button" @click="loadOverview">重新加载</button>
        </div>
        <div v-else class="profile-stat-list">
          <article class="profile-stat is-primary">
            <span>本月值班</span>
            <strong>{{ overview.monthCount ?? '—' }}<small>次</small></strong>
            <em :class="{ 'is-positive': (overview.monthDelta ?? 0) > 0 }">
              {{ monthDeltaLabel }}
            </em>
          </article>
          <article class="profile-stat">
            <span>年度累计</span>
            <strong>{{ overview.yearCount ?? '—' }}<small>次</small></strong>
            <em>{{ overviewYear }} 年个人值班</em>
          </article>
          <article class="profile-stat">
            <span>特殊日期</span>
            <strong>{{ overview.specialDateCount ?? '—' }}<small>次</small></strong>
            <em>本月周末与节假日班次</em>
          </article>
        </div>
      </section>

      <div class="profile-insights-grid">
        <section class="profile-pulse-card" aria-labelledby="profile-pulse-title">
          <div class="profile-card-heading">
            <div>
              <p class="profile-eyebrow">DUTY PULSE</p>
              <h3 id="profile-pulse-title">值班节奏</h3>
            </div>
            <span class="profile-period-label">近四月</span>
          </div>
          <div v-if="overview.trend.length > 0" class="profile-pulse-chart">
            <div
              v-for="(point, index) in overview.trend"
              :key="point.businessMonth"
              class="profile-pulse-column"
            >
              <span>{{ point.count }}</span>
              <i
                :class="{ 'is-current': index === overview.trend.length - 1 }"
                :style="getTrendBarStyle(point.count)"
                aria-hidden="true"
              />
              <small>{{ point.label }}</small>
            </div>
          </div>
          <div v-else class="profile-empty-insight">还没有可展示的个人统计趋势</div>
        </section>

        <section class="profile-next-duty" aria-labelledby="profile-next-duty-title">
          <div class="profile-next-duty-heading">
            <div>
              <p class="profile-eyebrow">下一班</p>
              <h3 id="profile-next-duty-title">
                {{ nextDutyDateLabel ?? '暂无待值班次' }}
              </h3>
            </div>
            <span v-if="overview.nextDuty !== undefined" class="profile-shift-badge">
              {{ overview.nextDuty.shiftTypeName }}
            </span>
          </div>
          <template v-if="overview.nextDuty !== undefined">
            <strong class="profile-duty-time">{{ nextDutyTimeLabel }}</strong>
            <p class="profile-duty-role">
              {{ overview.nextDuty.scheduleRoleName }}
              <span aria-hidden="true">·</span>
              {{ props.group.name }}
            </p>
            <button type="button" class="profile-duty-link" @click="navigate('calendar')">
              打开排班日历 <SharedIcon class="profile-inline-chevron" name="chevron-right" />
            </button>
          </template>
          <p v-else class="profile-duty-empty">当前月份与下个月没有查询到你的待值班次。</p>
        </section>
      </div>
    </template>

    <div class="profile-grid">
      <section class="profile-card" aria-labelledby="profile-account-title">
        <div class="profile-card-heading">
          <div>
            <p class="profile-eyebrow">账号与安全</p>
            <h3 id="profile-account-title">账户设置</h3>
          </div>
          <span class="profile-private-note">仅自己可见</span>
        </div>
        <dl class="profile-details">
          <div>
            <dt>姓名</dt>
            <dd>{{ profileName }}</dd>
          </div>
          <div>
            <dt>当前群组</dt>
            <dd>{{ props.group.name }}</dd>
          </div>
          <div>
            <dt>群组身份</dt>
            <dd>{{ roleLabel }}</dd>
          </div>
          <div v-if="overview.mobilePhone !== undefined">
            <dt>手机号</dt>
            <dd>{{ overview.mobilePhone }}</dd>
          </div>
          <div v-if="overview.shortPhone !== undefined">
            <dt>短号</dt>
            <dd>{{ overview.shortPhone }}</dd>
          </div>
          <div>
            <dt>登录状态</dt>
            <dd class="profile-detail-status"><i aria-hidden="true" />已验证</dd>
          </div>
          <div>
            <dt>登录密码</dt>
            <dd>
              <button
                type="button"
                class="profile-password-action"
                @click="emit('change-password')"
              >
                修改登录密码
              </button>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <div class="profile-actions">
      <button type="button" class="profile-sign-out" @click="emit('sign-out')">
        <SharedIcon name="logout" />
        退出登录
      </button>
      <p>登录状态只保存在当前设备，退出后需要重新验证。</p>
    </div>
  </main>
</template>

<style scoped>
.my-profile-view {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-lg);
  color: var(--ui-color-text-primary);
}

.profile-heading,
.profile-identity-card,
.profile-card-heading,
.profile-next-duty-heading,
.profile-name-row,
.profile-status,
.profile-actions {
  display: flex;
  align-items: center;
}

.profile-heading {
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.profile-eyebrow {
  margin: 0 0 4px;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-heading h2,
.profile-card h3,
.profile-stats-card h3,
.profile-pulse-card h3,
.profile-next-duty h3,
.profile-identity-copy h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
  letter-spacing: -0.02em;
}

.profile-heading h2 {
  font-size: clamp(28px, 4vw, 36px);
  line-height: 1.1;
}

.profile-heading-copy {
  margin: 7px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-heading-avatar,
.profile-avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--ui-color-white);
  background: linear-gradient(145deg, #2d88e4, #0a66d5);
  font-weight: var(--ui-font-weight-bold);
}

.profile-heading-avatar {
  width: 46px;
  height: 46px;
  border: 4px solid var(--ui-color-primary-light);
  border-radius: 50%;
  box-shadow: 0 6px 18px rgb(10 102 213 / 18%);
}

.profile-identity-card,
.profile-card,
.profile-stats-card,
.profile-pulse-card,
.profile-next-duty {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.profile-identity-card {
  padding: clamp(18px, 3vw, 26px);
  gap: 14px;
}

.profile-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  font-size: 24px;
}

.profile-identity-copy {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  flex-wrap: wrap;
  gap: 8px;
}

.profile-identity-copy h3 {
  font-size: 20px;
}

.profile-identity-copy p,
.profile-identity-copy small {
  display: block;
  margin: 4px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-identity-copy small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.profile-verified,
.profile-status,
.profile-private-note {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.profile-verified {
  padding: 4px 8px;
  background: var(--ui-color-primary-light);
  border-radius: 999px;
}

.profile-status {
  flex: 0 0 auto;
  align-self: flex-start;
  gap: 5px;
}

.profile-status i,
.profile-detail-status i {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #19724a;
  border-radius: 50%;
}

.profile-stats-card,
.profile-pulse-card,
.profile-next-duty {
  min-width: 0;
  padding: 20px;
}

.profile-stats-card {
  overflow: hidden;
  background:
    radial-gradient(circle at 88% -30%, rgb(10 102 213 / 11%), transparent 230px),
    var(--ui-color-surface);
}

.profile-inline-action,
.profile-duty-link,
.profile-overview-state button {
  min-height: var(--ui-touch-target-minimum);
  padding: 0;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.profile-inline-action span,
.profile-duty-link span {
  margin-left: 4px;
  font-size: 18px;
  font-weight: var(--ui-font-weight-regular);
}

.profile-inline-chevron {
  width: 18px;
  height: 18px;
  margin-left: 4px;
  vertical-align: middle;
}

.profile-inline-action:focus-visible,
.profile-duty-link:focus-visible,
.profile-overview-state button:focus-visible {
  outline: 3px solid var(--ui-color-primary-light);
  outline-offset: 3px;
}

.profile-overview-state {
  display: flex;
  min-height: 118px;
  align-items: center;
  justify-content: center;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.profile-overview-state.is-error {
  flex-direction: column;
  gap: 5px;
  color: var(--ui-color-danger);
  text-align: center;
}

.profile-stat-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.profile-stat {
  display: flex;
  min-height: 112px;
  padding: 14px;
  flex-direction: column;
  justify-content: space-between;
  color: var(--ui-color-text-primary);
  background: color-mix(in srgb, var(--ui-color-background) 70%, white);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.profile-stat.is-primary {
  color: var(--ui-color-white);
  background: linear-gradient(145deg, #0c6dd7, #0753aa);
  border-color: transparent;
  box-shadow: 0 12px 26px rgb(10 102 213 / 20%);
}

.profile-stat > span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.profile-stat.is-primary > span,
.profile-stat.is-primary em {
  color: rgb(255 255 255 / 76%);
}

.profile-stat strong {
  margin: 5px 0;
  font-size: clamp(27px, 4vw, 34px);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.05em;
  line-height: 1;
}

.profile-stat strong small {
  margin-left: 4px;
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  letter-spacing: 0;
}

.profile-stat em {
  color: var(--ui-color-text-secondary);
  font-size: 10px;
  font-style: normal;
  line-height: 1.35;
}

.profile-stat em.is-positive {
  color: #bcebd9;
}

.profile-insights-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: var(--ui-spacing-lg);
}

.profile-period-label {
  padding: 4px 8px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-background);
  border-radius: 999px;
  font-size: 10px;
  font-weight: var(--ui-font-weight-semibold);
}

.profile-pulse-chart {
  display: grid;
  height: 154px;
  padding: 12px 4px 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  gap: 12px;
  background:
    linear-gradient(var(--ui-color-border), var(--ui-color-border)) 0 35% / 100% 1px no-repeat,
    linear-gradient(var(--ui-color-border), var(--ui-color-border)) 0 70% / 100% 1px no-repeat;
}

.profile-pulse-column {
  display: grid;
  height: 100%;
  grid-template-rows: 18px minmax(0, 1fr) 18px;
  justify-items: center;
  gap: 4px;
}

.profile-pulse-column > span,
.profile-pulse-column > small {
  color: var(--ui-color-text-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.profile-pulse-column > i {
  width: min(30px, 70%);
  max-height: 100%;
  align-self: end;
  background: #c9d6e4;
  border-radius: 8px 8px 4px 4px;
}

.profile-pulse-column > i.is-current {
  background: linear-gradient(180deg, #2f8ce9, #0a66d5);
  box-shadow: 0 7px 14px rgb(10 102 213 / 18%);
}

.profile-empty-insight {
  display: grid;
  min-height: 154px;
  place-items: center;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: center;
}

.profile-next-duty {
  display: flex;
  overflow: hidden;
  min-height: 228px;
  flex-direction: column;
  color: #f7fbff;
  background:
    radial-gradient(circle at 100% 0%, rgb(67 153 241 / 32%), transparent 210px),
    linear-gradient(145deg, #183552, #10263e);
  border-color: #244361;
  box-shadow: 0 15px 34px rgb(16 38 62 / 18%);
}

.profile-next-duty-heading {
  justify-content: space-between;
  gap: 12px;
}

.profile-next-duty .profile-eyebrow {
  color: #7ab7f1;
}

.profile-next-duty h3 {
  color: #f7fbff;
  font-size: 17px;
}

.profile-shift-badge {
  padding: 5px 8px;
  color: #d3e9ff;
  background: rgb(255 255 255 / 10%);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  font-size: 10px;
  font-weight: var(--ui-font-weight-semibold);
}

.profile-duty-time {
  margin-top: 28px;
  color: var(--ui-color-white);
  font-size: 25px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}

.profile-duty-role,
.profile-duty-empty {
  margin: 12px 0 0;
  color: #b8cbe0;
  font-size: var(--ui-font-size-xs);
  line-height: 1.6;
}

.profile-duty-role span {
  padding: 0 5px;
  color: #66829f;
}

.profile-duty-link {
  margin-top: auto;
  align-self: flex-start;
  color: #9dceff;
}

.profile-duty-empty {
  margin: auto 0;
  text-align: center;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-spacing-lg);
}

.profile-card {
  min-width: 0;
  padding: 20px;
}

.profile-card-heading {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.profile-card h3 {
  font-size: 18px;
}

.profile-private-note {
  color: var(--ui-color-text-muted);
  font-weight: var(--ui-font-weight-regular);
}

.profile-sign-out:focus-visible,
.profile-password-action:focus-visible {
  outline: 3px solid var(--ui-color-primary-light);
  outline-offset: 2px;
}

.profile-details {
  display: grid;
  margin: 0;
  gap: 0;
}

.profile-details > div {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--ui-color-border);
}

.profile-details > div:last-child {
  border-bottom: 0;
}

.profile-details dt {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-details dd {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  text-align: right;
}

.profile-detail-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #19724a !important;
}

.profile-password-action {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 12px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.profile-password-action:hover {
  border-color: var(--ui-color-primary);
}

.profile-actions {
  flex-direction: column;
  gap: 8px;
}

.profile-sign-out {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
  font: inherit;
  font-weight: var(--ui-font-weight-semibold);
}

.profile-sign-out svg {
  width: 18px;
  height: 18px;
}

.profile-actions p {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  text-align: center;
}

@media (max-width: 760px) {
  .profile-grid,
  .profile-insights-grid {
    grid-template-columns: 1fr;
    gap: var(--ui-spacing-md);
  }

  .profile-card,
  .profile-stats-card,
  .profile-pulse-card,
  .profile-next-duty {
    padding: 16px;
  }

  .profile-next-duty {
    min-height: 210px;
  }
}

@media (max-width: 420px) {
  .profile-identity-card {
    align-items: flex-start;
  }

  .profile-status {
    font-size: 0;
  }

  .profile-status i {
    width: 9px;
    height: 9px;
  }

  .profile-stat-list {
    gap: 7px;
  }

  .profile-stat {
    min-height: 104px;
    padding: 12px 9px;
  }

  .profile-stat strong {
    font-size: 25px;
  }

  .profile-inline-action {
    max-width: 94px;
    line-height: 1.4;
    text-align: right;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-pulse-column > i {
    transition: none;
  }
}
</style>
