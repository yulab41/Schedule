import {
  ClientCoreError,
  type CalendarPreferencesClient,
  type GroupMobilePhoneConsentSubmission,
  type OrganizationReadClient,
  type OrganizationWriteClient,
} from '@schedule/client-core';
import {
  ClientCapabilityDisabledError,
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type {
  CalendarPreferenceView,
  CalendarPreferences,
  DissolvedGroup,
  GroupMember,
  GroupMemberContact,
  GroupMobilePhoneConsent,
  GroupSummary,
  SchedulingConfig,
} from '@schedule/contracts';
import {
  canDialDirectoryNumber,
  normalizeDirectoryDialNumber,
  createGroupMobilePhoneConsentDraft,
  createGroupMobilePhoneConsentViewModel,
  resolveGroupMobilePhoneConsentSubmission,
  setGroupMobilePhoneConsentDesired,
  type GroupMobilePhoneConsentDraft,
} from '@schedule/presentation-core';

import {
  createRuntimeCalendarPreferencesClient,
  createRuntimeGroupMobilePhoneConsentClient,
  createRuntimeOrganizationReadClient,
  createRuntimeOrganizationWriteClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import {
  createWorkbenchReadClient,
  readStoredWorkbenchGroupId,
} from '../../../../platform/workbench-read.js';

interface MemberCardView {
  readonly entry: ReturnType<typeof createMemberDirectoryEntry>;
  readonly canEdit: boolean;
  readonly canManage: boolean;
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly isPendingRoster: boolean;
  readonly name: string;
  readonly roleLabel: string;
  readonly version: number;
}

interface DissolvedCardView {
  readonly deletedAt: string;
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

interface CalendarShiftOption {
  readonly label: string;
  readonly value: string;
}

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
}

interface TapEvent {
  readonly detail?: {
    readonly option?: { readonly value?: string };
    readonly groupId?: string;
    readonly number?: string;
  };
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface GroupSettingsPageData {
  readonly calendarPreferencesError: string;
  readonly calendarPreferencesInfo: string;
  readonly calendarPreferencesState: 'error' | 'loading' | 'ready';
  readonly canSave: boolean;
  readonly canManageGroupCalendarDefaults: boolean;
  readonly canManageGroupLifecycle: boolean;
  readonly consentState: GroupMobilePhoneConsent['state'];
  readonly contactVersion: number;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly groupCalendarShiftIndex: number;
  readonly groupCalendarShiftOptions: readonly CalendarShiftOption[];
  readonly groupCalendarViewOptions: readonly CalendarShiftOption[];
  readonly memberCalendarViewOptions: readonly CalendarShiftOption[];
  readonly groupCalendarView: CalendarPreferenceView;
  readonly groupNameDraft: string;
  readonly largeText: boolean;
  readonly organizationEnabled: boolean;
  readonly canManageGroup: boolean;
  readonly canManageMembers: boolean;
  readonly canLeaveGroup: boolean;
  readonly canDissolveGroup: boolean;
  readonly memberCards: readonly MemberCardView[];
  readonly dissolvedCards: readonly DissolvedCardView[];
  readonly createGroupName: string;
  readonly managementError: string;
  readonly managementInfo: string;
  readonly managementState: 'error' | 'loading' | 'ready';
  readonly rosterEditorOpen: boolean;
  readonly rosterNames: string;
  readonly contactEditorOpen: boolean;
  readonly editingMemberId: string;
  readonly editingMemberName: string;
  readonly editingMobilePhone: string;
  readonly editingShortPhone: string;
  readonly editingIsConfirmed: boolean;
  readonly desiredConsent: boolean;
  readonly embedded: boolean;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly isSavingGroupCalendarDefaults: boolean;
  readonly isSavingMemberCalendarPreferences: boolean;
  readonly isSaving: boolean;
  readonly memberCalendarShiftIndex: number;
  readonly memberCalendarShiftOptions: readonly CalendarShiftOption[];
  readonly memberCalendarView: CalendarPreferenceView | 'follow';
  readonly noticeVersion: string;
  readonly pageScrollStyle: string;
  readonly saveDisabled: boolean;
  readonly shellHeaderStyle: string;
  readonly state: 'error' | 'loading' | 'ready';
  readonly switchDisabled: boolean;
  readonly viewportClass: string;
}

interface GroupSettingsPageInstance {
  _calendarPreferencesClient: CalendarPreferencesClient;
  _calendarPreferencesSerial: number;
  _consentDraft: GroupMobilePhoneConsentDraft | undefined;
  _consentStatus: GroupMobilePhoneConsent | undefined;
  _consentNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  _currentGroupId: string;
  _loadSerial: number;
  _requestedGroupId: string;
  _group: GroupSummary | undefined;
  _members: readonly GroupMember[];
  _contacts: readonly GroupMemberContact[];
  _dissolvedGroups: readonly DissolvedGroup[];
  _operationIds: Map<string, string>;
  _organizationReadClient: OrganizationReadClient;
  _organizationWriteClient: OrganizationWriteClient;
  readonly data: GroupSettingsPageData;
  setData(patch: Partial<GroupSettingsPageData>, callback?: () => void): void;
}

const consentClient = createRuntimeGroupMobilePhoneConsentClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const calendarPreferencesClient = createRuntimeCalendarPreferencesClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const workbenchClient = createWorkbenchReadClient();
const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const organizationWriteClient = createRuntimeOrganizationWriteClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createGroupSettingsPanelControllerDefinition(embedded = false) {
  return {
    data: {
      calendarPreferencesError: '',
      calendarPreferencesInfo: '',
      calendarPreferencesState: 'loading',
      canManageGroupCalendarDefaults: false,
      canManageGroupLifecycle: false,
      canSave: false,
      consentState: 'not-consented',
      contactVersion: 0,
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      groupCalendarShiftIndex: 0,
      groupCalendarShiftOptions: createCalendarShiftOptions('group', []),
      groupCalendarView: 'month',
      groupCalendarViewOptions: [
        { label: '月视图', value: 'month' },
        { label: '周视图', value: 'week' },
        { label: '列表视图', value: 'list' },
      ],
      memberCalendarViewOptions: [
        { label: '跟随群组', value: 'follow' },
        { label: '月视图', value: 'month' },
        { label: '周视图', value: 'week' },
        { label: '列表视图', value: 'list' },
      ],
      groupNameDraft: '',
      largeText: false,
      organizationEnabled: false,
      canManageGroup: false,
      canManageMembers: false,
      canLeaveGroup: false,
      canDissolveGroup: false,
      memberCards: [],
      dissolvedCards: [],
      createGroupName: '',
      managementError: '',
      managementInfo: '',
      managementState: 'loading',
      rosterEditorOpen: false,
      rosterNames: '',
      contactEditorOpen: false,
      editingMemberId: '',
      editingMemberName: '',
      editingMobilePhone: '',
      editingShortPhone: '',
      editingIsConfirmed: false,
      desiredConsent: false,
      embedded,
      errorMessage: '',
      infoMessage: '',
      isSavingGroupCalendarDefaults: false,
      isSavingMemberCalendarPreferences: false,
      isSaving: false,
      memberCalendarShiftIndex: 0,
      memberCalendarShiftOptions: createCalendarShiftOptions('member', []),
      memberCalendarView: 'follow',
      noticeVersion: '—',
      pageScrollStyle: 'height:calc(100% - 64px);',
      saveDisabled: true,
      shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
      state: 'loading',
      switchDisabled: true,
      viewportClass: '',
    } satisfies GroupSettingsPageData,

    _consentDraft: undefined,
    _consentStatus: undefined,
    _consentNoticeTimer: undefined,
    _calendarPreferencesClient: calendarPreferencesClient,
    _calendarPreferencesSerial: 0,
    _currentGroupId: '',
    _loadSerial: 0,
    _requestedGroupId: '',
    _group: undefined,
    _members: [],
    _contacts: [],
    _dissolvedGroups: [],
    _operationIds: new Map(),
    _organizationReadClient: organizationReadClient,
    _organizationWriteClient: organizationWriteClient,

    onLoad(
      this: GroupSettingsPageInstance,
      query: Readonly<Record<string, string | undefined>>,
    ): void {
      recordMiniTelemetryBoundary('group-settings:controller-onload');
      this._requestedGroupId = decodeQueryValue(query['groupId']);
      this.setData({ ...createShellLayoutPatch(this.data.embedded) });
      void loadGroupSettingsWithCapability(this);
    },

    onShow(this: GroupSettingsPageInstance): void {
      void requireClientCapability('core').catch((error: unknown) =>
        setGroupSettingsCapabilityError(this, error),
      );
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleRetry(this: GroupSettingsPageInstance): void {
      void loadGroupSettingsWithCapability(this);
    },

    handleConsentToggle(this: GroupSettingsPageInstance): void {
      if (
        this.data.isSaving ||
        this._consentDraft === undefined ||
        this._consentStatus === undefined ||
        this._consentStatus.state === 'missing-phone'
      ) {
        return;
      }
      this._consentDraft = setGroupMobilePhoneConsentDesired(
        this._consentDraft,
        !this.data.desiredConsent,
      );
      this.setData({ errorMessage: '', infoMessage: '' });
      clearConsentNoticeTimer(this);
      syncConsentView(this);
      void saveConsent(this);
    },

    handleSave(this: GroupSettingsPageInstance): void {
      void saveConsent(this);
    },

    handleCalendarPreferencesRetry(this: GroupSettingsPageInstance): void {
      void loadCalendarPreferences(this);
    },

    handleGroupCalendarViewSelect(this: GroupSettingsPageInstance, event: TapEvent): void {
      if (!this.data.canManageGroupCalendarDefaults) return;
      const view = readCalendarView(
        event.detail?.option?.value ?? event.currentTarget.dataset.view,
      );
      if (view === undefined) return;
      this.setData({
        calendarPreferencesError: '',
        calendarPreferencesInfo: '',
        groupCalendarView: view,
      });
    },

    handleGroupCalendarShiftChange(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManageGroupCalendarDefaults) return;
      const index = readPickerIndex(event, this.data.groupCalendarShiftOptions.length);
      if (index === undefined) return;
      this.setData({
        calendarPreferencesError: '',
        calendarPreferencesInfo: '',
        groupCalendarShiftIndex: index,
      });
    },

    handleSaveGroupCalendarDefaults(this: GroupSettingsPageInstance): void {
      void saveGroupCalendarDefaults(this);
    },

    handleMemberCalendarViewSelect(this: GroupSettingsPageInstance, event: TapEvent): void {
      const rawView = event.detail?.option?.value ?? event.currentTarget.dataset.view;
      const view = rawView === 'follow' ? 'follow' : readCalendarView(rawView);
      if (view === undefined) return;
      this.setData({
        calendarPreferencesError: '',
        calendarPreferencesInfo: '',
        memberCalendarView: view,
      });
    },

    handleMemberCalendarShiftChange(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      const index = readPickerIndex(event, this.data.memberCalendarShiftOptions.length);
      if (index === undefined) return;
      this.setData({
        calendarPreferencesError: '',
        calendarPreferencesInfo: '',
        memberCalendarShiftIndex: index,
      });
    },

    handleSaveMemberCalendarPreferences(this: GroupSettingsPageInstance): void {
      void saveMemberCalendarPreferences(this);
    },

    handleGroupNameInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ groupNameDraft: readInputValue(event) });
    },

    handleSaveGroupName(this: GroupSettingsPageInstance): void {
      void saveGroupName(this);
    },

    handleCreateGroupNameInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ createGroupName: readInputValue(event) });
    },

    handleCreateGroup(this: GroupSettingsPageInstance): void {
      void createGroup(this);
    },

    handleMemberCall(this: GroupSettingsPageInstance, event: TapEvent): void {
      const { groupId, number } = event.detail ?? {};
      const card = this.data.memberCards.find((member) => member.id === groupId);
      const allowed = card?.entry.contacts
        .flatMap((contact) => contact.numbers)
        .some((candidate) => candidate.dialable && candidate.dialNumber === number);
      if (allowed && number !== undefined) wx.makePhoneCall({ phoneNumber: number });
    },

    handleLeaveGroup(this: GroupSettingsPageInstance): void {
      void leaveGroup(this);
    },

    handleDissolveGroup(this: GroupSettingsPageInstance): void {
      void dissolveGroup(this);
    },

    handleRestoreGroup(this: GroupSettingsPageInstance, event: TapEvent): void {
      const groupId = event.currentTarget.dataset.groupId;
      if (groupId === undefined) return;
      void restoreGroup(this, groupId);
    },

    handleRosterInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ rosterNames: readInputValue(event), managementError: '' });
    },

    handleRosterToggle(this: GroupSettingsPageInstance): void {
      if (!this.data.canManageMembers || !this.data.organizationEnabled) return;
      this.setData({ rosterEditorOpen: !this.data.rosterEditorOpen, managementError: '' });
    },

    handleAddRoster(this: GroupSettingsPageInstance): void {
      void addRosterMembers(this);
    },

    handleConvertRoster(this: GroupSettingsPageInstance, event: TapEvent): void {
      const realName = event.currentTarget.dataset.realName;
      if (realName === undefined) return;
      void convertRosterMember(this, realName);
    },

    handleOpenContactEditor(this: GroupSettingsPageInstance, event: TapEvent): void {
      if (!this.data.canManageMembers) return;
      const memberId = event.currentTarget.dataset.memberId;
      if (memberId === undefined) return;
      const member = this._members.find((candidate) => candidate.id === memberId);
      const contact = this._contacts.find((candidate) => candidate.membershipId === memberId);
      if (member === undefined || contact === undefined) return;
      this.setData({
        contactEditorOpen: true,
        editingMemberId: memberId,
        editingMemberName: member.realName,
        editingMobilePhone: contact.mobilePhone ?? '',
        editingShortPhone: contact.shortPhone ?? '',
        editingIsConfirmed: contact.isConfirmed,
        managementError: '',
      });
    },

    handleCloseContactEditor(this: GroupSettingsPageInstance): void {
      if (this.data.managementState !== 'loading') {
        this.setData({ contactEditorOpen: false });
      }
    },

    handleContactNameInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ editingMemberName: readInputValue(event) });
    },

    handleContactMobileInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ editingMobilePhone: readInputValue(event) });
    },

    handleContactShortInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ editingShortPhone: readInputValue(event) });
    },

    handleContactConfirmToggle(this: GroupSettingsPageInstance): void {
      this.setData({ editingIsConfirmed: !this.data.editingIsConfirmed });
    },

    handleSaveContact(this: GroupSettingsPageInstance): void {
      void saveMemberContact(this);
    },

    handleMemberAction(this: GroupSettingsPageInstance, event: TapEvent): void {
      const memberId = event.currentTarget.dataset.memberId;
      const action = event.currentTarget.dataset.action;
      if (memberId === undefined || action === undefined) return;
      void runMemberAction(this, memberId, action);
    },
  };
}

