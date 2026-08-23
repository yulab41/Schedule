<script setup lang="ts">
import type {
  CalendarPreferences,
  CalendarPreferenceView,
  DissolvedGroup,
  GroupCatalogEntry,
  GroupSummary,
} from '@schedule/contracts';
import { computed, onMounted, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import GroupMobilePhoneConsentCard from './GroupMobilePhoneConsentCard.vue';
import { getGroupRoleLabel, splitGroupCode } from './group-presentation.js';
import { hasDuplicateRosterName, parseRosterNames } from './roster-input.js';

const props = defineProps<{
  readonly group: GroupSummary | undefined;
}>();

const emit = defineEmits<{
  'groups-changed': [groupId?: string];
}>();

const api = createApiClient({ auth: localAuth });
const createdGroup = ref<GroupSummary>();
const createGroupName = ref('');
const customGroupCode = ref('');
const editedGroupCode = ref('');
const rosterNames = ref('');
const catalog = ref<GroupCatalogEntry[]>([]);
const joinGroupId = ref('');
const claimCode = ref('');
const groupName = ref('');
const dissolvedGroups = ref<DissolvedGroup[]>([]);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isCreating = ref(false);
const isSavingRoster = ref(false);
const isJoining = ref(false);
const isLeaving = ref(false);
const isSavingName = ref(false);
const isRegeneratingCode = ref(false);
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
const catalogOptions = computed(() =>
  catalog.value.map((entry) => ({ label: catalogLabel(entry), value: entry.id })),
);
const selectedCatalogEntry = computed(() =>
  catalog.value.find((entry) => entry.id === joinGroupId.value),
);
const currentGroupCodeDigits = computed(() => splitGroupCode(props.group?.groupCode));
const createdGroupCodeDigits = computed(() => splitGroupCode(createdGroup.value?.groupCode));

watch(
  () => props.group?.id,
  () => {
    groupName.value = props.group?.name ?? '';
    editedGroupCode.value = props.group?.groupCode ?? '';
    void loadDissolved();
    void loadCalendarPreferences();
  },
  { immediate: true },
);

onMounted(() => {
  void loadCatalog();
});

async function loadCatalog(): Promise<void> {
  try {
    catalog.value = await api.listGroupCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '群组列表暂时无法加载，请稍后重试。');
  }
}

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

function catalogLabel(entry: GroupCatalogEntry): string {
  if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
    return `${entry.name}（已加入）`;
  }
  if (entry.relation === 'left-member') {
    return `${entry.name}（可重新加入）`;
  }
  return entry.name;
}

async function createGroup(): Promise<void> {
  resetMessages();
  isCreating.value = true;

  try {
    createdGroup.value = await api.createGroup({
      groupCode: customGroupCode.value.trim(),
      name: createGroupName.value,
    });
    createGroupName.value = '';
    customGroupCode.value = '';
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
  try {
    const result = await api.addRosterEntries(createdGroup.value.id, {
      realNames: parsedRosterNames.value,
    });
    rosterNames.value = '';
    infoMessage.value = `已添加 ${result.added} 位预设成员（可转为正式排班成员；成员使用已保存姓名和群组码加入后会自动关联账号）。`;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingRoster.value = false;
  }
}

async function joinSelectedGroup(): Promise<void> {
  resetMessages();
  const entry = selectedCatalogEntry.value;
  if (entry === undefined) {
    errorMessage.value = '请先选择要加入的群组。';
    return;
  }
  if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
    errorMessage.value = '您已经加入该群组。';
    return;
  }
  if (claimCode.value.trim() === '') {
    errorMessage.value = '请输入四位群组码。';
    return;
  }

  isJoining.value = true;
  try {
    const result = await api.claimGroup({ groupCode: claimCode.value.trim() });
    if (result.status === 'claimed') {
      resetJoinForm();
      infoMessage.value = `已加入“${result.group.name}”。`;
      emit('groups-changed', result.group.id);
    } else {
      infoMessage.value = '已向管理员提交添加人员请求，群组排班暂不会开放。';
    }
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isJoining.value = false;
  }
}

