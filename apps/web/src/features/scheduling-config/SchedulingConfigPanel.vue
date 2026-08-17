<script setup lang="ts">
import type { GroupSummary, ScheduleRole, ShiftType, ShiftTypeInput } from '@schedule/contracts';
import { getBestContrastRatio, pickReadableTextColor } from '@schedule/ui-tokens';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import CompactSwitch from '../../components/CompactSwitch.vue';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import ShiftColorPicker from './ShiftColorPicker.vue';
import { getSchedulingConfigurationOverview } from './scheduling-config-presentation.js';

interface ShiftTypeDraft {
  abbreviation: string;
  color: string;
  countsTowardStatistics: boolean;
  crossesMidnight: boolean;
  endTime: string;
  isEnabled: boolean;
  name: string;
  startTime: string;
}

interface RoleDraft {
  memberIds: string[];
}

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const config = ref<Awaited<ReturnType<typeof api.getSchedulingConfig>>>();
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSaving = ref(false);
const newRoleName = ref('');
const newShift = ref<ShiftTypeDraft>(createEmptyShiftDraft());
const newShiftEditorOpen = ref(false);
const editingShiftId = ref<string>();
const roleDrafts = ref<Record<string, RoleDraft>>({});
const shiftDrafts = ref<Record<string, ShiftTypeDraft>>({});
let requestVersion = 0;
const configurationOverview = computed(() =>
  config.value === undefined ? undefined : getSchedulingConfigurationOverview(config.value),
);

watch(
  () => props.group.id,
  () => {
    newShiftEditorOpen.value = false;
    editingShiftId.value = undefined;
    void loadConfig();
  },
  { immediate: true },
);

async function loadConfig(): Promise<void> {
  const currentRequest = ++requestVersion;
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isLoading.value = true;

  try {
    const nextConfig = await api.getSchedulingConfig(props.group.id);
    if (currentRequest === requestVersion) {
      config.value = nextConfig;
      shiftDrafts.value = Object.fromEntries(
        nextConfig.shiftTypes.map((shiftType) => [shiftType.id, toShiftTypeDraft(shiftType)]),
      );
      roleDrafts.value = Object.fromEntries(
        nextConfig.roles.map((role) => [role.id, toRoleDraft(role)]),
      );
    }
  } catch (error) {
    if (currentRequest === requestVersion) {
      errorMessage.value = toUserMessage(error, '排班配置暂时无法保存，请稍后重试。');
    }
  } finally {
    if (currentRequest === requestVersion) {
      isLoading.value = false;
    }
  }
}

async function createRole(): Promise<void> {
  if (newRoleName.value.trim() === '') {
    errorMessage.value = '请填写排班岗位名称。';
    return;
  }

  await save(async () => {
    await api.createScheduleRole(props.group.id, { name: newRoleName.value });
    newRoleName.value = '';
    infoMessage.value = '排班岗位已创建，请配置参与成员。';
  });
}

async function saveRoleMembers(role: ScheduleRole): Promise<void> {
  await save(async () => {
    await api.replaceScheduleRoleMembers(props.group.id, role.id, {
      membershipIds: getRoleDraft(role.id).memberIds,
    });
    infoMessage.value = '排班岗位成员已保存。';
  });
}

async function createShift(): Promise<void> {
  const created = await save(async () => {
    await api.createShiftType(props.group.id, toShiftTypeInput(newShift.value));
    newShift.value = createEmptyShiftDraft();
    infoMessage.value = '自定义班种已创建。';
  });
  if (created) newShiftEditorOpen.value = false;
}

async function saveShift(shiftType: ShiftType, closeAfterSave = true): Promise<void> {
  const saved = await save(async () => {
    await api.updateShiftType(
      props.group.id,
      shiftType.id,
      toShiftTypeInput(getShiftDraft(shiftType.id)),
    );
    infoMessage.value = `${shiftType.name}已保存。`;
  });
  if (saved && closeAfterSave) editingShiftId.value = undefined;
}

async function updateShiftEnabled(shiftType: ShiftType, enabled: boolean): Promise<void> {
  getShiftDraft(shiftType.id).isEnabled = enabled;
  await saveShift(shiftType, false);
}

async function deleteRole(role: ScheduleRole): Promise<void> {
  if (!window.confirm(`确定删除排班岗位“${role.name}”吗？删除后不可恢复。`)) {
    return;
  }

  const deleted = await save(async () => {
    await api.deleteScheduleRole(props.group.id, role.id);
  });
  if (deleted) {
    infoMessage.value = `排班岗位“${role.name}”已删除。`;
  }
}

