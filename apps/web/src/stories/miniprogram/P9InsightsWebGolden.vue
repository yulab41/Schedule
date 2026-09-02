<script setup lang="ts">
import { computed, ref } from 'vue';

type InsightsSurface = 'events' | 'export' | 'notifications' | 'statistics';
type InsightsState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

const props = withDefaults(
  defineProps<{
    readonly largeText?: boolean;
    readonly role?: 'administrator' | 'member' | 'owner';
    readonly state?: InsightsState;
    readonly surface?: InsightsSurface;
  }>(),
  { largeText: false, role: 'administrator', state: 'ready', surface: 'events' },
);

const activeSurface = ref<InsightsSurface>(props.surface);
const feedback = ref('');

const surfaceTabs = [
  { id: 'events' as const, eyebrow: '01', label: '事件时间线' },
  { id: 'statistics' as const, eyebrow: '02', label: '排班统计' },
  { id: 'notifications' as const, eyebrow: '03', label: '通知中心' },
  { id: 'export' as const, eyebrow: '04', label: '导出排班' },
];

const events = [
  {
    date: '08月25日',
    time: '18:42',
    title: '夜班排班已发布',
    actor: '王医生',
    detail: '覆盖 8 月 26 日至 9 月 1 日，共 42 个班次。',
    tone: 'blue',
  },
  {
    date: '08月25日',
    time: '16:18',
    title: '请假申请已批准',
    actor: '李护士',
    detail: '已按“顺延补位”重算 2 个受影响班次。',
    tone: 'mint',
  },
  {
    date: '08月24日',
    time: '09:07',
    title: '访客访问排班',
    actor: '访客入口',
    detail: '查看 2026 年 8 月排班，来源线索已脱敏。',
    tone: 'amber',
  },
] as const;

const statisticBars = [
  { label: '内科', value: 92, count: '46 / 50' },
  { label: '外科', value: 84, count: '38 / 45' },
  { label: '急诊', value: 76, count: '25 / 33' },
] as const;

const notifications = [
  {
    title: '排班已发布',
    body: '8 月 26 日至 9 月 1 日的排班已发布。',
    time: '刚刚',
    unread: true,
    tone: 'blue',
  },
  {
    title: '请假申请待处理',
    body: '李护士提交了 8 月 28 日的请假申请。',
    time: '16:18',
    unread: true,
    tone: 'amber',
  },
  {
    title: '换班已完成',
    body: '周医生与陈医生的换班已生效。',
    time: '昨天',
    unread: false,
    tone: 'mint',
  },
] as const;

const stateLabel = computed(() => {
  if (props.state === 'disabled') return '权限关闭';
  if (props.state === 'loading') return '读取中';
  if (props.state === 'error') return '读取失败';
  if (props.state === 'empty') return '暂无记录';
  return props.role === 'member' ? '成员视图' : '审计台';
});

const isUnavailable = computed(() => props.state !== 'ready');

function selectSurface(surface: InsightsSurface): void {
  activeSurface.value = surface;
  feedback.value = '';
}

function showFeedback(message: string): void {
  feedback.value = message;
}
</script>

