<script setup lang="ts">
import { ref, watch } from 'vue';

type NotificationStatus = 'ready' | 'permission-denied' | 'registration-needed';

const props = withDefaults(
  defineProps<{
    layout?: 'mobile' | 'desktop';
    enabled?: boolean;
    status?: NotificationStatus;
  }>(),
  {
    layout: 'mobile',
    enabled: false,
    status: 'ready',
  },
);

const locallyEnabled = ref(props.enabled);
const registrationFeedback = ref(false);

watch(
  () => props.enabled,
  (enabled) => {
    locallyEnabled.value = enabled;
  },
);

function toggleNotification(): void {
  locallyEnabled.value = !locallyEnabled.value;
  registrationFeedback.value = false;
}

function retryRegistration(): void {
  registrationFeedback.value = true;
}
</script>

<template>
  <main class="notification-preview" :class="`is-${layout}`">
    <div class="settings-shell">
      <header class="page-heading">
        <p class="eyebrow">个人设置</p>
        <h1>通知</h1>
        <p>选择希望接收排班变更提醒的方式。</p>
      </header>

      <section class="settings-group" aria-labelledby="notification-group-title">
        <div class="section-heading">
          <h2 id="notification-group-title">提醒方式</h2>
          <span>仅影响当前账号</span>
        </div>
        <div class="settings-card">
          <div class="notification-control-row">
            <div class="setting-copy">
              <div class="setting-title-line">
                <span class="notification-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8Z" />
                    <path d="M9.7 20h4.6" />
                  </svg>
                </span>
                <div>
                  <h3>接收浏览器通知</h3>
                  <span v-if="locallyEnabled" class="status-chip enabled">已开启</span>
                  <span v-else class="status-chip">已关闭</span>
                </div>
              </div>
              <p>排班发布、换班进展和待处理事项会通过浏览器及时提醒您。</p>
              <small>浏览器权限只在您主动开启时申请</small>
            </div>
            <button
              class="switch-hit-area"
              type="button"
              role="switch"
              :aria-checked="locallyEnabled"
              aria-label="接收浏览器通知"
              @click="toggleNotification"
            >
              <span
                class="notification-switch"
                :class="{ active: locallyEnabled }"
                aria-hidden="true"
              >
                <span />
              </span>
            </button>
          </div>

          <div v-if="status === 'permission-denied'" class="status-panel warning" role="status">
            <span class="status-symbol" aria-hidden="true">!</span>
            <div>
              <strong>浏览器通知权限已关闭</strong>
              <p>请先在浏览器的网站设置中允许通知，然后返回此处重新开启。</p>
            </div>
          </div>

          <div v-if="status === 'registration-needed'" class="status-panel action" role="status">
            <span class="status-symbol" aria-hidden="true">↻</span>
            <div>
              <strong>需要重新连接通知服务</strong>
              <p>您的偏好已保留，重新注册后即可继续接收提醒。</p>
              <button type="button" class="registration-action" @click="retryRegistration">
                重新注册
              </button>
            </div>
          </div>

          <p v-if="registrationFeedback" class="registration-feedback" role="status">
            预览状态：已提交重新注册请求
          </p>
        </div>
      </section>

      <section class="settings-group secondary" aria-labelledby="quiet-hours-title">
        <div class="section-heading">
          <h2 id="quiet-hours-title">提醒偏好</h2>
        </div>
        <div class="preference-row">
          <div>
            <strong>免打扰时段</strong>
            <p>仅紧急排班变动会在此期间提醒</p>
          </div>
          <span>22:00–07:00</span>
        </div>
      </section>

      <p class="preview-note">此 Storybook 预览不会真实申请浏览器通知权限。</p>
    </div>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.notification-preview {
  --preview-blue: #0a66d5;
  --preview-blue-soft: #eaf3ff;
  --preview-canvas: #f4f7fb;
  --preview-surface: #ffffff;
  --preview-text: #16202a;
  --preview-muted: #637083;
  --preview-border: #dce3eb;
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--preview-text);
  background:
    radial-gradient(circle at 86% 2%, rgb(10 102 213 / 8%), transparent 280px),
    var(--preview-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.settings-shell {
  width: min(100%, 820px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 30px 20px 44px;
  box-sizing: border-box;
}

.page-heading {
  margin-bottom: 28px;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--preview-blue);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-heading h1 {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Segoe UI', sans-serif;
  font-size: clamp(30px, 5vw, 40px);
  line-height: 1.08;
  letter-spacing: -0.025em;
}

.page-heading > p:last-child {
  margin: 9px 0 0;
  color: var(--preview-muted);
  font-size: 14px;
  line-height: 1.6;
}

.section-heading {
  display: flex;
  min-height: 35px;
  padding: 0 4px 8px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 14px;
}

.section-heading span {
  color: var(--preview-muted);
  font-size: 12px;
}

.settings-card,
.preference-row {
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  border-radius: 18px;
  box-shadow: 0 8px 28px rgb(39 58 82 / 6%);
}

.notification-control-row {
  display: flex;
  min-height: 132px;
  padding: 22px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.setting-copy {
  min-width: 0;
}

.setting-title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  color: var(--preview-blue);
  background: var(--preview-blue-soft);
  border-radius: 13px;
}

.notification-icon svg {
  width: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.setting-title-line > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.setting-title-line h3 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.01em;
}

.status-chip {
  padding: 3px 7px;
  color: #5b6674;
  background: #f0f2f5;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.status-chip.enabled {
  color: #126d49;
  background: #e4f6ec;
}

.setting-copy > p {
  max-width: 540px;
  margin: 10px 0 4px 54px;
  color: #4e5c6d;
  font-size: 13px;
  line-height: 1.55;
}

.setting-copy > small {
  display: block;
  margin-left: 54px;
  color: #667384;
  font-size: 11px;
  line-height: 1.45;
}

.switch-hit-area {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  padding: 7px 0 7px 8px;
  flex: none;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}

.notification-switch {
  position: relative;
  display: block;
  width: 52px;
  height: 30px;
  background: #c8d0da;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(46 58 74 / 8%);
  transition:
    background 180ms ease,
    box-shadow 180ms ease;
}

.notification-switch > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgb(30 43 58 / 28%);
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.notification-switch.active {
  background: var(--preview-blue);
  box-shadow: inset 0 0 0 1px rgb(3 79 167 / 14%);
}

.notification-switch.active > span {
  transform: translateX(22px);
}

.status-panel {
  display: grid;
  margin: 0 22px 22px;
  padding: 14px;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  border-radius: 13px;
}

.status-panel.warning {
  color: #704812;
  background: #fff6e7;
  border: 1px solid #f2d7a7;
}

.status-panel.action {
  color: #254d78;
  background: #edf5ff;
  border: 1px solid #c7dcf5;
}

.status-symbol {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  background: rgb(255 255 255 / 70%);
  border-radius: 50%;
  font-size: 14px;
  font-weight: 800;
}

.status-panel strong {
  font-size: 13px;
}

.status-panel p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
}

.registration-action {
  min-height: 44px;
  margin-top: 10px;
  padding: 0 14px;
  color: white;
  background: var(--preview-blue);
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.registration-feedback {
  margin: -8px 22px 22px;
  color: #146c43;
  font-size: 12px;
  font-weight: 650;
}

.settings-group.secondary {
  margin-top: 24px;
}

.preference-row {
  display: flex;
  min-height: 76px;
  padding: 16px 20px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  box-sizing: border-box;
}

.preference-row strong {
  font-size: 14px;
}

.preference-row p {
  margin: 4px 0 0;
  color: var(--preview-muted);
  font-size: 12px;
}

.preference-row > span {
  flex: none;
  color: #42536a;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.preview-note {
  margin: 18px 4px 0;
  color: #758192;
  font-size: 12px;
  line-height: 1.6;
}

button:focus-visible {
  outline: 3px solid rgb(10 102 213 / 34%);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .settings-shell {
    padding: 22px 14px 36px;
  }

  .page-heading {
    margin-bottom: 22px;
  }

  .page-heading h1 {
    font-size: 32px;
  }

  .settings-card,
  .preference-row {
    border-radius: 16px;
  }

  .notification-control-row {
    min-height: 150px;
    padding: 18px 16px;
    align-items: flex-start;
    gap: 10px;
  }

  .switch-hit-area {
    margin-top: -1px;
  }

  .setting-copy > p,
  .setting-copy > small {
    margin-left: 0;
  }

  .setting-copy > p {
    margin-top: 13px;
  }

  .status-panel {
    margin: 0 16px 16px;
  }

  .registration-feedback {
    margin-inline: 16px;
  }
}

@media (max-width: 340px) {
  .settings-shell {
    padding-inline: 10px;
  }

  .notification-control-row {
    padding-inline: 14px 10px;
  }

  .notification-icon {
    width: 38px;
    height: 38px;
  }

  .setting-title-line {
    gap: 9px;
  }

  .setting-title-line h3 {
    font-size: 16px;
  }

  .preference-row {
    padding-inline: 16px;
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
