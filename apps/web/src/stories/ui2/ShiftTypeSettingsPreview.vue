<script setup lang="ts">
import { reactive, ref } from 'vue';

interface ShiftTypeDraft {
  abbreviation: string;
  color: string;
  crossesMidnight: boolean;
  enabled: boolean;
  end: string;
  id: string;
  name: string;
  start: string;
  statistics: boolean;
}

const props = withDefaults(
  defineProps<{
    readonly layout?: 'desktop' | 'mobile';
  }>(),
  { layout: 'mobile' },
);

const shifts = reactive<ShiftTypeDraft[]>([
  {
    id: 'all-day',
    name: '全天班',
    abbreviation: '全',
    start: '08:00',
    end: '08:00',
    color: '#0A66D5',
    crossesMidnight: true,
    enabled: true,
    statistics: true,
  },
  {
    id: 'day',
    name: '白班',
    abbreviation: '白',
    start: '08:00',
    end: '18:00',
    color: '#287D70',
    crossesMidnight: false,
    enabled: true,
    statistics: true,
  },
  {
    id: 'night',
    name: '夜班',
    abbreviation: '夜',
    start: '18:00',
    end: '08:00',
    color: '#4C5BD4',
    crossesMidnight: true,
    enabled: true,
    statistics: true,
  },
  {
    id: 'backup',
    name: '备班',
    abbreviation: '备',
    start: '08:00',
    end: '18:00',
    color: '#9A6A13',
    crossesMidnight: false,
    enabled: false,
    statistics: false,
  },
]);

const editingId = ref('night');
const palette = ['#0A66D5', '#287D70', '#4C5BD4', '#9A6A13', '#C33D56'] as const;
const customColorShiftId = ref('');
const customColorDraft = ref('#7A4FD6');
const customColorHex = ref('#7A4FD6');
const customColorError = ref(false);

function toggleEdit(id: string): void {
  editingId.value = editingId.value === id ? '' : id;
}

function toggle(shift: ShiftTypeDraft, key: 'crossesMidnight' | 'enabled' | 'statistics'): void {
  shift[key] = !shift[key];
}

function durationLabel(shift: ShiftTypeDraft): string {
  if (shift.id === 'all-day') return '24 小时';
  if (shift.crossesMidnight) return '14 小时 · 次日结束';
  return '10 小时';
}

function isPresetColor(color: string): boolean {
  return palette.some((preset) => preset.toLowerCase() === color.toLowerCase());
}

function selectPresetColor(shift: ShiftTypeDraft, color: string): void {
  shift.color = color;
  customColorShiftId.value = '';
}

function normalizeHex(value: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match?.[1] === undefined ? undefined : `#${match[1].toUpperCase()}`;
}

function toggleCustomColor(shift: ShiftTypeDraft): void {
  if (customColorShiftId.value === shift.id) {
    customColorShiftId.value = '';
    return;
  }
  const startingColor = isPresetColor(shift.color) ? customColorDraft.value : shift.color;
  customColorDraft.value = startingColor;
  customColorHex.value = startingColor.toUpperCase();
  customColorError.value = false;
  customColorShiftId.value = shift.id;
}

function applyCustomColor(shift: ShiftTypeDraft, value = customColorHex.value): void {
  const color = normalizeHex(value);
  customColorError.value = color === undefined;
  if (color === undefined) return;
  customColorDraft.value = color;
  customColorHex.value = color;
  shift.color = color;
}

function applyPaletteInput(shift: ShiftTypeDraft, event: Event): void {
  applyCustomColor(shift, (event.target as HTMLInputElement).value);
}

function confirmCustomColor(shift: ShiftTypeDraft): void {
  applyCustomColor(shift);
  if (!customColorError.value) customColorShiftId.value = '';
}
</script>