async function loadGroupSettings(page: GroupSettingsPageInstance): Promise<void> {
  const serial = ++page._loadSerial;
  clearConsentNoticeTimer(page);
  page._calendarPreferencesSerial += 1;
  page._consentDraft = undefined;
  page._consentStatus = undefined;
  page._currentGroupId = '';
  page._group = undefined;
  page._members = [];
  page._contacts = [];
  page._dissolvedGroups = [];
  page.setData({
    calendarPreferencesError: '',
    calendarPreferencesInfo: '',
    calendarPreferencesState: 'loading',
    canManageGroupCalendarDefaults: false,
    canManageGroupLifecycle: false,
    canSave: false,
    errorMessage: '',
    infoMessage: '',
    isSavingGroupCalendarDefaults: false,
    isSavingMemberCalendarPreferences: false,
    isSaving: false,
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
    memberCards: [],
    memberCalendarShiftIndex: 0,
    memberCalendarShiftOptions: createCalendarShiftOptions('member', []),
    memberCalendarView: 'follow',
    dissolvedCards: [],
    rosterEditorOpen: false,
    rosterNames: '',
    contactEditorOpen: false,
    saveDisabled: true,
    groupCalendarShiftIndex: 0,
    groupCalendarShiftOptions: createCalendarShiftOptions('group', []),
    groupCalendarView: 'month',
    state: 'loading',
    switchDisabled: true,
  });
  try {
    const groups = await workbenchClient.listGroups();
    if (serial !== page._loadSerial) return;
    const group = resolveTargetGroup(groups, page._requestedGroupId);
    if (group === undefined) throw new Error('当前没有可设置联系方式公开的工作群组。');
    if (group.role === 'guest') throw new Error('访客不能修改群组联系方式公开设置。');

    page._currentGroupId = group.id;
    page._group = group;
    const capabilitySnapshot = getClientCapabilitySnapshot();
    const statusPromise = consentClient.getStatus(group.id);
    const membersPromise = page._organizationReadClient.listGroupMembers(group.id);
    const contactsPromise = page._organizationReadClient.listGroupContacts(group.id);
    const dissolvedPromise =
      capabilitySnapshot.organization && (group.role === 'owner' || group.isDeveloperAdmin === true)
        ? page._organizationReadClient.listDissolvedGroups()
        : Promise.resolve([] as DissolvedGroup[]);
    const [status, members, contacts, dissolved] = await Promise.all([
      statusPromise,
      membersPromise,
      contactsPromise,
      dissolvedPromise,
    ]);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    page._members = members;
    page._contacts = contacts;
    page._dissolvedGroups = dissolved;
    page.setData({
      ...createGroupPatch(group),
      ...createOrganizationPatch(group, members, contacts),
      ...createGroupDirectoryPatch(dissolved),
    });
    applyConsentStatus(page, status, { state: 'ready' });
    void loadCalendarPreferences(page);
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page.setData({
      errorMessage: toUserMessage(error, '群组设置暂时无法加载，请稍后重试。'),
      isSaving: false,
      managementError: toUserMessage(error, '成员与联系方式暂时无法加载，请稍后重试。'),
      managementState: 'error',
      state: 'error',
    });
  }
}

