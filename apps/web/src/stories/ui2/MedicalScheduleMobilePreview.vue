<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import Ui2Icon, { type Ui2IconName } from './Ui2Icon.vue';
import Ui2MonthCalendar from './Ui2MonthCalendar.vue';

export type Ui2PreviewScreen = 'calendar' | 'detail' | 'leave' | 'login';

const props = withDefaults(
  defineProps<{
    readonly screen?: Ui2PreviewScreen;
  }>(),
  { screen: 'calendar' },
);

const selectedDay = ref(14);
const loginMode = ref<'login' | 'register'>('login');
const leaveTab = ref<'mine' | 'review'>('mine');
const activeNav = ref(props.screen === 'leave' ? 'leave' : 'calendar');
const openSheet = ref<'filter' | 'more' | null>(null);

watch(
  () => props.screen,
  (screen) => {
    selectedDay.value = 14;
    activeNav.value = screen === 'leave' ? 'leave' : 'calendar';
    openSheet.value = null;
  },
);

const isLogin = computed(() => props.screen === 'login');
const pageTitle = computed(() => (props.screen === 'leave' ? '请假与审批' : '工作台'));

const navItems: readonly { icon: Ui2IconName; id: string; label: string }[] = [
  { id: 'calendar', label: '日历', icon: 'calendar' },
  { id: 'leave', label: '请假', icon: 'leave' },
  { id: 'swap', label: '换班', icon: 'swap' },
  { id: 'adjustment', label: '调班', icon: 'adjustment' },
  { id: 'more', label: '更多', icon: 'more' },
];

function selectNav(id: string): void {
  activeNav.value = id;
  if (id === 'more') openSheet.value = 'more';
}
</script>

