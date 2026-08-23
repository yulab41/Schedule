<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
} from '@schedule/contracts/manual-schedule-limits';
import {
  applyManualCellMutation,
  resolveManualCellMutation,
  resolveManualSelection,
} from '@schedule/presentation-core';
import { computed, ref, watch } from 'vue';

import MonthGrid from '../../features/calendar/MonthGrid.vue';
import ManualGrid from '../../features/manual-schedule/ManualGrid.vue';
import ShiftPalette from '../../features/manual-schedule/ShiftPalette.vue';
import {
  createCellKey,
  type ManualGridSelection,
  type TemplateCellMap,
} from '../../features/manual-schedule/manual-schedule-logic.js';
import { createMiniprogramMatrixFixture } from './miniprogram-parity-fixtures.js';

export type P5SchedulingPreviewState =
  | 'backfill'
  | 'editor'
  | 'maximum'
  | 'phone-consent'
  | 'preview'
  | 'release'
  | 'release-blocked'
  | 'release-delete'
  | 'release-republish'
  | 'release-withdraw'
  | 'risk';

const props = withDefaults(
  defineProps<{
    readonly state?: P5SchedulingPreviewState;
    readonly viewport?: 'mobile-320' | 'mobile-390';
  }>(),
  { state: 'editor', viewport: 'mobile-390' },
);

const activeState = ref<P5SchedulingPreviewState>(props.state);
const activeShiftTypeId = ref('shift-a');
const selectedCell = ref<ManualGridSelection>();
const riskAccepted = ref(false);
const releaseAccepted = ref(false);
const releasePastAccepted = ref(false);
const releaseReplaceAccepted = ref(false);
const phoneConsent = ref(false);
const activeBackfillMemberId = ref('member-1');
const backfillReason = ref('实际值班人员更正');
const backfillPending = ref([
  { date: '2026-07-03', memberName: '林医生', shiftTypeName: '白班' },
  { date: '2026-07-08', memberName: '陈护士', shiftTypeName: '夜班' },
]);

const fixture = computed(() =>
  createMiniprogramMatrixFixture(activeState.value === 'maximum' ? 'maximum' : 'daily'),
);
const cells = ref<TemplateCellMap>(new Map(createMiniprogramMatrixFixture('daily').cells));
const isReleaseState = computed(() => activeState.value.startsWith('release'));
const stageIndex = computed(() => {
  if (activeState.value === 'preview' || activeState.value === 'risk') return 1;
  if (isReleaseState.value) return 3;
  return 0;
});
const isSchedulingState = computed(() =>
  ['editor', 'maximum', 'preview', 'risk'].includes(activeState.value),
);
const backfillMembers = computed(() => fixture.value.rows.slice(0, 4));
const backfillHighlightedDates = computed(
  () => new Set(backfillPending.value.map((item) => item.date)),
);
const backfillHolidays = new Map<string, ConfirmedHolidayDate>();
const backfillAssignments: readonly CalendarDutyAssignment[] = [];
const backfillCalendarMembers: readonly CalendarDutyMember[] = [];
const limitUsage = computed(() => ({
  cells: activeState.value === 'maximum' ? MAX_MANUAL_CELLS : fixture.value.logicalCellCount,
  days: activeState.value === 'maximum' ? MAX_MANUAL_DAYS : fixture.value.columns.length,
  members: activeState.value === 'maximum' ? MAX_MANUAL_MEMBERS : fixture.value.rows.length,
}));

const stages = [
  { label: '模板编辑', short: '编辑' },
  { label: '风险预览', short: '预览' },
  { label: '保存草稿', short: '草稿' },
  { label: '发布生效', short: '发布' },
] as const;

watch(
  () => props.state,
  (state) => {
    activeState.value = state;
    releaseAccepted.value = false;
    releasePastAccepted.value = false;
    releaseReplaceAccepted.value = false;
  },
);

watch(
  fixture,
  (nextFixture) => {
    cells.value = new Map(nextFixture.cells);
    selectedCell.value = nextFixture.selectedCell;
  },
  { immediate: true },
);

function selectCell(selection: ManualGridSelection): void {
  selectedCell.value = resolveManualSelection(selectedCell.value, selection, {
    isSame: isSameManualGridSelection,
    mode: 'toggle',
  });
  const key = createCellKey(selection.cycleDay, selection.membershipId);
  cells.value = applyManualCellMutation(
    cells.value,
    resolveManualCellMutation({
      active: activeShiftTypeId.value,
      before: cells.value.get(key),
      key,
      mode: 'toggle',
    }),
  );
}

function isSameManualGridSelection(left: ManualGridSelection, right: ManualGridSelection): boolean {
  return left.cycleDay === right.cycleDay && left.membershipId === right.membershipId;
}

function removeBackfill(date: string): void {
  backfillPending.value = backfillPending.value.filter((item) => item.date !== date);
}

function toggleBackfill(date: string): void {
  if (backfillHighlightedDates.value.has(date)) {
    removeBackfill(date);
    return;
  }
  const member = backfillMembers.value.find(
    (item) => item.membershipId === activeBackfillMemberId.value,
  );
  const shiftType = fixture.value.shiftTypes.find((item) => item.id === activeShiftTypeId.value);
  backfillPending.value = [
    ...backfillPending.value,
    {
      date,
      memberName: member?.realName ?? '未选择成员',
      shiftTypeName: shiftType?.name ?? '未选择班种',
    },
  ];
}