async function loadGroupSettingsWithCapability(page: GroupSettingsPageInstance): Promise<void> {
  try {
    await requireClientCapability('core');
    await loadGroupSettings(page);
  } catch (error) {
    setGroupSettingsCapabilityError(page, error);
  }
}

function setGroupSettingsCapabilityError(page: GroupSettingsPageInstance, error: unknown): void {
  if (!(error instanceof ClientCapabilityDisabledError)) return;
  page._calendarPreferencesSerial += 1;
  page._loadSerial += 1;
  page.setData({
    errorMessage: error.message,
    isSaving: false,
    saveDisabled: true,
    state: 'error',
    switchDisabled: true,
  });
}

async function loadCalendarPreferences(page: GroupSettingsPageInstance): Promise<void> {
  const groupId = page._currentGroupId;
  const serial = page._calendarPreferencesSerial + 1;
  page._calendarPreferencesSerial = serial;
  if (groupId === '') return;
  page.setData({
    calendarPreferencesError: '',
    calendarPreferencesInfo: '',
    calendarPreferencesState: 'loading',
    isSavingGroupCalendarDefaults: false,
    isSavingMemberCalendarPreferences: false,
  });
  try {
    const [preferences, config] = await Promise.all([
      page._calendarPreferencesClient.get(groupId),
      page._organizationReadClient.getSchedulingConfig(groupId),
    ]);
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    applyCalendarPreferences(page, preferences, config);
  } catch (error) {
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    page.setData({
      calendarPreferencesError: toUserMessage(error, '日历偏好暂时无法读取，请稍后重试。'),
      calendarPreferencesInfo: '',
      calendarPreferencesState: 'error',
      isSavingGroupCalendarDefaults: false,
      isSavingMemberCalendarPreferences: false,
    });
  }
}

