<script setup lang="ts">
import type {
  CalendarPreferences,
  CalendarPreferenceView,
  DissolvedGroup,
  GroupSummary,
} from '@schedule/contracts';
import {
  resolveWorkflowOperationAttempt,
  type WorkflowOperationAttempt,
} from '@schedule/presentation-core';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import GroupMobilePhoneConsentCard from './GroupMobilePhoneConsentCard.vue';
import { getGroupRoleLabel } from './group-presentation.js';
import { hasDuplicateRosterName, parseRosterNames } from './roster-input.js';

const props = defineProps<{
  readonly group: GroupSummary | undefined;
}>();

const emit = defineEmits<{
  'groups-changed': [groupId?: string];
}>();

const api = createApiClient({ auth: localAuth });
const operationAttempts = new Map<
  string,
  WorkflowOperationAttempt<Readonly<Record<string, unknown>>>
>();
const createdGroup = ref<GroupSummary>();
const createGroupName = ref('');
const rosterNames = ref('');
const groupName = ref('');
const dissolvedGroups = ref<DissolvedGroup[]>([]);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isCreating = ref(false);
const isSavingRoster = ref(false);
const isLeaving = ref(false);
const isSavingName = ref(false);
const isDissolving = ref(false);
const isRestoring = ref(false);
const leaveConfirmVisible = ref(false);
const dissolveConfirmVisible = ref(false);
const calendarPreferences = ref<CalendarPreferences>();
const calendarShiftOptions = ref<readonly { label: string; value: string }[]>([]);
const groupCalendarView = ref<CalendarPreferenceView>('month');
const groupMonthShiftTypeId = ref('');
const memberCalendarView = ref<CalendarPreferenceView | 'follow'>('follow');
const memberMonthShiftTypeId = ref('');
const isSavingGroupCalendarDefaults = ref(false);
const isSavingMemberCalendarPreferences = ref(false);

const calendarViewOptions: readonly {
  readonly label: string;
  readonly value: CalendarPreferenceView;
}[] = [
  { label: '月视图', value: 'month' },
  { label: '周视图', value: 'week' },
  { label: '列表视图', value: 'list' },
];

const parsedRosterNames = computed(() => parseRosterNames(rosterNames.value));
function resolveOrganizationAttempt<Payload extends Readonly<Record<string, unknown>>>(
  key: string,
  payload: Payload,
): Readonly<Payload & { readonly operationId: string }> {
  const resolved = resolveWorkflowOperationAttempt(
    operationAttempts.get(key) as WorkflowOperationAttempt<Payload> | undefined,
    payload,
    () => crypto.randomUUID(),
  );
  operationAttempts.set(
    key,
    resolved.attempt as WorkflowOperationAttempt<Readonly<Record<string, unknown>>>,
  );
  return resolved.snapshot;
}

function completeOrganizationAttempt(key: string): void {
  operationAttempts.delete(key);
}

watch(
  () => props.group?.id,
  () => {
    groupName.value = props.group?.name ?? '';
    void loadDissolved();
    void loadCalendarPreferences();
  },
  { immediate: true },
);

async function loadDissolved(): Promise<void> {
  if (props.group?.role !== 'owner' && !props.group?.isDeveloperAdmin) {
    dissolvedGroups.value = [];
    return;
  }
  try {
    dissolvedGroups.value = await api.listDissolvedGroups();
  } catch {
    dissolvedGroups.value = [];
  }
}

async function loadCalendarPreferences(): Promise<void> {
  const groupId = props.group?.id;
  calendarPreferences.value = undefined;
  calendarShiftOptions.value = [];
  if (groupId === undefined || props.group?.role === 'guest') return;

  try {
    const [preferences, config] = await Promise.all([
      api.getCalendarPreferences(groupId),
      api.getSchedulingConfig(groupId),
    ]);
    if (props.group?.id !== groupId) return;
    calendarShiftOptions.value = config.shiftTypes
      .filter((shiftType) => shiftType.isEnabled)
      .map((shiftType) => ({
        label: `${shiftType.name}（${shiftType.abbreviation}）`,
        value: shiftType.id,
      }));
    applyCalendarPreferences(preferences);
  } catch (error) {
    if (props.group?.id === groupId) {
      errorMessage.value = toUserMessage(error, '日历偏好暂时无法加载，请稍后重试。');
    }
  }
}