function closeReleaseDialog(): void {
  releaseAccepted.value = false;
  releasePastAccepted.value = false;
  activeState.value = 'release';
}
</script>

<template>
  <main
    class="p5-preview"
    :class="[`is-${viewport}`, `state-${activeState}`, { 'has-action-dock': isSchedulingState }]"
  >
    <header class="mini-header">
      <button type="button" class="header-back" aria-label="返回排班台">‹</button>
      <div class="header-title">
        <strong>{{
          activeState === 'phone-consent'
            ? '群组管理'
            : activeState === 'backfill'
              ? '排班补录'
              : '手动排班'
        }}</strong>
        <span>头颈外科医生 · 管理员</span>
      </div>
      <span class="phase-chip">P5</span>
    </header>

    <section v-if="isSchedulingState" class="handoff-rail" aria-label="排班交接进度">
      <div class="handoff-heading">
        <div>
          <span>排班交接轨</span>
          <strong>一线值班 · 2026年8月</strong>
        </div>
        <span class="handoff-state">{{ stages[stageIndex]?.label }}</span>
      </div>
      <ol>
        <li
          v-for="(stage, index) in stages"
          :key="stage.label"
          :class="{ 'is-active': index === stageIndex, 'is-complete': index < stageIndex }"
        >
          <span class="stage-marker">{{ index < stageIndex ? '✓' : index + 1 }}</span>
          <span>{{ stage.short }}</span>
        </li>
      </ol>
      <dl class="limit-ledger">
        <div>
          <dt>人员</dt>
          <dd>{{ limitUsage.members }}/{{ MAX_MANUAL_MEMBERS }}</dd>
        </div>
        <div>
          <dt>天数</dt>
          <dd>{{ limitUsage.days }}/{{ MAX_MANUAL_DAYS }}</dd>
        </div>
        <div>
          <dt>逻辑格</dt>
          <dd>{{ limitUsage.cells }}/{{ MAX_MANUAL_CELLS }}</dd>
        </div>
      </dl>
    </section>

    <template v-if="activeState === 'editor' || activeState === 'maximum'">
      <section class="section-card template-context">
        <div class="section-heading">
          <div>
            <span>模板</span>
            <h1>{{ activeState === 'maximum' ? '上限矩阵校验' : '七日循环模板' }}</h1>
          </div>
          <span class="status-badge is-draft">未保存</span>
        </div>
        <div class="field-grid">
          <button type="button"><span>排班岗位</span><strong>一线值班</strong></button>
          <button type="button"><span>开始日期</span><strong>2026-08-03 周一</strong></button>
          <button type="button">
            <span>周期天数</span><strong>{{ fixture.columns.length }} 天</strong>
          </button>
          <button type="button">
            <span>值班人员</span><strong>{{ fixture.rows.length }} 人</strong>
          </button>
        </div>
      </section>

      <section v-if="activeState === 'maximum'" class="limit-notice" role="status">
        <strong>已达到单模板上限</strong>
        <span>仍可编辑或撤销；继续增加人员、天数或单元格会被前后端同时拒绝。</span>
      </section>

      <section class="matrix-section">
        <div class="section-heading matrix-title">
          <div>
            <span>班种与矩阵</span>
            <h2>点格排班</h2>
          </div>
        </div>
        <ShiftPalette
          :active-shift-type-id="activeShiftTypeId"
          :shift-types="fixture.shiftTypes"
          @select="activeShiftTypeId = $event"
        />
        <ManualGrid
          :cells="cells"
          :columns="fixture.columns"
          :holidays="fixture.holidays"
          :rows="fixture.rows"
          :selected-cell="selectedCell"
          :shift-types="fixture.shiftTypes"
          :stale-cell-keys="fixture.staleCellKeys"
          @select-cell="selectCell"
        />
      </section>

      <footer class="action-dock">
        <button type="button" class="secondary-action">保存模板</button>
        <button type="button" class="primary-action" @click="activeState = 'preview'">
          生成预览
        </button>
      </footer>
    </template>

    <template v-else-if="activeState === 'preview' || activeState === 'risk'">
      <section class="section-card range-card">
        <div class="section-heading">
          <div>
            <span>应用范围</span>
            <h1>30 天排班预览</h1>
          </div>
          <span class="range-days">含首尾 30 天</span>
        </div>
        <div class="date-range">
          <time datetime="2026-08-01">08月01日</time>
          <span aria-hidden="true">→</span>
          <time datetime="2026-08-30">08月30日</time>
        </div>
        <p>七日模板循环 4 次并截取最后 2 天；本次共生成 42 个班次。</p>
      </section>

      <section class="preview-metrics" aria-label="预览汇总">
        <div><span>班次</span><strong>42</strong></div>
        <div>
          <span>空缺</span
          ><strong :class="{ danger: activeState === 'risk' }">{{
            activeState === 'risk' ? 2 : 0
          }}</strong>
        </div>
        <div><span>连续值班</span><strong class="warning">1</strong></div>
      </section>

      <section v-if="activeState === 'risk'" class="risk-panel is-blocking">
        <header>
          <span>必须处理</span>
          <strong>2 个空缺会阻止直接发布</strong>
        </header>
        <ul>
          <li><span>08月12日 · 全天班</span><strong>成员已离开岗位</strong></li>
          <li><span>08月26日 · 夜班</span><strong>班种已停用</strong></li>
        </ul>
      </section>

      <section class="risk-panel">
        <header>
          <span>需要确认</span>
          <strong>连续值班风险</strong>
        </header>
        <div class="risk-row">
          <div>
            <strong>林恩宇</strong>
            <span>08月17日 08:00 至 08月18日 11:00</span>
          </div>
          <span class="risk-tone">27 小时</span>
        </div>
      </section>

      <label class="consent-row">
        <input v-model="riskAccepted" type="checkbox" />
        <span>
          <strong>我已核对空缺和连续值班风险</strong>
          <small>范围变化后必须重新生成预览并再次确认。</small>
        </span>
      </label>

      <footer class="action-dock">
        <button type="button" class="secondary-action" @click="activeState = 'editor'">
          返回修改
        </button>
        <button
          type="button"
          class="primary-action"
          :disabled="!riskAccepted || activeState === 'risk'"
        >
          保存为草稿
        </button>
      </footer>
    </template>

    <template v-else-if="isReleaseState">
      <section class="web-parity-page manual-release-page">
        <h2>手动排班</h2>

        <section class="draft-section">
          <h3>排班草稿</h3>
          <p class="draft-hint">
            模板应用后按开始到结束时间保存为一条草稿，可一次发布整个范围；重复应用时可选择覆盖旧草稿。
          </p>
          <div class="draft-list">
            <article class="draft-row">
              <div class="draft-summary">
                <strong>2026-08-01 至 2026-08-30</strong>
                <span>草稿 #3</span>
                <span>一线值班</span>
                <span>共 1 个月</span>
                <span class="month-chips">
                  <button type="button" class="month-chip">2026-08</button>
                </span>
              </div>
              <div class="web-row-actions">
                <button
                  type="button"
                  class="web-button is-primary"
                  @click="activeState = 'release-blocked'"
                >
                  发布整个排班
                </button>
                <button
                  type="button"
                  class="web-button is-danger-text"
                  @click="activeState = 'release-delete'"
                >
                  删除草稿
                </button>
              </div>
            </article>
          </div>
          <div v-if="activeState === 'release-blocked'" class="blocker-panel">
            <div class="release-callout is-warning" role="alert">
              发布范围包含已有已发布排班的月份，请确认覆盖发布。
            </div>
            <div class="month-chips">
              <span class="month-chip is-conflict">2026-08</span>
            </div>
            <label class="replace-field">
              <input v-model="releaseReplaceAccepted" type="checkbox" />
              覆盖已发布排班（替换同岗位同月份的旧排班）
            </label>
            <div class="workflow-impact-list">
              <strong>覆盖后将撤销以下已生效或处理中事件：</strong>
              <span>换班 · 林医生、陈医生 · 2026-08-17、2026-08-18</span>
              <label class="acknowledge-field">
                <input v-model="releaseAccepted" type="checkbox" />
                我已了解这些事件将因排班变更被撤销
              </label>
            </div>
            <div class="blocker-actions">
              <button type="button" class="web-button is-outline" @click="activeState = 'release'">
                取消
              </button>
              <button
                type="button"
                class="web-button is-danger-outline"
                :disabled="!releaseReplaceAccepted || !releaseAccepted"
              >
                确认覆盖发布
              </button>
            </div>
          </div>
        </section>

        <section class="draft-section">
          <h3>排班发布记录</h3>
          <p class="draft-hint">
            月份已过的排班自动转为“既往排班（锁定）”，已过日期不可修改；已归档版本会随月份过期自动清理。
          </p>
          <div class="draft-list">
            <article class="month-group">
              <div class="month-group-header">
                <strong>2026-08</strong>
                <span>一线值班</span>
              </div>
              <div class="version-row">
                <div class="draft-summary">
                  <span class="version-badge is-current">当前已发布</span>
                  <span>草稿 #2</span>
                </div>
                <div class="web-row-actions">
                  <button type="button" class="web-button is-outline">查看</button>
                  <button
                    type="button"
                    class="web-button is-danger-outline"
                    @click="activeState = 'release-withdraw'"
                  >
                    撤销发布
                  </button>
                </div>
              </div>
              <details class="archived-details" open>
                <summary>已归档（1）</summary>
                <div class="version-row">
                  <div class="draft-summary">
                    <span class="version-badge">已归档</span>
                    <span>草稿 #1</span>
                  </div>
                  <div class="web-row-actions">
                    <button type="button" class="web-button is-outline">查看</button>
                    <button
                      type="button"
                      class="web-button is-primary-outline"
                      @click="activeState = 'release-republish'"
                    >
                      重新发布
                    </button>
                    <button
                      type="button"
                      class="web-button is-danger-text"
                      @click="activeState = 'release-delete'"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </details>
            </article>

            <article class="month-group">
              <div class="month-group-header">
                <strong>2026-07</strong>
                <span>一线值班</span>
              </div>
              <div class="version-row">
                <div class="draft-summary">
                  <span class="version-badge is-past">既往排班（锁定）</span>
                  <span>草稿 #4</span>
                </div>
                <div class="web-row-actions">
                  <button type="button" class="web-button is-outline">查看</button>
                  <button type="button" class="web-button is-outline">排班补录</button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>

      <div
        v-if="
          activeState === 'release-withdraw' ||
          activeState === 'release-republish' ||
          activeState === 'release-delete'
        "
        class="release-dialog-layer"
        @click.self="closeReleaseDialog"
      >
        <section
          class="release-dialog"
          :class="{ 'is-danger': activeState !== 'release-republish' }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`release-dialog-title-${activeState}`"
        >
          <header class="release-dialog-header">
            <div>
              <span>{{ activeState === 'release-delete' ? '不可恢复操作' : '排班版本变更' }}</span>
              <h2 :id="`release-dialog-title-${activeState}`">
                {{
                  activeState === 'release-withdraw'
                    ? '撤销当前排班'
                    : activeState === 'release-republish'
                      ? '重新发布归档排班'
                      : '删除排班草稿'
                }}
              </h2>
            </div>
            <button
              type="button"
              class="dialog-close"
              aria-label="关闭"
              @click="closeReleaseDialog"
            >
              ×
            </button>
          </header>

          <p class="release-dialog-meta">
            {{
              activeState === 'release-delete'
                ? '2026-08-01 至 2026-08-30 · 共 1 个月'
                : '2026-08 · 一线值班'
            }}
          </p>

          <template v-if="activeState === 'release-withdraw'">
            <div class="release-callout is-warning">
              撤销后仅未来日期失效；已过日期将保留为既往排班（锁定），仍在月历中显示且不可修改。
            </div>
            <div class="workflow-impact-list">
              <strong>本次变更将撤销以下事件，撤销原因为“排班变更”：</strong>
              <span>换班 · 林医生、陈医生 · 2026-08-17、2026-08-18</span>
            </div>
            <label class="acknowledge-field">
              <input v-model="releaseAccepted" type="checkbox" />
              我已了解上述影响，确认继续
            </label>
          </template>

          <template v-else-if="activeState === 'release-republish'">
            <div class="release-callout is-info">
              重新发布后，该版本将成为当前排班，原当前版本自动进入归档。
            </div>
            <div class="release-callout is-warning">
              该版本包含已过日期；已过日期不可修改，发布后仍保持既往排班（锁定）状态，是否发布？
            </div>
            <div class="release-callout is-warning">该归档版本包含 1 处硬冲突和 2 个空缺。</div>
            <div class="workflow-impact-list">
              <strong>本次变更将撤销以下事件，撤销原因为“排班变更”：</strong>
              <span>加扣班 · 王医生 · 2026-08-21</span>
            </div>
            <label class="acknowledge-field">
              <input v-model="releaseAccepted" type="checkbox" />
              我已了解上述影响，确认继续
            </label>
            <label class="acknowledge-field">
              <input v-model="releasePastAccepted" type="checkbox" />
              我已了解已过日期不可修改，确认发布
            </label>
          </template>

          <template v-else>
            <div class="release-callout is-danger">
              确定删除 2026-08-01 至 2026-08-30 的排班草稿吗？删除后不可恢复。
            </div>
            <p class="delete-note">这只删除尚未发布的草稿，不会修改当前已发布排班。</p>
          </template>

          <footer class="release-dialog-actions">
            <button type="button" class="web-button is-outline" @click="closeReleaseDialog">
              取消
            </button>
            <button
              type="button"
              class="web-button"
              :class="activeState === 'release-republish' ? 'is-primary' : 'is-danger-solid'"
              :disabled="
                (activeState === 'release-withdraw' && !releaseAccepted) ||
                (activeState === 'release-republish' && (!releaseAccepted || !releasePastAccepted))
              "
            >
              {{
                activeState === 'release-withdraw'
                  ? '确认撤销发布'
                  : activeState === 'release-republish'
                    ? '确认重新发布'
                    : '删除草稿'
              }}
            </button>
          </footer>
        </section>
      </div>
    </template>

    <template v-else-if="activeState === 'backfill'">
      <section class="web-parity-page past-schedule-view">
        <h2>排班补录</h2>
        <div class="web-alert" role="note">
          仅管理员与群主可进入，可自由切换既往月份/年份。先选择班种和成员（再次点击取消选中），再点击日历中的既往日期配班；确认后才会生效并留下“排班补录”事件记录。
        </div>

        <div class="controls">
          <label>
            排班岗位
            <button type="button" class="web-input-shell">
              <span>一线值班</span><span aria-hidden="true">⌄</span>
            </button>
          </label>
          <label>
            月份
            <span class="month-nav">
              <button type="button" class="web-button is-outline">‹ 上一月</button>
              <button type="button" class="web-input-shell month-input">2026-07</button>
              <button type="button" class="web-button is-outline">下一月 ›</button>
            </span>
          </label>
          <span class="month-label">2026年7月</span>
        </div>

        <div class="palette-section">
          <div class="palette-row">
            <span class="palette-label">班种</span>
            <button
              v-for="shiftType in fixture.shiftTypes"
              :key="shiftType.id"
              type="button"
              class="palette-button shift-type-button"
              :class="{ 'is-active': activeShiftTypeId === shiftType.id }"
              :aria-pressed="activeShiftTypeId === shiftType.id"
              :style="{ backgroundColor: shiftType.color, color: shiftType.textColor }"
              @click="activeShiftTypeId = shiftType.id"
            >
              {{ shiftType.name }}
            </button>
          </div>
          <div class="palette-row">
            <span class="palette-label">成员</span>
            <button
              v-for="member in backfillMembers"
              :key="member.membershipId"
              type="button"
              class="palette-button member-button"
              :class="{ 'is-active': activeBackfillMemberId === member.membershipId }"
              :aria-pressed="activeBackfillMemberId === member.membershipId"
              @click="activeBackfillMemberId = member.membershipId"
            >
              {{ member.realName }}
            </button>
          </div>
          <label class="reason-field">
            补录说明（选填，作用于本次确认）
            <textarea v-model="backfillReason" maxlength="1000" placeholder="记录本次补录原因" />
          </label>
        </div>

        <div class="paint-status is-ready" aria-live="polite">
          <span class="paint-status-label">当前配班</span>
          <strong>林医生 · 白班</strong>
          <span class="paint-status-message">点击既往日期加入待确认</span>
        </div>

        <div v-if="backfillPending.length > 0" class="staged-panel">
          <strong>待确认补录（{{ backfillPending.length }}）</strong>
          <button
            v-for="item in backfillPending"
            :key="item.date"
            type="button"
            class="staged-item"
            :aria-label="`移除 ${item.date} ${item.memberName} ${item.shiftTypeName} 的待确认补录`"
            @click="removeBackfill(item.date)"
          >
            <span>{{ item.date }}：{{ item.memberName }} · {{ item.shiftTypeName }}</span>
            <span class="staged-remove">移除</span>
          </button>
          <div class="staged-actions">
            <button type="button" class="web-button is-primary">确认补录</button>
            <button type="button" class="web-button is-outline" @click="backfillPending = []">
              清空草稿
            </button>
          </div>
        </div>

        <p class="paint-hint">
          提示：灰色为未来日期（不可补录），正常底色为既往日期；可连续点击多个日期加入待确认（蓝色描边），再统一点击“确认补录”一次性生效；再次点击已加入的日期可取消该项（不会生成记录）。
        </p>

        <section class="backfill-calendar" aria-label="补录日期选择">
          <div class="backfill-calendar-heading">
            <strong>2026年7月</strong>
            <span>点击整格加入或取消待确认补录</span>
          </div>
          <MonthGrid
            :assignments="backfillAssignments"
            business-month="2026-07"
            :highlighted-dates="backfillHighlightedDates"
            :holidays="backfillHolidays"
            :invert-past-colors="true"
            :members="backfillCalendarMembers"
            today="2026-08-23"
            @select-date="toggleBackfill"
          />
        </section>

        <section class="events-section">
          <h3>最近补录记录</h3>
          <ul>
            <li>
              <span class="event-time">2026/08/20 09:18:00</span>
              2026-07-01 · 周护士 · 夜班 · 实际值班人员更正 · 操作人：林恩宇
            </li>
          </ul>
        </section>
      </section>
    </template>

    <template v-else>
      <section class="web-parity-page group-setup-panel">
        <header class="group-panel-heading">
          <div>
            <p>协作身份</p>
            <h2>群组管理</h2>
          </div>
          <span>创建或加入工作群组，并管理当前群组的共享身份。</span>
        </header>

        <section class="group-identity-band">
          <div class="group-identity-copy">
            <span>当前工作群组</span>
            <strong>头颈外科医生</strong>
            <small>管理员</small>
          </div>
          <div class="group-code-block">
            <span>共享群组码</span>
            <div class="group-code-digits" aria-label="群组码 2 6 0 8">
              <strong v-for="digit in ['2', '6', '0', '8']" :key="digit">{{ digit }}</strong>
            </div>
          </div>
        </section>

        <div class="group-card-grid">
          <section class="group-card contact-consent-card">
            <header class="group-card-header"><strong>联系方式公开</strong></header>
            <div class="group-card-body">
              <section class="contact-consent-section">
                <header>
                  <div>
                    <strong>我的手机号公开设置</strong>
                    <span>仅决定当前群组成员能否查看您的完整手机号。</span>
                  </div>
                  <span class="preference-scope is-personal">仅自己</span>
                </header>

                <div class="contact-member-row">
                  <div class="phone-avatar">林</div>
                  <div>
                    <strong>林恩宇</strong>
                    <span>手机号 138 **** 7926</span>
                    <small>说明版本 v1 · 号码变更后需重新同意</small>
                  </div>
                </div>

                <label class="phone-consent-control">
                  <input v-model="phoneConsent" type="checkbox" role="switch" />
                  <span>
                    <strong>允许本群组显示完整手机号</strong>
                    <small>此选择可随时撤回，不影响账号、资料或排班。</small>
                  </span>
                </label>

                <p class="privacy-boundary">
                  管理员不能代替成员授权，也不能把同意复制到其他群组；撤回后完整号码立即隐藏。
                </p>
                <button
                  type="button"
                  class="web-button is-primary consent-save"
                  :disabled="!phoneConsent"
                >
                  保存同意
                </button>
              </section>
            </div>
          </section>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
  margin: 0;
  background: var(--ui-color-background);
}

