<script setup lang="ts">
import { reactive } from 'vue';

const props = withDefaults(
  defineProps<{
    readonly layout?: 'desktop' | 'mobile';
  }>(),
  { layout: 'mobile' },
);

const values = reactive<Record<string, boolean>>({
  acknowledgeChanges: false,
  confirmContact: true,
  onlyChanges: true,
  repeatTemplate: false,
  replaceDrafts: false,
});

const sections = [
  {
    eyebrow: '日历',
    title: '显示内容',
    items: [
      {
        key: 'onlyChanges',
        title: '仅显示有变更的班次',
        description: '收起没有换班、请假或加扣班记录的日期。',
      },
    ],
  },
  {
    eyebrow: '排班模板',
    title: '应用方式',
    items: [
      {
        key: 'repeatTemplate',
        title: '按周期重复',
        description: '将当前模板连续应用到所选日期范围。',
      },
      {
        key: 'replaceDrafts',
        title: '覆盖已有草稿',
        description: '仅替换尚未发布的排班内容。',
      },
    ],
  },
  {
    eyebrow: '提交确认',
    title: '需要明确确认',
    items: [
      {
        key: 'acknowledgeChanges',
        title: '我已了解关联事件会被撤销',
        description: '开启后才可继续覆盖已生效的排班。',
        warning: true,
      },
      {
        key: 'confirmContact',
        title: '联系方式已核对',
        description: '号码已与成员本人确认，可用于直接拨打。',
      },
    ],
  },
] as const;

function toggle(key: string): void {
  values[key] = !values[key];
}
</script>

<template>
  <main class="controls-preview" :class="`layout-${props.layout}`">
    <div class="controls-shell">
      <header class="page-heading">
        <div>
          <p>控件统一预览</p>
          <h1>开关与确认</h1>
          <span>所有需要勾选的项目使用同一套紧凑开关，说明文字留在左侧。</span>
        </div>
        <span class="density-badge">紧凑</span>
      </header>

      <div class="settings-grid">
        <section v-for="section in sections" :key="section.title" class="settings-section">
          <header>
            <span>{{ section.eyebrow }}</span>
            <h2>{{ section.title }}</h2>
          </header>
          <div class="settings-list">
            <article
              v-for="item in section.items"
              :key="item.key"
              class="setting-row"
              :class="{ 'is-warning': 'warning' in item && item.warning }"
            >
              <button class="setting-copy" type="button" @click="toggle(item.key)">
                <strong>{{ item.title }}</strong>
                <small>{{ item.description }}</small>
              </button>
              <button
                type="button"
                class="switch-hit-area"
                role="switch"
                :aria-checked="values[item.key]"
                :aria-label="item.title"
                @click="toggle(item.key)"
              >
                <span
                  class="control-switch"
                  :class="{ active: values[item.key] }"
                  aria-hidden="true"
                >
                  <span />
                </span>
              </button>
            </article>
          </div>
        </section>
      </div>

      <p class="preview-note">
        轨道保持 52×30px；60×44px 的透明外层负责点触面积，不再把开关本体强行拉高。
      </p>
    </div>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.controls-preview {
  --blue: #0a66d5;
  --blue-soft: #eaf3ff;
  --canvas: #f4f7fb;
  --surface: #fff;
  --text: #16202a;
  --muted: #637083;
  --border: #dce3eb;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(circle at 90% 0, rgb(10 102 213 / 8%), transparent 290px), var(--canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.controls-shell {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 30px 20px 44px;
  box-sizing: border-box;
}

.page-heading {
  display: flex;
  margin-bottom: 22px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.page-heading p,
.page-heading h1,
.page-heading span {
  margin: 0;
}

.page-heading p {
  color: var(--blue);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.page-heading h1 {
  margin-top: 4px;
  font-size: clamp(28px, 5vw, 38px);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.page-heading div > span {
  display: block;
  max-width: 580px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.density-badge {
  flex: none;
  padding: 6px 10px;
  color: var(--blue);
  background: var(--blue-soft);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.settings-section {
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 8px 26px rgb(26 45 68 / 6%);
}

.settings-section:last-child {
  grid-column: 1 / -1;
}

.settings-section > header {
  display: flex;
  min-height: 48px;
  padding: 0 15px;
  align-items: center;
  gap: 9px;
  background: #fbfcfe;
  border-bottom: 1px solid var(--border);
}

.settings-section > header span {
  color: var(--blue);
  font-size: 10px;
  font-weight: 760;
  letter-spacing: 0.07em;
}

.settings-section > header h2 {
  margin: 0;
  font-size: 15px;
}

.settings-list {
  padding: 0 14px;
}

.setting-row {
  display: grid;
  min-height: 66px;
  grid-template-columns: minmax(0, 1fr) 60px;
  align-items: center;
  gap: 10px;
}

.setting-row + .setting-row {
  border-top: 1px solid #e7ecf2;
}

.setting-row.is-warning {
  margin-inline: -14px;
  padding-inline: 14px;
  background: #fffaf0;
}

.setting-copy {
  display: grid;
  min-width: 0;
  min-height: 44px;
  padding: 7px 0;
  align-content: center;
  gap: 3px;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
}

.setting-copy strong {
  font-size: 13px;
  line-height: 1.35;
}

.setting-copy small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
}

.switch-hit-area {
  display: grid;
  min-width: 60px;
  min-height: 44px;
  padding: 0 4px;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}

.control-switch {
  position: relative;
  display: block;
  width: 52px;
  height: 30px;
  background: #c8ced6;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(22 32 42 / 5%);
  transition: background 180ms ease;
}

.control-switch > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgb(22 32 42 / 24%);
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.control-switch.active {
  background: var(--blue);
}

.control-switch.active > span {
  transform: translateX(22px);
}

.preview-note {
  margin: 14px 3px 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}

button:focus-visible {
  outline: 3px solid rgb(10 102 213 / 30%);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .controls-shell {
    padding: 22px 14px 32px;
  }

  .page-heading {
    align-items: flex-start;
  }

  .page-heading div > span {
    max-width: 260px;
  }

  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .settings-section:last-child {
    grid-column: auto;
  }

  .settings-section {
    border-radius: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
</style>
