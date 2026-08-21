<script setup lang="ts">
import { reactive, ref } from 'vue';

import LucideMinimalActionIcon, {
  type LucideMinimalActionIconName,
} from './LucideMinimalActionIcon.vue';

withDefaults(defineProps<{ readonly boardOnly?: boolean }>(), { boardOnly: false });

const filterActive = ref(false);
const directoryMode = ref<'department' | 'people'>('department');
const calendarDays = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;
const motionIcons: readonly {
  label: string;
  name: LucideMinimalActionIconName;
  note: string;
}[] = [
  { label: '通知', name: 'bell', note: '原铃铛 · 点击摇晃' },
  { label: '个人中心', name: 'profile', note: '原用户图标 · 点击回应' },
  { label: '导出', name: 'export', note: '原导出图标 · 箭头顺向出现' },
  { label: '筛选', name: 'filter', note: '原三横线 · 点击错动' },
  { label: '定位', name: 'locate', note: '原准星 · 点击转向' },
  { label: '科室', name: 'department', note: '原四格 · 点击转 90°' },
  { label: '人员', name: 'people', note: '群组双人图标 · 点击并排' },
  { label: '电话', name: 'phone', note: '原听筒 · 点击轻摆' },
];

const motionKeys = reactive<Record<LucideMinimalActionIconName, number>>({
  bell: 0,
  department: 0,
  export: 0,
  filter: 0,
  locate: 0,
  people: 0,
  phone: 0,
  profile: 0,
});

function playMotion(name: LucideMinimalActionIconName): void {
  motionKeys[name] += 1;
}

function toggleFilter(): void {
  filterActive.value = !filterActive.value;
  playMotion('filter');
}

function selectDepartment(): void {
  if (directoryMode.value === 'department') return;
  directoryMode.value = 'department';
  playMotion('department');
}

function selectPeople(): void {
  if (directoryMode.value === 'people') return;
  directoryMode.value = 'people';
  playMotion('people');
}
</script>