function applyCalendarPreferences(preferences: CalendarPreferences): void {
  calendarPreferences.value = preferences;
  groupCalendarView.value = preferences.groupDefaultView;
  groupMonthShiftTypeId.value = preferences.groupDefaultMonthShiftTypeId ?? '';
  memberCalendarView.value = preferences.memberDefaultView ?? 'follow';
  memberMonthShiftTypeId.value = preferences.memberDefaultMonthShiftTypeId ?? '';
}

async function saveGroupCalendarDefaults(): Promise<void> {
  if (props.group === undefined || calendarPreferences.value?.canManageGroupDefaults !== true) {
    return;
  }
  resetMessages();
  isSavingGroupCalendarDefaults.value = true;
  try {
    applyCalendarPreferences(
      await api.updateGroupCalendarDefaults(props.group.id, {
        defaultMonthShiftTypeId: groupMonthShiftTypeId.value || null,
        defaultView: groupCalendarView.value,
      }),
    );
    infoMessage.value = '群组日历默认设置已保存。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '群组日历默认设置未保存，请稍后重试。');
  } finally {
    isSavingGroupCalendarDefaults.value = false;
  }
}

async function saveMyCalendarPreferences(): Promise<void> {
  if (props.group === undefined || calendarPreferences.value === undefined) return;
  resetMessages();
  isSavingMemberCalendarPreferences.value = true;
  try {
    applyCalendarPreferences(
      await api.updateMyCalendarPreferences(props.group.id, {
        defaultMonthShiftTypeId: memberMonthShiftTypeId.value || null,
        defaultView: memberCalendarView.value === 'follow' ? null : memberCalendarView.value,
      }),
    );
    infoMessage.value = '我的日历偏好已保存。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '我的日历偏好未保存，请稍后重试。');
  } finally {
    isSavingMemberCalendarPreferences.value = false;
  }
}

async function createGroup(): Promise<void> {
  resetMessages();
  isCreating.value = true;

  const attemptKey = 'group-create';
  try {
    createdGroup.value = await api.createGroup(
      resolveOrganizationAttempt(attemptKey, {
        name: createGroupName.value,
      }),
    );
    completeOrganizationAttempt(attemptKey);
    createGroupName.value = '';
    emit('groups-changed', createdGroup.value.id);
    infoMessage.value = '群组已创建。请将预设成员逐行粘贴到下方名单中。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isCreating.value = false;
  }
}

async function saveRoster(): Promise<void> {
  resetMessages();

  if (createdGroup.value === undefined) {
    return;
  }

  if (parsedRosterNames.value.length === 0) {
    errorMessage.value = '请至少输入一位预设成员。';
    return;
  }

  if (hasDuplicateRosterName(parsedRosterNames.value)) {
    errorMessage.value = '预设成员名单中不能有重复姓名。';
    return;
  }

  isSavingRoster.value = true;
  const attemptKey = `roster-add:${createdGroup.value.id}`;
  try {
    const result = await api.addRosterEntries(
      createdGroup.value.id,
      resolveOrganizationAttempt(attemptKey, {
        realNames: parsedRosterNames.value,
      }),
    );
    completeOrganizationAttempt(attemptKey);
    rosterNames.value = '';
    infoMessage.value = `已添加 ${result.added} 位预设成员（可转为正式排班成员；请使用管理员提供的邀请关联成员账号）。`;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingRoster.value = false;
  }
}

async function leaveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  leaveConfirmVisible.value = false;
  isLeaving.value = true;
  const attemptKey = `group-leave:${props.group.id}`;
  try {
    await api.leaveGroup(props.group.id, resolveOrganizationAttempt(attemptKey, {}));
    completeOrganizationAttempt(attemptKey);
    infoMessage.value = '已退出该群组。';
    emit('groups-changed');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isLeaving.value = false;
  }
}