<template>
  <main
    class="insights-golden"
    :class="{ 'is-large-text': largeText, 'is-unavailable': isUnavailable }"
    aria-label="P9 数据与消息黄金稿"
  >
    <header class="insights-topbar">
      <div class="brand-lockup">
        <span class="brand-cross" aria-hidden="true">+</span><span>排班台</span>
      </div>
      <span class="build-label">P9 · 数据与消息</span>
    </header>

    <section class="insights-hero" aria-labelledby="insights-title">
      <div>
        <p class="eyebrow">值班台账 / 数据脉搏</p>
        <h1 id="insights-title">把每一次变更，留在可读的轨迹里。</h1>
        <p class="hero-copy">
          事件、统计、通知与导出共享同一组排班事实；管理员看见趋势，成员只看见与自己有关的提醒。
        </p>
      </div>
      <div class="hero-badge"><span class="status-pip" aria-hidden="true" />{{ stateLabel }}</div>
    </section>

    <nav class="surface-tabs" aria-label="P9 数据工具">
      <button
        v-for="tab in surfaceTabs"
        :key="tab.id"
        class="surface-tab"
        :class="{ 'is-active': activeSurface === tab.id }"
        type="button"
        :aria-current="activeSurface === tab.id ? 'page' : undefined"
        @click="selectSurface(tab.id)"
      >
        <span class="tab-number">{{ tab.eyebrow }}</span
        ><span>{{ tab.label }}</span>
      </button>
    </nav>

    <section v-if="state === 'loading'" class="state-card loading-card" aria-busy="true">
      <div class="skeleton skeleton-wide" />
      <div class="skeleton skeleton-line" />
      <div class="skeleton skeleton-line short" />
      <div class="loading-caption">
        正在读取 {{ surfaceTabs.find((tab) => tab.id === activeSurface)?.label }}
      </div>
    </section>

    <section v-else-if="state === 'disabled'" class="state-card disabled-card">
      <span class="state-mark">—</span>
      <h2>数据工具暂未开放</h2>
      <p v-if="role === 'member'">
        当前账号只接收与本人相关的通知；统计、事件时间线和导出由管理员权限控制。
      </p>
      <p v-else>当前版本的 P9 数据能力处于关闭状态，生产环境不会读取或写入额外数据。</p>
    </section>

    <section v-else-if="state === 'error'" class="state-card error-card" role="alert">
      <span class="state-mark error">!</span>
      <h2>数据暂时无法读取</h2>
      <p>保留当前页面位置后重试，不会创建重复导出或重复通知。</p>
      <button
        type="button"
        class="primary-button"
        @click="showFeedback('已保留当前筛选，等待再次读取。')"
      >
        重新加载
      </button>
    </section>

    <section v-else-if="state === 'empty'" class="state-card empty-card">
      <span class="state-mark">○</span>
      <h2>这里还没有记录</h2>
      <p>完成一次排班发布或通知设置后，相关数据会沿着这条台账出现。</p>
    </section>

    <template v-else>
      <section
        v-if="activeSurface === 'events'"
        class="surface-card event-surface"
        aria-labelledby="events-title"
      >
        <header class="card-heading">
          <div>
            <p class="section-kicker">不可变记录 · 最近 30 天</p>
            <h2 id="events-title">事件时间线</h2>
          </div>
          <span class="card-counter">{{ events.length }} 条</span>
        </header>
        <div class="timeline">
          <article
            v-for="event in events"
            :key="`${event.date}-${event.time}`"
            class="timeline-row"
          >
            <div class="timeline-pin" :class="`tone-${event.tone}`"><span /></div>
            <div class="timeline-time">
              <strong>{{ event.time }}</strong
              ><span>{{ event.date }}</span>
            </div>
            <div class="timeline-copy">
              <h3>{{ event.title }}</h3>
              <p>{{ event.detail }}</p>
              <span class="actor-label">操作者 · {{ event.actor }}</span>
            </div>
          </article>
        </div>
        <button
          type="button"
          class="quiet-button"
          @click="showFeedback('已保留当前事件筛选，加载更多将在原生页接入。')"
        >
          加载更多事件 <span>→</span>
        </button>
      </section>

      <section
        v-else-if="activeSurface === 'statistics'"
        class="surface-card statistics-surface"
        aria-labelledby="statistics-title"
      >
        <header class="card-heading">
          <div>
            <p class="section-kicker">2026 年 8 月 · 从已发布排班汇总</p>
            <h2 id="statistics-title">排班统计</h2>
          </div>
          <span class="period-stamp">按月</span>
        </header>
        <div class="metric-grid">
          <div class="metric primary">
            <span>实际班次</span><strong>109</strong><small>计划 128 · 完成率 85%</small>
          </div>
          <div class="metric">
            <span>计值班次</span><strong>96</strong><small>扣除 13 个不计值班次</small>
          </div>
          <div class="metric"><span>缺口</span><strong>7</strong><small>需要管理员关注</small></div>
        </div>
        <div class="bar-ledger">
          <div v-for="bar in statisticBars" :key="bar.label" class="bar-row">
            <span>{{ bar.label }}</span>
            <div class="bar-track"><span :style="{ width: `${bar.value}%` }" /></div>
            <strong>{{ bar.count }}</strong>
          </div>
        </div>
        <button
          type="button"
          class="quiet-button"
          @click="showFeedback('统计快照已标记为待刷新。')"
        >
          刷新统计快照 <span>↻</span>
        </button>
      </section>

      <section
        v-else-if="activeSurface === 'notifications'"
        class="surface-card notifications-surface"
        aria-labelledby="notifications-title"
      >
        <header class="card-heading">
          <div>
            <p class="section-kicker">与当前群组和本人有关</p>
            <h2 id="notifications-title">通知中心</h2>
          </div>
          <span class="unread-count">3 未读</span>
        </header>
        <div class="notification-list">
          <article
            v-for="notification in notifications"
            :key="notification.title"
            class="notification-row"
            :class="{ 'is-unread': notification.unread }"
          >
            <span class="notification-marker" :class="`tone-${notification.tone}`" />
            <div>
              <h3>{{ notification.title }}</h3>
              <p>{{ notification.body }}</p>
            </div>
            <time>{{ notification.time }}</time>
          </article>
        </div>
        <button type="button" class="quiet-button" @click="showFeedback('已标记当前通知为已读。')">
          全部标为已读 <span>✓</span>
        </button>
      </section>

      <section v-else class="surface-card export-surface" aria-labelledby="export-title">
        <header class="card-heading">
          <div>
            <p class="section-kicker">离线文件 · 权限内生成</p>
            <h2 id="export-title">导出排班与统计</h2>
          </div>
          <span class="format-stamp">CSV / XLSX</span>
        </header>
        <div class="export-summary">
          <span>当前选择</span><strong>2026 年 8 月 · 排班与统计</strong
          ><span>已按群组权限过滤成员和岗位。</span>
        </div>
        <div class="export-options">
          <button
            type="button"
            class="option-chip is-selected"
            @click="showFeedback('已选择按月导出。')"
          >
            按月</button
          ><button type="button" class="option-chip" @click="showFeedback('已选择按年导出。')">
            按年</button
          ><button type="button" class="option-chip" @click="showFeedback('已选择统计内容。')">
            统计
          </button>
        </div>
        <div class="export-warning">
          <strong>下载安全</strong
          ><span>文件通过登录态下载，不在 URL 中携带 token；生成期间可安全离开页面。</span>
        </div>
        <button
          type="button"
          class="primary-button export-button"
          @click="showFeedback('导出任务已创建，完成后会在当前页面提供下载。')"
        >
          创建导出任务 <span>↗</span>
        </button>
      </section>
    </template>

    <p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>
    <footer class="insights-footer">
      审计数据按权限显示 · 原始事件不可变 · 访问明细最多保留 90 天
    </footer>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}