<template>
  <main class="shift-settings-preview" :class="`layout-${props.layout}`">
    <div class="settings-shell">
      <header class="page-heading">
        <div>
          <p>排班配置</p>
          <h1>班种设置</h1>
          <span>名称、时间与状态集中在一行；需要修改时再展开。</span>
        </div>
        <button class="add-shift-button" type="button">
          <span aria-hidden="true">＋</span>新增
        </button>
      </header>

      <section class="shift-overview" aria-label="班种概览">
        <div>
          <strong>{{ shifts.length }}</strong
          ><span>个班种</span>
        </div>
        <div>
          <strong>{{ shifts.filter((shift) => shift.enabled).length }}</strong
          ><span>已启用</span>
        </div>
        <p>时间轴颜色会同步显示在月历、周视图和统计中。</p>
      </section>

      <section class="shift-card" aria-labelledby="shift-list-title">
        <header>
          <div>
            <h2 id="shift-list-title">班种</h2>
            <span>点击“编辑”展开紧凑设置</span>
          </div>
          <span class="save-state">已保存</span>
        </header>

        <ul class="shift-type-list">
          <li
            v-for="shift in shifts"
            :key="shift.id"
            class="shift-type-row"
            :class="{ 'is-editing': editingId === shift.id, 'is-disabled': !shift.enabled }"
          >
            <span class="shift-glyph" :style="{ '--shift-color': shift.color }" aria-hidden="true">
              {{ shift.abbreviation }}
            </span>
            <div class="shift-summary">
              <div>
                <strong>{{ shift.name }}</strong>
                <span v-if="shift.id === 'all-day'" class="built-in-badge">固定</span>
              </div>
              <p>
                <span class="time-band" :style="{ '--shift-color': shift.color }" />
                <b>{{ shift.start }}–{{ shift.crossesMidnight ? '次日' : '' }}{{ shift.end }}</b>
                <small>{{ durationLabel(shift) }}</small>
              </p>
            </div>
            <button class="edit-row-button" type="button" @click="toggleEdit(shift.id)">
              {{ editingId === shift.id ? '收起' : '编辑' }}
            </button>
            <button
              class="switch-hit-area"
              type="button"
              role="switch"
              :aria-checked="shift.enabled"
              :aria-label="`${shift.name}${shift.enabled ? '已启用' : '已停用'}`"
              @click="toggle(shift, 'enabled')"
            >
              <span class="compact-switch" :class="{ active: shift.enabled }" aria-hidden="true">
                <span />
              </span>
            </button>

            <form
              v-if="editingId === shift.id"
              class="shift-editor"
              @submit.prevent="editingId = ''"
            >
              <div class="identity-fields">
                <label>
                  <span>名称</span>
                  <input v-model="shift.name" maxlength="100" />
                </label>
                <label class="abbreviation-field">
                  <span>简称</span>
                  <input v-model="shift.abbreviation" maxlength="2" />
                </label>
              </div>

              <fieldset class="time-range-control">
                <legend>时段</legend>
                <label><span>开始</span><input v-model="shift.start" type="time" /></label>
                <span class="range-arrow" aria-hidden="true">→</span>
                <label><span>结束</span><input v-model="shift.end" type="time" /></label>
              </fieldset>

              <fieldset class="color-control">
                <legend>颜色</legend>
                <button
                  v-for="color in palette"
                  :key="color"
                  type="button"
                  :class="{ selected: shift.color === color }"
                  :style="{ '--swatch': color }"
                  :aria-label="`选择颜色 ${color}`"
                  :aria-pressed="shift.color === color"
                  @click="selectPresetColor(shift, color)"
                />
                <button
                  class="custom-color-trigger"
                  type="button"
                  :class="{ selected: !isPresetColor(shift.color) }"
                  :style="{ '--swatch': customColorDraft }"
                  aria-label="自定义颜色"
                  :aria-expanded="customColorShiftId === shift.id"
                  :aria-pressed="!isPresetColor(shift.color)"
                  @click="toggleCustomColor(shift)"
                />
                <Transition name="color-popover">
                  <div
                    v-if="customColorShiftId === shift.id"
                    class="custom-color-panel"
                    aria-label="自定义颜色调色板"
                  >
                    <label class="color-picker-field">
                      <span>调色板</span>
                      <input
                        :value="customColorDraft"
                        type="color"
                        aria-label="选择自定义颜色"
                        @input="applyPaletteInput(shift, $event)"
                      />
                    </label>
                    <label class="hex-color-field">
                      <span>HEX</span>
                      <input
                        v-model="customColorHex"
                        maxlength="7"
                        spellcheck="false"
                        aria-label="自定义颜色 HEX"
                        :aria-invalid="customColorError"
                        @blur="applyCustomColor(shift)"
                        @keyup.enter.prevent="applyCustomColor(shift)"
                      />
                    </label>
                    <button
                      class="apply-custom-color"
                      type="button"
                      @click="confirmCustomColor(shift)"
                    >
                      应用
                    </button>
                    <small v-if="customColorError">请输入 #RRGGBB</small>
                  </div>
                </Transition>
              </fieldset>

              <div class="editor-options">
                <article>
                  <span><strong>跨日</strong><small>结束时间属于次日</small></span>
                  <button
                    class="switch-hit-area"
                    type="button"
                    role="switch"
                    :aria-checked="shift.crossesMidnight"
                    aria-label="跨日"
                    @click="toggle(shift, 'crossesMidnight')"
                  >
                    <span
                      class="compact-switch"
                      :class="{ active: shift.crossesMidnight }"
                      aria-hidden="true"
                      ><span
                    /></span>
                  </button>
                </article>
                <article>
                  <span><strong>计入统计</strong><small>纳入值班次数与时长</small></span>
                  <button
                    class="switch-hit-area"
                    type="button"
                    role="switch"
                    :aria-checked="shift.statistics"
                    aria-label="计入统计"
                    @click="toggle(shift, 'statistics')"
                  >
                    <span
                      class="compact-switch"
                      :class="{ active: shift.statistics }"
                      aria-hidden="true"
                      ><span
                    /></span>
                  </button>
                </article>
              </div>

              <div class="editor-actions">
                <button type="button" class="delete-action">删除班种</button>
                <button type="submit" class="done-action">完成</button>
              </div>
            </form>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.shift-settings-preview {
  --blue: #0a66d5;
  --blue-soft: #eaf3ff;
  --canvas: #f4f7fb;
  --surface: #fff;
  --text: #16202a;
  --muted: #566477;
  --border: #dce3eb;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(circle at 88% 0, rgb(10 102 213 / 8%), transparent 310px), var(--canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.settings-shell {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 28px 20px 44px;
  box-sizing: border-box;
}