async function saveGroupName(): Promise<void> {
  resetMessages();
  if (
    props.group === undefined ||
    (props.group.role !== 'owner' && !props.group.isDeveloperAdmin)
  ) {
    return;
  }
  isSavingName.value = true;
  const attemptKey = `group-name:${props.group.id}`;
  try {
    await api.updateGroupName(
      props.group.id,
      resolveOrganizationAttempt(attemptKey, {
        expectedVersion: props.group.version,
        name: groupName.value,
      }),
    );
    completeOrganizationAttempt(attemptKey);
    infoMessage.value = '群组名称已更新。';
    emit('groups-changed', props.group.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingName.value = false;
  }
}

async function dissolveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  dissolveConfirmVisible.value = false;
  isDissolving.value = true;
  const attemptKey = `group-delete:${props.group.id}`;
  try {
    await api.deleteGroup(
      props.group.id,
      resolveOrganizationAttempt(attemptKey, {
        expectedVersion: props.group.version,
      }),
    );
    completeOrganizationAttempt(attemptKey);
    infoMessage.value = '群组已解散，30 天内可在下方恢复。';
    emit('groups-changed');
    await loadDissolved();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isDissolving.value = false;
  }
}

async function restoreGroup(groupId: string): Promise<void> {
  resetMessages();
  const dissolved = dissolvedGroups.value.find((group) => group.id === groupId);
  if (dissolved === undefined) return;
  isRestoring.value = true;
  const attemptKey = `group-restore:${groupId}`;
  try {
    await api.restoreGroup(
      groupId,
      resolveOrganizationAttempt(attemptKey, {
        expectedVersion: dissolved.version,
      }),
    );
    completeOrganizationAttempt(attemptKey);
    infoMessage.value = '群组已恢复。';
    emit('groups-changed', groupId);
    await loadDissolved();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRestoring.value = false;
  }
}

function resetMessages(): void {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
}
</script>