:global(body) {
  margin: 0;
  background: #edf3f7;
}
.insights-golden {
  --ink: #12324a;
  --ink-soft: #557184;
  --blue: #2f7fcc;
  --blue-deep: #1762a1;
  --paper: #fbfdfe;
  --mist: #edf3f7;
  --line: #dbe7ed;
  --mint: #dff4ec;
  --mint-ink: #18745c;
  --amber: #f8e8be;
  --amber-ink: #875d10;
  width: min(100%, 760px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 18px 32px;
  color: var(--ink);
  background: var(--mist);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}
.insights-topbar {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}
.brand-lockup {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 750;
  letter-spacing: 0.02em;
}
.brand-cross {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  color: white;
  background: var(--blue-deep);
  border-radius: 7px 7px 7px 2px;
  font-size: 18px;
  line-height: 1;
}
.build-label,
.period-stamp,
.format-stamp {
  color: var(--blue-deep);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.insights-hero {
  display: flex;
  padding: 34px 0 24px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}
.eyebrow,
.section-kicker {
  margin: 0 0 7px;
  color: var(--blue-deep);
  font-size: 11px;
  font-weight: 780;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1 {
  max-width: 600px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(30px, 5vw, 48px);
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 0.98;
}
.hero-copy {
  max-width: 540px;
  margin-top: 13px;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.65;
}
.hero-badge {
  display: inline-flex;
  min-width: 96px;
  padding: 10px 11px;
  align-items: center;
  gap: 7px;
  color: var(--blue-deep);
  background: #e3effa;
  border: 1px solid #c6def1;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 740;
  white-space: nowrap;
}
.status-pip {
  width: 7px;
  height: 7px;
  background: #36a77f;
  border-radius: 50%;
  box-shadow: 0 0 0 4px #ccebdd;
}
.surface-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 14px;
  padding: 5px;
  gap: 5px;
  background: #dfeaf0;
  border-radius: 14px;
}
.surface-tab {
  display: flex;
  min-height: 52px;
  padding: 8px 9px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  color: var(--ink-soft);
  background: transparent;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.surface-tab:hover,
.surface-tab:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}
.surface-tab.is-active {
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 4px 15px #b9cbd544;
}
.tab-number {
  color: var(--blue-deep);
  font-size: 10px;
  letter-spacing: 0.08em;
}
.surface-card,
.state-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 14px 30px #b7cbd622;
}
.surface-card {
  overflow: hidden;
}
.card-heading {
  display: flex;
  min-height: 78px;
  padding: 18px 20px 15px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--line);
}
.card-heading h2 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.03em;
}
.card-counter,
.unread-count {
  padding: 7px 9px;
  color: var(--blue-deep);
  background: #e3effa;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 760;
  white-space: nowrap;
}
.timeline {
  padding: 6px 20px 2px;
}
.timeline-row {
  display: grid;
  grid-template-columns: 17px 66px minmax(0, 1fr);
  padding: 16px 0;
  gap: 10px;
  border-bottom: 1px solid var(--line);
}
.timeline-row:last-child {
  border-bottom: 0;
}
.timeline-pin {
  position: relative;
  display: flex;
  justify-content: center;
}
.timeline-pin::after {
  position: absolute;
  top: 15px;
  bottom: -32px;
  width: 1px;
  background: var(--line);
  content: '';
}
.timeline-row:last-child .timeline-pin::after {
  display: none;
}
.timeline-pin span {
  z-index: 1;
  display: block;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border: 3px solid var(--paper);
  border-radius: 50%;
  box-shadow: 0 0 0 1px currentColor;
}
.tone-blue {
  color: var(--blue);
  background-color: #dcecf9;
}
.tone-mint {
  color: var(--mint-ink);
  background-color: var(--mint);
}
.tone-amber {
  color: var(--amber-ink);
  background-color: var(--amber);
}
.timeline-time {
  display: flex;
  padding-top: 1px;
  flex-direction: column;
  gap: 3px;
  color: var(--ink-soft);
  font-size: 11px;
}
.timeline-time strong {
  color: var(--ink);
  font-size: 13px;
}
.timeline-copy {
  min-width: 0;
}
.timeline-copy h3,
.notification-row h3 {
  font-size: 14px;
  font-weight: 760;
}
.timeline-copy p,
.notification-row p {
  margin-top: 4px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}