.page-heading {
  display: flex;
  margin-bottom: 16px;
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
  margin-top: 3px;
  font-size: clamp(28px, 5vw, 38px);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.page-heading div > span {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.add-shift-button,
.edit-row-button,
.delete-action,
.done-action {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.add-shift-button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #fff;
  background: var(--blue);
  border: 0;
}

.add-shift-button span {
  font-size: 18px;
  font-weight: 400;
}

.shift-overview {
  display: grid;
  min-height: 64px;
  margin-bottom: 14px;
  padding: 10px 14px;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  background: linear-gradient(110deg, var(--blue-soft), #f8fbff 74%);
  border: 1px solid #c8ddf6;
  border-radius: 16px;
}

.shift-overview div {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.shift-overview strong {
  color: var(--blue);
  font-size: 20px;
}

.shift-overview span,
.shift-overview p {
  color: var(--muted);
  font-size: 11px;
}

.shift-overview p {
  margin: 0 0 0 auto;
  text-align: right;
}

.shift-card {
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgb(26 45 68 / 7%);
}

.shift-card > header {
  display: flex;
  min-height: 54px;
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fbfcfe;
  border-bottom: 1px solid var(--border);
}

.shift-card h2,
.shift-card header span {
  margin: 0;
}

.shift-card h2 {
  font-size: 16px;
}

.shift-card header div > span {
  color: var(--muted);
  font-size: 11px;
}

.save-state {
  color: #167b63;
  font-size: 11px;
  font-weight: 700;
}

.shift-type-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shift-type-row {
  display: grid;
  min-height: 74px;
  padding: 10px 12px;
  grid-template-columns: 44px minmax(0, 1fr) auto 60px;
  align-items: center;
  gap: 10px;
}

.shift-type-row + .shift-type-row {
  border-top: 1px solid #e7ecf2;
}

.shift-type-row.is-editing {
  background: #fbfdff;
  box-shadow: inset 3px 0 var(--blue);
}

.shift-type-row.is-disabled .shift-glyph {
  background: #697788;
  box-shadow: none;
}

.shift-type-row.is-disabled .shift-summary strong {
  color: #566477;
}

.shift-type-row.is-disabled .time-band {
  opacity: 0.55;
}

.shift-glyph {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #fff;
  background: var(--shift-color);
  border-radius: 12px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--shift-color) 26%, transparent);
  font-size: 13px;
  font-weight: 760;
}

.shift-summary {
  min-width: 0;
}

.shift-summary > div,
.shift-summary p {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.shift-summary strong {
  font-size: 14px;
}

.built-in-badge {
  padding: 2px 6px;
  color: var(--blue);
  background: var(--blue-soft);
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
}

.shift-summary p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.shift-summary p b {
  color: #425165;
  font-weight: 650;
  white-space: nowrap;
}

.shift-summary p small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-band {
  width: 18px;
  height: 4px;
  flex: none;
  background: var(--shift-color);
  border-radius: 999px;
}

.edit-row-button {
  min-width: 54px;
  padding: 0 9px;
  color: var(--blue);
  background: transparent;
  border: 1px solid transparent;
}

.edit-row-button:hover {
  background: var(--blue-soft);
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

.compact-switch {
  position: relative;
  display: block;
  width: 52px;
  height: 30px;
  background: #c8ced6;
  border-radius: 999px;
  transition: background 180ms ease;
}

.compact-switch > span {
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

.compact-switch.active {
  background: var(--blue);
}

.compact-switch.active > span {
  transform: translateX(22px);
}

.shift-editor {
  display: grid;
  grid-column: 1 / -1;
  margin: 6px 0 2px;
  padding: 13px;
  gap: 12px;
  background: var(--blue-soft);
  border: 1px solid #c3daf5;
  border-radius: 14px;
}

.shift-editor fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.shift-editor legend,
.shift-editor label > span {
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.identity-fields {
  display: grid;
  grid-template-columns: minmax(0, 160px) 76px;
  gap: 9px;
}

.identity-fields label {
  display: grid;
}

.identity-fields input,
.time-range-control input {
  min-width: 0;
  height: 42px;
  padding: 0 10px;
  color: var(--text);
  background: #fff;
  border: 1px solid #b8c7d8;
  border-radius: 10px;
  box-sizing: border-box;
  font: inherit;
  font-size: 13px;
}

.time-range-control {
  display: grid;
  grid-template-columns: minmax(0, 132px) 20px minmax(0, 132px);
  align-items: end;
  gap: 6px;
}

.time-range-control legend {
  grid-column: 1 / -1;
}

.time-range-control label {
  display: grid;
}

.range-arrow {
  display: grid;
  height: 42px;
  place-items: center;
  color: var(--blue);
}

.color-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.color-control legend {
  width: 100%;
}

.color-control > button {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.color-control > button::before {
  position: absolute;
  inset: 5px;
  background: var(--swatch);
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #aab7c6;
  content: '';
}

.color-control > button.selected::before {
  box-shadow: 0 0 0 3px var(--blue);
}

.custom-color-trigger::after {
  position: absolute;
  right: 1px;
  bottom: 1px;
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  color: var(--blue);
  background: #fff;
  border: 1px solid #b6c8dc;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(22 32 42 / 18%);
  content: '+';
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.custom-color-trigger.selected::after {
  color: #fff;
  background: var(--blue);
  border-color: var(--blue);
  content: '✓';
  font-size: 9px;
}

.custom-color-panel {
  display: grid;
  width: 100%;
  padding: 9px;
  grid-template-columns: minmax(120px, 1fr) minmax(128px, 1fr) auto;
  align-items: end;
  gap: 8px;
  background: rgb(255 255 255 / 86%);
  border: 1px solid #bfd4eb;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgb(38 73 109 / 9%);
  box-sizing: border-box;
}

.custom-color-panel label {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.custom-color-panel label > span {
  margin: 0;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.color-picker-field input,
.hex-color-field input {
  width: 100%;
  height: 42px;
  min-width: 0;
  padding: 4px 8px;
  color: var(--text);
  background: #fff;
  border: 1px solid #b8c7d8;
  border-radius: 10px;
  box-sizing: border-box;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.color-picker-field input {
  padding: 3px;
  cursor: pointer;
}

.color-picker-field input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 7px;
}

.apply-custom-color {
  min-width: 62px;
  min-height: 42px;
  padding: 0 12px;
  color: #fff;
  background: var(--blue);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.custom-color-panel > small {
  grid-column: 1 / -1;
  color: #b52d3f;
  font-size: 9px;
}

.color-popover-enter-active,
.color-popover-leave-active {
  transition:
    opacity 160ms ease,
    translate 160ms ease;
}

.color-popover-enter-from,
.color-popover-leave-to {
  opacity: 0;
  translate: 0 -4px;
}

.editor-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #cbd9e9;
  border-radius: 12px;
}

.editor-options article {
  display: grid;
  min-height: 58px;
  padding: 7px 7px 7px 11px;
  grid-template-columns: minmax(0, 1fr) 60px;
  align-items: center;
  gap: 6px;
}

.editor-options article + article {
  border-left: 1px solid #d6e2ef;
}

.editor-options article > span,
.editor-options strong,
.editor-options small {
  display: block;
}

.editor-options strong {
  font-size: 12px;
}

.editor-options small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-action {
  color: #b52d3f;
  background: transparent;
  border: 1px solid transparent;
}

.done-action {
  min-width: 84px;
  color: #fff;
  background: var(--blue);
  border: 0;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(10 102 213 / 30%);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .settings-shell {
    padding: 22px 12px 32px;
  }

  .page-heading div > span {
    max-width: 230px;
    line-height: 1.5;
  }

  .shift-overview {
    grid-template-columns: auto auto;
    gap: 8px 18px;
  }

  .shift-overview p {
    grid-column: 1 / -1;
    margin: 0;
    text-align: left;
  }

  .shift-card {
    border-radius: 16px;
  }

  .shift-type-row {
    padding-inline: 9px;
    grid-template-columns: 40px minmax(0, 1fr) 48px 56px;
    gap: 6px;
  }

  .shift-glyph {
    width: 36px;
    height: 36px;
  }

  .edit-row-button {
    min-width: 48px;
    padding-inline: 5px;
  }

  .switch-hit-area {
    min-width: 56px;
    padding-inline: 2px;
  }

  .shift-summary p small {
    display: none;
  }

  .identity-fields {
    grid-template-columns: minmax(0, 1fr) 72px;
  }

  .time-range-control {
    grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr);
  }

  .custom-color-panel {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .apply-custom-color {
    min-height: 44px;
    grid-column: 1 / -1;
  }

  .editor-options {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-options article + article {
    border-top: 1px solid #d6e2ef;
    border-left: 0;
  }
}

@media (min-width: 641px) {
  .shift-editor {
    grid-template-columns: 245px 288px minmax(200px, 1fr);
    align-items: end;
  }

  .identity-fields {
    grid-column: 1;
  }

  .time-range-control {
    grid-column: 2;
  }

  .color-control {
    grid-column: 3;
  }

  .editor-options {
    grid-column: 1 / 3;
  }

  .editor-actions {
    grid-column: 3;
    align-self: center;
  }
}

@media (max-width: 340px) {
  .settings-shell {
    padding-inline: 8px;
  }

  .page-heading div > span {
    max-width: 195px;
  }

  .shift-type-row {
    grid-template-columns: 36px minmax(0, 1fr) 46px 54px;
    gap: 4px;
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