<template>
  <div class="preview-stage">
    <main class="phone-preview" :class="`screen-${screen}`">
      <section v-if="isLogin" class="login-screen" aria-label="账号登录预览">
        <div class="safe-top" />
        <div class="login-content">
          <div class="brand-mark" aria-hidden="true"><span /><span /></div>
          <div class="login-copy">
            <p class="eyebrow">医护排班</p>
            <h1>清楚掌握每一次值班</h1>
            <p>登录后查看所在群组的排班、请假和班次变更。</p>
          </div>

          <div class="segmented" role="tablist" aria-label="登录或注册">
            <button
              type="button"
              role="tab"
              :aria-selected="loginMode === 'login'"
              :class="{ active: loginMode === 'login' }"
              @click="loginMode = 'login'"
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="loginMode === 'register'"
              :class="{ active: loginMode === 'register' }"
              @click="loginMode = 'register'"
            >
              注册
            </button>
          </div>

          <form class="login-card" @submit.prevent>
            <label>
              <span>账号</span>
              <span class="input-shell"
                ><Ui2Icon name="user" /><input autocomplete="username" value="D0796"
              /></span>
            </label>
            <label>
              <span>密码</span>
              <span class="input-shell"
                ><span class="password-dot">•••</span
                ><input type="password" autocomplete="current-password" value="preview-password"
              /></span>
            </label>
            <button class="primary-button" type="submit">
              {{ loginMode === 'login' ? '进入工作台' : '创建账号' }}
            </button>
          </form>

          <p class="privacy-note">账号只用于排班身份识别。联系信息仅对有权限的群组成员可见。</p>
        </div>
        <div class="home-indicator" aria-hidden="true" />
      </section>

      <template v-else>
        <header class="app-header">
          <div>
            <p class="context-label">急诊一组 · 群主</p>
            <h1>{{ pageTitle }}</h1>
          </div>
          <button class="header-action" type="button" aria-label="通知">
            <Ui2Icon name="bell" />
            <span class="notification-dot" />
          </button>
        </header>

        <div class="phone-scroll">
          <section
            v-if="screen === 'calendar' || screen === 'detail'"
            class="screen-content calendar-content"
          >
            <div class="view-toolbar">
              <div class="segmented compact" role="tablist" aria-label="日历视图">
                <button class="active" type="button" role="tab" aria-selected="true">月</button>
                <button type="button" role="tab" aria-selected="false">周</button>
                <button type="button" role="tab" aria-selected="false">列表</button>
              </div>
              <button
                class="toolbar-button"
                type="button"
                aria-label="筛选"
                @click="openSheet = 'filter'"
              >
                <Ui2Icon name="filter" />
                <span>筛选</span>
              </button>
            </div>

            <Ui2MonthCalendar :selected-day="selectedDay" @select="selectedDay = $event" />

            <section v-if="screen === 'calendar'" class="selected-summary" aria-live="polite">
              <div class="summary-date">
                <strong>8 月 {{ selectedDay }} 日</strong>
                <span>{{ selectedDay === 14 ? '今天 · 星期五' : '已选择日期' }}</span>
              </div>
              <div class="summary-person">
                <span class="shift-dot blue" />
                <span><b>早班</b> 林恩宇</span>
              </div>
              <button type="button" class="text-button">查看完整值班</button>
            </section>

            <section v-else class="duty-detail" aria-label="8 月 14 日值班详情">
              <header class="detail-heading">
                <div>
                  <p class="eyebrow">8 月 14 日 · 星期五</p>
                  <h2>值班详情</h2>
                </div>
                <span class="status-badge info">3 个班次</span>
              </header>

              <div class="duty-track">
                <article class="track-event">
                  <span class="track-node" />
                  <div class="event-time">08:00</div>
                  <div class="event-card">
                    <div>
                      <span class="status-badge blue">早班</span
                      ><span class="event-role">主治 · 急诊</span>
                    </div>
                    <strong>林恩宇</strong>
                    <div class="event-meta"><span>已确认</span><span>无变更</span></div>
                    <button class="phone-button" type="button">
                      <Ui2Icon name="phone" />拨打电话
                    </button>
                  </div>
                </article>
                <article class="track-event">
                  <span class="track-node" />
                  <div class="event-time">14:00</div>
                  <div class="event-card accented">
                    <div>
                      <span class="status-badge green">中班</span
                      ><span class="event-role">护理 · 留观</span>
                    </div>
                    <strong>陈护士</strong>
                    <div class="event-meta"><span>换班完成</span><span>由周护士转入</span></div>
                    <button class="phone-button" type="button">
                      <Ui2Icon name="phone" />拨打电话
                    </button>
                  </div>
                </article>
                <article class="track-event">
                  <span class="track-node" />
                  <div class="event-time">20:00</div>
                  <div class="event-card">
                    <div>
                      <span class="status-badge orange">晚班</span
                      ><span class="event-role">主治 · 急诊</span>
                    </div>
                    <strong>王医生</strong>
                    <div class="event-meta"><span>已确认</span><span>加班 +1</span></div>
                    <button class="phone-button" type="button">
                      <Ui2Icon name="phone" />拨打电话
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </section>

          <section v-else class="screen-content leave-content">
            <div class="segmented leave-tabs" role="tablist" aria-label="请假内容">
              <button
                type="button"
                role="tab"
                :aria-selected="leaveTab === 'mine'"
                :class="{ active: leaveTab === 'mine' }"
                @click="leaveTab = 'mine'"
              >
                我的请假
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="leaveTab === 'review'"
                :class="{ active: leaveTab === 'review' }"
                @click="leaveTab = 'review'"
              >
                待我审批 <span class="count-pill">2</span>
              </button>
            </div>

            <template v-if="leaveTab === 'mine'">
              <article class="workflow-card featured">
                <header>
                  <span class="status-badge orange">审批中</span><time>8 月 18–19 日</time>
                </header>
                <h2>事假 · 2 天</h2>
                <p>需要照顾家人，涉及 8 月 18 日中班。</p>
                <div class="workflow-meta">
                  <span>提交于今天 09:24</span><span>1 个排班冲突</span>
                </div>
                <button class="secondary-button" type="button">查看申请</button>
              </article>
              <article class="workflow-card">
                <header>
                  <span class="status-badge green">已批准</span><time>7 月 28 日</time>
                </header>
                <h2>年假 · 1 天</h2>
                <p>排班已由系统重新安排，无未解决冲突。</p>
                <div class="workflow-meta"><span>林恩宇批准</span><span>排班已更新</span></div>
              </article>
            </template>

            <template v-else>
              <article class="workflow-card featured review-card">
                <header>
                  <span class="status-badge info">待审批</span><time>8 月 22 日</time>
                </header>
                <div class="applicant">
                  <span class="avatar">陈</span>
                  <div>
                    <h2>陈护士</h2>
                    <p>病假 · 1 天</p>
                  </div>
                </div>
                <div class="conflict-note">
                  <strong>1 个排班冲突</strong><span>中班 · 留观区</span>
                </div>
                <div class="review-actions">
                  <button type="button" class="secondary-button">退回</button
                  ><button type="button" class="primary-button small">
                    <Ui2Icon name="check" />批准
                  </button>
                </div>
              </article>
              <article class="workflow-card review-card">
                <header>
                  <span class="status-badge info">待审批</span><time>8 月 26–27 日</time>
                </header>
                <div class="applicant">
                  <span class="avatar blue-avatar">王</span>
                  <div>
                    <h2>王医生</h2>
                    <p>年假 · 2 天</p>
                  </div>
                </div>
                <div class="workflow-meta"><span>无排班冲突</span><span>提交于昨天</span></div>
              </article>
            </template>

            <button class="floating-action" type="button"><Ui2Icon name="plus" />新建请假</button>
          </section>
        </div>

        <nav class="bottom-nav" aria-label="手机主导航">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            :class="{ active: activeNav === item.id }"
            :aria-current="activeNav === item.id ? 'page' : undefined"
            @click="selectNav(item.id)"
          >
            <Ui2Icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div v-if="openSheet" class="sheet-layer" @click.self="openSheet = null">
          <section
            class="bottom-sheet"
            role="dialog"
            aria-modal="true"
            :aria-label="openSheet === 'filter' ? '筛选排班' : '更多功能'"
          >
            <div class="sheet-handle" />
            <header>
              <h2>{{ openSheet === 'filter' ? '筛选排班' : '更多功能' }}</h2>
              <button type="button" aria-label="关闭" @click="openSheet = null">完成</button>
            </header>
            <template v-if="openSheet === 'filter'">
              <button class="sheet-row selected" type="button">
                <span>全部班次</span><Ui2Icon name="check" />
              </button>
              <button class="sheet-row" type="button"><span>只看我的排班</span></button>
              <button class="sheet-row" type="button"><span>只看有变更的班次</span></button>
            </template>
            <template v-else>
              <p class="sheet-group-label">排班管理</p>
              <button class="sheet-row" type="button">
                <span>成员与权限</span><Ui2Icon name="chevron-right" />
              </button>
              <button class="sheet-row" type="button">
                <span>手动排班</span><Ui2Icon name="chevron-right" />
              </button>
              <button class="sheet-row" type="button">
                <span>统计与导出</span><Ui2Icon name="chevron-right" />
              </button>
              <p class="sheet-group-label">账号</p>
              <button class="sheet-row danger" type="button"><span>退出登录</span></button>
            </template>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.preview-stage {
  --ui2-primary: #0a66d5;
  --ui2-primary-dark: #084fa6;
  --ui2-primary-tint: #eaf3ff;
  --ui2-canvas: #f4f7fb;
  --ui2-surface: #fff;
  --ui2-text-primary: #16202a;
  --ui2-text-secondary: #5e6a78;
  --ui2-border: #dce3eb;
  --ui2-success: #248a3d;
  --ui2-success-tint: #eaf8ef;
  --ui2-warning: #b86a00;
  --ui2-warning-tint: #fff4d6;
  --ui2-danger: #d92d20;
  --ui2-danger-tint: #fdecea;
  --ui2-radius-sm: 10px;
  --ui2-radius-md: 14px;
  --ui2-radius-lg: 18px;
  --ui2-shadow-card: 0 8px 24px rgb(22 32 42 / 7%);
  display: grid;
  min-height: 100vh;
  padding: 28px;
  place-items: center;
  color: var(--ui2-text-primary);
  background:
    radial-gradient(circle at 50% 0%, rgb(10 102 213 / 9%), transparent 38%), var(--ui2-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.phone-preview {
  position: relative;
  display: flex;
  width: min(390px, 100%);
  height: 844px;
  overflow: hidden;
  flex-direction: column;
  background: var(--ui2-canvas);
  border: 1px solid rgb(22 32 42 / 10%);
  border-radius: 32px;
  box-shadow: 0 24px 80px rgb(22 32 42 / 18%);
}

button,
input {
  font: inherit;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(10 102 213 / 28%);
  outline-offset: 2px;
}

.safe-top {
  height: max(18px, env(safe-area-inset-top));
  flex: 0 0 auto;
}

.login-screen {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  background:
    radial-gradient(circle at 86% 10%, rgb(10 102 213 / 12%), transparent 28%), var(--ui2-canvas);
}

.login-content {
  display: flex;
  padding: 32px 24px 20px;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.brand-mark {
  position: relative;
  width: 52px;
  height: 52px;
  margin-bottom: 24px;
  background: var(--ui2-primary);
  border-radius: 17px;
  box-shadow: 0 12px 30px rgb(10 102 213 / 24%);
}

.brand-mark span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 25px;
  height: 7px;
  background: #fff;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}

.brand-mark span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.eyebrow,
.context-label,
.sheet-group-label {
  margin: 0;
  color: var(--ui2-primary);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.1px;
}

.login-copy h1 {
  max-width: 310px;
  margin: 6px 0 10px;
  font-size: 28px;
  line-height: 1.18;
  letter-spacing: -0.7px;
}

.login-copy > p:last-child {
  max-width: 330px;
  margin: 0;
  color: var(--ui2-text-secondary);
  font-size: 15px;
  line-height: 1.55;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 3px;
  background: #e8edf3;
  border-radius: var(--ui2-radius-md);
}

.login-content > .segmented {
  margin: 30px 0 14px;
}

.segmented button {
  min-height: 44px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.segmented button.active {
  color: var(--ui2-text-primary);
  background: #fff;
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}

.login-card {
  display: grid;
  gap: 16px;
  padding: 20px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.login-card label {
  display: grid;
  gap: 7px;
  color: var(--ui2-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.input-shell {
  display: grid;
  min-height: 50px;
  padding: 0 14px;
  grid-template-columns: 24px 1fr;
  align-items: center;
  gap: 8px;
  color: var(--ui2-text-secondary);
  background: #f8fafc;
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-md);
}

.input-shell:focus-within {
  background: #fff;
  border-color: var(--ui2-primary);
  box-shadow: 0 0 0 3px rgb(10 102 213 / 12%);
}

.input-shell input {
  min-width: 0;
  height: 48px;
  color: var(--ui2-text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 15px;
}

.password-dot {
  color: var(--ui2-primary);
  font-weight: 800;
  letter-spacing: 1px;
}

.primary-button,
.secondary-button,
.phone-button,
.toolbar-button,
.text-button,
.floating-action {
  min-height: 44px;
  border-radius: var(--ui2-radius-md);
  font-weight: 650;
  cursor: pointer;
}

.primary-button {
  display: inline-flex;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fff;
  background: var(--ui2-primary);
  border: 0;
  box-shadow: 0 8px 20px rgb(10 102 213 / 22%);
}

.primary-button:active {
  background: var(--ui2-primary-dark);
}

.primary-button.small {
  min-height: 44px;
}

.privacy-note {
  margin: 15px 8px 0;
  color: var(--ui2-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.home-indicator {
  width: 128px;
  height: 5px;
  margin: 8px auto max(8px, env(safe-area-inset-bottom));
  background: #16202a;
  border-radius: 999px;
  opacity: 0.8;
}

.app-header {
  display: flex;
  min-height: calc(68px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 16px 10px;
  align-items: flex-end;
  justify-content: space-between;
  background: rgb(255 255 255 / 94%);
  border-bottom: 1px solid var(--ui2-border);
  backdrop-filter: blur(20px);
}

.app-header h1 {
  margin: 2px 0 0;
  font-size: 20px;
  line-height: 1.25;
  letter-spacing: -0.25px;
}

.context-label {
  color: var(--ui2-text-secondary);
  font-size: 11px;
  font-weight: 550;
}

.header-action {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui2-text-primary);
  background: var(--ui2-canvas);
  border: 0;
  border-radius: 15px;
  cursor: pointer;
}

.notification-dot {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 8px;
  height: 8px;
  background: var(--ui2-danger);
  border: 2px solid #fff;
  border-radius: 50%;
}

.phone-scroll {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
  overscroll-behavior: contain;
}

.screen-content {
  display: grid;
  gap: 14px;
  padding: 14px 12px 28px;
}

.view-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.segmented.compact {
  grid-template-columns: repeat(3, 1fr);
}

.segmented.compact button {
  min-height: 44px;
}

.toolbar-button {
  display: inline-flex;
  padding: 0 12px;
  align-items: center;
  gap: 5px;
  color: var(--ui2-primary);
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  font-size: 13px;
}

.selected-summary {
  display: grid;
  min-height: 78px;
  padding: 14px;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px 12px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.summary-date,
.summary-person {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}

.summary-date {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.summary-date strong {
  font-size: 15px;
}

.summary-date span,
.event-meta,
.workflow-meta {
  color: var(--ui2-text-secondary);
}

.summary-person {
  grid-column: 1;
}

.shift-dot {
  width: 9px;
  height: 9px;
  background: var(--ui2-primary);
  border-radius: 50%;
}

.text-button {
  grid-row: 1 / span 2;
  grid-column: 2;
  padding-inline: 10px;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border: 0;
  font-size: 13px;
}

.duty-detail {
  padding: 2px 2px 0;
}

.detail-heading {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.detail-heading h2 {
  margin: 4px 0 0;
  font-size: 20px;
  letter-spacing: -0.2px;
}

.status-badge {
  display: inline-flex;
  min-height: 24px;
  padding: 3px 9px;
  align-items: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.status-badge.info,
.status-badge.blue {
  color: #075bbd;
  background: var(--ui2-primary-tint);
}

.status-badge.green {
  color: var(--ui2-success);
  background: var(--ui2-success-tint);
}

.status-badge.orange {
  color: var(--ui2-warning);
  background: var(--ui2-warning-tint);
}

.duty-track {
  position: relative;
  display: grid;
  gap: 16px;
}

.duty-track::before {
  position: absolute;
  top: 15px;
  bottom: 15px;
  left: 42px;
  width: 3px;
  content: '';
  background: linear-gradient(var(--ui2-primary), #8bbdf5);
  border-radius: 999px;
}

.track-event {
  position: relative;
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  align-items: start;
}

.track-node {
  position: absolute;
  top: 14px;
  left: 37px;
  z-index: 1;
  width: 13px;
  height: 13px;
  background: #fff;
  border: 3px solid var(--ui2-primary);
  border-radius: 50%;
}

.event-time {
  padding-top: 12px;
  color: var(--ui2-text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.event-card {
  display: grid;
  gap: 9px;
  padding: 14px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.event-card.accented {
  background: linear-gradient(145deg, #fff, #f4f9ff);
  border-color: #bfdcff;
}

.event-card > div:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}

.event-card > strong {
  font-size: 17px;
}

.event-role,
.event-meta,
.workflow-meta {
  font-size: 12px;
}

.event-meta,
.workflow-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.phone-button {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border: 0;
  font-size: 13px;
}

.leave-content {
  gap: 12px;
}

.leave-tabs {
  margin-bottom: 2px;
}

.count-pill {
  display: inline-grid;
  min-width: 19px;
  height: 19px;
  margin-left: 3px;
  place-items: center;
  color: #fff;
  background: var(--ui2-primary);
  border-radius: 999px;
  font-size: 10px;
}

.workflow-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.workflow-card.featured {
  border-color: #bfdcff;
  box-shadow:
    var(--ui2-shadow-card),
    inset 3px 0 var(--ui2-primary);
}

.workflow-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.workflow-card time {
  color: var(--ui2-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.workflow-card h2,
.applicant h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.15px;
}

.workflow-card > p,
.applicant p {
  margin: 0;
  color: var(--ui2-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.secondary-button {
  color: var(--ui2-primary);
  background: #fff;
  border: 1px solid #b9d5f7;
  font-size: 13px;
}

.applicant {
  display: flex;
  align-items: center;
  gap: 11px;
}

.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: #1f7134;
  background: var(--ui2-success-tint);
  border-radius: 15px;
  font-weight: 750;
}

.avatar.blue-avatar {
  color: #075bbd;
  background: var(--ui2-primary-tint);
}

.conflict-note {
  display: flex;
  min-height: 48px;
  padding: 9px 12px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  color: var(--ui2-warning);
  background: var(--ui2-warning-tint);
  border-radius: var(--ui2-radius-sm);
  font-size: 12px;
}

.review-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 9px;
}

.floating-action {
  position: sticky;
  bottom: 10px;
  display: inline-flex;
  width: 100%;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fff;
  background: var(--ui2-primary);
  border: 0;
  box-shadow: 0 12px 28px rgb(10 102 213 / 28%);
}

.bottom-nav {
  display: grid;
  min-height: calc(70px + env(safe-area-inset-bottom));
  padding: 5px 3px calc(5px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(5, 1fr);
  background: rgb(255 255 255 / 96%);
  border-top: 1px solid var(--ui2-border);
  backdrop-filter: blur(20px);
}

.bottom-nav button {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 56px;
  padding: 5px 2px 3px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 13px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.bottom-nav button.active {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
}

.bottom-nav :deep(.ui2-icon) {
  width: 23px;
  height: 23px;
}

.sheet-layer {
  position: absolute;
  z-index: 20;
  display: flex;
  inset: 0;
  align-items: flex-end;
  background: rgb(22 32 42 / 32%);
  backdrop-filter: blur(2px);
}

.bottom-sheet {
  width: 100%;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--ui2-surface);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -12px 36px rgb(22 32 42 / 16%);
}

.sheet-handle {
  width: 38px;
  height: 5px;
  margin: 0 auto 8px;
  background: #c5cdd6;
  border-radius: 999px;
}

.bottom-sheet header {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
}

.bottom-sheet h2 {
  margin: 0;
  font-size: 20px;
}

.bottom-sheet header button {
  min-width: 52px;
  min-height: 44px;
  color: var(--ui2-primary);
  background: transparent;
  border: 0;
  font-weight: 650;
}

.sheet-row {
  display: flex;
  width: 100%;
  min-height: 50px;
  padding: 0 4px;
  align-items: center;
  justify-content: space-between;
  color: var(--ui2-text-primary);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--ui2-border);
  text-align: left;
}

.sheet-row.selected {
  color: var(--ui2-primary);
  font-weight: 650;
}

.sheet-row.danger {
  color: var(--ui2-danger);
}

.sheet-group-label {
  padding: 14px 4px 4px;
  color: var(--ui2-text-secondary);
  font-size: 11px;
  text-transform: uppercase;
}

@media (max-width: 420px) {
  .preview-stage {
    min-height: 100dvh;
    padding: 0;
    place-items: stretch;
    background: var(--ui2-canvas);
  }

  .phone-preview {
    width: 100%;
    height: 100dvh;
    min-height: 720px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}

@media (max-width: 340px) {
  .screen-content {
    padding-inline: 12px;
  }

  .toolbar-button span {
    display: none;
  }

  .toolbar-button {
    width: 44px;
    padding: 0;
    justify-content: center;
  }

  .selected-summary {
    grid-template-columns: 1fr;
  }

  .text-button {
    grid-row: auto;
    grid-column: 1;
  }

  .login-content {
    padding-inline: 18px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .primary-button,
  .secondary-button,
  .toolbar-button,
  .bottom-nav button,
  .floating-action,
  .segmented button {
    transition:
      color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  button:active {
    transform: scale(0.975);
  }

  .bottom-sheet {
    animation: sheet-in 180ms ease-out;
  }
}

@keyframes sheet-in {
  from {
    transform: translateY(18px);
    opacity: 0;
  }
}
</style>