async function saveGroupCalendarDefaults(page: GroupSettingsPageInstance): Promise<void> {
  if (
    !page.data.canManageGroupCalendarDefaults ||
    page.data.calendarPreferencesState !== 'ready' ||
    page.data.isSavingGroupCalendarDefaults ||
    page._currentGroupId === ''
  ) {
    return;
  }
  const selected = page.data.groupCalendarShiftOptions[page.data.groupCalendarShiftIndex];
  if (selected === undefined) return;
  const serial = page._calendarPreferencesSerial;
  const groupId = page._currentGroupId;
  page.setData({
    calendarPreferencesError: '',
    calendarPreferencesInfo: '',
    isSavingGroupCalendarDefaults: true,
  });
  try {
    const preferences = await page._calendarPreferencesClient.updateGroupDefaults(groupId, {
      defaultMonthShiftTypeId: selected.value === '' ? null : selected.value,
      defaultView: page.data.groupCalendarView,
    });
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    applyCalendarPreferences(page, preferences);
    page.setData({ calendarPreferencesInfo: '群组日历默认设置已保存。' });
  } catch (error) {
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    page.setData({
      calendarPreferencesError: toUserMessage(error, '群组日历默认设置未保存，请稍后重试。'),
    });
  } finally {
    if (isCalendarPreferenceRequestCurrent(page, serial, groupId)) {
      page.setData({ isSavingGroupCalendarDefaults: false });
    }
  }
}

async function saveMemberCalendarPreferences(page: GroupSettingsPageInstance): Promise<void> {
  if (
    page.data.calendarPreferencesState !== 'ready' ||
    page.data.isSavingMemberCalendarPreferences ||
    page._currentGroupId === ''
  ) {
    return;
  }
  const selected = page.data.memberCalendarShiftOptions[page.data.memberCalendarShiftIndex];
  if (selected === undefined) return;
  const serial = page._calendarPreferencesSerial;
  const groupId = page._currentGroupId;
  page.setData({
    calendarPreferencesError: '',
    calendarPreferencesInfo: '',
    isSavingMemberCalendarPreferences: true,
  });
  try {
    const preferences = await page._calendarPreferencesClient.updateMine(groupId, {
      defaultMonthShiftTypeId: selected.value === '' ? null : selected.value,
      defaultView: page.data.memberCalendarView === 'follow' ? null : page.data.memberCalendarView,
    });
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    applyCalendarPreferences(page, preferences);
    page.setData({ calendarPreferencesInfo: '个人日历偏好已保存。' });
  } catch (error) {
    if (!isCalendarPreferenceRequestCurrent(page, serial, groupId)) return;
    page.setData({
      calendarPreferencesError: toUserMessage(error, '个人日历偏好未保存，请稍后重试。'),
    });
  } finally {
    if (isCalendarPreferenceRequestCurrent(page, serial, groupId)) {
      page.setData({ isSavingMemberCalendarPreferences: false });
    }
  }
}

