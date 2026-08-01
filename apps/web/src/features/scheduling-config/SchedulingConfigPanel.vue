<script setup lang="ts">
import type { GroupSummary, ScheduleRole, ShiftType, ShiftTypeInput } from '@schedule/contracts';
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
  currentPosition: number;
  defaultShiftTypeId: string;
  memberIds: string[];
  positions: Record<string, number>;
  requiredMembersPerDay: number;
  startDate: string;
  startingMemberScheduleRoleId: string;
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
    errorMessage.value = '请填写排班角色名称。';
    return;
  }

  await save(async () => {
    await api.createScheduleRole(props.group.id, { name: newRoleName.value });
    newRoleName.value = '';
    infoMessage.value = '排班角色已创建，请配置成员和轮值规则。';
  });
}

async function saveRoleMembers(role: ScheduleRole): Promise<void> {
  await save(async () => {
    await api.replaceScheduleRoleMembers(props.group.id, role.id, {
      membershipIds: getRoleDraft(role.id).memberIds,
    });
    infoMessage.value = '排班角色成员已保存。';
  });
}

async function saveRoleOrder(role: ScheduleRole): Promise<void> {
  await save(async () => {
    const draft = getRoleDraft(role.id);
    await api.reorderRotationMembers(props.group.id, role.id, {
      members: role.members.map((member) => ({
        position: Number(draft.positions[member.id]),
        scheduleRoleMemberId: member.id,
      })),
    });
    infoMessage.value = '轮值顺序已保存。';
  });
}

async function saveRotationRule(role: ScheduleRole): Promise<void> {
  await save(async () => {
    const draft = getRoleDraft(role.id);
    await api.updateRotationRule(props.group.id, role.id, {
      currentPosition: Number(draft.currentPosition),
      defaultShiftTypeId: draft.defaultShiftTypeId,
      requiredMembersPerDay: Number(draft.requiredMembersPerDay),
      startDate: draft.startDate === '' ? null : draft.startDate,
      startingMemberScheduleRoleId:
        draft.startingMemberScheduleRoleId === '' ? null : draft.startingMemberScheduleRoleId,
    });
    infoMessage.value = '轮值规则已保存。';
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

async function save(operation: () => Promise<void>): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isSaving.value = true;

  try {
    await operation();
    await loadConfig();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
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
    currentPosition: role.rotationRule.currentPosition,
    defaultShiftTypeId: role.rotationRule.defaultShiftTypeId,
    memberIds: role.members.map((member) => member.membershipId),
    positions: Object.fromEntries(role.members.map((member) => [member.id, member.position])),
    requiredMembersPerDay: role.rotationRule.requiredMembersPerDay,
    startDate: role.rotationRule.startDate ?? '',
    startingMemberScheduleRoleId: role.rotationRule.startingMemberScheduleRoleId ?? '',
  };
}

function getRoleDraft(roleId: string): RoleDraft {
  const draft = roleDrafts.value[roleId];
  if (draft === undefined) {
    throw new Error('排班角色配置尚未加载。');
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
          <strong>新增自定义班种</strong>
          <label>名称<input v-model="newShift.name" maxlength="100" required /></label>
          <label>简称<input v-model="newShift.abbreviation" maxlength="16" required /></label>
          <label>颜色<input v-model="newShift.color" type="color" /></label>
          <label>开始<input v-model="newShift.startTime" type="time" /></label>
          <label>结束<input v-model="newShift.endTime" type="time" /></label>
          <label><input v-model="newShift.crossesMidnight" type="checkbox" /> 跨日</label>
          <label><input v-model="newShift.isEnabled" type="checkbox" /> 启用</label>
          <label
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
            <span
              class="shift-color-preview"
              :style="{
                backgroundColor: getShiftDraft(shiftType.id).color,
                color: shiftType.textColor,
              }"
            >
              {{ getShiftDraft(shiftType.id).abbreviation || '班' }}
            </span>
            <label
              >名称<input v-model="getShiftDraft(shiftType.id).name" maxlength="100" required
            /></label>
            <label
              >简称<input
                v-model="getShiftDraft(shiftType.id).abbreviation"
                maxlength="16"
                required
            /></label>
            <label>颜色<input v-model="getShiftDraft(shiftType.id).color" type="color" /></label>
            <label
              >开始<input
                v-model="getShiftDraft(shiftType.id).startTime"
                :disabled="shiftType.isAllDay"
                type="time"
            /></label>
            <label
              >结束<input
                v-model="getShiftDraft(shiftType.id).endTime"
                :disabled="shiftType.isAllDay"
                type="time"
            /></label>
            <label
              ><input
                v-model="getShiftDraft(shiftType.id).crossesMidnight"
                :disabled="shiftType.isAllDay"
                type="checkbox"
              />
              跨日</label
            >
            <label
              ><input
                v-model="getShiftDraft(shiftType.id).isEnabled"
                :disabled="shiftType.isAllDay"
                type="checkbox"
              />
              启用</label
            >
            <label
              ><input
                v-model="getShiftDraft(shiftType.id).countsTowardStatistics"
                type="checkbox"
              />
              计入统计</label
            >
            <t-button type="submit" variant="outline" :loading="isSaving">保存</t-button>
          </form>
        </div>
      </t-card>

      <t-card title="排班角色与轮值" class="scheduling-config-card">
        <form class="new-role-form" @submit.prevent="createRole">
          <label>角色名称<input v-model="newRoleName" maxlength="100" required /></label>
          <t-button theme="primary" type="submit" :loading="isSaving">新增角色</t-button>
        </form>
        <article v-for="role in config.roles" :key="role.id" class="schedule-role-editor">
          <h3>{{ role.name }}</h3>
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
          <fieldset>
            <legend>轮值顺序</legend>
            <label v-for="member in role.members" :key="member.id">
              {{ member.realName }}
              <input
                v-model.number="getRoleDraft(role.id).positions[member.id]"
                min="1"
                type="number"
              />
            </label>
            <t-button variant="outline" :loading="isSaving" @click="saveRoleOrder(role)">
              保存顺序
            </t-button>
          </fieldset>
          <fieldset class="rotation-rule-editor">
            <legend>轮值规则</legend>
            <label>
              默认班种
              <select v-model="getRoleDraft(role.id).defaultShiftTypeId">
                <option
                  v-for="shiftType in config.shiftTypes.filter((item) => item.isEnabled)"
                  :key="shiftType.id"
                  :value="shiftType.id"
                >
                  {{ shiftType.name }}（{{ shiftType.abbreviation }}）
                </option>
              </select>
            </label>
            <label
              >每天人数<input
                v-model.number="getRoleDraft(role.id).requiredMembersPerDay"
                min="1"
                max="100"
                type="number"
            /></label>
            <label>起始日期<input v-model="getRoleDraft(role.id).startDate" type="date" /></label>
            <label>
              起始成员
              <select v-model="getRoleDraft(role.id).startingMemberScheduleRoleId">
                <option value="">未设置</option>
                <option v-for="member in role.members" :key="member.id" :value="member.id">
                  {{ member.realName }}
                </option>
              </select>
            </label>
            <label
              >当前游标<input
                v-model.number="getRoleDraft(role.id).currentPosition"
                min="1"
                type="number"
            /></label>
            <t-button variant="outline" :loading="isSaving" @click="saveRotationRule(role)">
              保存规则
            </t-button>
          </fieldset>
        </article>
      </t-card>
    </template>
  </section>
</template>
