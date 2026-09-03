<script setup lang="ts">
import { computed, ref } from 'vue';

type PreviewLayout = 'desktop' | 'mobile';

const props = withDefaults(
  defineProps<{
    readonly layout?: PreviewLayout;
    readonly modalOpen?: boolean;
  }>(),
  {
    layout: 'desktop',
    modalOpen: false,
  },
);

const showDefaultPasswordModal = ref(props.modalOpen);
const passwordEditorOpen = ref(false);
const feedback = ref('');

const modalTitle = computed(() =>
  passwordEditorOpen.value ? '现在修改密码' : '当前使用的是默认密码',
);

function openPasswordModal(): void {
  feedback.value = '';
  passwordEditorOpen.value = false;
  showDefaultPasswordModal.value = true;
}

function closePasswordModal(message = ''): void {
  showDefaultPasswordModal.value = false;
  passwordEditorOpen.value = false;
  feedback.value = message;
}

function startPasswordEditor(): void {
  passwordEditorOpen.value = true;
  feedback.value = '';
}

function savePreviewPassword(): void {
  closePasswordModal('预览状态：密码修改已提交');
}

function openSetting(setting: string): void {
  feedback.value = `预览状态：已打开${setting}`;
}
</script>

<template>
  <main class="my-preview" :class="`is-${layout}`">
    <div class="app-frame">
      <aside class="side-rail" aria-label="主导航">
        <div class="brand-mark" aria-hidden="true">+</div>
        <p class="brand-caption">排班台</p>
        <nav class="rail-nav">
          <button type="button" class="rail-item" aria-label="排班总览">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v14H4zM8 3v4M16 3v4M4 10h16M8 14h2M13 14h3M8 17h2" />
            </svg>
          </button>
          <button type="button" class="rail-item active" aria-label="我的">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c.8-3.4 3.1-5.2 7-5.2s6.2 1.8 7 5.2" />
            </svg>
          </button>
        </nav>
        <div class="rail-bottom">
          <span class="online-dot" aria-hidden="true" />
          <span>已同步</span>
        </div>
      </aside>

      <section class="content-column">
        <header class="topbar">
          <div>
            <p class="breadcrumb">工作台 <span>/</span> 个人中心</p>
            <h1>我的</h1>
          </div>
          <button type="button" class="top-avatar" aria-label="打开账号菜单">林</button>
        </header>

        <div class="content-grid">
          <section class="profile-hero" aria-labelledby="profile-title">
            <div class="hero-glow" aria-hidden="true" />
            <div class="hero-main">
              <div class="profile-avatar" aria-hidden="true">林</div>
              <div class="profile-identity">
                <div class="identity-heading">
                  <h2 id="profile-title">林恩宇</h2>
                  <span class="verified-chip"><span aria-hidden="true">✓</span> 已确认</span>
                </div>
                <p>头颈外科医生 <span>·</span> 成员</p>
                <span class="account-id">工号 d0796</span>
              </div>
            </div>
            <div class="hero-meta">
              <span class="presence-line"><i aria-hidden="true" /> 账号正常</span>
              <span>最近登录 今天 08:42</span>
            </div>
          </section>

          <section class="stats-panel" aria-labelledby="stats-title">
            <div class="section-label-row">
              <div>
                <p class="eyebrow">个人数据</p>
                <h2 id="stats-title">值班概览</h2>
              </div>
              <span class="period-label">2026 年</span>
            </div>
            <div class="stat-list">
              <article class="stat-card primary-stat">
                <span class="stat-label">本月值班</span>
                <strong>8<span>天</span></strong>
                <span class="stat-foot positive">较上月 +2 天</span>
              </article>
              <article class="stat-card">
                <span class="stat-label">年度累计</span>
                <strong>76<span>天</span></strong>
                <span class="stat-foot">占工作日 39%</span>
              </article>
              <article class="stat-card">
                <span class="stat-label">近 30 日完成率</span>
                <strong>96<span>%</span></strong>
                <span class="stat-foot positive">状态稳定</span>
              </article>
            </div>
          </section>

          <section class="pulse-card" aria-labelledby="pulse-title">
            <div class="section-label-row">
              <div>
                <p class="eyebrow">DUTY PULSE</p>
                <h2 id="pulse-title">值班节奏</h2>
              </div>
              <span class="trend-badge"><span aria-hidden="true">↗</span> 规律</span>
            </div>
            <div class="pulse-chart" aria-label="近四周值班天数趋势">
              <div class="chart-y-axis"><span>4</span><span>2</span><span>0</span></div>
              <div class="chart-area">
                <div class="chart-grid-line line-top" />
                <div class="chart-grid-line line-mid" />
                <div class="chart-grid-line line-bottom" />
                <div class="bars">
                  <div class="bar-column">
                    <span class="bar" style="height: 52%" /><small>第 1 周</small>
                  </div>
                  <div class="bar-column">
                    <span class="bar" style="height: 78%" /><small>第 2 周</small>
                  </div>
                  <div class="bar-column">
                    <span class="bar current" style="height: 100%" /><small>第 3 周</small>
                  </div>
                  <div class="bar-column">
                    <span class="bar muted" style="height: 40%" /><small>本周</small>
                  </div>
                </div>
              </div>
            </div>
            <div class="pulse-summary">
              <span><i class="legend-dot" /> 已完成</span><strong>近四周共 13 天</strong>
            </div>
          </section>

          <section class="next-duty-card" aria-labelledby="next-duty-title">
            <div class="next-duty-header">
              <div>
                <p class="eyebrow">下一班</p>
                <h2 id="next-duty-title">明天 · 08月20日</h2>
              </div>
              <span class="next-duty-tag">日班</span>
            </div>
            <div class="duty-time"><strong>08:00</strong><span>—</span><strong>17:30</strong></div>
            <div class="duty-location">
              <span class="location-pin" aria-hidden="true">⌖</span><span>头颈外科病房</span
              ><span class="location-separator">·</span><span>3 号楼 7F</span>
            </div>
            <div class="duty-team">
              <div class="mini-avatar">陈</div>
              <span>与陈跃等 4 人共同值班</span>
            </div>
          </section>

          <section class="account-card" aria-labelledby="account-title">
            <div class="section-label-row">
              <div>
                <p class="eyebrow">账号与安全</p>
                <h2 id="account-title">个人设置</h2>
              </div>
              <span class="privacy-note"><span aria-hidden="true">●</span> 仅自己可见</span>
            </div>
            <div class="setting-list">
              <button type="button" class="setting-row" @click="openSetting('手机号')">
                <span class="setting-icon phone-icon" aria-hidden="true"
                  ><svg viewBox="0 0 24 24">
                    <path
                      d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                    />
                    <path d="M9 18h6" /></svg
                ></span>
                <span class="setting-copy"
                  ><strong>手机号</strong><small>134 •••• 8339</small></span
                >
                <span class="setting-action">已绑定 <b>›</b></span>
              </button>
              <button type="button" class="setting-row" @click="openPasswordModal">
                <span class="setting-icon lock-icon" aria-hidden="true"
                  ><svg viewBox="0 0 24 24">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg
                ></span>
                <span class="setting-copy"
                  ><strong>登录密码</strong><small>当前为默认密码，建议立即修改</small></span
                >
                <span class="setting-action warning-text">修改密码 <b>›</b></span>
              </button>
            </div>
          </section>

          <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
        </div>
      </section>

      <nav class="mobile-tabbar" aria-label="底部导航">
        <button type="button"><span aria-hidden="true">⌂</span>排班</button>
        <button type="button" class="active"><span aria-hidden="true">◎</span>我的</button>
      </nav>
    </div>

    <div
      v-if="showDefaultPasswordModal"
      class="modal-layer"
      role="presentation"
      @click.self="closePasswordModal()"
    >
      <section
        class="password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
      >
        <button type="button" class="modal-close" aria-label="关闭" @click="closePasswordModal()">
          ×
        </button>
        <div class="modal-icon" aria-hidden="true"><span>!</span></div>
        <p class="eyebrow modal-eyebrow">账号安全提醒</p>
        <h2 id="password-modal-title">{{ modalTitle }}</h2>
        <template v-if="!passwordEditorOpen">
          <p class="modal-copy">
            当前密码为系统默认密码 <strong>123</strong>，为保护您的账号安全，建议尽快修改。
          </p>
          <div class="modal-actions">
            <button type="button" class="secondary-button" @click="closePasswordModal()">
              取消
            </button>
            <button type="button" class="primary-button" @click="startPasswordEditor">
              修改密码
            </button>
            <button
              type="button"
              class="quiet-button"
              @click="closePasswordModal('预览状态：已选择不再提示')"
            >
              不再提示
            </button>
          </div>
        </template>
        <form v-else class="password-form" @submit.prevent="savePreviewPassword">
          <label
            >新密码<input type="password" value="" placeholder="请输入至少 6 位密码" autofocus
          /></label>
          <label>确认新密码<input type="password" value="" placeholder="再次输入新密码" /></label>
          <div class="modal-actions editor-actions">
            <button type="button" class="secondary-button" @click="passwordEditorOpen = false">
              返回
            </button>
            <button type="submit" class="primary-button">保存密码</button>
          </div>
        </form>
        <p class="modal-note">修改密码后，下次登录请使用新密码。</p>
      </section>
    </div>

    <button v-else class="preview-trigger" type="button" @click="openPasswordModal">
      打开默认密码弹窗预览
    </button>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.my-preview {
  --ink: #152131;
  --muted: #6c7788;
  --soft-muted: #8a95a5;
  --line: #e3e8ef;
  --canvas: #f4f7fb;
  --surface: #fff;
  --blue: #0a66d5;
  --blue-deep: #084eaa;
  --blue-soft: #eaf3ff;
  --mint: #39b895;
  --amber: #e39a32;
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--ink);
  background:
    radial-gradient(circle at 76% 0%, rgb(10 102 213 / 8%), transparent 410px), var(--canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.app-frame {
  display: flex;
  min-height: 100vh;
}
.side-rail {
  display: flex;
  width: 76px;
  padding: 24px 0 21px;
  flex: none;
  flex-direction: column;
  align-items: center;
  background: #122238;
  color: #dfe9f5;
}
.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #fff;
  background: var(--blue);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  font-size: 23px;
  font-weight: 300;
  line-height: 1;
}
.brand-caption {
  margin: 10px 0 44px;
  color: #aab8c9;
  font-size: 10px;
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
}
.rail-nav {
  display: grid;
  gap: 12px;
}
.rail-item {
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  color: #91a2b9;
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
}
.rail-item.active {
  color: #fff;
  background: rgb(255 255 255 / 13%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
}
.rail-item svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
.rail-bottom {
  display: flex;
  margin-top: auto;
  align-items: center;
  gap: 7px;
  color: #8fa0b7;
  font-size: 9px;
  writing-mode: vertical-rl;
}
.online-dot {
  width: 6px;
  height: 6px;
  background: #4bc79f;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(75 199 159 / 15%);
}
.content-column {
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 0 44px 50px;
  flex: 1;
}
.topbar {
  display: flex;
  height: 100px;
  align-items: center;
  justify-content: space-between;
}
.breadcrumb {
  margin: 0 0 9px;
  color: var(--soft-muted);
  font-size: 12px;
}
.breadcrumb span {
  padding: 0 7px;
  color: #bac3ce;
}
.topbar h1 {
  margin: 0;
  color: var(--ink);
  font-size: 28px;
  font-weight: 740;
  letter-spacing: -0.04em;
}
.top-avatar {
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  place-items: center;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border: 1px solid #d7e8fc;
  border-radius: 50%;
  cursor: pointer;
  font-weight: 750;
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.26fr) minmax(280px, 0.74fr);
  gap: 18px;
}
.profile-hero,
.stats-panel,
.pulse-card,
.next-duty-card,
.account-card {
  position: relative;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 9px 28px rgb(34 56 84 / 5%);
}
.profile-hero {
  display: flex;
  min-height: 202px;
  padding: 28px 30px;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(114deg, #fff 0%, #f9fbfe 55%, #eef6ff 100%);
}
.hero-glow {
  position: absolute;
  top: -170px;
  right: -38px;
  width: 390px;
  height: 390px;
  background: radial-gradient(circle, rgb(10 102 213 / 10%), rgb(10 102 213 / 0%) 70%);
  pointer-events: none;
}
.hero-main,
.hero-meta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}
.hero-main {
  gap: 18px;
}
.profile-avatar {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #2b89e8, #0757b5);
  border: 5px solid #fff;
  border-radius: 25px;
  box-shadow: 0 9px 22px rgb(10 102 213 / 20%);
  font-size: 30px;
  font-weight: 700;
}
.identity-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.profile-identity h2 {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.04em;
}
.profile-identity p {
  margin: 8px 0 6px;
  color: #415269;
  font-size: 14px;
  font-weight: 600;
}
.profile-identity p span {
  padding: 0 5px;
  color: #9aa7b6;
  font-weight: 400;
}
.account-id {
  color: var(--soft-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.02em;
}
.verified-chip {
  display: inline-flex;
  min-height: 22px;
  padding: 0 8px;
  align-items: center;
  gap: 4px;
  color: #167452;
  background: #e7f7ef;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.verified-chip span {
  display: grid;
  width: 13px;
  height: 13px;
  place-items: center;
  color: #fff;
  background: #36b489;
  border-radius: 50%;
  font-size: 9px;
}
.hero-meta {
  align-self: flex-end;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  color: var(--soft-muted);
  font-size: 11px;
}
.presence-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #258064;
  font-weight: 700;
}
.presence-line i {
  width: 6px;
  height: 6px;
  background: #43ba90;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(67 186 144 / 13%);
}
.stats-panel,
.pulse-card,
.next-duty-card,
.account-card {
  padding: 23px 24px;
}
.section-label-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.eyebrow {
  margin: 0 0 5px;
  color: var(--blue);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.13em;
}
.section-label-row h2,
.next-duty-header h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.02em;
}
.period-label,
.privacy-note {
  color: var(--soft-muted);
  font-size: 11px;
}
.privacy-note span {
  color: #49b794;
  font-size: 8px;
  vertical-align: 1px;
}
.stat-list {
  display: grid;
  margin-top: 22px;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}
