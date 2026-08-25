<script setup lang="ts">
import { computed, ref } from 'vue';

type VisitorAccessState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

const props = withDefaults(
  defineProps<{
    readonly largeText?: boolean;
    readonly role?: 'administrator' | 'owner' | 'member';
    readonly state?: VisitorAccessState;
  }>(),
  { largeText: false, role: 'administrator', state: 'ready' },
);

const feedback = ref('');
const selectedMonth = ref('2026-08');

const logs = [
  { createdAt: '2026-08-25 18:42', businessMonth: '2026-08', clientIp: '203.0.113.10', requestId: 'req-9a2…' },
  { createdAt: '2026-08-25 16:18', businessMonth: '2026-09', clientIp: '203.0.113.••', requestId: 'req-81c…' },
  { createdAt: '2026-08-24 09:07', businessMonth: '2026-08', clientIp: '203.0.113.••', requestId: 'req-43b…' },
] as const;

const aggregates = [
  { month: '06月', count: 4, height: 32 },
  { month: '07月', count: 8, height: 58 },
  { month: '08月', count: 12, height: 88 },
  { month: '09月', count: 6, height: 48 },
] as const;

const isBusy = computed(() => props.state === 'loading');
const visibleLogs = computed(() => (props.state === 'ready' ? logs : []));
const stateLabel = computed(() => {
  if (props.state === 'disabled') return 'insights 暂未开放';
  if (props.state === 'error') return '访问记录暂时无法加载';
  if (props.state === 'empty') return '暂无访客访问记录';
  return '只读审计';
});

function showFeedback(message: string): void {
  feedback.value = message;
}
</script>

<template>
  <main class="visitor-golden" :class="{ 'is-large-text': largeText }" aria-label="访客访问审计黄金稿">
    <header class="visitor-topbar">
      <div class="visitor-brand"><span class="brand-mark" aria-hidden="true">+</span><span>排班台</span></div>
      <span class="build-label">P9 · insights</span>
    </header>

    <section class="visitor-heading" aria-labelledby="visitor-title">
      <p class="eyebrow">审计轨 / 访客访问</p>
      <div class="heading-row">
        <div>
          <h1 id="visitor-title">谁在查看排班？</h1>
          <p>只记录访问时间、查看月份和最小化来源线索，帮助群主管理访客入口。</p>
        </div>
        <span class="capability-chip"><i aria-hidden="true" />{{ stateLabel }}</span>
      </div>
    </section>

    <section v-if="state === 'ready' || state === 'loading'" class="aggregate-card" aria-labelledby="aggregate-title">
      <header class="section-heading">
        <div><p class="section-kicker">访问脉搏</p><h2 id="aggregate-title">近四个月访问次数</h2></div>
        <span class="aggregate-total">30 次</span>
      </header>
      <div class="aggregate-chart" :aria-busy="isBusy">
        <div v-for="item in aggregates" :key="item.month" class="aggregate-column">
          <span class="aggregate-count">{{ item.count }}</span>
          <span class="aggregate-bar" :style="{ height: `${item.height}%` }" />
          <span>{{ item.month }}</span>
        </div>
      </div>
      <p class="aggregate-note">按访问月份聚合；原始访问记录保留 90 天。</p>
    </section>

    <section class="logs-card" aria-labelledby="logs-title">
      <header class="section-heading logs-heading">
        <div><p class="section-kicker">原始记录 · 90 天</p><h2 id="logs-title">最近访问</h2></div>
        <label class="month-select"><span class="sr-only">查看月份</span><select v-model="selectedMonth"><option>2026-08</option><option>2026-07</option><option>2026-06</option></select></label>
      </header>

      <div v-if="state === 'loading'" class="log-skeletons" aria-label="正在加载访问记录">
        <span v-for="n in 3" :key="n" class="log-skeleton" />
      </div>
      <div v-else-if="state === 'error'" class="state-panel state-panel--error" role="alert">
        <span class="state-icon">!</span><strong>访问记录暂时无法加载</strong><p>请检查网络后重试，当前不会写入任何访问数据。</p><button type="button" @click="showFeedback('预览状态：重新加载')">重新加载</button>
      </div>
      <div v-else-if="state === 'disabled'" class="state-panel state-panel--disabled">
        <span class="state-icon">i</span><strong>审计功能尚未开放</strong><p>当前版本只保留排班核心能力，访客访问记录将在 RC 后开放。</p>
      </div>
      <div v-else-if="state === 'empty'" class="state-panel">
        <span class="state-icon">日</span><strong>暂无访客访问记录</strong><p>访客查看排班后，记录会出现在这里。</p>
      </div>
      <div v-else class="log-list">
        <article v-for="log in visibleLogs" :key="log.requestId" class="log-row">
          <span class="log-node" aria-hidden="true" />
          <div class="log-main"><strong>{{ log.createdAt }}</strong><span>查看 {{ log.businessMonth }} 排班</span></div>
          <div class="log-meta"><span>{{ log.clientIp }}</span><code>{{ log.requestId }}</code></div>
        </article>
      </div>
      <footer v-if="state === 'ready'" class="logs-footer"><span>显示 {{ visibleLogs.length }} 条记录</span><button type="button" @click="showFeedback('预览状态：加载下一页')">加载更多记录</button></footer>
      <p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>
    </section>

    <p class="visitor-privacy"><span aria-hidden="true">⌁</span> 仅群主和管理员可见；来源线索按权限脱敏，访客凭证不会出现在记录中。</p>
  </main>