async function deleteShift(shiftType: ShiftType): Promise<void> {
  if (!window.confirm(`确定删除班种“${shiftType.name}”吗？删除后不可恢复。`)) {
    return;
  }

  const deleted = await save(async () => {
    await api.deleteShiftType(props.group.id, shiftType.id);
  });
  if (deleted) {
    infoMessage.value = `班种“${shiftType.name}”已删除。`;
  }
}

async function save(operation: () => Promise<void>): Promise<boolean> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isSaving.value = true;

  try {
    await operation();
    await loadConfig();
    return true;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '排班配置暂时无法保存，请稍后重试。');
    return false;
  } finally {
    isSaving.value = false;
  }
}

function toShiftTypeDraft(shiftType: ShiftType): ShiftTypeDraft {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    countsTowardStatistics: shiftType.countsTowardStatistics,
    crossesMidnight: shiftType.crossesMidnight,
    endTime: shiftType.endTime ?? '',
    isEnabled: shiftType.isEnabled,
    name: shiftType.name,
    startTime: shiftType.startTime ?? '',
  };
}

function createEmptyShiftDraft(): ShiftTypeDraft {
  return {
    abbreviation: '',
    color: '#1F5AA6',
    countsTowardStatistics: true,
    crossesMidnight: false,
    endTime: '',
    isEnabled: false,
    name: '',
    startTime: '',
  };
}

function toShiftTypeInput(draft: ShiftTypeDraft): ShiftTypeInput {
  return {
    abbreviation: draft.abbreviation,
    color: draft.color,
    countsTowardStatistics: draft.countsTowardStatistics,
    crossesMidnight: draft.crossesMidnight,
    endTime: draft.endTime === '' ? null : draft.endTime,
    isEnabled: draft.isEnabled,
    name: draft.name,
    startTime: draft.startTime === '' ? null : draft.startTime,
  };
}

function toRoleDraft(role: ScheduleRole): RoleDraft {
  return {
    memberIds: role.members.map((member) => member.membershipId),
  };
}

function getRoleDraft(roleId: string): RoleDraft {
  const draft = roleDrafts.value[roleId];
  if (draft === undefined) {
    throw new Error('排班岗位配置尚未加载。');
  }

  return draft;
}

function getShiftDraft(shiftTypeId: string): ShiftTypeDraft {
  const draft = shiftDrafts.value[shiftTypeId];
  if (draft === undefined) {
    throw new Error('班种配置尚未加载。');
  }

  return draft;
}

function previewStyle(draft: ShiftTypeDraft): { backgroundColor: string; color: string } {
  return {
    backgroundColor: draft.color,
    color: pickReadableTextColor(draft.color),
  };
}

function hasInsufficientContrast(draft: ShiftTypeDraft): boolean {
  return getBestContrastRatio(draft.color) < 4.5;
}

function toggleShiftEditor(shiftTypeId: string): void {
  editingShiftId.value = editingShiftId.value === shiftTypeId ? undefined : shiftTypeId;
}

function formatShiftTime(draft: ShiftTypeDraft): string {
  if (draft.startTime === '' || draft.endTime === '') return '未设置时段';
  return `${draft.startTime}–${draft.crossesMidnight ? '次日 ' : ''}${draft.endTime}`;
}

function roleIncludesMember(roleId: string, membershipId: string): boolean {
  return getRoleDraft(roleId).memberIds.includes(membershipId);
}

function setRoleMember(roleId: string, membershipId: string, selected: boolean): void {
  const draft = getRoleDraft(roleId);
  draft.memberIds = selected
    ? [...new Set([...draft.memberIds, membershipId])]
    : draft.memberIds.filter((id) => id !== membershipId);
}
</script>

