<script setup lang="ts">
import type { GroupSummary, ScheduleExportJob, ScheduleExportType } from '@schedule/contracts';
import { getCurrentBusinessMonth } from '@schedule/scheduling-domain';
import { computed, onMounted, ref } from 'vue';
import type { SelectValue } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { buildExportFileName, getExportPeriodLabel, isExportJobFinished } from './export-logic.js';

const props = defineProps<{
  group: GroupSummary;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const api = createApiClient({ auth: localAuth });
const visible = defineModel<boolean>({ required: true });
const exportType = ref<ScheduleExportType>('schedule');
const periodType = ref<'month' | 'year'>('month');
const businessMonth = ref(getCurrentBusinessMonth());
const year = ref(Number(getCurrentBusinessMonth().slice(0, 4)));
const roleId = ref<string>();
const membershipId = ref<string>();
const roles = ref<readonly { readonly id: string; readonly name: string }[]>([]);
const members = ref<readonly { readonly id: string; readonly realName: string }[]>([]);
const isLoading = ref(false);
const isWorking = ref(false);
const errorMessage = ref<string>();
const successMessage = ref<string>();

const period = computed(() =>
  periodType.value === 'month' ? businessMonth.value : String(year.value),
);

onMounted(() => {
  void loadOptions();
});

async function loadOptions(): Promise<void> {
  isLoading.value = true;
  try {
    const config = await api.getSchedulingConfig(props.group.id);
    roles.value = config.roles;
    const memberMap = new Map<string, string>();
    for (const role of config.roles) {
      for (const member of role.members) {
        memberMap.set(member.id, member.realName);
      }
    }
    members.value = [...memberMap.entries()].map(([id, realName]) => ({ id, realName }));
  } catch (error) {
    errorMessage.value = toUserMessage(error, '导出暂时无法完成，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function runExport(): Promise<void> {
  errorMessage.value = undefined;
  successMessage.value = undefined;
  isWorking.value = true;
  try {
    const job = await api.createExportJob(props.group.id, {
      exportType: exportType.value,
      ...(membershipId.value === undefined ? {} : { membershipId: membershipId.value }),
      period: period.value,
      ...(roleId.value === undefined ? {} : { roleId: roleId.value }),
    });
    const finishedJob = await waitForJob(job.id);
    if (finishedJob.status !== 'completed') {
      throw new Error(finishedJob.error ?? '导出失败，请稍后重试。');
    }
    const content = await api.downloadExport(props.group.id, job.id);
    downloadCsv(buildExportFileName(finishedJob.exportType, finishedJob.period), content);
    successMessage.value = `导出完成：${getExportPeriodLabel(finishedJob.period)}。`;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '导出暂时无法完成，请稍后重试。');
  } finally {
    isWorking.value = false;
  }
}

async function waitForJob(exportJobId: string): Promise<ScheduleExportJob> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const job = await api.getExportJob(props.group.id, exportJobId);
    if (isExportJobFinished(job)) {
      return job;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error('导出超时，请稍后重试。');
}

function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function onRoleChange(value: SelectValue): void {
  roleId.value = typeof value === 'string' ? value : undefined;
}

function onMembershipChange(value: SelectValue): void {
  membershipId.value = typeof value === 'string' ? value : undefined;
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    header="导出排班/统计"
    :confirm-btn="{ content: '导出', loading: isWorking }"
    :cancel-btn="{}"
    width="560px"
    @confirm="runExport"
    @close="emit('close')"
  >
    <t-loading v-if="isLoading" text="正在加载导出选项" />
    <template v-else>
      <t-form-item label="导出内容" name="exportType">
        <t-radio-group v-model="exportType">
          <t-radio-button value="schedule">排班</t-radio-button>
          <t-radio-button value="statistics">统计</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="时间范围" name="periodType">
        <t-radio-group v-model="periodType">
          <t-radio-button value="month">按月</t-radio-button>
          <t-radio-button value="year">按年</t-radio-button>
        </t-radio-group>
        <input
          v-if="periodType === 'month'"
          v-model="businessMonth"
          class="export-period-input"
          type="month"
        />
        <select v-else v-model.number="year" class="export-period-input">
          <option
            v-for="candidate in [year - 1, year, year + 1]"
            :key="candidate"
            :value="candidate"
          >
            {{ candidate }} 年
          </option>
        </select>
      </t-form-item>
      <t-form-item label="排班岗位" name="roleId">
        <t-select
          :value="roleId ?? ''"
          :options="roles.map((role) => ({ label: role.name, value: role.id }))"
          clearable
          placeholder="全部岗位"
          @change="onRoleChange"
        />
      </t-form-item>
      <t-form-item label="成员" name="membershipId">
        <t-select
          :value="membershipId ?? ''"
          :options="members.map((member) => ({ label: member.realName, value: member.id }))"
          clearable
          placeholder="全部成员"
          @change="onMembershipChange"
        />
      </t-form-item>
      <p class="export-hint">
        导出文件默认不包含电话号码和内部审计内容，每次导出都会记录安全审计。
      </p>
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <t-alert v-if="successMessage !== undefined" theme="success" :message="successMessage" />
    </template>
  </t-dialog>
</template>