<template>
  <section class="group-setup-panel">
    <section v-if="props.group !== undefined" class="group-identity-band">
      <div class="group-identity-copy">
        <span>当前工作群组</span>
        <strong>{{ props.group.name }}</strong>
        <small>{{
          props.group.isDeveloperAdmin ? '后台管理员' : getGroupRoleLabel(props.group.role)
        }}</small>
      </div>
    </section>

    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />

    <div class="group-card-grid">
      <GroupMobilePhoneConsentCard
        v-if="props.group !== undefined && props.group.role !== 'guest'"
        :group-id="props.group.id"
      />
      <t-card
        v-if="calendarPreferences !== undefined"
        title="日历偏好"
        class="group-card calendar-preferences-card"
      >
        <div class="calendar-preference-sections">
          <section
            v-if="calendarPreferences.canManageGroupDefaults"
            class="calendar-preference-section"
          >
            <header>
              <div>
                <strong>群组日历默认设置</strong>
                <span>决定成员首次打开排班日历时看到的视图。</span>
              </div>
              <span class="preference-scope">群组默认</span>
            </header>
            <t-select
              v-model="groupCalendarView"
              :options="[...calendarViewOptions]"
              aria-label="群组默认视图"
            />
            <label class="calendar-shift-setting">
              <span>月视图默认班种</span>
              <t-select
                v-model="groupMonthShiftTypeId"
                :options="[{ label: '自动选择首个启用班种', value: '' }, ...calendarShiftOptions]"
              />
            </label>
            <t-button
              theme="primary"
              :loading="isSavingGroupCalendarDefaults"
              @click="saveGroupCalendarDefaults"
            >
              保存群组默认
            </t-button>
          </section>

          <section class="calendar-preference-section">
            <header>
              <div>
                <strong>我的日历偏好</strong>
                <span>个人设置优先；选择跟随群组可自动接收管理员调整。</span>
              </div>
              <span class="preference-scope is-personal">仅自己</span>
            </header>
            <t-select
              v-model="memberCalendarView"
              :options="[{ label: '跟随群组', value: 'follow' }, ...calendarViewOptions]"
              aria-label="我的默认视图"
            />
            <label class="calendar-shift-setting">
              <span>月视图默认班种</span>
              <t-select
                v-model="memberMonthShiftTypeId"
                :options="[{ label: '跟随群组', value: '' }, ...calendarShiftOptions]"
              />
            </label>
            <t-button
              theme="primary"
              :loading="isSavingMemberCalendarPreferences"
              @click="saveMyCalendarPreferences"
            >
              保存我的偏好
            </t-button>
          </section>
        </div>
      </t-card>

      <t-card
        v-if="
          props.group !== undefined &&
          (props.group.role === 'owner' || props.group.isDeveloperAdmin)
        "
        title="当前群组操作"
        class="group-card current-group-card"
      >
        <template v-if="props.group.role === 'owner' || props.group.isDeveloperAdmin">
          <t-form-item label="群组名称" name="groupName">
            <t-input v-model="groupName" maxlength="100" />
          </t-form-item>
          <div class="group-management-actions">
            <t-button variant="outline" :loading="isSavingName" @click="saveGroupName">
              保存名称
            </t-button>
            <t-button theme="danger" variant="outline" @click="dissolveConfirmVisible = true">
              解散群组
            </t-button>
          </div>
        </template>
      </t-card>

      <button
        v-if="
          props.group !== undefined && props.group.role !== 'owner' && !props.group.isDeveloperAdmin
        "
        class="group-leave-button"
        type="button"
        :disabled="isLeaving"
        @click="leaveConfirmVisible = true"
      >
        退出群组
      </button>

      <t-card title="创建群组" class="group-card">
        <p class="group-card-intro">建立新的独立排班空间。</p>
        <form @submit.prevent="createGroup">
          <t-form-item label="群组名称" name="name">
            <t-input v-model="createGroupName" maxlength="100" required />
          </t-form-item>
          <t-button theme="primary" type="submit" :loading="isCreating">创建群组</t-button>
        </form>
      </t-card>

      <t-card
        v-if="createdGroup !== undefined"
        title="预设成员"
        class="group-card created-roster-card"
      >
        <form @submit.prevent="saveRoster">
          <t-form-item label="每行一个真实姓名" name="rosterNames">
            <t-textarea v-model="rosterNames" :autosize="{ minRows: 4, maxRows: 12 }" />
          </t-form-item>
          <t-button theme="primary" type="submit" :loading="isSavingRoster">添加名单</t-button>
        </form>
      </t-card>

      <t-card
        v-if="
          (props.group?.role === 'owner' || props.group?.isDeveloperAdmin) &&
          dissolvedGroups.length > 0
        "
        title="已解散群组（30 天内可恢复）"
        class="group-card dissolved-groups-card"
      >
        <div
          v-for="dissolvedGroup in dissolvedGroups"
          :key="dissolvedGroup.id"
          class="dissolved-row"
        >
          <span>{{ dissolvedGroup.name }}</span>
          <t-button
            variant="outline"
            :loading="isRestoring"
            @click="restoreGroup(dissolvedGroup.id)"
          >
            恢复
          </t-button>
        </div>
      </t-card>
    </div>

    <ResponsiveSheet v-model:visible="leaveConfirmVisible" title="退出群组">
      <div class="group-confirmation">
        <p>
          退出后：历史排班和联系方式仍保留，您不再收到该群通知；重新加入请使用管理员提供的邀请。
        </p>
        <div class="group-confirmation-actions">
          <t-button variant="outline" @click="leaveConfirmVisible = false">取消</t-button>
          <t-button theme="primary" :loading="isLeaving" @click="leaveCurrentGroup">
            确认退出
          </t-button>
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet v-model:visible="dissolveConfirmVisible" title="解散群组">
      <div class="group-confirmation">
        <p>解散后群组立即从所有列表消失，数据保留 30 天；您可在“已解散群组”中恢复。</p>
        <div class="group-confirmation-actions">
          <t-button variant="outline" @click="dissolveConfirmVisible = false">取消</t-button>
          <t-button theme="danger" :loading="isDissolving" @click="dissolveCurrentGroup">
            确认解散
          </t-button>
        </div>
      </div>
    </ResponsiveSheet>
  </section>