<template>
  <section class="scheduling-config-panel" :aria-busy="isLoading || isSaving">
    <header class="config-panel-heading">
      <div>
        <p>排班基础</p>
        <h2>排班配置</h2>
      </div>
      <span>先建立班种、时段与岗位成员，再进入排班编制。</span>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载排班配置" />
    <template v-else-if="config !== undefined">
      <section
        v-if="configurationOverview !== undefined"
        class="configuration-readiness"
        :class="`is-${configurationOverview.status}`"
      >
        <header>
          <div>
            <span>排班准备轨道</span>
            <strong>{{ configurationOverview.statusLabel }}</strong>
          </div>
          <small>这里只汇总基础配置，不改变排班规则。</small>
        </header>
        <ol>
          <li
            v-for="step in configurationOverview.steps"
            :key="step.key"
            :class="{ 'is-complete': step.isComplete }"
          >
            <span class="readiness-dot" aria-hidden="true" />
            <span>{{ step.label }}</span>
            <strong>{{ step.value }}</strong>
          </li>
        </ol>
      </section>

      <t-card title="班种" class="scheduling-config-card">
        <div class="shift-section-heading">
          <p class="config-section-note">
            全天班固定为 08:00 至次日 08:00。点击“编辑”再展开详细设置。
          </p>
          <button
            type="button"
            class="add-shift-button"
            :aria-expanded="newShiftEditorOpen"
            @click="newShiftEditorOpen = !newShiftEditorOpen"
          >
            {{ newShiftEditorOpen ? '收起新增' : '＋ 新增班种' }}
          </button>
        </div>

        <form
          v-if="newShiftEditorOpen"
          class="compact-shift-editor new-shift-editor"
          @submit.prevent="createShift"
        >
          <header class="editor-heading">
            <strong>新增自定义班种</strong>
            <span>填写名称、时段和颜色后保存</span>
          </header>
          <div class="identity-fields">
            <label
              ><span>名称</span><input v-model="newShift.name" maxlength="100" required
            /></label>
            <label class="abbreviation-field"
              ><span>简称</span><input v-model="newShift.abbreviation" maxlength="16" required
            /></label>
          </div>
          <fieldset class="time-range-control">
            <legend>时段</legend>
            <label><span>开始</span><input v-model="newShift.startTime" type="time" /></label>
            <span class="range-arrow" aria-hidden="true">→</span>
            <label><span>结束</span><input v-model="newShift.endTime" type="time" /></label>
          </fieldset>
          <ShiftColorPicker v-model="newShift.color" />
          <span v-if="hasInsufficientContrast(newShift)" class="contrast-warning" role="status">
            当前颜色对比度不足 4.5:1
          </span>
          <div class="editor-options three-options">
            <article>
              <span><strong>跨日</strong><small>结束时间属于次日</small></span>
              <CompactSwitch v-model="newShift.crossesMidnight" label="新班种跨日" />
            </article>
            <article>
              <span><strong>启用</strong><small>创建后可用于排班</small></span>
              <CompactSwitch v-model="newShift.isEnabled" label="启用新班种" />
            </article>
            <article>
              <span><strong>计入统计</strong><small>纳入值班次数与时长</small></span>
              <CompactSwitch v-model="newShift.countsTowardStatistics" label="新班种计入统计" />
            </article>
          </div>
          <div class="editor-actions">
            <button type="button" class="secondary-action" @click="newShiftEditorOpen = false">
              取消
            </button>
            <button type="submit" class="primary-action" :disabled="isSaving">
              {{ isSaving ? '保存中…' : '新增班种' }}
            </button>
          </div>
        </form>

        <ul class="shift-type-list">
          <li
            v-for="shiftType in config.shiftTypes"
            :key="shiftType.id"
            class="shift-type-row"
            :class="{
              'is-editing': editingShiftId === shiftType.id,
              'is-disabled': !getShiftDraft(shiftType.id).isEnabled,
            }"
          >
            <span class="shift-glyph" :style="previewStyle(getShiftDraft(shiftType.id))">
              {{ getShiftDraft(shiftType.id).abbreviation || '班' }}
            </span>
            <div class="shift-summary">
              <div>
                <strong>{{ getShiftDraft(shiftType.id).name }}</strong>
                <span v-if="shiftType.isBuiltIn" class="built-in-badge">固定</span>
              </div>
              <p>
                <span
                  class="time-band"
                  :style="{ backgroundColor: getShiftDraft(shiftType.id).color }"
                />
                {{ formatShiftTime(getShiftDraft(shiftType.id)) }}
              </p>
            </div>
            <button
              type="button"
              class="edit-row-button"
              :aria-expanded="editingShiftId === shiftType.id"
              @click="toggleShiftEditor(shiftType.id)"
            >
              {{ editingShiftId === shiftType.id ? '收起' : '编辑' }}
            </button>
            <CompactSwitch
              :model-value="getShiftDraft(shiftType.id).isEnabled"
              :disabled="shiftType.isAllDay || isSaving"
              :label="`${shiftType.name}${getShiftDraft(shiftType.id).isEnabled ? '已启用' : '已停用'}`"
              @update:model-value="updateShiftEnabled(shiftType, $event)"
            />

            <form
              v-if="editingShiftId === shiftType.id"
              class="compact-shift-editor"
              @submit.prevent="saveShift(shiftType)"
            >
              <div class="identity-fields">
                <label
                  ><span>名称</span
                  ><input v-model="getShiftDraft(shiftType.id).name" maxlength="100" required
                /></label>
                <label class="abbreviation-field"
                  ><span>简称</span
                  ><input
                    v-model="getShiftDraft(shiftType.id).abbreviation"
                    maxlength="16"
                    required
                /></label>
              </div>
              <fieldset class="time-range-control">
                <legend>时段</legend>
                <label
                  ><span>开始</span
                  ><input
                    v-model="getShiftDraft(shiftType.id).startTime"
                    :disabled="shiftType.isAllDay"
                    type="time"
                /></label>
                <span class="range-arrow" aria-hidden="true">→</span>
                <label
                  ><span>结束</span
                  ><input
                    v-model="getShiftDraft(shiftType.id).endTime"
                    :disabled="shiftType.isAllDay"
                    type="time"
                /></label>
              </fieldset>
              <ShiftColorPicker v-model="getShiftDraft(shiftType.id).color" />
              <span
                v-if="hasInsufficientContrast(getShiftDraft(shiftType.id))"
                class="contrast-warning"
                role="status"
              >
                当前颜色对比度不足 4.5:1
              </span>
              <div class="editor-options">
                <article>
                  <span><strong>跨日</strong><small>结束时间属于次日</small></span>
                  <CompactSwitch
                    v-model="getShiftDraft(shiftType.id).crossesMidnight"
                    :disabled="shiftType.isAllDay"
                    :label="`${shiftType.name}跨日`"
                  />
                </article>
                <article>
                  <span><strong>计入统计</strong><small>纳入值班次数与时长</small></span>
                  <CompactSwitch
                    v-model="getShiftDraft(shiftType.id).countsTowardStatistics"
                    :label="`${shiftType.name}计入统计`"
                  />
                </article>
              </div>
              <div class="editor-actions">
                <button
                  v-if="!shiftType.isBuiltIn"
                  type="button"
                  class="delete-action"
                  :disabled="isSaving"
                  @click="deleteShift(shiftType)"
                >
                  删除班种
                </button>
                <button type="submit" class="primary-action" :disabled="isSaving">
                  {{ isSaving ? '保存中…' : '完成' }}
                </button>
              </div>
            </form>
          </li>
        </ul>
      </t-card>

      <t-card title="排班岗位" class="scheduling-config-card">
        <p class="config-section-note">排班岗位指值班班次岗位（如一线、二线），不是成员姓名。</p>
        <form class="new-role-form" @submit.prevent="createRole">
          <label>岗位名称<input v-model="newRoleName" maxlength="100" required /></label>
          <t-button theme="primary" type="submit" :loading="isSaving">新增岗位</t-button>
        </form>
        <p v-if="config.roles.length === 0" class="config-empty-note">
          还没有排班岗位。新增首个岗位后，再选择参与成员。
        </p>
        <article v-for="role in config.roles" :key="role.id" class="schedule-role-editor">
          <div class="role-editor-header">
            <h3>岗位：{{ role.name }}</h3>
            <t-button theme="danger" variant="text" :loading="isSaving" @click="deleteRole(role)">
              删除岗位
            </t-button>
          </div>
          <fieldset>
            <legend>参与成员</legend>
            <p v-if="config.groupMembers.length === 0" class="config-empty-note">
              当前群组还没有可配置成员，请先在成员页面添加人员。
            </p>
            <div
              v-for="member in config.groupMembers"
              :key="member.membershipId"
              class="role-member-option"
            >
              <span>{{ member.realName }}</span>
              <CompactSwitch
                :model-value="roleIncludesMember(role.id, member.membershipId)"
                :label="`${role.name}包含${member.realName}`"
                @update:model-value="setRoleMember(role.id, member.membershipId, $event)"
              />
            </div>
            <t-button variant="outline" :loading="isSaving" @click="saveRoleMembers(role)">
              保存成员
            </t-button>
          </fieldset>
        </article>
      </t-card>
    </template>
  </section>