function applyCalendarPreferences(
  page: GroupSettingsPageInstance,
  preferences: CalendarPreferences,
  config?: SchedulingConfig,
): void {
  if (preferences.groupId !== page._currentGroupId) {
    throw new Error('日历偏好响应与当前群组不匹配。');
  }
  const enabledShiftTypes = config?.shiftTypes.filter((shiftType) => shiftType.isEnabled);
  const groupCalendarShiftOptions =
    enabledShiftTypes === undefined
      ? page.data.groupCalendarShiftOptions
      : createCalendarShiftOptions('group', enabledShiftTypes);
  const memberCalendarShiftOptions =
    enabledShiftTypes === undefined
      ? page.data.memberCalendarShiftOptions
      : createCalendarShiftOptions('member', enabledShiftTypes);
  page.setData({
    calendarPreferencesError: '',
    calendarPreferencesState: 'ready',
    canManageGroupCalendarDefaults: preferences.canManageGroupDefaults,
    groupCalendarShiftIndex: findCalendarShiftIndex(
      groupCalendarShiftOptions,
      preferences.groupDefaultMonthShiftTypeId,
    ),
    groupCalendarShiftOptions,
    groupCalendarView: preferences.groupDefaultView,
    memberCalendarShiftIndex: findCalendarShiftIndex(
      memberCalendarShiftOptions,
      preferences.memberDefaultMonthShiftTypeId,
    ),
    memberCalendarShiftOptions,
    memberCalendarView: preferences.memberDefaultView ?? 'follow',
  });
}

function isCalendarPreferenceRequestCurrent(
  page: GroupSettingsPageInstance,
  serial: number,
  groupId: string,
): boolean {
  return serial === page._calendarPreferencesSerial && groupId === page._currentGroupId;
}

async function saveConsent(page: GroupSettingsPageInstance): Promise<void> {
  if (
    page.data.isSaving ||
    !page.data.canSave ||
    page._consentStatus === undefined ||
    page._consentDraft === undefined ||
    page._currentGroupId === ''
  ) {
    return;
  }

  let submission;
  try {
    submission = resolveGroupMobilePhoneConsentSubmission(
      page._consentStatus,
      page._consentDraft,
      createOperationId,
    );
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '请先更改手机号公开设置。'),
      infoMessage: '',
    });
    return;
  }

  page._consentDraft = submission.draft;
  const groupId = page._currentGroupId;
  const request = {
    ...submission.snapshot,
    noticeVersion: page._consentStatus.noticeVersion,
  } satisfies GroupMobilePhoneConsentSubmission;
  page.setData({ errorMessage: '', infoMessage: '', isSaving: true, saveDisabled: true });
  try {
    const status = await consentClient.update(groupId, request);
    if (page._currentGroupId !== groupId) return;
    const granted = submission.snapshot.consented;
    applyConsentStatus(page, status, {
      infoMessage: granted
        ? '已保存当前群组的手机号公开同意。'
        : '已撤回当前群组的手机号公开同意。',
      isSaving: false,
      state: 'ready',
    });
    scheduleConsentNoticeClear(
      page,
      groupId,
      granted ? '已保存当前群组的手机号公开同意。' : '已撤回当前群组的手机号公开同意。',
    );
  } catch (error) {
    if (page._currentGroupId !== groupId) return;
    if (isConflict(error)) {
      await reloadAfterConflict(page, groupId);
      return;
    }
    page.setData({
      errorMessage: `${toUserMessage(error, '手机号公开设置暂时无法保存，请稍后重试。')} 本次结果尚未确认，可直接重试。`,
      infoMessage: '',
      isSaving: false,
      saveDisabled: false,
    });
  }
}

async function reloadAfterConflict(
  page: GroupSettingsPageInstance,
  groupId: string,
): Promise<void> {
  const serial = ++page._loadSerial;
  try {
    const status = await consentClient.getStatus(groupId);
    if (serial !== page._loadSerial || page._currentGroupId !== groupId) return;
    applyConsentStatus(page, status, {
      infoMessage: '联系方式或同意状态已变化，请按最新状态重新确认。',
      isSaving: false,
      state: 'ready',
    });
    scheduleConsentNoticeClear(page, groupId, '联系方式或同意状态已变化，请按最新状态重新确认。');
  } catch (error) {
    if (serial !== page._loadSerial || page._currentGroupId !== groupId) return;
    page._consentDraft = undefined;
    page._consentStatus = undefined;
    page.setData({
      canSave: false,
      errorMessage: toUserMessage(error, '资料已变化，但最新状态暂时无法加载，请重新加载。'),
      infoMessage: '',
      isSaving: false,
      saveDisabled: true,
      state: 'error',
      switchDisabled: true,
    });
  }
}

function applyConsentStatus(
  page: GroupSettingsPageInstance,
  status: GroupMobilePhoneConsent,
  patch: Partial<GroupSettingsPageData>,
): void {
  if (status.groupId !== page._currentGroupId) {
    throw new Error('群组联系方式响应与当前群组不匹配。');
  }
  page._consentStatus = status;
  page._consentDraft = createGroupMobilePhoneConsentDraft(status);
  page.setData({ ...createConsentViewPatch(status, page._consentDraft), ...patch });
}

function syncConsentView(page: GroupSettingsPageInstance): void {
  if (page._consentStatus === undefined || page._consentDraft === undefined) return;
  page.setData(createConsentViewPatch(page._consentStatus, page._consentDraft));
}

function clearConsentNoticeTimer(page: GroupSettingsPageInstance): void {
  if (page._consentNoticeTimer !== undefined) {
    clearTimeout(page._consentNoticeTimer);
    page._consentNoticeTimer = undefined;
  }
}

function scheduleConsentNoticeClear(
  page: GroupSettingsPageInstance,
  groupId: string,
  message: string,
): void {
  clearConsentNoticeTimer(page);
  page._consentNoticeTimer = setTimeout(() => {
    page._consentNoticeTimer = undefined;
    if (page._currentGroupId === groupId && page.data.infoMessage === message) {
      page.setData({ infoMessage: '' });
    }
  }, 2_000);
}