async function leaveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  leaveConfirmVisible.value = false;
  isLeaving.value = true;
  try {
    await api.leaveGroup(props.group.id);
    infoMessage.value = '已退出该群组。';
    emit('groups-changed');
    await loadCatalog();
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
  try {
    await api.updateGroupName(props.group.id, { name: groupName.value });
    infoMessage.value = '群组名称已更新。';
    emit('groups-changed', props.group.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingName.value = false;
  }
}

async function saveGroupCode(): Promise<void> {
  resetMessages();
  if (
    props.group === undefined ||
    (props.group.role !== 'owner' && !props.group.isDeveloperAdmin)
  ) {
    return;
  }
  isRegeneratingCode.value = true;
  try {
    const result = await api.updateGroupCode(props.group.id, {
      groupCode: editedGroupCode.value.trim(),
    });
    infoMessage.value =
      result.groupCode === undefined
        ? '群组码已更新，旧码立即失效。'
        : `群组码已更新：${result.groupCode}，旧码立即失效。`;
    emit('groups-changed', props.group.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRegeneratingCode.value = false;
  }
}

async function dissolveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  dissolveConfirmVisible.value = false;
  isDissolving.value = true;
  try {
    await api.deleteGroup(props.group.id);
    infoMessage.value = '群组已解散，30 天内可在下方恢复。';
    emit('groups-changed');
    await loadDissolved();
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isDissolving.value = false;
  }
}

async function restoreGroup(groupId: string): Promise<void> {
  resetMessages();
  isRestoring.value = true;
  try {
    await api.restoreGroup(groupId);
    infoMessage.value = '群组已恢复。';
    emit('groups-changed', groupId);
    await loadDissolved();
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRestoring.value = false;
  }
}

function resetJoinForm(): void {
  joinGroupId.value = '';
  claimCode.value = '';
}

function resetMessages(): void {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
}
</script>

<template>
  <section class="group-setup-panel">
    <header class="group-panel-heading">
      <div>
        <p>协作身份</p>
        <h2>群组管理</h2>
      </div>
      <span>创建或加入工作群组，并管理当前群组的共享身份。</span>
    </header>

    <section v-if="props.group !== undefined" class="group-identity-band">
      <div class="group-identity-copy">
        <span>当前工作群组</span>
        <strong>{{ props.group.name }}</strong>
        <small>{{
          props.group.isDeveloperAdmin ? '后台管理员' : getGroupRoleLabel(props.group.role)
        }}</small>
      </div>
      <div v-if="currentGroupCodeDigits.length > 0" class="group-code-block">
        <span>共享群组码</span>
        <div class="group-code-digits" :aria-label="`群组码 ${currentGroupCodeDigits.join(' ')}`">
          <strong v-for="(digit, index) in currentGroupCodeDigits" :key="`${digit}-${index}`">
            {{ digit }}
          </strong>
        </div>
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
            <div class="calendar-view-segment" role="radiogroup" aria-label="群组默认视图">
              <button
                v-for="option in calendarViewOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="groupCalendarView === option.value"
                :class="{ 'is-active': groupCalendarView === option.value }"
                @click="groupCalendarView = option.value"
              >
                {{ option.label }}
              </button>
            </div>
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
            <div
              class="calendar-view-segment is-personal"
              role="radiogroup"
              aria-label="我的默认视图"
            >
              <button
                type="button"
                role="radio"
                :aria-checked="memberCalendarView === 'follow'"
                :class="{ 'is-active': memberCalendarView === 'follow' }"
                @click="memberCalendarView = 'follow'"
              >
                跟随群组
              </button>
              <button
                v-for="option in calendarViewOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="memberCalendarView === option.value"
                :class="{ 'is-active': memberCalendarView === option.value }"
                @click="memberCalendarView = option.value"
              >
                {{ option.label }}
              </button>
            </div>
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
        v-if="props.group !== undefined"
        title="当前群组操作"
        class="group-card current-group-card"
      >
        <template v-if="props.group.role === 'owner' || props.group.isDeveloperAdmin">
          <t-form-item label="群组名称" name="groupName">
            <t-input v-model="groupName" maxlength="100" />
          </t-form-item>
          <t-form-item label="四位群组码" name="editedGroupCode">
            <t-input
              v-model="editedGroupCode"
              class="group-code-input"
              inputmode="numeric"
              maxlength="4"
              pattern="\d{4}"
            />
          </t-form-item>
          <div class="group-management-actions">
            <t-button variant="outline" :loading="isSavingName" @click="saveGroupName">
              保存名称
            </t-button>
            <t-button variant="outline" :loading="isRegeneratingCode" @click="saveGroupCode">
              保存群组码
            </t-button>
            <t-button theme="danger" variant="outline" @click="dissolveConfirmVisible = true">
              解散群组
            </t-button>
          </div>
        </template>
        <t-button
          v-else-if="!props.group.isDeveloperAdmin"
          variant="outline"
          @click="leaveConfirmVisible = true"
          >退出群组</t-button
        >
      </t-card>

      <t-card title="创建群组" class="group-card">
        <p class="group-card-intro">建立新的独立排班空间，并生成可分享的四位群组码。</p>
        <form @submit.prevent="createGroup">
          <t-form-item label="群组名称" name="name">
            <t-input v-model="createGroupName" maxlength="100" required />
          </t-form-item>
          <t-form-item label="四位群组码" name="groupCode">
            <t-input
              v-model="customGroupCode"
              inputmode="numeric"
              maxlength="4"
              pattern="\d{4}"
              required
            />
          </t-form-item>
          <t-button theme="primary" type="submit" :loading="isCreating">创建群组</t-button>
        </form>
      </t-card>

      <t-card title="加入其他群组" class="group-card">
        <p class="group-card-intro">使用管理员提供的群组码加入现有排班空间。</p>
        <t-form-item label="选择群组" name="joinGroup">
          <t-select v-model="joinGroupId" :options="catalogOptions" placeholder="请选择群组" />
        </t-form-item>
        <p v-if="selectedCatalogEntry?.relation === 'left-member'" class="join-hint">
          该群有与您同名的预设成员，请输入群组码重新加入。
        </p>
        <t-form-item label="四位群组码" name="joinCode">
          <t-input v-model="claimCode" inputmode="numeric" maxlength="4" pattern="\d{4}" />
        </t-form-item>
        <t-button theme="primary" :loading="isJoining" @click="joinSelectedGroup"
          >加入群组</t-button
        >
      </t-card>

      <t-card
        v-if="createdGroup !== undefined"
        title="预设成员"
        class="group-card created-roster-card"
      >
        <div v-if="createdGroupCodeDigits.length > 0" class="created-group-code">
          <span>新群组码</span>
          <div
            class="group-code-digits is-compact"
            :aria-label="`新群组码 ${createdGroupCodeDigits.join(' ')}`"
          >
            <strong v-for="(digit, index) in createdGroupCodeDigits" :key="`${digit}-${index}`">
              {{ digit }}
            </strong>
          </div>
        </div>
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
          退出后：历史排班和联系方式仍保留，您不再收到该群通知；重新加入时输入群组码可恢复群组身份。
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

.group-panel-heading {
  display: flex;
  align-items: end;
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
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.group-panel-heading > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: right;
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

.group-identity-copy span,
.group-code-block > span,
.created-group-code > span {
  color: var(--ui-color-text-muted);
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

.group-code-block,
.created-group-code {
  display: grid;
  justify-items: end;
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
  font-weight: var(--ui-font-weight-semibold);
}

.group-code-digits.is-compact strong {
  width: 36px;
  height: 44px;
  font-size: var(--ui-font-size-xl);
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
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.calendar-view-segment {
  display: grid;
  padding: 3px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  background: var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.calendar-view-segment.is-personal {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.calendar-view-segment button {
  min-height: var(--ui-touch-target-minimum);
  padding: 6px;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.calendar-view-segment button.is-active {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-card);
}

.calendar-view-segment button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
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

.created-group-code {
  justify-items: start;
  margin-bottom: var(--ui-spacing-md);
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
  .group-panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .group-panel-heading > span {
    text-align: left;
  }

  .group-identity-band {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--ui-spacing-md);
  }

  .group-code-block {
    justify-items: start;
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
  .group-code-digits {
    justify-content: flex-start;
    gap: var(--ui-spacing-xxs);
  }

  .group-code-digits strong {
    width: 40px;
  }
}
</style>