.actor-label {
  display: inline-block;
  margin-top: 8px;
  color: var(--blue-deep);
  font-size: 10px;
  font-weight: 700;
}
.quiet-button,
.primary-button {
  display: inline-flex;
  min-height: 44px;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  cursor: pointer;
}
.quiet-button {
  margin: 4px 20px 18px;
  color: var(--blue-deep);
  background: transparent;
  border: 1px solid var(--line);
}
.quiet-button:hover,
.quiet-button:focus-visible,
.primary-button:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 16px 20px;
  gap: 8px;
}
.metric {
  min-height: 106px;
  padding: 12px;
  background: #f0f5f7;
  border-radius: 12px;
}
.metric.primary {
  color: white;
  background: var(--blue-deep);
}
.metric span,
.metric small {
  display: block;
  color: var(--ink-soft);
  font-size: 10px;
}
.metric.primary span,
.metric.primary small {
  color: #dcecf9;
}
.metric strong {
  display: block;
  margin: 9px 0 4px;
  font-size: 28px;
  letter-spacing: -0.04em;
}
.bar-ledger {
  padding: 12px 20px 4px;
  border-top: 1px solid var(--line);
}
.bar-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 62px;
  min-height: 39px;
  align-items: center;
  gap: 10px;
  color: var(--ink-soft);
  font-size: 11px;
}
.bar-track {
  height: 8px;
  overflow: hidden;
  background: #e7eef1;
  border-radius: 999px;
}
.bar-track span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #70b9e7, var(--blue-deep));
  border-radius: inherit;
}
.bar-row strong {
  color: var(--ink);
  font-size: 11px;
  text-align: right;
}
.notification-list {
  padding: 2px 20px;
}
.notification-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  padding: 16px 0;
  align-items: start;
  gap: 11px;
  border-bottom: 1px solid var(--line);
}
.notification-row:last-child {
  border-bottom: 0;
}
.notification-marker {
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
}
.notification-row:not(.is-unread) {
  opacity: 0.64;
}
.notification-row time {
  color: var(--ink-soft);
  font-size: 10px;
  white-space: nowrap;
}
.export-summary {
  display: flex;
  padding: 20px;
  flex-direction: column;
  gap: 6px;
}
.export-summary span:first-child {
  color: var(--blue-deep);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.export-summary strong {
  font-size: 19px;
  letter-spacing: -0.025em;
}
.export-summary span:last-child {
  color: var(--ink-soft);
  font-size: 12px;
}
.export-options {
  display: flex;
  padding: 0 20px 18px;
  flex-wrap: wrap;
  gap: 8px;
}
.option-chip {
  min-height: 40px;
  padding: 0 14px;
  color: var(--ink-soft);
  background: #f0f5f7;
  border: 1px solid var(--line);
  border-radius: 9px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.option-chip.is-selected {
  color: var(--blue-deep);
  background: #e3effa;
  border-color: #a9ccea;
}
.export-warning {
  display: flex;
  margin: 0 20px 18px;
  padding: 12px;
  flex-direction: column;
  gap: 4px;
  color: var(--amber-ink);
  background: #fff8e7;
  border: 1px solid #efdb9f;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.45;
}
.primary-button {
  color: white;
  background: var(--blue-deep);
  border: 0;
}
.export-button {
  width: calc(100% - 40px);
  margin: 0 20px 20px;
}
.state-card {
  display: flex;
  min-height: 280px;
  padding: 30px 22px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.state-card h2 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 24px;
  font-weight: 500;
}
.state-card p {
  max-width: 420px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.6;
}
.state-mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--blue-deep);
  background: #e3effa;
  border-radius: 14px;
  font-size: 25px;
  font-weight: 700;
}
.state-mark.error {
  color: #9c3d37;
  background: #fbe8e5;
}
.skeleton {
  overflow: hidden;
  position: relative;
  width: 70%;
  height: 14px;
  background: #e4edf1;
  border-radius: 999px;
}
.skeleton::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, #ffffffaa, transparent);
  content: '';
  animation: shimmer 1.4s linear infinite;
}
.skeleton-wide {
  width: 52%;
  height: 38px;
  margin-bottom: 10px;
  border-radius: 10px;
}
.skeleton-line.short {
  width: 45%;
}
.loading-caption {
  margin-top: 5px;
  color: var(--ink-soft);
  font-size: 12px;
}
.feedback {
  margin: 12px 2px 0;
  padding: 10px 12px;
  color: var(--mint-ink);
  background: var(--mint);
  border-radius: 9px;
  font-size: 12px;
}
.insights-footer {
  padding: 20px 2px 0;
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}
.is-large-text {
  font-size: 118%;
}
.is-large-text .surface-tab {
  min-height: 58px;
  font-size: 13px;
}
.is-large-text .timeline-copy h3,
.is-large-text .notification-row h3 {
  font-size: 16px;
}
.is-large-text .timeline-copy p,
.is-large-text .notification-row p,
.is-large-text .hero-copy {
  font-size: 14px;
}
@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
@media (max-width: 540px) {
  .insights-golden {
    padding: 0 12px 26px;
  }
  .insights-hero {
    padding-top: 24px;
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-badge {
    align-self: flex-start;
  }
  .surface-tabs {
    grid-template-columns: repeat(2, 1fr);
  }
  .card-heading {
    padding: 16px;
  }
  .timeline,
  .bar-ledger,
  .notification-list {
    padding-right: 16px;
    padding-left: 16px;
  }
  .metric-grid {
    padding: 14px 16px;
    gap: 6px;
  }
  .metric {
    min-height: 98px;
    padding: 9px;
  }
  .metric strong {
    font-size: 23px;
  }
  .quiet-button {
    margin-right: 16px;
    margin-left: 16px;
  }
  .export-summary,
  .export-options {
    padding-right: 16px;
    padding-left: 16px;
  }
  .export-warning {
    margin-right: 16px;
    margin-left: 16px;
  }
  .export-button {
    width: calc(100% - 32px);
    margin-right: 16px;
    margin-left: 16px;
  }
}
@media (max-width: 350px) {
  .insights-golden {
    padding-right: 9px;
    padding-left: 9px;
  }
  .timeline-row {
    grid-template-columns: 15px 54px minmax(0, 1fr);
    gap: 7px;
  }
  .timeline-time strong {
    font-size: 12px;
  }
  .timeline-copy h3,
  .notification-row h3 {
    font-size: 12px;
  }
  .timeline-copy p,
  .notification-row p {
    font-size: 11px;
  }
  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }
  .metric:last-child {
    grid-column: 1 / -1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
</style>