.stat-card {
  min-height: 103px;
  padding: 13px 12px;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 13px;
}
.stat-card.primary-stat {
  color: #fff;
  background: linear-gradient(140deg, #1678df, #075ab9);
  border-color: transparent;
  box-shadow: 0 8px 17px rgb(10 102 213 / 19%);
}
.stat-label {
  display: block;
  color: #758193;
  font-size: 10px;
}
.primary-stat .stat-label {
  color: #dbeaff;
}
.stat-card strong {
  display: block;
  margin-top: 13px;
  font-size: 26px;
  letter-spacing: -0.05em;
  line-height: 1;
}
.stat-card strong span {
  margin-left: 2px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
}
.stat-foot {
  display: block;
  margin-top: 11px;
  color: #7c8797;
  font-size: 9px;
  white-space: nowrap;
}
.stat-foot.positive {
  color: #27886d;
  font-weight: 650;
}
.primary-stat .stat-foot {
  color: #c5e2ff;
}
.trend-badge {
  display: inline-flex;
  padding: 5px 8px;
  align-items: center;
  gap: 4px;
  color: #248068;
  background: #e8f7f1;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 750;
}
.pulse-chart {
  display: flex;
  height: 127px;
  margin-top: 15px;
  padding: 4px 0 0;
}
.chart-y-axis {
  display: flex;
  width: 19px;
  padding: 0 0 19px;
  flex-direction: column;
  justify-content: space-between;
  color: #aab3bf;
  font-size: 9px;
}
.chart-area {
  position: relative;
  min-width: 0;
  flex: 1;
}
.chart-grid-line {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px dashed #e4e9ef;
}
.line-top {
  top: 4px;
}
.line-mid {
  top: 50%;
}
.line-bottom {
  bottom: 19px;
}
.bars {
  position: absolute;
  right: 0;
  bottom: 19px;
  left: 0;
  display: flex;
  height: calc(100% - 19px);
  align-items: flex-end;
  justify-content: space-around;
  gap: 11%;
}
.bar-column {
  display: flex;
  height: 100%;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.bar {
  width: min(29px, 60%);
  min-height: 14px;
  background: #91c5f5;
  border-radius: 7px 7px 3px 3px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);
}
.bar.current {
  background: linear-gradient(#1a80e2, #0b62c9);
}
.bar.muted {
  background: #c8dcf1;
}
.bar-column small {
  position: absolute;
  bottom: 0;
  color: #8d98a7;
  font-size: 9px;
  white-space: nowrap;
}
.pulse-summary {
  display: flex;
  margin-top: 1px;
  align-items: center;
  justify-content: space-between;
  color: var(--soft-muted);
  font-size: 10px;
}
.pulse-summary span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pulse-summary strong {
  color: #4a586b;
  font-size: 10px;
}
.legend-dot {
  width: 6px;
  height: 6px;
  background: var(--blue);
  border-radius: 50%;
}
.next-duty-card {
  color: #fff;
  background: linear-gradient(145deg, #142d4d, #0c2340);
  border-color: #1b385c;
  box-shadow: 0 12px 32px rgb(18 41 71 / 15%);
}
.next-duty-card .eyebrow {
  color: #84b9f4;
}
.next-duty-header h2 {
  color: #fff;
  font-size: 16px;
}
.next-duty-tag {
  padding: 5px 8px;
  color: #cfe7ff;
  background: rgb(255 255 255 / 10%);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  font-size: 10px;
}
.duty-time {
  display: flex;
  margin-top: 27px;
  align-items: center;
  gap: 10px;
  color: #fff;
}
.duty-time strong {
  font-size: 24px;
  letter-spacing: -0.05em;
}
.duty-time span {
  color: #738da9;
}
.duty-location {
  display: flex;
  margin-top: 14px;
  align-items: center;
  gap: 6px;
  color: #b8cbe0;
  font-size: 11px;
}
.location-pin {
  color: #77b6f5;
  font-size: 17px;
}
.location-separator {
  color: #54708e;
}
.duty-team {
  display: flex;
  margin-top: 24px;
  padding-top: 13px;
  align-items: center;
  gap: 8px;
  color: #90a9c3;
  border-top: 1px solid rgb(255 255 255 / 12%);
  font-size: 10px;
}
.mini-avatar {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #14335a;
  background: #d8ecff;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 750;
}
.account-card {
  grid-column: 1 / -1;
}
.setting-list {
  margin-top: 17px;
  border-top: 1px solid #edf0f4;
}
.setting-row {
  display: flex;
  width: 100%;
  min-height: 72px;
  padding: 11px 0;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #edf0f4;
  cursor: pointer;
}
.setting-row:last-child {
  border-bottom: 0;
}
.setting-icon {
  display: grid;
  width: 35px;
  height: 35px;
  flex: none;
  place-items: center;
  background: var(--blue-soft);
  border-radius: 10px;
}
.setting-icon svg {
  width: 18px;
  fill: none;
  stroke: var(--blue);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
.lock-icon {
  background: #f0f4fa;
}
.lock-icon svg {
  stroke: #5a708d;
}
.setting-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.setting-copy strong {
  color: #28384b;
  font-size: 13px;
}
.setting-copy small {
  overflow: hidden;
  color: #8691a0;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.setting-action {
  display: inline-flex;
  margin-left: auto;
  flex: none;
  align-items: center;
  gap: 7px;
  color: #6d7c90;
  font-size: 11px;
}
.setting-action b {
  color: #abb6c2;
  font-size: 20px;
  font-weight: 300;
  line-height: 0.6;
}
.warning-text {
  color: #bc771d;
}
.preview-feedback {
  grid-column: 1 / -1;
  margin: -4px 0 0;
  color: #1a7b5a;
  font-size: 11px;
}
.mobile-tabbar {
  display: none;
}
.modal-layer {
  position: fixed;
  z-index: 10;
  inset: 0;
  display: grid;
  padding: 20px;
  place-items: center;
  background: rgb(8 21 37 / 43%);
  backdrop-filter: blur(6px);
}
.password-modal {
  position: relative;
  width: min(100%, 392px);
  padding: 30px 30px 24px;
  color: var(--ink);
  background: #fff;
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 24px;
  box-shadow: 0 28px 70px rgb(6 24 46 / 24%);
  text-align: center;
}
.modal-close {
  position: absolute;
  top: 13px;
  right: 15px;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: #778396;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
  font-weight: 300;
}
.modal-close:hover {
  background: #f3f6fa;
}
.modal-icon {
  display: grid;
  width: 50px;
  height: 50px;
  margin: 0 auto 16px;
  place-items: center;
  color: #a96315;
  background: #fff3de;
  border: 7px solid #fff8ee;
  border-radius: 17px;
}
.modal-icon span {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 2px solid currentColor;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
}
.modal-eyebrow {
  color: #bd7a25;
}
.password-modal h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.035em;
}
.modal-copy {
  margin: 12px auto 0;
  color: #677486;
  font-size: 13px;
  line-height: 1.7;
}
.modal-copy strong {
  color: #a46117;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 800;
}
.modal-actions {
  display: grid;
  margin-top: 24px;
  grid-template-columns: 1fr 1.35fr;
  gap: 9px;
}
.modal-actions button {
  min-height: 44px;
  border-radius: 11px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}
.secondary-button {
  color: #536278;
  background: #f7f9fb;
  border: 1px solid #e3e8ee;
}
.primary-button {
  color: #fff;
  background: var(--blue);
  border: 1px solid var(--blue);
  box-shadow: 0 6px 13px rgb(10 102 213 / 19%);
}
.quiet-button {
  grid-column: 1 / -1;
  min-height: 32px !important;
  color: #8793a2;
  background: transparent;
  border: 0;
  font-size: 11px !important;
  font-weight: 600 !important;
}
.modal-note {
  margin: 20px 0 0;
  color: #a0aab6;
  font-size: 10px;
}
.password-form {
  margin-top: 18px;
  text-align: left;
}
.password-form label {
  display: grid;
  margin-bottom: 12px;
  color: #536176;
  font-size: 11px;
  font-weight: 700;
  gap: 6px;
}
.password-form input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  color: var(--ink);
  background: #f8fafc;
  border: 1px solid #dfe5ec;
  border-radius: 10px;
  outline: 0;
  font-size: 12px;
}
.password-form input:focus {
  border-color: #72aae8;
  box-shadow: 0 0 0 3px rgb(10 102 213 / 11%);
}
.editor-actions {
  margin-top: 18px;
}
.preview-trigger {
  position: fixed;
  right: 18px;
  bottom: 16px;
  z-index: 4;
  min-height: 36px;
  padding: 0 12px;
  color: #fff;
  background: #153456;
  border: 0;
  border-radius: 10px;
  box-shadow: 0 7px 20px rgb(18 41 71 / 18%);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}
button:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(10 102 213 / 30%);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .side-rail {
    display: none;
  }
  .content-column {
    padding: 0 16px 86px;
  }
  .topbar {
    height: 83px;
  }
  .topbar h1 {
    font-size: 25px;
  }
  .breadcrumb {
    margin-bottom: 7px;
  }
  .content-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .profile-hero {
    min-height: 171px;
    padding: 22px 20px;
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    border-radius: 18px;
  }
  .profile-avatar {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    font-size: 25px;
  }
  .profile-identity h2 {
    font-size: 23px;
  }
  .hero-main {
    gap: 14px;
  }
  .hero-meta {
    align-self: stretch;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
  }
  .hero-glow {
    top: -140px;
    right: -120px;
  }
  .stats-panel,
  .pulse-card,
  .next-duty-card,
  .account-card {
    padding: 19px 17px;
    border-radius: 17px;
  }
  .stat-list {
    gap: 7px;
  }
  .stat-card {
    min-height: 96px;
    padding: 12px 9px;
  }
  .stat-card strong {
    font-size: 23px;
  }
  .stat-foot {
    font-size: 8px;
  }
  .stat-label {
    font-size: 9px;
  }
  .next-duty-card {
    order: 3;
  }
  .pulse-card {
    order: 2;
  }
  .account-card {
    order: 4;
  }
  .stats-panel {
    order: 1;
  }
  .profile-hero {
    order: 0;
  }
  .duty-time {
    margin-top: 23px;
  }
  .duty-team {
    margin-top: 19px;
  }
  .mobile-tabbar {
    position: fixed;
    z-index: 5;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    height: 64px;
    padding: 7px 38px max(7px, env(safe-area-inset-bottom));
    justify-content: space-around;
    background: rgb(255 255 255 / 94%);
    border-top: 1px solid #e0e6ed;
    box-shadow: 0 -5px 20px rgb(31 50 73 / 6%);
    backdrop-filter: blur(12px);
  }
  .mobile-tabbar button {
    display: grid;
    min-width: 60px;
    padding: 0;
    color: #8b97a6;
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 10px;
    gap: 1px;
  }
  .mobile-tabbar button span {
    color: currentColor;
    font-size: 20px;
    line-height: 22px;
  }
  .mobile-tabbar button.active {
    color: var(--blue);
    font-weight: 700;
  }
  .preview-trigger {
    right: 10px;
    bottom: 73px;
  }
}

@media (max-width: 350px) {
  .content-column {
    padding-inline: 11px;
  }
  .profile-hero {
    padding-inline: 15px;
  }
  .stat-card {
    padding-inline: 7px;
  }
  .stat-card strong {
    font-size: 21px;
  }
  .stat-foot {
    letter-spacing: -0.04em;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
