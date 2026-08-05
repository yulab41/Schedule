<script setup lang="ts">
import type { GroupSummary, ScheduleRole, ShiftType, ShiftTypeInput } from '@schedule/contracts';
import { getBestContrastRatio, pickReadableTextColor } from '@schedule/ui-tokens';
import { ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';

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

const api = createApiClient({ auth: cloudbaseAuth });
const config = ref<Awaited<ReturnType<typeof api.getSchedulingConfig>>>();
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSaving = ref(false);
const newRoleName = ref('');
const newShift = ref<ShiftTypeDraft>(createEmptyShiftDraft());
const roleDrafts = ref<Record<string, RoleDraft>>({});
const shiftDrafts = ref<Record<string, ShiftTypeDraft>>({});
let requestVersion = 0;

watch(
  () => props.group.id,
  () => {
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
      errorMessage.value = getErrorMessage(error);
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
  await save(async () => {
    await api.createShiftType(props.group.id, toShiftTypeInput(newShift.value));
    newShift.value = createEmptyShiftDraft();
    infoMessage.value = '自定义班种已创建。';
  });
}

async function saveShift(shiftType: ShiftType): Promise<void> {
  await save(async () => {
    await api.updateShiftType(
      props.group.id,
      shiftType.id,
      toShiftTypeInput(getShiftDraft(shiftType.id)),
    );
    infoMessage.value = `${shiftType.name}已保存。`;
  });
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
    errorMessage.value = getErrorMessage(error);
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

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '排班配置暂时无法保存，请稍后重试。';
}
</script>

<template>
  <section class="scheduling-config-panel" :aria-busy="isLoading || isSaving">
    <h2>排班配置</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载排班配置" />
    <template v-else-if="config !== undefined">
      <t-card title="班种" class="scheduling-config-card">
        <p>全天班固定为 08:00 至次日 08:00。其他预建班种需先填写时间，才可启用。</p>
        <form class="shift-editor new-shift-editor" @submit.prevent="createShift">
          <strong class="new-shift-title">新增自定义班种</strong>
          <label class="field-name"
            >名称<input v-model="newShift.name" maxlength="100" required
          /></label>
          <label class="field-abbreviation"
            >简称<input v-model="newShift.abbreviation" maxlength="16" required
          /></label>
          <label class="field-color">颜色<input v-model="newShift.color" type="color" /></label>
          <span v-if="hasInsufficientContrast(newShift)" class="contrast-warning" role="status">
            对比度不足 4.5:1
          </span>
          <label class="field-start">开始<input v-model="newShift.startTime" type="time" /></label>
          <label class="field-end">结束<input v-model="newShift.endTime" type="time" /></label>
          <label class="field-crosses-midnight"
            ><input v-model="newShift.crossesMidnight" type="checkbox" /> 跨日</label
          >
          <label class="field-enabled"
            ><input v-model="newShift.isEnabled" type="checkbox" /> 启用</label
          >
          <label class="field-counts"
            ><input v-model="newShift.countsTowardStatistics" type="checkbox" /> 计入统计</label
          >
          <t-button theme="primary" type="submit" :loading="isSaving">新增班种</t-button>
        </form>
        <div class="shift-type-list">
          <form
            v-for="shiftType in config.shiftTypes"
            :key="shiftType.id"
            class="shift-editor"
            @submit.prevent="saveShift(shiftType)"
          >
            <span class="shift-color-preview" :style="previewStyle(getShiftDraft(shiftType.id))">
              {{ getShiftDraft(shiftType.id).abbreviation || '班' }}
            </span>
            <label class="field-name"
              >名称<input v-model="getShiftDraft(shiftType.id).name" maxlength="100" required
            /></label>
            <label class="field-abbreviation"
              >简称<input
                v-model="getShiftDraft(shiftType.id).abbreviation"
                maxlength="16"
                required
            /></label>
            <label class="field-color"
              >颜色<input v-model="getShiftDraft(shiftType.id).color" type="color"
            /></label>
            <span
              v-if="hasInsufficientContrast(getShiftDraft(shiftType.id))"
              class="contrast-warning"
              role="status"
              title="建议选择更深或更浅的颜色。"
            >
              对比度不足 4.5:1
            </span>
            <label class="field-start"
              >开始<input
                v-model="getShiftDraft(shiftType.id).startTime"
                :disabled="shiftType.isAllDay"
                type="time"
            /></label>
            <label class="field-end"
              >结束<input
                v-model="getShiftDraft(shiftType.id).endTime"
                :disabled="shiftType.isAllDay"
                type="time"
            /></label>
            <label class="field-crosses-midnight"
              ><input
                v-model="getShiftDraft(shiftType.id).crossesMidnight"
                :disabled="shiftType.isAllDay"
                type="checkbox"
              />
              跨日</label
            >
            <label class="field-enabled"
              ><input
                v-model="getShiftDraft(shiftType.id).isEnabled"
                :disabled="shiftType.isAllDay"
                type="checkbox"
              />
              启用</label
            >
            <label class="field-counts"
              ><input
                v-model="getShiftDraft(shiftType.id).countsTowardStatistics"
                type="checkbox"
              />
              计入统计</label
            >
            <div class="shift-editor-actions">
              <t-button type="submit" variant="outline" :loading="isSaving">保存</t-button>
              <t-button
                v-if="!shiftType.isBuiltIn"
                type="button"
                theme="danger"
                variant="text"
                :loading="isSaving"
                @click="deleteShift(shiftType)"
              >
                删除
              </t-button>
            </div>
          </form>
        </div>
      </t-card>

      <t-card title="排班岗位" class="scheduling-config-card">
        <p>排班岗位指值班班次岗位（如一线、二线），不是成员姓名。</p>
        <form class="new-role-form" @submit.prevent="createRole">
          <label>岗位名称<input v-model="newRoleName" maxlength="100" required /></label>
          <t-button theme="primary" type="submit" :loading="isSaving">新增岗位</t-button>
        </form>
        <article v-for="role in config.roles" :key="role.id" class="schedule-role-editor">
          <div class="role-editor-header">
            <h3>岗位：{{ role.name }}</h3>
            <t-button theme="danger" variant="text" :loading="isSaving" @click="deleteRole(role)">
              删除岗位
            </t-button>
          </div>
          <fieldset>
            <legend>参与成员</legend>
            <label v-for="member in config.groupMembers" :key="member.membershipId">
              <input
                v-model="getRoleDraft(role.id).memberIds"
                :value="member.membershipId"
                type="checkbox"
              />
              {{ member.realName }}
            </label>
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
</style>