</template>

<style scoped>
.scheduling-config-panel {
  display: grid;
  gap: 12px;
}

.scheduling-config-card :deep(.t-card__body) {
  display: grid;
  gap: 10px;
}

.scheduling-config-card > p {
  margin: 0;
  font-size: 13px;
}

.shift-editor {
  display: grid;
  grid-template-columns:
    auto minmax(0, 130px) minmax(0, 90px) auto minmax(0, 1fr) minmax(0, 110px) minmax(0, 110px)
    auto auto auto auto;
  gap: 6px 10px;
  align-items: center;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.new-shift-editor {
  grid-template-columns:
    auto auto minmax(0, 130px) minmax(0, 90px) auto minmax(0, 1fr) minmax(0, 110px)
    minmax(0, 110px) auto auto auto auto;
}

.shift-editor .shift-color-preview {
  grid-column: 1;
}

.shift-editor .field-name {
  grid-column: 2;
}

.shift-editor .field-abbreviation {
  grid-column: 3;
}

.shift-editor .field-color {
  grid-column: 4;
}

.shift-editor .contrast-warning {
  grid-column: 5;
}

.shift-editor .field-start {
  grid-column: 6;
}

.shift-editor .field-end {
  grid-column: 7;
}

.shift-editor .field-crosses-midnight {
  grid-column: 8;
}

.shift-editor .field-enabled {
  grid-column: 9;
}

.shift-editor .field-counts {
  grid-column: 10;
}

.shift-editor-actions {
  grid-column: 11;
  display: flex;
  gap: 4px;
  align-items: center;
}

.new-shift-editor .new-shift-title {
  grid-column: 1 / 3;
}

.new-shift-editor .field-name {
  grid-column: 3;
}

.new-shift-editor .field-abbreviation {
  grid-column: 4;
}

.new-shift-editor .field-color {
  grid-column: 5;
}

.new-shift-editor .contrast-warning {
  grid-column: 6;
}

.new-shift-editor .field-start {
  grid-column: 7;
}

.new-shift-editor .field-end {
  grid-column: 8;
}

.new-shift-editor .field-crosses-midnight {
  grid-column: 9;
}

.new-shift-editor .field-enabled {
  grid-column: 10;
}

.new-shift-editor .field-counts {
  grid-column: 11;
}

.new-shift-editor > .t-button {
  grid-column: 12;
}

.shift-editor label {
  display: grid;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
  color: #374151;
}

.shift-editor input:not([type='checkbox']):not([type='color']),
.shift-editor select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  box-sizing: border-box;
}

