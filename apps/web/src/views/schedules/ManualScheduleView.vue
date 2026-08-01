<script setup lang="ts">
import type {
  CreateManualScheduleTemplateRequest,
  GroupSummary,
  ManualScheduleTemplate,
  SchedulingConfig,
} from '@schedule/contracts';
import { computed, reactive, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { getCurrentBusinessMonth } from '../../features/calendar/calendar-logic.js';
import ClearActions from '../../features/manual-schedule/ClearActions.vue';
import ManualGrid from '../../features/manual-schedule/ManualGrid.vue';
import ShiftPalette from '../../features/manual-schedule/ShiftPalette.vue';
import {
  applyShiftToCell,
  clearCell,
  clearColumn,
  clearRow,
  createCellKey,
  createTemplateUndoStack,
  getTemplateDateColumns,
  templateToCellMap,
  type ManualGridRow,
  type ManualGridSelection,
  type TemplateCellMap,
} from '../../features/manual-schedule/manual-schedule-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const config = ref<SchedulingConfig>();
const templates = ref<ManualScheduleTemplate[]>([]);
const selectedTemplateId = ref('');
const scheduleRoleId = ref('');
const membershipIds = ref<string[]>([]);
const startDate = ref(getCurrentBusinessMonth() + '-01');
const cycleDays = ref(7);
const cells = ref<TemplateCellMap>(new Map());
const selectedCell = ref<ManualGridSelection>();
const staleMemberIds = ref<string[]>([]);
const staleCellKeys = ref<ReadonlySet<string>>(new Set());
const undoStack = reactive(createTemplateUndoStack());
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSaving = ref(false);
let requestVersion = 0;

const roleOptions = computed(() =>
  (config.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const templateOptions = computed(() => [
  { label: '新建模板', value: '' },
  ...(templates.value ?? []).map((template) => ({
    label: `${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays}天`,
    value: template.id,
  })),
]);
const roleMembers = computed(() => {
  const role = (config.value?.roles ?? []).find(
    (candidate) => candidate.id === scheduleRoleId.value,
  );
  return role?.members ?? [];
});
const enabledShiftTypes = computed(() =>
  (config.value?.shiftTypes ?? []).filter((shiftType) => shiftType.isEnabled),
);
const columns = computed(() => {
  try {
    return getTemplateDateColumns(startDate.value, cycleDays.value);
  } catch {
    return [];
  }
});
const rows = computed<readonly ManualGridRow[]>(() => {
  const memberNamesById = new Map(
    roleMembers.value.map((member) => [member.membershipId, member.realName]),
  );
  const staleIds = new Set(staleMemberIds.value);

  return membershipIds.value.map((membershipId) => ({
    isStale: staleIds.has(membershipId),
    membershipId,
    realName: memberNamesById.get(membershipId) ?? '未知成员',
  }));
});
const isEditing = computed(() => selectedTemplateId.value !== '');
const canClearCell = computed(() => selectedCell.value !== undefined);
const canUndo = computed(() => undoStack.canUndo());
const staleWarning = computed(
  () => staleMemberIds.value.length > 0 || staleCellKeys.value.size > 0,
);

function loadData(): Promise<void> {
  const currentRequest = ++requestVersion;
  errorMessage.value = undefined;
  isLoading.value = true;

  return Promise.all([
    api.getSchedulingConfig(props.group.id),
    api.listManualScheduleTemplates(props.group.id),
  ])
    .then(([nextConfig, nextTemplates]) => {
      if (currentRequest === requestVersion) {
        config.value = nextConfig;
        templates.value = nextTemplates;
      }
    })
    .catch((error: unknown) => {
      if (currentRequest === requestVersion) {
        errorMessage.value = getErrorMessage(error);
      }
    })
    .finally(() => {
      if (currentRequest === requestVersion) {
        isLoading.value = false;
      }
    });
}

function onTemplateChange(value: string | number | boolean | object | null): void {
  if (typeof value !== 'string') {
    return;
  }

  if (value === '') {
    resetEditor();
    return;
  }

  const template = templates.value.find((candidate) => candidate.id === value);
  if (template !== undefined) {
    openTemplate(template);
  }
}

function onRoleChange(value: string | number | boolean | object | null): void {
  if (typeof value !== 'string' || !roleOptions.value.some((option) => option.value === value)) {
    return;
  }

  scheduleRoleId.value = value;
  membershipIds.value = [];
  cells.value = new Map();
  selectedCell.value = undefined;
  staleMemberIds.value = [];
  staleCellKeys.value = new Set();
  undoStack.clear();
}

function openTemplate(template: ManualScheduleTemplate): void {
  selectedTemplateId.value = template.id;
  scheduleRoleId.value = template.scheduleRoleId;
  membershipIds.value = template.members.map((member) => member.membershipId);
  startDate.value = template.startDate;
  cycleDays.value = template.cycleDays;
  cells.value = templateToCellMap(template);
  staleMemberIds.value = template.members
    .filter((member) => member.isStale)
    .map((member) => member.membershipId);
  staleCellKeys.value = new Set(
    template.cells
      .filter((cell) => cell.isStale)
      .map((cell) => createCellKey(cell.cycleDay, cell.membershipId)),
  );
  selectedCell.value = undefined;
  undoStack.clear();
}

function resetEditor(): void {
  selectedTemplateId.value = '';
  scheduleRoleId.value = '';
  membershipIds.value = [];
  startDate.value = `${getCurrentBusinessMonth()}-01`;
  cycleDays.value = 7;
  cells.value = new Map();
  selectedCell.value = undefined;
  staleMemberIds.value = [];
  staleCellKeys.value = new Set();
  undoStack.clear();
}

function toggleMember(membershipId: string): void {
  if (membershipIds.value.includes(membershipId)) {
    pushUndo();
    membershipIds.value = membershipIds.value.filter((id) => id !== membershipId);
    cells.value = clearRow(cells.value, membershipId);
    if (selectedCell.value?.membershipId === membershipId) {
      selectedCell.value = undefined;
    }
  } else {
    membershipIds.value = [...membershipIds.value, membershipId];
  }
}

function selectCell(selection: ManualGridSelection): void {
  selectedCell.value =
    selectedCell.value !== undefined &&
    selectedCell.value.cycleDay === selection.cycleDay &&
    selectedCell.value.membershipId === selection.membershipId
      ? undefined
      : selection;
}

function applyShift(shiftTypeId: string): void {
  if (selectedCell.value === undefined) {
    infoMessage.value = '请先点击一个单元格，再选择班种。';
    return;
  }

  pushUndo();
  cells.value = applyShiftToCell(
    cells.value,
    selectedCell.value.cycleDay,
    selectedCell.value.membershipId,
    shiftTypeId,
  );
  infoMessage.value = undefined;
}

function clearSelectedCell(): void {
  if (selectedCell.value === undefined) {
    return;
  }

  pushUndo();
  cells.value = clearCell(
    cells.value,
    selectedCell.value.cycleDay,
    selectedCell.value.membershipId,
  );
}

function clearSelectedRow(): void {
  const selection = selectedCell.value;
  if (selection === undefined) {
    return;
  }

  const member = roleMembers.value.find(
    (candidate) => candidate.membershipId === selection.membershipId,
  );
  const realName = member?.realName ?? '该成员';
  if (!window.confirm(`确定清空 ${realName} 的整行吗？此操作可在保存前撤销。`)) {
    return;
  }

  pushUndo();
  cells.value = clearRow(cells.value, selection.membershipId);
}

function clearSelectedColumn(): void {
  const selection = selectedCell.value;
  if (selection === undefined) {
    return;
  }

  const column = columns.value.find((candidate) => candidate.cycleDay === selection.cycleDay);
  const dateLabel = column?.date ?? '该列';
  if (!window.confirm(`确定清空 ${dateLabel} 这一列吗？此操作可在保存前撤销。`)) {
    return;
  }

  pushUndo();
  cells.value = clearColumn(cells.value, selection.cycleDay);
}

function undo(): void {
  const snapshot = undoStack.pop();
  if (snapshot !== undefined) {
    cells.value = snapshot;
  }
}

function pushUndo(): void {
  undoStack.push(cells.value);
}

async function save(): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;

  if (scheduleRoleId.value === '') {
    errorMessage.value = '请先选择排班角色。';
    return;
  }
  if (membershipIds.value.length === 0) {
    errorMessage.value = '请至少勾选一位值班人员。';
    return;
  }
  if (columns.value.length === 0) {
    errorMessage.value = '请检查开始日期和周期天数（1 到 31 天）。';
    return;
  }

  const request: CreateManualScheduleTemplateRequest = {
    cells: [...cells.value.entries()].map(([key, shiftTypeId]) => {
      const [cycleDayText = '', ...membershipParts] = key.split(':');
      return {
        cycleDay: Number(cycleDayText),
        membershipId: membershipParts.join(':'),
        shiftTypeId,
      };
    }),
    cycleDays: cycleDays.value,
    membershipIds: membershipIds.value,
    scheduleRoleId: scheduleRoleId.value,
    startDate: startDate.value,
  };

  isSaving.value = true;
  try {
    let saved: ManualScheduleTemplate;
    if (isEditing.value) {
      const template = templates.value.find(
        (candidate) => candidate.id === selectedTemplateId.value,
      );
      saved = await api.updateManualScheduleTemplate(props.group.id, selectedTemplateId.value, {
        ...request,
        expectedVersion: template?.version ?? 1,
      });
    } else {
      saved = await api.createManualScheduleTemplate(props.group.id, request);
    }

    infoMessage.value = '模板已保存，尚未创建任何正式班次。';
    await loadData();
    openTemplate(saved);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSaving.value = false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '模板暂时无法保存，请稍后重试。';
}

void loadData();
</script>

<template>
  <section class="manual-schedule-view" :aria-busy="isLoading || isSaving">
    <h2>手动排班模板</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载排班配置" />
    <template v-else-if="config !== undefined">
      <div class="editor-config">
        <label>
          模板
          <t-select
            :value="selectedTemplateId"
            :options="templateOptions"
            @change="onTemplateChange"
          />
        </label>
        <label>
          排班角色
          <t-select :value="scheduleRoleId" :options="roleOptions" @change="onRoleChange" />
        </label>
        <label>
          开始日期
          <input v-model="startDate" type="date" />
        </label>
        <label>
          周期天数
          <input v-model.number="cycleDays" min="1" max="31" type="number" />
        </label>
      </div>

      <fieldset class="member-selector">
        <legend>值班人员</legend>
        <p v-if="roleMembers.length === 0" class="member-empty">
          该排班角色还没有成员，请先在排班配置中添加。
        </p>
        <label v-for="member in roleMembers" :key="member.membershipId">
          <input
            type="checkbox"
            :checked="membershipIds.includes(member.membershipId)"
            @change="toggleMember(member.membershipId)"
          />
          {{ member.realName }}
        </label>
      </fieldset>

      <t-alert
        v-if="staleWarning"
        theme="warning"
        message="模板包含失效引用（成员已不在角色中，或班种已停用/配置已变更）。保存时会重新校验，请确认后再继续。"
      />

      <template v-if="rows.length > 0 && columns.length > 0">
        <ManualGrid
          :cells="cells"
          :columns="columns"
          :rows="rows"
          :selected-cell="selectedCell"
          :shift-types="enabledShiftTypes"
          :stale-cell-keys="staleCellKeys"
          @select-cell="selectCell"
        />
        <ShiftPalette :shift-types="enabledShiftTypes" @select="applyShift" />
        <ClearActions
          :can-clear-cell="canClearCell"
          :can-undo="canUndo"
          @clear-cell="clearSelectedCell"
          @clear-column="clearSelectedColumn"
          @clear-row="clearSelectedRow"
          @undo="undo"
        />
        <t-button theme="primary" :loading="isSaving" @click="save">
          {{ isEditing ? '保存模板' : '创建模板' }}
        </t-button>
      </template>
      <p v-else class="editor-hint">请选择排班角色并勾选至少一位值班人员。</p>
    </template>
  </section>
</template>

<style scoped>
.manual-schedule-view {
  display: grid;
  gap: 16px;
}

.manual-schedule-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.editor-config {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.editor-config label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.editor-config input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.member-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.member-selector legend {
  color: #374151;
  font-weight: 600;
}

.member-selector label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #1f2937;
  font-size: 14px;
}

.member-empty,
.editor-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}
</style>