.p5-preview {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0 14px calc(24px + env(safe-area-inset-bottom));
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

.p5-preview.has-action-dock {
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

button,
input {
  font: inherit;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.mini-header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: grid;
  min-height: 64px;
  margin: 0 -14px;
  padding: 8px 14px;
  box-sizing: border-box;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  background: rgb(244 247 250 / 94%);
  border-bottom: 1px solid var(--ui-color-border);
  backdrop-filter: blur(16px);
}

.header-back {
  width: 44px;
  height: 44px;
  padding: 0 2px 4px 0;
  color: var(--ui-color-primary-dark);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-medium);
  font-size: 34px;
  line-height: 1;
}

.header-title {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.header-title strong {
  font-size: var(--ui-font-size-lg);
  letter-spacing: -0.02em;
}

.header-title span {
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phase-chip,
.status-badge,
.handoff-state,
.range-days {
  display: inline-flex;
  min-height: 28px;
  padding: 0 9px;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.phase-chip {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
}

.handoff-rail {
  margin-top: 12px;
  padding: 13px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.handoff-heading,
.section-heading,
.risk-panel header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.handoff-heading > div,
.section-heading > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.handoff-heading > div > span,
.section-heading > div > span,
.risk-panel header > span {
  color: var(--ui-color-primary);
  font-size: 11px;
  font-weight: var(--ui-font-weight-strong);
  letter-spacing: 0.06em;
}

.handoff-heading strong {
  font-size: var(--ui-font-size-md);
}

.handoff-state {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
}

.handoff-rail ol {
  position: relative;
  display: grid;
  margin: 13px 0 12px;
  padding: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.handoff-rail ol::before {
  position: absolute;
  top: 12px;
  right: 10%;
  left: 10%;
  height: 2px;
  content: '';
  background: var(--ui-color-border);
}

.handoff-rail li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  color: var(--ui-color-text-muted);
  font-size: 11px;
}

.stage-marker {
  z-index: 1;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border: 2px solid var(--ui-color-border);
  border-radius: 50%;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.handoff-rail li.is-active,
.handoff-rail li.is-complete {
  color: var(--ui-color-primary-dark);
  font-weight: var(--ui-font-weight-semibold);
}

.handoff-rail li.is-active .stage-marker,
.handoff-rail li.is-complete .stage-marker {
  color: #fff;
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.limit-ledger {
  display: grid;
  margin: 0;
  padding: 9px 4px 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--ui-color-border);
}

.limit-ledger div {
  display: grid;
  gap: 2px;
  text-align: center;
}

.limit-ledger div + div {
  border-left: 1px solid var(--ui-color-border);
}

.limit-ledger dt {
  color: var(--ui-color-text-muted);
  font-size: 10px;
}

.limit-ledger dd {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.section-card,
.matrix-section,
.risk-panel {
  margin-top: 10px;
  padding: 13px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.section-heading h1,
.section-heading h2 {
  margin: 0;
  font-size: var(--ui-font-size-lg);
  line-height: var(--ui-line-height-title);
}

.status-badge.is-draft {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.status-badge.is-ready {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.field-grid {
  display: grid;
  margin-top: 11px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-grid button {
  display: grid;
  min-height: 54px;
  padding: 8px 10px;
  text-align: left;
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.field-grid span {
  color: var(--ui-color-text-muted);
  font-size: 10px;
}

.field-grid strong {
  margin-top: 2px;
  overflow: hidden;
  font-size: var(--ui-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limit-notice {
  display: grid;
  margin: 10px 0 0;
  padding: 11px 12px;
  gap: 3px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border: 1px solid #efc56f;
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.matrix-section {
  overflow: hidden;
  padding: 12px 10px 10px;
}

.matrix-title {
  margin: 0 2px 9px;
  align-items: center;
}

.primary-action:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
}

.action-dock {
  position: fixed;
  z-index: 6;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  background: rgb(255 255 255 / 96%);
  border-top: 1px solid var(--ui-color-border);
  backdrop-filter: blur(16px);
}

.action-dock.single-action {
  grid-template-columns: minmax(0, 1fr);
}

.action-dock button {
  min-height: 48px;
  border-radius: var(--ui-radius-medium);
  font-weight: var(--ui-font-weight-semibold);
}

.secondary-action {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
}

.primary-action {
  color: #fff;
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
}

.range-days {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
}

.date-range {
  display: grid;
  margin-top: 13px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 9px;
}

.date-range time {
  padding: 12px 8px;
  text-align: center;
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-small);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
  font-weight: 700;
}

.range-card p,
.version-summary p {
  margin: 10px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.preview-metrics {
  display: grid;
  margin-top: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.preview-metrics div {
  display: grid;
  min-height: 68px;
  padding: 9px;
  box-sizing: border-box;
  align-content: center;
  text-align: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.preview-metrics span {
  color: var(--ui-color-text-muted);
  font-size: 10px;
}

.preview-metrics strong {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 21px;
}

.preview-metrics strong.warning,
.risk-tone {
  color: var(--ui-color-warning);
}

.preview-metrics strong.danger {
  color: var(--ui-color-danger);
}

.risk-panel header strong {
  font-size: var(--ui-font-size-sm);
}

.risk-panel.is-blocking {
  background: #fff8f7;
  border-color: #efb6b1;
}

.risk-panel ul {
  display: grid;
  margin: 10px 0 0;
  padding: 0;
  gap: 7px;
  list-style: none;
}

.risk-panel li {
  display: flex;
  min-height: 42px;
  padding: 7px 9px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-xs);
}

.risk-panel li strong {
  color: var(--ui-color-danger);
  text-align: right;
}

.risk-row {
  display: flex;
  margin-top: 10px;
  padding: 9px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--ui-color-warning-light);
  border-radius: var(--ui-radius-small);
}

.risk-row > div,
.consent-row span,
.phone-consent-control span,
.contact-member-row > div:last-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.risk-row span,
.consent-row small,
.phone-consent-control small,
.contact-member-row span,
.contact-member-row small {
  color: var(--ui-color-text-secondary);
  font-size: 10px;
}

.consent-row,
.phone-consent-control {
  display: flex;
  min-height: 58px;
  margin-top: 10px;
  padding: 9px 11px;
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.consent-row input,
.phone-consent-control input {
  width: 22px;
  height: 22px;
  flex: none;
  accent-color: var(--ui-color-primary);
}

.consent-row strong,
.phone-consent-control strong {
  font-size: var(--ui-font-size-sm);
}

.web-parity-page {
  display: grid;
  min-width: 0;
  margin-top: var(--ui-spacing-md);
  gap: var(--ui-spacing-md);
}

.web-parity-page h2 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
}

.draft-section {
  display: grid;
  gap: 10px;
  padding: var(--ui-spacing-sm);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.draft-section h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.draft-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: var(--ui-line-height-body);
}

.draft-list {
  display: grid;
  gap: 8px;
}

.draft-row {
  display: flex;
  padding: 10px 12px;
  align-items: stretch;
  flex-direction: column;
  gap: 8px 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.draft-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  color: #6b7280;
  font-size: 13px;
}

.draft-summary strong {
  color: #111827;
  font-size: 14px;
}

.month-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.month-chip {
  min-height: var(--ui-touch-target-minimum);
  padding: 2px 8px;
  color: #1f5aa6;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
}

.month-group {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.month-group-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  color: #6b7280;
  font-size: 13px;
}

.month-group-header strong {
  color: #111827;
  font-size: 14px;
}

.archived-details {
  border-top: 1px dashed #e5e7eb;
}

.archived-details summary {
  min-height: 44px;
  padding: 8px 0 4px;
  box-sizing: border-box;
  color: #1f5aa6;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.version-row {
  display: flex;
  padding: 6px 0;
  align-items: stretch;
  flex-direction: column;
  gap: 8px 16px;
  border-top: 1px dashed #e5e7eb;
}

.version-badge {
  padding: 1px 6px;
  color: #6b7280;
  background: #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.version-badge.is-current {
  color: #166534;
  background: #dcfce7;
}

.version-badge.is-past {
  color: #4b5563;
  background: #e5e7eb;
}

.web-row-actions,
.staged-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}

.web-button {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 var(--ui-spacing-md);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.web-button.is-primary {
  color: #fff;
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.web-button.is-outline,
.web-button.is-primary-outline {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-primary-border);
}

.web-button.is-danger-outline {
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border-color: #efb6b1;
}

.web-button.is-danger-text {
  color: var(--ui-color-danger);
  background: transparent;
  border-color: transparent;
}

.web-button.is-danger-solid {
  color: #fff;
  background: var(--ui-color-danger);
  border-color: var(--ui-color-danger);
}

.web-button:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
  cursor: not-allowed;
}

.blocker-panel {
  display: grid;
  padding: var(--ui-spacing-sm);
  gap: var(--ui-spacing-xs);
  background: #fffaf0;
  border: 1px solid #efc56f;
  border-radius: var(--ui-radius-small);
}

.month-chip.is-conflict {
  color: #9a5a08;
  background: var(--ui-color-warning-light);
  border-color: #efc56f;
}

.replace-field,
.acknowledge-field {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px 9px;
  box-sizing: border-box;
  align-items: center;
  gap: 9px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.replace-field input,
.acknowledge-field input {
  width: 22px;
  height: 22px;
  margin: 0;
  flex: none;
  accent-color: var(--ui-color-primary);
}

.workflow-impact-list {
  display: grid;
  padding: 10px;
  gap: 7px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  font-size: 12px;
  line-height: var(--ui-line-height-body);
}

.workflow-impact-list strong {
  color: var(--ui-color-text-primary);
  font-size: 13px;
}

.blocker-actions,
.release-dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-xs);
}

.release-dialog-layer {
  position: fixed;
  z-index: var(--ui-z-index-dialog);
  inset: 0;
  display: flex;
  padding: 14px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  background: rgb(22 32 42 / 48%);
}

.release-dialog {
  display: grid;
  width: min(362px, 100%);
  max-height: calc(100dvh - 28px);
  padding: var(--ui-spacing-md);
  box-sizing: border-box;
  overflow-y: auto;
  gap: 10px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-elevated);
}

.release-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.release-dialog-header > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.release-dialog-header span {
  color: var(--ui-color-primary);
  font-size: 11px;
  font-weight: var(--ui-font-weight-semibold);
  letter-spacing: 0.06em;
}

.release-dialog.is-danger .release-dialog-header span {
  color: var(--ui-color-danger);
}

.release-dialog-header h2 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.dialog-close {
  display: grid;
  width: var(--ui-touch-target-minimum);
  height: var(--ui-touch-target-minimum);
  margin: -8px -8px 0 0;
  padding: 0;
  flex: none;
  place-items: center;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 50%;
  font-size: 25px;
}

.dialog-close:hover,
.dialog-close:focus-visible {
  background: var(--ui-color-surface-muted);
}

.release-dialog-meta,
.delete-note {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.release-callout {
  padding: 10px 11px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  font-size: 12px;
  line-height: var(--ui-line-height-body);
}

.release-callout.is-info {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-color: var(--ui-color-primary-border);
}

.release-callout.is-warning {
  color: #8a520b;
  background: var(--ui-color-warning-light);
  border-color: #efc56f;
}

.release-callout.is-danger {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
  border-color: #efb6b1;
}

.release-dialog-actions {
  position: sticky;
  bottom: 0;
  padding-top: 4px;
  background: var(--ui-color-surface);
}

.release-dialog-actions .web-button,
.blocker-actions .web-button {
  width: 100%;
}

.web-alert {
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.controls {
  display: grid;
  padding: var(--ui-spacing-sm);
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-spacing-sm) var(--ui-spacing-lg);
  align-items: end;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.controls label,
.reason-field {
  display: grid;
  gap: 4px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.web-input-shell {
  display: flex;
  min-width: 0;
  min-height: var(--ui-touch-target-minimum);
  padding: 0 var(--ui-spacing-sm);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  text-align: left;
}

.month-nav {
  display: grid;
  grid-template-columns: auto minmax(112px, 1fr) auto;
  gap: var(--ui-spacing-xs);
  align-items: center;
}

.month-nav .web-button {
  padding-inline: var(--ui-spacing-xs);
  white-space: nowrap;
}

.month-input {
  width: 100%;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.month-label {
  display: none;
}

.palette-section {
  display: grid;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-sm);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  align-items: stretch;
}

.palette-label {
  flex: 0 0 100%;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.palette-button {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
}

.palette-button.is-active {
  outline: 2px solid var(--ui-color-primary);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgb(31 90 166 / 18%);
}

.member-button {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
}

.member-button.is-active {
  color: #fff;
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.reason-field textarea {
  min-height: 88px;
  padding: var(--ui-spacing-sm);
  box-sizing: border-box;
  resize: vertical;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  font: inherit;
}

.paint-status {
  display: grid;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-spacing-sm);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.paint-status-label {
  grid-column: 1 / -1;
  color: var(--ui-color-text-muted);
  font-weight: var(--ui-font-weight-medium);
}

.paint-status strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.paint-status-message {
  font-weight: var(--ui-font-weight-medium);
}

.staged-panel {
  display: grid;
  padding: var(--ui-spacing-sm);
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.staged-item {
  display: flex;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  text-align: left;
}

.staged-remove {
  flex: none;
  color: var(--ui-color-danger);
  font-weight: var(--ui-font-weight-semibold);
}

.staged-actions .web-button {
  flex: 1 1 120px;
}

.paint-hint {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.backfill-calendar {
  display: grid;
  width: calc(100% + 24px);
  margin-inline: -12px;
  gap: var(--ui-spacing-xs);
}

.backfill-calendar-heading {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding-inline: var(--ui-spacing-md);
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  gap: var(--ui-spacing-sm);
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.backfill-calendar-heading strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.events-section {
  display: grid;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.events-section h3 {
  margin: 0;
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.events-section ul {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 6px;
  list-style: none;
  font-size: var(--ui-font-size-sm);
}

.events-section li {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  border-bottom: 1px dashed var(--ui-color-border);
}

.event-time {
  color: var(--ui-color-text-muted);
}

.group-setup-panel {
  gap: var(--ui-spacing-md);
}

.group-panel-heading {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.group-panel-heading p,
.group-panel-heading h2 {
  margin: 0;
}

.group-panel-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.group-panel-heading h2 {
  margin-top: var(--ui-spacing-xxs);
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.group-panel-heading > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.group-identity-band {
  display: grid;
  padding: var(--ui-spacing-md);
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-spacing-lg);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-large);
}

.group-identity-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.group-identity-copy span,
.group-code-block > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.group-identity-copy > strong {
  overflow: hidden;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-identity-copy small {
  width: fit-content;
  margin-top: var(--ui-spacing-xxs);
  padding: 3px var(--ui-spacing-xs);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.group-code-block {
  display: grid;
  justify-items: start;
  gap: var(--ui-spacing-xxs);
}

.group-code-digits {
  display: flex;
  gap: var(--ui-spacing-xs);
}

.group-code-digits strong {
  display: grid;
  width: 42px;
  height: 50px;
  place-items: center;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  box-shadow: var(--ui-shadow-card);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.group-card-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-spacing-sm);
}

.group-card {
  min-width: 0;
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.group-card-header {
  display: flex;
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  box-sizing: border-box;
  align-items: center;
  border-bottom: 1px solid var(--ui-color-border);
}

.group-card-body {
  padding: var(--ui-spacing-sm);
}

.contact-consent-section {
  display: grid;
  padding: var(--ui-spacing-md);
  gap: var(--ui-spacing-sm);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.contact-consent-section > header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.contact-consent-section > header > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.contact-consent-section > header div > span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.preference-scope {
  padding: 3px 8px;
  flex: 0 0 auto;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.preference-scope.is-personal {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.contact-member-row {
  display: grid;
  padding: var(--ui-spacing-sm);
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-spacing-sm);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.contact-member-row > div:last-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.phone-avatar {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: #fff;
  background: var(--ui-color-primary);
  border-radius: 50%;
  font-size: 19px;
  font-weight: 700;
}

.privacy-boundary {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.consent-save {
  width: 100%;
}

@media (max-width: 340px) {
  .p5-preview {
    padding-right: 10px;
    padding-left: 10px;
  }

  .mini-header {
    margin-right: -10px;
    margin-left: -10px;
    padding-right: 10px;
    padding-left: 10px;
  }

  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-metrics {
    gap: 5px;
  }

  .action-dock {
    padding-right: 10px;
    padding-left: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