function resolveCanManageGroupLifecycle(
  group: GroupSummary,
  organizationEnabled: boolean,
): boolean {
  return (
    organizationEnabled &&
    (group.isDeveloperAdmin === true || group.role === 'owner' || group.role === 'administrator')
  );
}

function createOrganizationPatch(
  group: GroupSummary,
  members: readonly GroupMember[],
  contacts: readonly GroupMemberContact[],
): Pick<
  GroupSettingsPageData,
  | 'canDissolveGroup'
  | 'canLeaveGroup'
  | 'canManageGroup'
  | 'canManageGroupLifecycle'
  | 'canManageMembers'
  | 'groupNameDraft'
  | 'managementError'
  | 'managementInfo'
  | 'managementState'
  | 'memberCards'
  | 'organizationEnabled'
> {
  const organizationEnabled = getClientCapabilitySnapshot().organization;
  const isDeveloperAdmin = group.isDeveloperAdmin === true;
  const canManageGroup = organizationEnabled && (group.role === 'owner' || isDeveloperAdmin);
  const canManageMembers =
    organizationEnabled &&
    (group.role === 'owner' || group.role === 'administrator' || isDeveloperAdmin);
  const canManageGroupLifecycle = resolveCanManageGroupLifecycle(group, organizationEnabled);
  const canDissolveGroup = organizationEnabled && (group.role === 'owner' || isDeveloperAdmin);
  const canLeaveGroup = organizationEnabled && group.role !== 'owner' && !isDeveloperAdmin;
  const contactByMemberId = new Map(contacts.map((contact) => [contact.membershipId, contact]));
  return {
    canDissolveGroup,
    canLeaveGroup,
    canManageGroup,
    canManageGroupLifecycle,
    canManageMembers,
    groupNameDraft: group.name,
    managementError: '',
    managementInfo: '',
    managementState: 'ready',
    memberCards: members.map((member) => {
      const contact = contactByMemberId.get(member.id);
      const isPendingRoster = member.isPendingRoster === true;
      const canEdit = canManageMembers && !isPendingRoster;
      return {
        entry: createMemberDirectoryEntry(member, contact),
        canEdit,
        canManage: canEdit,
        id: member.id,
        isCurrentUser: member.isCurrentUser,
        isPendingRoster,
        name: member.realName,
        roleLabel: formatRole(member.role),
        version: member.version,
      };
    }),
    organizationEnabled,
  };
}

function createGroupDirectoryPatch(
  dissolved: readonly DissolvedGroup[],
): Pick<GroupSettingsPageData, 'dissolvedCards'> {
  return {
    dissolvedCards: dissolved.map((group) => ({
      deletedAt: formatDeletedAt(group.deletedAt),
      id: group.id,
      name: group.name,
      version: group.version,
    })),
  };
}

function formatDeletedAt(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

async function createGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageGroupLifecycle || !(await ensureOrganizationCapability(page))) return;
  const name = page.data.createGroupName.trim();
  if (name.length === 0) {
    page.setData({ managementError: '请输入新群组名称。', managementState: 'error' });
    return;
  }
  const operationKey = `group-create:${name}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._organizationWriteClient.createGroup({
      name,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({
      createGroupName: '',
      managementInfo: '群组已创建，请继续添加预设成员。',
      managementState: 'ready',
    });
    await reloadGroupDirectory(page);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组没有创建，请稍后重试。')} 可保持内容重试。`,
      managementState: 'error',
    });
  }
}

async function leaveGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (
    !page.data.canLeaveGroup ||
    page.data.managementState === 'loading' ||
    !(await ensureOrganizationCapability(page))
  )
    return;
  const group = page._group;
  if (group === undefined || !(await showConfirm('退出后将不再收到该群通知，确认退出吗？'))) return;
  const operationKey = `group-leave:${group.id}:${group.version}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._organizationWriteClient.leaveGroup(group.id, {
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({ managementInfo: '已退出该群组。', managementState: 'ready' });
    await reloadGroupDirectory(page);
    if (!page.data.embedded) wx.navigateBack({ delta: 1 });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '退出群组没有完成，请稍后重试。')} 可保持当前页面重试。`,
      managementState: 'error',
    });
  }
}

async function dissolveGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canDissolveGroup || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  if (
    group === undefined ||
    !(await showConfirm('解散后群组会立即从列表消失，30 天内可恢复。确认解散吗？'))
  )
    return;
  const operationKey = `group-delete:${group.id}:${group.version}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._organizationWriteClient.deleteGroup(group.id, {
      expectedVersion: group.version,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({ managementInfo: '群组已解散，30 天内可在下方恢复。', managementState: 'ready' });
    await reloadGroupDirectory(page);
    if (!page.data.embedded) wx.navigateBack({ delta: 1 });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组没有解散，请稍后重试。')} 可保持当前页面重试。`,
      managementState: 'error',
    });
  }
}

async function restoreGroup(page: GroupSettingsPageInstance, groupId: string): Promise<void> {
  if (!page.data.canDissolveGroup || !(await ensureOrganizationCapability(page))) return;
  const dissolved = page._dissolvedGroups.find((candidate) => candidate.id === groupId);
  if (dissolved === undefined) return;
  const operationKey = `group-restore:${groupId}:${dissolved.version}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._organizationWriteClient.restoreGroup(groupId, {
      expectedVersion: dissolved.version,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({ managementInfo: '群组已恢复。', managementState: 'ready' });
    await reloadGroupDirectory(page);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组没有恢复，请稍后重试。')} 可保持当前页面重试。`,
      managementState: 'error',
    });
  }
}

async function reloadGroupDirectory(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageGroupLifecycle) {
    page._dissolvedGroups = [];
    page.setData(createGroupDirectoryPatch([]));
    return;
  }
  try {
    const dissolved = page.data.canDissolveGroup
      ? await page._organizationReadClient.listDissolvedGroups()
      : ([] as DissolvedGroup[]);
    page._dissolvedGroups = dissolved;
    page.setData(createGroupDirectoryPatch(dissolved));
  } catch {
    // A successful write remains visible; directory refresh can be retried on the next load.
  }
}