</template>

<style scoped>
.visitor-golden {
  --ink: var(--ui-color-text-primary);
  --muted: var(--ui-color-text-secondary);
  --faint: var(--ui-color-text-muted);
  --line: var(--ui-color-border);
  --blue: var(--ui-color-primary);
  --blue-dark: var(--ui-color-primary-dark);
  --blue-soft: var(--ui-color-primary-light);
  width: min(100%, 720px);
  min-height: 844px;
  margin: 0 auto;
  padding: 24px 18px 34px;
  box-sizing: border-box;
  color: var(--ink);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

.visitor-topbar,
.visitor-brand,
.heading-row,
.section-heading,
.logs-footer,
.log-row,
.log-meta {
  display: flex;
  align-items: center;
}

.visitor-topbar,
.heading-row,
.section-heading,
.logs-footer {
  justify-content: space-between;
  gap: 14px;
}

.visitor-topbar { min-height: 36px; }
.visitor-brand { gap: 8px; font-size: var(--ui-font-size-sm); font-weight: var(--ui-font-weight-strong); }
.brand-mark { display: grid; width: 27px; height: 27px; place-items: center; color: #fff; background: var(--blue); border-radius: 9px; font-size: 19px; font-weight: 400; }
.build-label { color: var(--faint); font: 10px ui-monospace, monospace; }
.visitor-heading { margin: 42px 3px 22px; }
.eyebrow, .section-kicker { margin: 0; color: var(--blue); font-size: var(--ui-font-size-xs); font-weight: var(--ui-font-weight-strong); letter-spacing: .08em; }
.heading-row { align-items: flex-start; margin-top: 8px; }
.visitor-heading h1 { margin: 0 0 9px; font-size: clamp(30px, 6vw, 42px); line-height: 1.08; letter-spacing: -.045em; }
.visitor-heading p:not(.eyebrow) { max-width: 500px; margin: 0; color: var(--muted); font-size: var(--ui-font-size-sm); line-height: 1.55; }
.capability-chip { display: inline-flex; min-height: 28px; padding: 0 10px; align-items: center; gap: 6px; flex: none; color: #216b59; background: #e7f6f0; border-radius: 999px; font-size: var(--ui-font-size-xs); font-weight: var(--ui-font-weight-semibold); white-space: nowrap; }
.capability-chip i { width: 7px; height: 7px; background: currentColor; border-radius: 50%; }
.aggregate-card, .logs-card { padding: 18px; background: var(--ui-color-surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--ui-shadow-card); }
.aggregate-card { background: linear-gradient(135deg, var(--blue-soft), #fff 72%); }
.logs-card { margin-top: 14px; }
.section-heading { align-items: flex-start; }
.section-heading h2 { margin: 4px 0 0; font-size: var(--ui-font-size-lg); line-height: 1.2; }
.aggregate-total { padding: 5px 9px; color: var(--blue-dark); background: #fff; border: 1px solid var(--ui-color-primary-border); border-radius: 999px; font-size: var(--ui-font-size-xs); font-weight: var(--ui-font-weight-semibold); }
.aggregate-chart { display: flex; height: 142px; margin-top: 18px; padding: 0 18px 8px; align-items: flex-end; justify-content: space-around; gap: 15px; border-bottom: 1px solid rgb(10 102 213 / 20%); }
.aggregate-column { display: flex; height: 100%; align-items: center; flex-direction: column; justify-content: flex-end; color: var(--muted); font-size: 11px; }
.aggregate-count { margin-bottom: 4px; color: var(--blue-dark); font-size: var(--ui-font-size-xs); font-weight: var(--ui-font-weight-strong); }
.aggregate-bar { width: 28px; min-height: 10px; background: linear-gradient(180deg, var(--blue), #77b7f9); border-radius: 8px 8px 3px 3px; }
.aggregate-column:last-child .aggregate-bar { background: linear-gradient(180deg, #378c7a, #9ad9c4); }
.aggregate-note, .visitor-privacy { margin: 12px 2px 0; color: var(--faint); font-size: 11px; line-height: 1.45; }
.month-select select { min-height: 44px; padding: 0 10px; color: var(--blue-dark); background: var(--ui-color-surface-muted); border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: var(--ui-font-size-xs); }
.log-list { position: relative; margin-top: 16px; }
.log-list::before { position: absolute; top: 14px; bottom: 14px; left: 6px; width: 2px; background: #cfe0f2; content: ''; }
.log-row { position: relative; min-height: 60px; padding: 10px 0 10px 22px; align-items: flex-start; gap: 10px; }
.log-node { position: absolute; top: 18px; left: 1px; z-index: 1; width: 12px; height: 12px; background: var(--blue); border: 3px solid var(--ui-color-surface); border-radius: 50%; box-shadow: 0 0 0 2px var(--blue); }
.log-main { display: grid; min-width: 0; gap: 4px; flex: 1; }
.log-main strong { font-size: var(--ui-font-size-sm); font-weight: var(--ui-font-weight-semibold); }
.log-main span { color: var(--muted); font-size: var(--ui-font-size-xs); }
.log-meta { min-width: 125px; align-items: flex-end; flex-direction: column; gap: 4px; color: var(--faint); font-size: 11px; }
.log-meta code { color: var(--blue-dark); font: 11px ui-monospace, monospace; }
.logs-footer { margin-top: 12px; padding-top: 12px; color: var(--faint); border-top: 1px solid var(--line); font-size: 11px; }
.logs-footer button, .state-panel button { min-height: 44px; padding: 0 12px; color: var(--blue-dark); background: transparent; border: 1px solid var(--ui-color-primary-border); border-radius: 10px; font: inherit; font-size: var(--ui-font-size-xs); font-weight: var(--ui-font-weight-semibold); }
.state-panel { display: grid; min-height: 190px; margin-top: 16px; padding: 22px; place-items: center; align-content: center; gap: 8px; color: var(--muted); text-align: center; }
.state-panel strong { color: var(--ink); font-size: var(--ui-font-size-md); }
.state-panel p { max-width: 330px; margin: 0; font-size: var(--ui-font-size-xs); line-height: 1.5; }
.state-icon { display: grid; width: 42px; height: 42px; margin-bottom: 3px; place-items: center; color: var(--blue-dark); background: var(--blue-soft); border-radius: 14px; font-weight: var(--ui-font-weight-strong); }
.state-panel--error .state-icon { color: #a12f45; background: #fff0f3; }
.state-panel--disabled .state-icon { color: #7a5310; background: #fff5d9; }
.log-skeletons { display: grid; margin-top: 16px; gap: 10px; }
.log-skeleton { display: block; height: 58px; background: linear-gradient(90deg, #eef3f8, #fafcfe, #eef3f8); border-radius: 12px; }
.feedback { margin: 12px 0 0; color: #216b59; font-size: var(--ui-font-size-xs); text-align: center; }
.visitor-privacy { margin-top: 20px; text-align: center; }
.visitor-privacy span { color: var(--blue); font-size: 15px; vertical-align: -1px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.is-large-text { font-size: 18px; }
.is-large-text .visitor-heading p:not(.eyebrow), .is-large-text .aggregate-note, .is-large-text .visitor-privacy { font-size: var(--ui-font-size-sm); }

@media (max-width: 520px) {
  .visitor-golden { width: 100%; }
  .heading-row { display: grid; }
  .capability-chip { justify-self: start; }
}

@media (max-width: 360px) {
  .visitor-golden { padding-right: 12px; padding-left: 12px; }
  .aggregate-card, .logs-card { padding: 15px; }
  .log-row { display: grid; }
  .log-meta { min-width: 0; align-items: flex-start; flex-direction: row; gap: 10px; }
  .aggregate-chart { padding-right: 4px; padding-left: 4px; gap: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .visitor-golden * { scroll-behavior: auto !important; }
}
</style>
