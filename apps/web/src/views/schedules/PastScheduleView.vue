<script setup lang="ts">
import type {
  GroupSummary,
  PastScheduleAssignment,
  PastSchedulePeriod,
  ShiftType,
} from '@schedule/contracts';
import { onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const periods = ref<readonly PastSchedulePeriod[]>([]);
const selectedPeriodId = ref('');
const assignments = ref<readonly PastScheduleAssignment[]>([]);
const shiftTypes = ref<readonly ShiftType[]>([]);
const members = ref<
  readonly {
    readonly membershipId: string;
    readonly realName: string;
  }[]
>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const editTarget = ref<PastScheduleAssignment>();
const editVisible = ref(false);
const editMemberId = ref('');
const editShiftTypeId = ref('');
const editReason = ref('');

onMounted(() => {
  void loadData();
});

async function loadData(preferredPeriodId?: string): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const [nextPeriods, nextConfig] = await Promise.all([
      api.listPastSchedulePeriods(props.group.id),
      api.getSchedulingConfig(props.group.id),
    ]);
    periods.value = nextPeriods;
    shiftTypes.value = nextConfig.shiftTypes.filter((shiftType) => shiftType.isEnabled);
    members.value = nextConfig.groupMembers;
    const nextPeriodId =
      preferredPeriodId ??
      (periods.value.some((period) => period.id === selectedPeriodId.value)
        ? selectedPeriodId.value
        : (periods.value[0]?.id ?? ''));
    await selectPeriod(nextPeriodId);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function selectPeriod(periodId: string): Promise<void> {
  selectedPeriodId.value = periodId;
  assignments.value = [];
  if (periodId === '') {
    return;
  }
  try {
    assignments.value = await api.listPastScheduleAssignments(props.group.id, periodId);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

function openEdit(assignment: PastScheduleAssignment): void {
  editTarget.value = assignment;
  editVisible.value = true;
  editMemberId.value = assignment.actualMemberId ?? '';
  editShiftTypeId.value = assignment.shiftTypeId;
  editReason.value = '';
}

async function saveEdit(): Promise<void> {
  const target = editTarget.value;
  if (target === undefined || selectedPeriodId.value === '') {
    return;
  }
  if (editMemberId.value === '' && editShiftTypeId.value === '') {
    errorMessage.value = '请选择补录后的值班成员或班种。';
    return;
  }

  errorMessage.value = undefined;
  isSaving.value = true;
  try {
    await api.updatePastScheduleAssignment(
      props.group.id,
      selectedPeriodId.value,
      target.assignmentId,
      {
        ...(editMemberId.value === '' ? {} : { actualMembershipId: editMemberId.value }),
        ...(editShiftTypeId.value === '' ? {} : { shiftTypeId: editShiftTypeId.value }),
        ...(editReason.value.trim() === '' ? {} : { reason: editReason.value.trim() }),
      },
    );
    infoMessage.value = `已补录 ${target.businessDate} 的班次，并留下“排班补录”事件记录。`;
    editTarget.value = undefined;
    editVisible.value = false;
    await loadData(selectedPeriodId.value);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSaving.value = false;
  }
}

function memberName(assignment: PastScheduleAssignment): string {
  return assignment.actualMemberName ?? assignment.plannedMemberName ?? '未设置';
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '排班补录暂时无法完成，请稍后重试。';
}
</script>

<template>
  <section class="past-schedule-view" :aria-busy="isLoading || isSaving">
    <h2>排班补录</h2>
    <t-alert
      theme="info"
      message="仅管理员与群主可进入。可修改已过日期的排班，每次修改都会生成“排班补录”事件记录；未过日期请使用正常排班功能。"
    />
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载既往排班" />
    <template v-else>
      <label class="period-select">
        既往排班
        <t-select
          :value="selectedPeriodId"
          :options="
            periods.map((period) => ({
              label: `${period.businessMonth} · ${period.scheduleRoleName}`,
              value: period.id,
            }))
          "
          placeholder="请选择要补录的排班"
          @change="
            (value: string | number | boolean | object | null) => selectPeriod(String(value ?? ''))
          "
        />
      </label>

      <div v-if="assignments.length === 0" class="empty-hint">暂无已过日期的班次需要补录。</div>
      <table v-else class="assignment-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>班种</th>
            <th>当值成员</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="assignment in assignments" :key="assignment.assignmentId">
            <td>{{ assignment.businessDate }}</td>
            <td>{{ assignment.shiftTypeName }}（{{ assignment.shiftTypeAbbreviation }}）</td>
            <td>{{ memberName(assignment) }}</td>
            <td>
              <t-button variant="outline" size="small" @click="openEdit(assignment)">修改</t-button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <t-dialog
      v-model:visible="editVisible"
      :confirm-btn="{
        content: '保存补录',
        disabled: isSaving,
        loading: isSaving,
        theme: 'primary',
      }"
      :header="`排班补录：${editTarget?.businessDate ?? ''}`"
      width="520px"
      @confirm="saveEdit"
      @close="editVisible = false"
    >
      <div v-if="editTarget !== undefined" class="edit-dialog">
        <p class="edit-summary">
          原班次：{{ editTarget.shiftTypeName }}（{{ editTarget.shiftTypeAbbreviation }}）· 当值
          {{ memberName(editTarget) }}
        </p>
        <label>
          补录后值班成员
          <t-select
            v-model="editMemberId"
            :options="
              members.map((member) => ({
                label: member.realName,
                value: member.membershipId,
              }))
            "
            placeholder="保持原成员"
          />
        </label>
        <label>
          补录后班种
          <t-select
            v-model="editShiftTypeId"
            :options="
              shiftTypes.map((shiftType) => ({
                label: `${shiftType.name}（${shiftType.abbreviation}）`,
                value: shiftType.id,
              }))
            "
            placeholder="保持原班种"
          />
        </label>
        <label>
          补录说明（选填）
          <t-textarea v-model="editReason" :maxlength="1000" placeholder="记录本次补录原因" />
        </label>
      </div>
    </t-dialog>
  </section>
</template>

<style scoped>
.past-schedule-view {
  display: grid;
  gap: 14px;
}

.past-schedule-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.period-select {
  display: grid;
  gap: 4px;
  max-width: 420px;
  color: #374151;
  font-size: 14px;
}

.empty-hint {
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.assignment-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.assignment-table th,
.assignment-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.assignment-table th {
  color: #374151;
  background: #f8fafc;
  font-weight: 600;
}

.edit-dialog {
  display: grid;
  gap: 12px;
}

.edit-dialog label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.edit-summary {
  margin: 0;
  padding: 10px 12px;
  color: #1f2937;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
}
</style>