</template>

<style scoped>
.group-setup-panel {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-md);
}
.group-identity-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ui-spacing-lg);
  padding: var(--ui-spacing-md) var(--ui-spacing-lg);
  align-items: center;
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
.group-identity-copy span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}
.group-identity-copy strong {
  overflow: hidden;
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
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
.group-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}
.group-card {
  min-width: 0;
  border-color: var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}
.current-group-card,
.calendar-preferences-card,
.created-roster-card,
.dissolved-groups-card {
  grid-column: 1 / -1;
}
.calendar-preference-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}
.calendar-preference-section {
  display: grid;
  min-width: 0;
  padding: var(--ui-spacing-md);
  align-content: start;
  gap: var(--ui-spacing-sm);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}
.calendar-preference-section > header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}
.calendar-preference-section > header > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.calendar-preference-section > header strong {
  font-size: var(--ui-font-size-md);
}
.calendar-preference-section > header div > span,
.calendar-shift-setting > span {
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
  color: var(--ui-color-text-primary);
  background: var(--ui-color-success-light);
}
.current-group-card :deep(.t-button--theme-danger.t-button--variant-outline) {
  color: var(--ui-color-danger);
  border-color: var(--ui-color-danger);
}
.calendar-shift-setting {
  display: grid;
  gap: var(--ui-spacing-xxs);
}
.calendar-preference-section > :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}
.group-card :deep(.t-card__header) {
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  border-bottom: 1px solid var(--ui-color-border);
}
.group-card :deep(.t-card__body) {
  padding: var(--ui-spacing-md);
}
.group-card form {
  min-width: 0;
}
.group-card-intro {
  margin: 0 0 var(--ui-spacing-sm);
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}
.group-card :deep(.t-input),
.group-card :deep(.t-input__wrap),
.group-card :deep(.t-select),
.group-card :deep(.t-button),
.group-confirmation :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}
.group-card :deep(.t-form__item) {
  margin-bottom: var(--ui-spacing-sm);
}
.group-card :deep(.t-textarea__inner) {
  min-height: 120px;
}
.group-management-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}
.join-hint {
  margin: 0 0 var(--ui-spacing-sm);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}
.dissolved-row {
  display: flex;
  min-height: var(--ui-touch-target-comfortable);
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-xs) 0;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--ui-color-border);
}
.dissolved-row:last-child {
  border-bottom: 0;
}
.group-confirmation {
  display: grid;
  gap: var(--ui-spacing-md);
}
.group-confirmation p {
  margin: 0;
  color: var(--ui-color-text-secondary);
  line-height: var(--ui-line-height-body);
}
.group-confirmation-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-xs);
}
.group-confirmation-actions :deep(.t-button) {
  width: 100%;
}

@media (max-width: 760px) {
  .group-identity-band {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--ui-spacing-md);
  }
  .group-card-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-spacing-sm);
  }
  .current-group-card,
  .calendar-preferences-card,
  .created-roster-card,
  .dissolved-groups-card {
    grid-column: auto;
  }
  .calendar-preference-sections {
    grid-template-columns: minmax(0, 1fr);
  }
  .group-card :deep(.t-card__body) {
    padding: var(--ui-spacing-sm);
  }
  .group-management-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .group-management-actions :deep(.t-button),
  .group-card form > :deep(.t-button),
  .group-card > :deep(.t-button) {
    width: 100%;
  }
}

@media (max-width: 360px) {
}
.group-leave-button {
  justify-self: center;
  width: 184px;
  max-width: 100%;
  min-height: 44px;
  padding: 8px 18px;
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font: inherit;
  font-weight: var(--ui-font-weight-semibold);
}
</style>