.shift-editor input[type='color'] {
  width: 100%;
  min-width: 0;
  max-width: 44px;
  min-height: 30px;
  padding: 2px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  box-sizing: border-box;
}

.shift-editor input[type='checkbox'] {
  min-height: auto;
}

.shift-type-list {
  display: grid;
  gap: 6px;
}

.shift-color-preview {
  display: inline-grid;
  min-width: 28px;
  min-height: 28px;
  place-items: center;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.new-role-form,
.schedule-role-editor fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.new-role-form label,
.schedule-role-editor fieldset label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #374151;
  font-size: 13px;
}

.new-role-form input {
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.schedule-role-editor {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.schedule-role-editor fieldset {
  margin: 0;
}

.schedule-role-editor fieldset legend {
  padding: 0 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.role-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.role-editor-header h3 {
  margin: 0;
}

.contrast-warning {
  color: var(--ui-color-warning);
  font-size: var(--ui-font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Web UI 2.0: the configuration surface keeps desktop density and progressively unfolds on touch. */
.scheduling-config-panel {
  min-width: 0;
  gap: var(--ui-spacing-md);
  margin-top: 0;
}

.config-panel-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.config-panel-heading p,
.config-panel-heading h2 {
  margin: 0;
}

.config-panel-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.config-panel-heading h2 {
  margin-top: var(--ui-spacing-xxs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.config-panel-heading > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: right;
}

.configuration-readiness {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.configuration-readiness > header {
  display: flex;
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
  background: var(--ui-color-primary-light);
  border-bottom: 1px solid var(--ui-color-primary-border);
}

.configuration-readiness > header > div {
  display: grid;
  gap: 2px;
}

.configuration-readiness > header span,
.configuration-readiness > header small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.configuration-readiness > header strong {
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.configuration-readiness ol {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: var(--ui-spacing-md);
  list-style: none;
}

.configuration-readiness ol::before {
  position: absolute;
  top: 27px;
  right: calc(16.666% + var(--ui-spacing-md));
  left: calc(16.666% + var(--ui-spacing-md));
  height: 2px;
  background: var(--ui-color-border);
  content: '';
}

.configuration-readiness li {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: var(--ui-spacing-xxs);
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: center;
}

.readiness-dot {
  display: block;
  width: 14px;
  height: 14px;
  margin-bottom: var(--ui-spacing-xxs);
  background: var(--ui-color-surface);
  border: 3px solid var(--ui-color-border-strong);
  border-radius: 50%;
}

.configuration-readiness li.is-complete .readiness-dot {
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
  box-shadow: 0 0 0 4px var(--ui-color-primary-light);
}

.configuration-readiness li strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.scheduling-config-card {
  min-width: 0;
  border-color: var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.scheduling-config-card :deep(.t-card__header) {
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  border-bottom: 1px solid var(--ui-color-border);
}

.scheduling-config-card :deep(.t-card__body) {
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-md);
}

.config-section-note {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.shift-type-list {
  gap: var(--ui-spacing-sm);
}

.shift-editor {
  grid-template-columns:
    52px minmax(140px, 1.4fr) minmax(88px, 0.7fr) 64px minmax(110px, 1fr)
    minmax(110px, 1fr);
  grid-auto-flow: dense;
  gap: var(--ui-spacing-xs) var(--ui-spacing-sm);
  padding: var(--ui-spacing-sm);
  align-items: end;
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.new-shift-editor {
  grid-template-columns:
    minmax(140px, 1.4fr) minmax(88px, 0.7fr) 64px minmax(110px, 1fr) minmax(110px, 1fr)
    auto;
  background: var(--ui-color-primary-light);
  border-color: var(--ui-color-primary-border);
}

.shift-editor .shift-color-preview {
  grid-column: 1;
}

.shift-editor .field-name {
  grid-column: 2;
}

.shift-editor .field-abbreviation {
  grid-column: 3;
}

.shift-editor .field-color {
  grid-column: 4;
}

.shift-editor .field-start {
  grid-column: 5;
}

.shift-editor .field-end {
  grid-column: 6;
}

.shift-editor .contrast-warning {
  grid-column: 1 / -1;
}

.shift-editor .field-crosses-midnight {
  grid-column: 2;
}

.shift-editor .field-enabled {
  grid-column: 3;
}

.shift-editor .field-counts {
  grid-column: 4;
}

.shift-editor-actions {
  grid-column: 5 / 7;
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-spacing-xs);
}

.new-shift-editor .new-shift-title {
  grid-column: 1 / -1;
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.new-shift-editor .field-name {
  grid-column: 1;
}

.new-shift-editor .field-abbreviation {
  grid-column: 2;
}

.new-shift-editor .field-color {
  grid-column: 3;
}

.new-shift-editor .field-start {
  grid-column: 4;
}

.new-shift-editor .field-end {
  grid-column: 5;
}

.new-shift-editor .field-crosses-midnight {
  grid-column: 1;
}

.new-shift-editor .field-enabled {
  grid-column: 2;
}

.new-shift-editor .field-counts {
  grid-column: 3;
}

.new-shift-editor > .t-button {
  grid-column: 4 / 7;
  justify-self: end;
}

.shift-editor label,
.new-role-form label,
.schedule-role-editor fieldset label {
  min-width: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.shift-editor input:not([type='checkbox']):not([type='color']),
.new-role-form input {
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xxs) var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
}

.shift-editor input[type='color'] {
  width: 52px;
  max-width: 52px;
  min-height: var(--ui-touch-target-minimum);
  padding: 3px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
}

.shift-editor .field-crosses-midnight,
.shift-editor .field-enabled,
.shift-editor .field-counts,
.schedule-role-editor fieldset label {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  gap: var(--ui-spacing-xs);
}

.shift-editor input[type='checkbox'],
.schedule-role-editor input[type='checkbox'] {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  accent-color: var(--ui-color-primary);
}

.shift-color-preview {
  width: var(--ui-touch-target-minimum);
  min-width: var(--ui-touch-target-minimum);
  height: var(--ui-touch-target-minimum);
  min-height: var(--ui-touch-target-minimum);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.shift-editor :deep(.t-button),
.new-role-form :deep(.t-button),
.schedule-role-editor :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.new-role-form,
.schedule-role-editor fieldset {
  gap: var(--ui-spacing-xs) var(--ui-spacing-sm);
  padding: var(--ui-spacing-sm);
  align-items: center;
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.new-role-form label {
  flex: 1 1 240px;
}

.new-role-form input {
  width: 100%;
}

.schedule-role-editor {
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.role-editor-header {
  min-height: var(--ui-touch-target-minimum);
}

.role-editor-header h3 {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.schedule-role-editor fieldset {
  margin: 0;
}

.schedule-role-editor fieldset legend {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.config-empty-note {
  grid-column: 1 / -1;
  margin: 0;
  padding: var(--ui-spacing-sm);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px dashed var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.contrast-warning {
  overflow: visible;
  color: var(--ui-color-warning);
  font-weight: var(--ui-font-weight-semibold);
  text-overflow: clip;
  white-space: normal;
}

.shift-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.add-shift-button,
.edit-row-button,
.secondary-action,
.primary-action,
.delete-action {
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.add-shift-button,
.primary-action {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 0;
}

.shift-type-list {
  display: block;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
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
  border-top: 1px solid var(--ui-color-border);
}

.shift-type-row.is-editing {
  background: #fbfdff;
  box-shadow: inset 3px 0 var(--ui-color-primary);
}

.shift-type-row.is-disabled .shift-glyph {
  filter: grayscale(0.6);
  opacity: 0.7;
}

.shift-glyph {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(22 32 42 / 14%);
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
  overflow: hidden;
  color: var(--ui-color-text-primary);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.built-in-badge {
  padding: 2px 6px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: 9px;
  font-weight: 700;
}

.shift-summary p {
  margin: 5px 0 0;
  color: var(--ui-color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.time-band {
  width: 18px;
  height: 4px;
  flex: none;
  border-radius: var(--ui-radius-pill);
}

.edit-row-button {
  min-width: 54px;
  padding: 0 9px;
  color: var(--ui-color-primary);
  background: transparent;
  border: 1px solid transparent;
}

.edit-row-button:hover {
  background: var(--ui-color-primary-light);
}

.compact-shift-editor {
  display: grid;
  min-width: 0;
  margin: 6px 0 2px;
  padding: 13px;
  grid-column: 1 / -1;
  grid-template-columns: 245px 288px minmax(210px, 1fr);
  align-items: end;
  gap: 12px;
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: 14px;
}

.new-shift-editor {
  margin: 0;
}

.editor-heading {
  display: flex;
  grid-column: 1 / -1;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.editor-heading strong {
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-md);
}

.editor-heading span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.identity-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 9px;
}

.identity-fields label,
.time-range-control label {
  display: grid;
  min-width: 0;
}

.compact-shift-editor fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.compact-shift-editor legend,
.compact-shift-editor label > span {
  margin-bottom: 5px;
  color: var(--ui-color-text-muted);
  font-size: 10px;
  font-weight: var(--ui-font-weight-semibold);
}

.identity-fields input,
.time-range-control input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0 10px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-white);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
}

.time-range-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
  align-items: end;
  gap: 6px;
}

.time-range-control legend {
  grid-column: 1 / -1;
}

.range-arrow {
  display: grid;
  height: 42px;
  place-items: center;
  color: var(--ui-color-primary);
}

.compact-shift-editor > .contrast-warning {
  grid-column: 1 / -1;
  margin: -4px 0;
  font-size: var(--ui-font-size-xs);
}

.editor-options {
  display: grid;
  grid-column: 1 / 3;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #cbd9e9;
  border-radius: 12px;
}

.editor-options.three-options {
  grid-column: 1 / -1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  color: var(--ui-color-text-primary);
  font-size: 12px;
}

.editor-options small {
  margin-top: 2px;
  color: var(--ui-color-text-muted);
  font-size: 9px;
}

.editor-actions {
  display: flex;
  grid-column: 3;
  align-self: center;
  justify-content: flex-end;
  gap: 8px;
}

.three-options + .editor-actions {
  grid-column: 1 / -1;
}

.secondary-action {
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
}

.delete-action {
  color: var(--ui-color-danger);
  background: transparent;
  border: 1px solid transparent;
}

.primary-action {
  min-width: 84px;
}

.primary-action:disabled,
.delete-action:disabled {
  cursor: wait;
  opacity: 0.6;
}

.role-member-option {
  display: grid;
  min-width: 180px;
  min-height: 52px;
  padding: 4px 4px 4px 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 12px;
  font-size: var(--ui-font-size-sm);
}

@media (max-width: 900px) {
  .config-panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .config-panel-heading > span {
    text-align: left;
  }

  .shift-editor,
  .new-shift-editor {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shift-editor .shift-color-preview,
  .shift-editor .field-name,
  .shift-editor .contrast-warning,
  .new-shift-editor .new-shift-title,
  .new-shift-editor .field-name,
  .new-shift-editor .contrast-warning {
    grid-column: 1 / -1;
  }

  .shift-editor .field-abbreviation,
  .new-shift-editor .field-abbreviation,
  .shift-editor .field-start,
  .new-shift-editor .field-start,
  .shift-editor .field-crosses-midnight,
  .new-shift-editor .field-crosses-midnight {
    grid-column: 1;
  }

  .shift-editor .field-color,
  .new-shift-editor .field-color,
  .shift-editor .field-end,
  .new-shift-editor .field-end,
  .shift-editor .field-enabled,
  .new-shift-editor .field-enabled {
    grid-column: 2;
  }

  .shift-editor .field-counts,
  .new-shift-editor .field-counts,
  .shift-editor-actions,
  .new-shift-editor > .t-button {
    grid-column: 1 / -1;
  }

  .shift-editor-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shift-editor-actions :deep(.t-button),
  .new-shift-editor > :deep(.t-button) {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .configuration-readiness > header {
    align-items: flex-start;
    flex-direction: column;
  }

  .configuration-readiness ol {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .configuration-readiness ol::before {
    top: calc(var(--ui-spacing-md) + 7px);
    bottom: calc(var(--ui-spacing-md) + 7px);
    left: calc(var(--ui-spacing-md) + 6px);
    width: 2px;
    height: auto;
  }

  .configuration-readiness li {
    min-height: var(--ui-touch-target-comfortable);
    grid-template-columns: auto minmax(0, 1fr) auto;
    justify-items: start;
    align-items: center;
    gap: var(--ui-spacing-xs);
    text-align: left;
  }

  .readiness-dot {
    margin: 0;
  }

  .scheduling-config-card :deep(.t-card__body) {
    padding: var(--ui-spacing-sm);
  }

  .new-role-form,
  .schedule-role-editor fieldset {
    align-items: stretch;
    flex-direction: column;
  }

  .new-role-form label {
    flex-basis: auto;
  }

  .new-role-form :deep(.t-button),
  .schedule-role-editor fieldset > :deep(.t-button) {
    width: 100%;
  }

  .shift-section-heading {
    align-items: flex-start;
  }

  .shift-section-heading .config-section-note {
    flex: 1;
  }

  .add-shift-button {
    flex: none;
    white-space: nowrap;
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

  .compact-shift-editor {
    grid-template-columns: minmax(0, 1fr);
    padding: 11px;
  }

  .editor-heading,
  .identity-fields,
  .time-range-control,
  .compact-shift-editor > :deep(.color-control),
  .compact-shift-editor > .contrast-warning,
  .editor-options,
  .editor-options.three-options,
  .editor-actions,
  .three-options + .editor-actions {
    grid-column: 1;
  }

  .editor-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .editor-options,
  .editor-options.three-options {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-options article + article {
    border-top: 1px solid #d6e2ef;
    border-left: 0;
  }

  .role-member-option {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .shift-editor,
  .new-shift-editor {
    grid-template-columns: minmax(0, 1fr);
  }

  .shift-editor .shift-color-preview,
  .shift-editor .field-name,
  .shift-editor .field-abbreviation,
  .shift-editor .field-color,
  .shift-editor .contrast-warning,
  .shift-editor .field-start,
  .shift-editor .field-end,
  .shift-editor .field-crosses-midnight,
  .shift-editor .field-enabled,
  .shift-editor .field-counts,
  .shift-editor-actions,
  .new-shift-editor .new-shift-title,
  .new-shift-editor .field-name,
  .new-shift-editor .field-abbreviation,
  .new-shift-editor .field-color,
  .new-shift-editor .contrast-warning,
  .new-shift-editor .field-start,
  .new-shift-editor .field-end,
  .new-shift-editor .field-crosses-midnight,
  .new-shift-editor .field-enabled,
  .new-shift-editor .field-counts,
  .new-shift-editor > .t-button {
    grid-column: 1;
  }

  .shift-editor-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