<template>
  <main class="action-motion-preview" :class="{ 'is-board-only': boardOnly }">
    <header class="preview-intro">
      <div>
        <p>Lucide Minimal · Static-preserving motion</p>
        <h1>医疗工作台动作图标</h1>
      </div>
      <span>静态原样 · 点击回应</span>
    </header>

    <section class="motion-board" aria-label="动作图标总览">
      <button
        v-for="icon in motionIcons"
        :key="icon.name"
        type="button"
        class="motion-swatch"
        :aria-label="`${icon.label}，点击图标播放`"
        @click="playMotion(icon.name)"
      >
        <span class="swatch-icon">
          <LucideMinimalActionIcon
            :name="icon.name"
            :motion-key="motionKeys[icon.name]"
            preview-motion
          />
        </span>
        <strong>{{ icon.label }}</strong>
        <small>{{ icon.note }}</small>
      </button>
    </section>

    <p v-if="boardOnly" class="preview-note">点击图标播放；不点击时与当前生产静态样式完全一致。</p>

    <section v-else class="workbench-frame" aria-label="动作图标工作台场景预览">
      <header class="workbench-header">
        <div class="workbench-heading">
          <span>演示群组</span>
          <h2>排班日历</h2>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="icon-action"
            aria-label="通知中心"
            @click="playMotion('bell')"
          >
            <LucideMinimalActionIcon name="bell" :motion-key="motionKeys.bell" preview-motion />
            <i class="unread-dot" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-action"
            aria-label="个人中心"
            @click="playMotion('profile')"
          >
            <LucideMinimalActionIcon
              name="profile"
              :motion-key="motionKeys.profile"
              preview-motion
            />
          </button>
          <button
            type="button"
            class="export-action"
            aria-label="导出排班"
            @click="playMotion('export')"
          >
            <LucideMinimalActionIcon name="export" :motion-key="motionKeys.export" preview-motion />
            <span>导出</span>
          </button>
        </div>
      </header>

      <div class="workbench-content">
        <section class="calendar-surface" aria-labelledby="calendar-preview-title">
          <header class="surface-heading">
            <div>
              <p>本月排班</p>
              <h3 id="calendar-preview-title">2026 年 8 月</h3>
            </div>
            <button
              type="button"
              class="filter-action"
              :class="{ 'is-active': filterActive }"
              :aria-pressed="filterActive"
              @click="toggleFilter"
            >
              <LucideMinimalActionIcon
                name="filter"
                :motion-key="motionKeys.filter"
                preview-motion
              />
              <span>筛选</span>
              <b v-if="filterActive">1</b>
            </button>
          </header>

          <div class="calendar-toolbar">
            <button type="button" aria-label="上个月">‹</button>
            <strong>8 月第 4 周</strong>
            <button
              type="button"
              class="locate-action"
              aria-label="定位到今天"
              @click="playMotion('locate')"
            >
              <LucideMinimalActionIcon
                name="locate"
                :motion-key="motionKeys.locate"
                preview-motion
              />
            </button>
            <button type="button" aria-label="下个月">›</button>
          </div>

          <div class="weekday-row" aria-hidden="true">
            <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
              {{ weekday }}
            </span>
          </div>
          <div class="calendar-grid" aria-label="8 月排班日期示例">
            <button
              v-for="day in calendarDays"
              :key="day"
              type="button"
              :class="{ 'is-selected': day === 21, 'is-weekend': day % 7 === 1 || day % 7 === 2 }"
              :aria-pressed="day === 21"
            >
              <span>{{ day }}</span>
              <small v-if="day === 18 || day === 21 || day === 25">D</small>
            </button>
          </div>

          <article class="duty-row">
            <div>
              <p>8 月 21 日 · 日班</p>
              <strong>李医生</strong>
              <span>08:00–18:00 · 急诊一线</span>
            </div>
            <a
              href="tel:6618"
              aria-label="拨打李医生短号 6618"
              @click.prevent="playMotion('phone')"
            >
              <LucideMinimalActionIcon name="phone" :motion-key="motionKeys.phone" preview-motion />
              <span>短号 6618</span>
            </a>
          </article>
        </section>

        <section class="directory-surface" aria-labelledby="directory-preview-title">
          <header class="surface-heading directory-heading">
            <div>
              <p>快速联系</p>
              <h3 id="directory-preview-title">通讯录</h3>
            </div>
          </header>

          <div class="directory-tabs" role="tablist" aria-label="通讯录模式">
            <button
              type="button"
              role="tab"
              :aria-selected="directoryMode === 'department'"
              :class="{ 'is-active': directoryMode === 'department' }"
              @click="selectDepartment"
            >
              <LucideMinimalActionIcon
                name="department"
                :motion-key="motionKeys.department"
                preview-motion
              />
              <span>科室</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="directoryMode === 'people'"
              :class="{ 'is-active': directoryMode === 'people' }"
              @click="selectPeople"
            >
              <LucideMinimalActionIcon
                name="people"
                :motion-key="motionKeys.people"
                preview-motion
              />
              <span>人员</span>
            </button>
          </div>

          <article v-if="directoryMode === 'department'" class="contact-card">
            <div class="contact-copy">
              <span>急诊医学科</span>
              <strong>抢救室 / 值班台</strong>
              <small>门急诊楼 · 1 层</small>
            </div>
            <div class="dial-stack">
              <a href="tel:6618" @click.prevent="playMotion('phone')">
                <span>短号 6618</span>
                <LucideMinimalActionIcon
                  name="phone"
                  :motion-key="motionKeys.phone"
                  preview-motion
                />
              </a>
              <a href="tel:13800138000" @click.prevent="playMotion('phone')">
                <span>手机 138 0013 8000</span>
                <LucideMinimalActionIcon
                  name="phone"
                  :motion-key="motionKeys.phone"
                  preview-motion
                />
              </a>
            </div>
          </article>

          <article v-else class="contact-card">
            <div class="contact-copy">
              <span>林医生</span>
              <strong>主治医师 · 急诊医学科</strong>
              <small>今日 18:00 前在岗</small>
            </div>
            <div class="dial-stack">
              <a href="tel:6639" @click.prevent="playMotion('phone')">
                <span>短号 6639</span>
                <LucideMinimalActionIcon
                  name="phone"
                  :motion-key="motionKeys.phone"
                  preview-motion
                />
              </a>
              <a href="tel:13800138039" @click.prevent="playMotion('phone')">
                <span>手机 138 0013 8039</span>
                <LucideMinimalActionIcon
                  name="phone"
                  :motion-key="motionKeys.phone"
                  preview-motion
                />
              </a>
            </div>
          </article>

          <p class="preview-note">
            同一图标在顶部、筛选、定位、科室/人员切换及所有拨号入口保持一致线宽。
          </p>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.action-motion-preview {
  min-height: 100vh;
  padding: 34px;
  color: #17202a;
  background: #f3f5f8;
  font-family:
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.preview-intro {
  display: flex;
  width: min(1120px, 100%);
  margin: 0 auto 22px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.preview-intro p,
.surface-heading p,
.duty-row p {
  margin: 0;
  color: #66717e;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.preview-intro h1 {
  margin: 5px 0 0;
  font-family:
    'SF Pro Display',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 720;
  letter-spacing: -0.035em;
}

.preview-intro > span {
  padding: 7px 11px;
  color: #125ab7;
  background: #e9f2ff;
  border: 1px solid #cfe1fb;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.motion-board {
  display: grid;
  width: min(1120px, 100%);
  margin: 0 auto 18px;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
}

.motion-swatch {
  display: grid;
  min-height: 118px;
  padding: 14px 10px 11px;
  justify-items: center;
  align-content: start;
  color: #17202a;
  background: #ffffff;
  border: 1px solid #e1e6ec;
  border-radius: 16px;
  cursor: pointer;
  font: inherit;
  text-align: center;
}

.swatch-icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 9px;
  place-items: center;
  color: #1769e0;
  background: #edf4ff;
  border-radius: 13px;
}

.motion-swatch strong {
  font-size: 13px;
}

.motion-swatch small {
  margin-top: 4px;
  color: #5d6874;
  font-size: 10px;
  text-align: center;
}

.workbench-frame {
  width: min(1120px, 100%);
  margin: 0 auto;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #dce2e8;
  border-radius: 26px;
  box-shadow: 0 20px 54px rgb(24 38 55 / 11%);
}

.workbench-header {
  display: flex;
  min-height: 80px;
  padding: 15px 18px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  background: rgb(255 255 255 / 96%);
  border-bottom: 1px solid #e2e7ec;
}

.workbench-heading span {
  color: #5b6672;
  font-size: 12px;
}

.workbench-heading h2 {
  margin: 2px 0 0;
  font-size: 19px;
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-action,
.export-action,
.filter-action,
.calendar-toolbar button,
.directory-tabs button {
  min-width: 44px;
  min-height: 44px;
  color: #17202a;
  background: #f3f5f7;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
}

.icon-action {
  position: relative;
  display: grid;
  width: 44px;
  padding: 0;
  place-items: center;
  border-radius: 14px;
}

.unread-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: #e64b4b;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.export-action,
.filter-action {
  display: inline-flex;
  padding: 0 12px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #1769e0;
  border-color: #d7e1ec;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
}

.workbench-content {
  display: grid;
  padding: 18px;
  grid-template-columns: minmax(0, 1.18fr) minmax(330px, 0.82fr);
  gap: 14px;
  background: #f6f8fa;
}

.calendar-surface,
.directory-surface {
  min-width: 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e1e6ec;
  border-radius: 18px;
}

.surface-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.surface-heading h3 {
  margin: 2px 0 0;
  font-size: 18px;
  letter-spacing: -0.02em;
}

.filter-action.is-active {
  color: #ffffff;
  background: #1769e0;
  border-color: #1769e0;
}

.filter-action b {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  color: #1769e0;
  background: #ffffff;
  border-radius: 50%;
  font-size: 10px;
}

.calendar-toolbar {
  display: grid;
  min-height: 52px;
  margin-top: 13px;
  grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
  align-items: center;
  border: 1px solid #e1e6ec;
  border-radius: 15px 15px 0 0;
}

.calendar-toolbar button {
  display: grid;
  padding: 0;
  place-items: center;
  background: transparent;
  border-radius: 12px;
  font-size: 24px;
}

.calendar-toolbar strong {
  text-align: center;
  font-size: 14px;
}

.weekday-row,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  color: #73808c;
  background: #f6f8fa;
  border-right: 1px solid #e1e6ec;
  border-left: 1px solid #e1e6ec;
  font-size: 11px;
  text-align: center;
}

.weekday-row span {
  padding: 7px 0;
}

.calendar-grid {
  overflow: hidden;
  border: 1px solid #e1e6ec;
  border-radius: 0 0 15px 15px;
}

.calendar-grid button {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 56px;
  padding: 7px;
  place-items: start center;
  color: #27313b;
  background: #ffffff;
  border: 0;
  border-right: 1px solid #edf0f3;
  border-bottom: 1px solid #edf0f3;
  font: inherit;
  font-size: 12px;
}

.calendar-grid button.is-weekend {
  color: #9f4141;
}

.calendar-grid button.is-selected {
  box-shadow: inset 0 0 0 2px #1769e0;
}

.calendar-grid small {
  display: grid;
  min-width: 18px;
  height: 14px;
  margin-top: 3px;
  place-items: center;
  color: #ffffff;
  background: #1769e0;
  border-radius: 4px;
  font-size: 8px;
  font-weight: 750;
}

.duty-row {
  display: grid;
  min-height: 78px;
  margin-top: 12px;
  padding: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  background: #f7f9fb;
  border: 1px solid #e1e6ec;
  border-radius: 15px;
}

.duty-row > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.duty-row strong {
  font-size: 15px;
}

.duty-row > div span {
  overflow: hidden;
  color: #56626e;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duty-row a,
.dial-stack a {
  display: inline-flex;
  min-height: 44px;
  padding: 0 10px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #1769e0;
  background: #edf4ff;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.directory-tabs {
  display: grid;
  margin-top: 13px;
  padding: 3px;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  background: #eef1f4;
  border-radius: 14px;
}

.directory-tabs button {
  display: inline-flex;
  padding: 0 12px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #4f5c68;
  background: transparent;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
}

.directory-tabs button.is-active {
  color: #1769e0;
  background: #ffffff;
  box-shadow: 0 2px 7px rgb(26 42 59 / 9%);
}

.contact-card {
  display: grid;
  margin-top: 12px;
  padding: 13px;
  gap: 12px;
  border: 1px solid #e1e6ec;
  border-radius: 15px;
}

.contact-copy {
  display: grid;
  gap: 3px;
}

.contact-copy > span {
  color: #1769e0;
  font-size: 12px;
  font-weight: 700;
}

.contact-copy strong {
  font-size: 15px;
}

.contact-copy small,
.preview-note {
  color: #596672;
  font-size: 11px;
  line-height: 1.5;
}

.dial-stack {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.dial-stack a {
  justify-content: space-between;
}

.preview-note {
  width: min(1120px, 100%);
  margin: 12px auto 0;
}

.directory-surface > .preview-note {
  width: auto;
  margin: 11px 2px 0;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid rgb(23 105 224 / 25%);
  outline-offset: 2px;
}

@media (max-width: 920px) {
  .motion-board {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .workbench-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .action-motion-preview {
    padding: 18px 0 28px;
  }

  .preview-intro,
  .motion-board,
  .preview-note {
    width: auto;
    margin-right: 14px;
    margin-left: 14px;
  }

  .preview-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .preview-intro h1 {
    font-size: 25px;
  }

  .motion-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .motion-swatch {
    min-height: 106px;
  }

  .workbench-frame {
    width: 100%;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .workbench-header {
    min-height: 76px;
    padding: 13px 12px;
  }

  .header-actions {
    gap: 2px;
  }

  .export-action {
    width: 44px;
    padding: 0;
  }

  .export-action > span:last-child {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
  }

  .workbench-content {
    padding: 12px;
    gap: 12px;
  }

  .calendar-surface,
  .directory-surface {
    padding: 12px;
    border-radius: 16px;
  }

  .filter-action {
    padding: 0 10px;
  }

  .calendar-grid button {
    min-height: 48px;
    padding: 5px 2px;
  }

  .duty-row {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .duty-row a {
    justify-self: stretch;
  }

  .dial-stack {
    grid-template-columns: 1fr;
  }
}
</style>