async function saveGroupName(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageGroup || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const name = page.data.groupNameDraft.trim();
  if (group === undefined || name.length === 0 || name === group.name) return;
  const operationKey = `group-name:${group.id}:${group.version}:${name}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.updateGroupName(group.id, {
      expectedVersion: group.version,
      name,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page._group = result;
    page.setData({
      ...createGroupPatch(result),
      groupNameDraft: result.name,
      managementInfo: '群组名称已更新。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组名称没有保存，请稍后重试。')} 可保持当前内容重试。`,
      managementState: 'error',
    });
  }
}

async function addRosterMembers(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageMembers || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const names = uniqueNames(page.data.rosterNames);
  if (group === undefined || names.length === 0) {
    page.setData({ managementError: '请每行输入一个预设成员姓名。' });
    return;
  }
  const operationKey = `roster-add:${group.id}:${names.join('|')}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.addGroupMembers(group.id, {
      operationId: resolveOperationId(page, operationKey),
      realNames: names,
    });
    page._operationIds.delete(operationKey);
    await reloadOrganizationData(page, `已添加 ${result.added} 位预设成员。`);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '预设成员没有添加，请稍后重试。')} 可保持内容重试。`,
      managementState: 'error',
    });
  }
}

async function convertRosterMember(
  page: GroupSettingsPageInstance,
  realName: string,
): Promise<void> {
  if (!page.data.canManageMembers || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  if (group === undefined) return;
  const operationKey = `roster-convert:${group.id}:${realName}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.convertRosterEntries(group.id, {
      operationId: resolveOperationId(page, operationKey),
      realNames: [realName],
    });
    page._operationIds.delete(operationKey);
    await reloadOrganizationData(page, `已转为正式成员 ${result.converted} 位。`);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '预设成员没有转正，请稍后重试。')} 可保持当前内容重试。`,
      managementState: 'error',
    });
  }
}

async function saveMemberContact(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageMembers || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const member = page._members.find((candidate) => candidate.id === page.data.editingMemberId);
  const contact = page._contacts.find(
    (candidate) => candidate.membershipId === page.data.editingMemberId,
  );
  if (group === undefined || member === undefined || contact === undefined) return;
  const name = page.data.editingMemberName.trim();
  if (name.length === 0) {
    page.setData({ managementError: '成员姓名不能为空。' });
    return;
  }
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    let nextMember = member;
    if (name !== member.realName) {
      const nameKey = `member-name:${member.id}:${member.version}:${name}`;
      nextMember = await page._organizationWriteClient.updateGroupMemberName(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, nameKey),
        realName: name,
      });
      page._operationIds.delete(nameKey);
    }
    const contactKey = `member-contact:${contact.membershipId}:${contact.version}:${page.data.editingMobilePhone}:${page.data.editingShortPhone}:${page.data.editingIsConfirmed}`;
    const nextContact = await page._organizationWriteClient.updateGroupMemberContact(
      group.id,
      member.id,
      {
        expectedVersion: contact.version,
        isConfirmed: page.data.editingIsConfirmed,
        mobilePhone: emptyToNull(page.data.editingMobilePhone),
        operationId: resolveOperationId(page, contactKey),
        shortPhone: emptyToNull(page.data.editingShortPhone),
      },
    );
    page._operationIds.delete(contactKey);
    page._members = page._members.map((candidate) =>
      candidate.id === nextMember.id ? nextMember : candidate,
    );
    page._contacts = page._contacts.map((candidate) =>
      candidate.membershipId === nextContact.membershipId ? nextContact : candidate,
    );
    page.setData({
      ...createOrganizationPatch(group, page._members, page._contacts),
      contactEditorOpen: false,
      editingMemberId: '',
      managementInfo: '成员资料已更新。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '成员资料没有保存，请稍后重试。')} 可保持内容重试。`,
      managementState: 'error',
    });
  }
}

async function runMemberAction(
  page: GroupSettingsPageInstance,
  memberId: string,
  action: string,
): Promise<void> {
  if (!page.data.canManageMembers || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const member = page._members.find((candidate) => candidate.id === memberId);
  if (group === undefined || member === undefined) return;
  if (!['delete', 'administrator', 'member'].includes(action)) return;
  const actionText = action === 'delete' ? '删除这个成员吗？' : '';
  if (actionText !== '' && !(await showConfirm(actionText))) return;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const operationKey = `member-${action}:${member.id}:${member.version}`;
    if (action === 'delete') {
      await page._organizationWriteClient.deleteGroupMember(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, operationKey),
      });
    } else if (action === 'administrator' || action === 'member') {
      await page._organizationWriteClient.updateGroupMemberRole(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, operationKey),
        role: action,
      });
    }
    page._operationIds.delete(operationKey);
    await reloadOrganizationData(page, '成员状态已更新。');
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '成员操作没有完成，请稍后重试。')} 可保持当前内容重试。`,
      managementState: 'error',
    });
  }
}

async function reloadOrganizationData(
  page: GroupSettingsPageInstance,
  infoMessage: string,
): Promise<void> {
  const group = page._group;
  if (group === undefined) return;
  try {
    const [members, contacts] = await Promise.all([
      page._organizationReadClient.listGroupMembers(group.id),
      page._organizationReadClient.listGroupContacts(group.id),
    ]);
    page._members = members;
    page._contacts = contacts;
    page.setData({
      ...createOrganizationPatch(group, members, contacts),
      managementInfo: infoMessage,
      managementState: 'ready',
      rosterEditorOpen: false,
      rosterNames: '',
    });
  } catch (error) {
    page.setData({
      managementError: toUserMessage(error, '最新成员状态暂时无法加载，请重新加载。'),
      managementState: 'error',
    });
  }
}

async function ensureOrganizationCapability(page: GroupSettingsPageInstance): Promise<boolean> {
  try {
    await requireClientCapability('organization');
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '组织管理能力暂未开放，当前仅可查看已有资料。';
    page.setData({ managementError: message, managementState: 'error' });
    return false;
  }
}

function resolveOperationId(page: GroupSettingsPageInstance, key: string): string {
  const existing = page._operationIds.get(key);
  if (existing !== undefined) return existing;
  const operationId = createOperationId();
  page._operationIds.set(key, operationId);
  return operationId;
}

function readInputValue(event: ValueInputEvent): string {
  return typeof event.detail?.value === 'string' ? event.detail.value : '';
}

function readPickerIndex(event: ValueInputEvent, optionCount: number): number | undefined {
  const rawIndex = event.detail?.value;
  const index = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex);
  return Number.isInteger(index) && index >= 0 && index < optionCount ? index : undefined;
}

function readCalendarView(value: string | undefined): CalendarPreferenceView | undefined {
  return value === 'list' || value === 'month' || value === 'week' ? value : undefined;
}

function createCalendarShiftOptions(
  scope: 'group' | 'member',
  shiftTypes: SchedulingConfig['shiftTypes'],
): readonly CalendarShiftOption[] {
  return [
    {
      label: scope === 'group' ? '自动选择首个启用班种' : '跟随群组',
      value: '',
    },
    ...shiftTypes.map((shiftType) => ({
      label: `${shiftType.name}（${shiftType.abbreviation}）`,
      value: shiftType.id,
    })),
  ];
}

function findCalendarShiftIndex(
  options: readonly CalendarShiftOption[],
  shiftTypeId: string | null,
): number {
  if (shiftTypeId === null) return 0;
  const index = options.findIndex((option) => option.value === shiftTypeId);
  return index < 0 ? 0 : index;
}

function uniqueNames(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/gu)
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ];
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function showConfirm(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      content,
      confirmText: '确认',
      success: (result) => resolve(result.confirm === true),
      fail: () => resolve(false),
    });
  });
}

function createConsentViewPatch(
  status: GroupMobilePhoneConsent,
  draft: GroupMobilePhoneConsentDraft,
): Pick<
  GroupSettingsPageData,
  | 'canSave'
  | 'consentState'
  | 'contactVersion'
  | 'desiredConsent'
  | 'noticeVersion'
  | 'saveDisabled'
  | 'switchDisabled'
> {
  const view = createGroupMobilePhoneConsentViewModel(status, draft);
  return {
    canSave: view.canSave,
    consentState: status.state,
    contactVersion: status.contactVersion,
    desiredConsent: view.desiredConsent,
    noticeVersion: status.noticeVersion,
    saveDisabled: !view.canSave,
    switchDisabled: !view.hasPhone,
  };
}

function resolveTargetGroup(
  groups: readonly GroupSummary[],
  requestedGroupId: string,
): GroupSummary | undefined {
  const requested = groups.find((group) => group.id === requestedGroupId);
  if (requested !== undefined) return requested;
  const ownerId = getStoredWechatProfile()?.id;
  const storedGroupId = ownerId === undefined ? undefined : readStoredWorkbenchGroupId(ownerId);
  const stored =
    storedGroupId === undefined
      ? undefined
      : groups.find((group) => group.id === storedGroupId && group.role !== 'guest');
  return stored ?? groups.find((group) => group.role !== 'guest');
}

function createGroupPatch(
  group: GroupSummary,
): Pick<GroupSettingsPageData, 'currentGroupName' | 'currentGroupRole'> {
  return {
    currentGroupName: group.name,
    currentGroupRole: group.isDeveloperAdmin === true ? '后台管理员' : formatRole(group.role),
  };
}

function createShellLayoutPatch(
  embedded: boolean,
): Pick<
  GroupSettingsPageData,
  'largeText' | 'pageScrollStyle' | 'shellHeaderStyle' | 'viewportClass'
> {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  return {
    largeText:
      ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ?? 16) >=
      20,
    pageScrollStyle: embedded ? 'height:100%;' : `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  };
}

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner' ? '群主' : role === 'administrator' ? '管理员' : '成员';
}

function isConflict(error: unknown): boolean {
  return error instanceof ClientCoreError && error.status === 409;
}

function decodeQueryValue(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function createOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

function createMemberDirectoryEntry(member: GroupMember, contact: GroupMemberContact | undefined) {
  const numbers = [
    { value: contact?.mobilePhone, field: 'full' as const, label: '长号' },
    { value: contact?.shortPhone, field: 'extension' as const, label: '短号' },
  ].flatMap(({ value, field, label }) => {
    if (value === undefined || value.trim() === '') return [];
    // The contacts endpoint applies per-group consent. Never turn a masked display into a number.
    const dialable =
      /^\+?[0-9][0-9 ()-]*$/u.test(value) &&
      (field !== 'extension' || /^\d{3,6}$/u.test(value)) &&
      canDialDirectoryNumber('mobile', field);
    return [
      {
        id: `${member.id}:${field}`,
        label,
        number: value,
        dialable,
        dialNumber: dialable ? normalizeDirectoryDialNumber(value) : '',
      },
    ];
  });
  return {
    id: member.id,
    title: member.realName,
    kindLabel: formatRole(member.role),
    jobTitles: [],
    contexts: [],
    employeeCodes: contact?.employeeCodes ?? [],
    employeeCodeLabel: contact?.employeeCodes?.join(' / ') ?? '',
    favorite: false,
    merged: false,
    mergeCountLabel: '',
    notes: numbers.length === 0 ? '联系方式未填写或未公开' : '',
    contacts:
      numbers.length === 0
        ? []
        : [{ id: `${member.id}:contact`, label: '联系电话', showLabel: false, numbers }],
  };
}
