import {
  ClientCoreError,
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
  DissolvedGroup,
  GroupCatalogEntry,
  GroupMember,
  GroupMemberContact,
  GroupMobilePhoneConsent,
  GroupSummary,
  MembershipClaimRequest,
} from '@schedule/contracts';
import {
  createGroupMobilePhoneConsentDraft,
  createGroupMobilePhoneConsentViewModel,
  resolveGroupMobilePhoneConsentSubmission,
  setGroupMobilePhoneConsentDesired,
  type GroupMobilePhoneConsentDraft,
} from '@schedule/presentation-core';

import {
  createRuntimeGroupMobilePhoneConsentClient,
  createRuntimeOrganizationReadClient,
  createRuntimeOrganizationWriteClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import {
  createWorkbenchReadClient,
  readStoredWorkbenchGroupId,
} from '../../../../platform/workbench-read.js';

interface GroupCodeDigitView {
  readonly key: string;
  readonly value: string;
}

interface MemberCardView {
  readonly canEdit: boolean;
  readonly canManage: boolean;
  readonly hasMobilePhone: boolean;
  readonly hasShortPhone: boolean;
  readonly id: string;
  readonly isClaimedByCurrentUser: boolean;
  readonly isCurrentUser: boolean;
  readonly isPendingRoster: boolean;
  readonly isUnclaimed: boolean;
  readonly mobilePhone: string;
  readonly name: string;
  readonly roleLabel: string;
  readonly shortPhone: string;
  readonly statusLabel: string;
  readonly version: number;
}

interface ClaimCardView {
  readonly canDecide: boolean;
  readonly id: string;
  readonly requesterName: string;
  readonly statusLabel: string;
  readonly targetName: string;
  readonly version: number;
}

interface CatalogCardView {
  readonly id: string;
  readonly label: string;
}

interface DissolvedCardView {
  readonly deletedAt: string;
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface GroupSettingsPageData {
  readonly actionLabel: '已同意' | '保存同意' | '撤回同意';
  readonly canSave: boolean;
  readonly consentState: GroupMobilePhoneConsent['state'];
  readonly contactVersion: number;
  readonly currentGroupCodeDigits: readonly GroupCodeDigitView[];
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly groupCodeDraft: string;
  readonly groupNameDraft: string;
  readonly groupVersion: number;
  readonly organizationEnabled: boolean;
  readonly canManageGroup: boolean;
  readonly canManageMembers: boolean;
  readonly canLeaveGroup: boolean;
  readonly canDissolveGroup: boolean;
  readonly memberCards: readonly MemberCardView[];
  readonly claimCards: readonly ClaimCardView[];
  readonly catalogCards: readonly CatalogCardView[];
  readonly catalogLabels: readonly string[];
  readonly catalogIndex: number;
  readonly selectedCatalogId: string;
  readonly selectedCatalogLabel: string;
  readonly dissolvedCards: readonly DissolvedCardView[];
  readonly createGroupName: string;
  readonly createGroupCode: string;
  readonly joinGroupCode: string;
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
  readonly groupCodeAriaLabel: string;
  readonly infoMessage: string;
  readonly isSaving: boolean;
  readonly maskedMobilePhone: string;
  readonly noticeVersion: string;
  readonly pageScrollStyle: string;
  readonly profileInitial: string;
  readonly profileName: string;
  readonly saveDisabled: boolean;
  readonly shellHeaderStyle: string;
  readonly state: 'error' | 'loading' | 'ready';
  readonly switchDisabled: boolean;
  readonly viewportClass: string;
}

interface GroupSettingsPageInstance {
  _consentDraft: GroupMobilePhoneConsentDraft | undefined;
  _consentStatus: GroupMobilePhoneConsent | undefined;
  _currentGroupId: string;
  _loadSerial: number;
  _requestedGroupId: string;
  _group: GroupSummary | undefined;
  _members: readonly GroupMember[];
  _contacts: readonly GroupMemberContact[];
  _claimRequests: readonly MembershipClaimRequest[];
  _catalog: readonly GroupCatalogEntry[];
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
      actionLabel: '保存同意',
      canSave: false,
      consentState: 'not-consented',
      contactVersion: 0,
      currentGroupCodeDigits: createGroupCodeDigits(),
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      groupCodeDraft: '',
      groupNameDraft: '',
      groupVersion: 0,
      organizationEnabled: false,
      canManageGroup: false,
      canManageMembers: false,
      canLeaveGroup: false,
      canDissolveGroup: false,
      memberCards: [],
      claimCards: [],
      catalogCards: [],
      catalogLabels: [],
      catalogIndex: 0,
      selectedCatalogId: '',
      selectedCatalogLabel: '请选择群组',
      dissolvedCards: [],
      createGroupName: '',
      createGroupCode: '',
      joinGroupCode: '',
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
      groupCodeAriaLabel: '群组码暂不可用',
      infoMessage: '',
      isSaving: false,
      maskedMobilePhone: '',
      noticeVersion: '—',
      pageScrollStyle: 'height:calc(100% - 64px);',
      profileInitial: '我',
      profileName: '当前账号',
      saveDisabled: true,
      shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
      state: 'loading',
      switchDisabled: true,
      viewportClass: '',
    } satisfies GroupSettingsPageData,

    _consentDraft: undefined,
    _consentStatus: undefined,
    _currentGroupId: '',
    _loadSerial: 0,
    _requestedGroupId: '',
    _group: undefined,
    _members: [],
    _contacts: [],
    _claimRequests: [],
    _catalog: [],
    _dissolvedGroups: [],
    _operationIds: new Map(),
    _organizationReadClient: organizationReadClient,
    _organizationWriteClient: organizationWriteClient,

    onLoad(
      this: GroupSettingsPageInstance,
      query: Readonly<Record<string, string | undefined>>,
    ): void {
      this._requestedGroupId = decodeQueryValue(query['groupId']);
      this.setData({ ...createShellLayoutPatch(this.data.embedded), ...createProfilePatch() });
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
      syncConsentView(this);
    },

    handleSave(this: GroupSettingsPageInstance): void {
      void saveConsent(this);
    },

    handleGroupNameInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ groupNameDraft: readInputValue(event) });
    },

    handleGroupCodeInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ groupCodeDraft: readInputValue(event).replace(/\D/gu, '').slice(0, 4) });
    },

    handleSaveGroupName(this: GroupSettingsPageInstance): void {
      void saveGroupName(this);
    },

    handleSaveGroupCode(this: GroupSettingsPageInstance): void {
      void saveGroupCode(this);
    },

    handleCreateGroupNameInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ createGroupName: readInputValue(event) });
    },

    handleCreateGroupCodeInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ createGroupCode: readInputValue(event).replace(/\D/gu, '').slice(0, 4) });
    },

    handleCreateGroup(this: GroupSettingsPageInstance): void {
      void createGroup(this);
    },

    handleJoinGroupCodeInput(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      this.setData({ joinGroupCode: readInputValue(event).replace(/\D/gu, '').slice(0, 4) });
    },

    handleJoinGroupPickerChange(this: GroupSettingsPageInstance, event: ValueInputEvent): void {
      const rawIndex = event.detail?.value;
      const index = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= this.data.catalogCards.length) return;
      const selected = this.data.catalogCards[index];
      if (selected === undefined) return;
      this.setData({
        catalogIndex: index,
        selectedCatalogId: selected.id,
        selectedCatalogLabel: selected.label,
      });
    },

    handleJoinGroup(this: GroupSettingsPageInstance): void {
      void joinGroup(this);
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

    handleClaimAction(this: GroupSettingsPageInstance, event: TapEvent): void {
      const claimId = event.currentTarget.dataset.claimId;
      const action = event.currentTarget.dataset.action;
      if (claimId === undefined || action === undefined) return;
      void decideClaim(this, claimId, action);
    },
  };
}

async function loadGroupSettings(page: GroupSettingsPageInstance): Promise<void> {
  const serial = ++page._loadSerial;
  page._consentDraft = undefined;
  page._consentStatus = undefined;
  page._currentGroupId = '';
  page._group = undefined;
  page._members = [];
  page._contacts = [];
  page._claimRequests = [];
  page._catalog = [];
  page._dissolvedGroups = [];
  page.setData({
    canSave: false,
    errorMessage: '',
    infoMessage: '',
    isSaving: false,
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
    memberCards: [],
    claimCards: [],
    catalogCards: [],
    catalogLabels: [],
    catalogIndex: 0,
    selectedCatalogId: '',
    selectedCatalogLabel: '请选择群组',
    dissolvedCards: [],
    rosterEditorOpen: false,
    rosterNames: '',
    contactEditorOpen: false,
    saveDisabled: true,
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
    const statusPromise = consentClient.getStatus(group.id);
    const membersPromise = page._organizationReadClient.listGroupMembers(group.id);
    const contactsPromise = page._organizationReadClient.listGroupContacts(group.id);
    const claimsPromise = page._organizationReadClient.listMembershipClaimRequests(group.id);
    const catalogPromise = page._organizationReadClient.listGroupCatalog();
    const capabilitySnapshot = getClientCapabilitySnapshot();
    const dissolvedPromise =
      capabilitySnapshot.organization && (group.role === 'owner' || group.isDeveloperAdmin === true)
        ? page._organizationReadClient.listDissolvedGroups()
        : Promise.resolve([] as DissolvedGroup[]);
    const [status, members, contacts, claims, catalog, dissolved] = await Promise.all([
      statusPromise,
      membersPromise,
      contactsPromise,
      claimsPromise,
      catalogPromise,
      dissolvedPromise,
    ]);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    page._members = members;
    page._contacts = contacts;
    page._claimRequests = claims;
    page._catalog = catalog;
    page._dissolvedGroups = dissolved;
    page.setData({
      ...createGroupPatch(group),
      ...createOrganizationPatch(group, members, contacts, claims),
      ...createGroupDirectoryPatch(catalog, dissolved),
    });
    applyConsentStatus(page, status, { state: 'ready' });
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
  page._loadSerial += 1;
  page.setData({
    errorMessage: error.message,
    isSaving: false,
    saveDisabled: true,
    state: 'error',
    switchDisabled: true,
  });
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

function createOrganizationPatch(
  group: GroupSummary,
  members: readonly GroupMember[],
  contacts: readonly GroupMemberContact[],
  claims: readonly MembershipClaimRequest[],
): Pick<
  GroupSettingsPageData,
  | 'canDissolveGroup'
  | 'canLeaveGroup'
  | 'canManageGroup'
  | 'canManageMembers'
  | 'claimCards'
  | 'groupCodeDraft'
  | 'groupNameDraft'
  | 'groupVersion'
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
  const canDissolveGroup = organizationEnabled && (group.role === 'owner' || isDeveloperAdmin);
  const canLeaveGroup = organizationEnabled && group.role !== 'owner' && !isDeveloperAdmin;
  const contactByMemberId = new Map(contacts.map((contact) => [contact.membershipId, contact]));
  return {
    canDissolveGroup,
    canLeaveGroup,
    canManageGroup,
    canManageMembers,
    claimCards: claims.map((claim) => ({
      canDecide: canManageMembers && claim.status === 'pending',
      id: claim.id,
      requesterName: claim.requestingUserRealName,
      statusLabel: formatClaimStatus(claim.status),
      targetName: claim.targetMemberRealName,
      version: claim.version,
    })),
    groupCodeDraft: group.groupCode ?? '',
    groupNameDraft: group.name,
    groupVersion: group.version,
    managementError: '',
    managementInfo: '',
    managementState: 'ready',
    memberCards: members.map((member) => {
      const contact = contactByMemberId.get(member.id);
      const isPendingRoster = member.isPendingRoster === true;
      const canEdit = canManageMembers && !isPendingRoster;
      return {
        canEdit,
        canManage: canEdit,
        hasMobilePhone: contact?.mobilePhone !== undefined,
        hasShortPhone: contact?.shortPhone !== undefined,
        id: member.id,
        isClaimedByCurrentUser: member.isClaimedByCurrentUser === true,
        isCurrentUser: member.isCurrentUser,
        isPendingRoster,
        isUnclaimed: member.isUnclaimed === true,
        mobilePhone: contact?.mobilePhone ?? '',
        name: member.realName,
        roleLabel: formatRole(member.role),
        shortPhone: contact?.shortPhone ?? '',
        statusLabel: isPendingRoster
          ? '待转为正式成员'
          : member.isUnclaimed === true
            ? '待认领'
            : member.isClaimedByCurrentUser === true
              ? '已认领'
              : formatRole(member.role),
        version: member.version,
      };
    }),
    organizationEnabled,
  };
}

function createGroupDirectoryPatch(
  catalog: readonly GroupCatalogEntry[],
  dissolved: readonly DissolvedGroup[],
): Pick<
  GroupSettingsPageData,
  | 'catalogCards'
  | 'catalogIndex'
  | 'catalogLabels'
  | 'dissolvedCards'
  | 'selectedCatalogId'
  | 'selectedCatalogLabel'
> {
  const catalogCards = catalog
    .filter((entry) => entry.relation !== 'active-member' && entry.relation !== 'active-guest')
    .map((entry) => ({
      id: entry.id,
      label: `${entry.name} · ${formatCatalogRelation(entry.relation)}`,
    }));
  return {
    catalogCards,
    catalogIndex: 0,
    catalogLabels: catalogCards.map((entry) => entry.label),
    dissolvedCards: dissolved.map((group) => ({
      deletedAt: formatDeletedAt(group.deletedAt),
      id: group.id,
      name: group.name,
      version: group.version,
    })),
    selectedCatalogId: catalogCards[0]?.id ?? '',
    selectedCatalogLabel: catalogCards[0]?.label ?? '暂无可加入群组',
  };
}

function formatCatalogRelation(relation: GroupCatalogEntry['relation']): string {
  return relation === 'left-member' ? '可重新加入' : '可申请加入';
}

function formatDeletedAt(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

async function createGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (!(await ensureOrganizationCapability(page))) return;
  const name = page.data.createGroupName.trim();
  const groupCode = page.data.createGroupCode.trim();
  if (name.length === 0) {
    page.setData({ managementError: '请输入新群组名称。', managementState: 'error' });
    return;
  }
  if (!/^\d{4}$/u.test(groupCode)) {
    page.setData({ managementError: '请输入四位群组码。', managementState: 'error' });
    return;
  }
  const operationKey = `group-create:${name}:${groupCode}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.createGroup({
      groupCode,
      name,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({
      createGroupCode: '',
      createGroupName: '',
      managementInfo: result.groupCode
        ? `群组已创建，群组码为 ${result.groupCode}。请继续添加预设成员。`
        : '群组已创建，请继续添加预设成员。',
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

async function joinGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (!(await ensureOrganizationCapability(page))) return;
  const selectedId = page.data.selectedCatalogId;
  const selected = page._catalog.find((entry) => entry.id === selectedId);
  const groupCode = page.data.joinGroupCode.trim();
  if (selected === undefined) {
    page.setData({ managementError: '请先选择要加入的群组。', managementState: 'error' });
    return;
  }
  if (selected.relation === 'active-member' || selected.relation === 'active-guest') {
    page.setData({ managementError: '您已经加入该群组。', managementState: 'error' });
    return;
  }
  if (!/^\d{4}$/u.test(groupCode)) {
    page.setData({ managementError: '请输入四位群组码。', managementState: 'error' });
    return;
  }
  const operationKey = `group-claim:${selected.id}:${groupCode}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.claimGroup({
      groupCode,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page.setData({
      joinGroupCode: '',
      managementInfo:
        result.status === 'claimed'
          ? `已加入“${result.group.name}”。`
          : '已向管理员提交添加人员请求，管理员批准后才会开放群组排班。',
      managementState: 'ready',
    });
    await reloadGroupDirectory(page);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组加入申请没有完成，请稍后重试。')} 可保持内容重试。`,
      managementState: 'error',
    });
  }
}

async function leaveGroup(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canLeaveGroup || !(await ensureOrganizationCapability(page))) return;
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
  try {
    const catalog = await page._organizationReadClient.listGroupCatalog();
    const dissolved = page.data.canDissolveGroup
      ? await page._organizationReadClient.listDissolvedGroups()
      : ([] as DissolvedGroup[]);
    page._catalog = catalog;
    page._dissolvedGroups = dissolved;
    page.setData(createGroupDirectoryPatch(catalog, dissolved));
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
      groupCodeDraft: result.groupCode ?? '',
      groupVersion: result.version,
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

async function saveGroupCode(page: GroupSettingsPageInstance): Promise<void> {
  if (!page.data.canManageGroup || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const groupCode = page.data.groupCodeDraft.trim();
  if (group === undefined || !/^\d{4}$/u.test(groupCode) || groupCode === group.groupCode) return;
  const operationKey = `group-code:${group.id}:${group.version}:${groupCode}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._organizationWriteClient.updateGroupCode(group.id, {
      expectedVersion: group.version,
      groupCode,
      operationId: resolveOperationId(page, operationKey),
    });
    page._operationIds.delete(operationKey);
    page._group = result;
    page.setData({
      ...createGroupPatch(result),
      groupNameDraft: result.name,
      groupCodeDraft: result.groupCode ?? '',
      groupVersion: result.version,
      managementInfo: '群组码已更新。旧群组码不再有效。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '群组码没有保存，请稍后重试。')} 可保持当前内容重试。`,
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
      ...createOrganizationPatch(group, page._members, page._contacts, page._claimRequests),
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
  const actionText =
    action === 'delete' ? '删除这个成员吗？' : action === 'revoke' ? '撤销这个成员的认领吗？' : '';
  if (actionText !== '' && !(await showConfirm(actionText))) return;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const operationKey = `member-${action}:${member.id}:${member.version}`;
    if (action === 'delete') {
      await page._organizationWriteClient.deleteGroupMember(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, operationKey),
      });
    } else if (action === 'revoke') {
      await page._organizationWriteClient.revokeMembershipClaim(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, operationKey),
      });
    } else if (action === 'administrator' || action === 'member') {
      await page._organizationWriteClient.updateGroupMemberRole(group.id, member.id, {
        expectedVersion: member.version,
        operationId: resolveOperationId(page, operationKey),
        role: action,
      });
    } else if (action === 'claim') {
      const result = await page._organizationWriteClient.createMembershipClaimRequest(group.id, {
        expectedMemberVersion: member.version,
        membershipId: member.id,
        operationId: resolveOperationId(page, operationKey),
      });
      if (result.direct) {
        page.setData({ managementInfo: '已直接认领该预设成员。' });
      }
    }
    page._operationIds.delete(operationKey);
    await reloadOrganizationData(
      page,
      action === 'claim' ? '认领申请已提交。' : '成员状态已更新。',
    );
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '成员操作没有完成，请稍后重试。')} 可保持当前内容重试。`,
      managementState: 'error',
    });
  }
}

async function decideClaim(
  page: GroupSettingsPageInstance,
  claimId: string,
  action: string,
): Promise<void> {
  if (!page.data.canManageMembers || !(await ensureOrganizationCapability(page))) return;
  const group = page._group;
  const claim = page._claimRequests.find((candidate) => candidate.id === claimId);
  if (
    group === undefined ||
    claim === undefined ||
    !(await showConfirm(action === 'approve' ? '同意这项认领申请吗？' : '驳回这项认领申请吗？'))
  )
    return;
  const operationKey = `claim-${action}:${claim.id}:${claim.version}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const request = {
      expectedVersion: claim.version,
      operationId: resolveOperationId(page, operationKey),
    };
    const result =
      action === 'approve'
        ? await page._organizationWriteClient.approveMembershipClaimRequest(
            group.id,
            claim.id,
            request,
          )
        : await page._organizationWriteClient.rejectMembershipClaimRequest(
            group.id,
            claim.id,
            request,
          );
    page._operationIds.delete(operationKey);
    page._claimRequests = page._claimRequests.map((candidate) =>
      candidate.id === result.id ? result : candidate,
    );
    page.setData({
      ...createOrganizationPatch(group, page._members, page._contacts, page._claimRequests),
      managementInfo: action === 'approve' ? '认领申请已同意。' : '认领申请已驳回。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '认领申请没有处理，请稍后重试。')} 可保持当前内容重试。`,
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
    const [members, contacts, claims] = await Promise.all([
      page._organizationReadClient.listGroupMembers(group.id),
      page._organizationReadClient.listGroupContacts(group.id),
      page._organizationReadClient.listMembershipClaimRequests(group.id),
    ]);
    page._members = members;
    page._contacts = contacts;
    page._claimRequests = claims;
    page.setData({
      ...createOrganizationPatch(group, members, contacts, claims),
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

function formatClaimStatus(status: MembershipClaimRequest['status']): string {
  return status === 'pending'
    ? '待处理'
    : status === 'approved'
      ? '已同意'
      : status === 'rejected'
        ? '已驳回'
        : '已取消';
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
  | 'actionLabel'
  | 'canSave'
  | 'consentState'
  | 'contactVersion'
  | 'desiredConsent'
  | 'maskedMobilePhone'
  | 'noticeVersion'
  | 'saveDisabled'
  | 'switchDisabled'
> {
  const view = createGroupMobilePhoneConsentViewModel(status, draft);
  return {
    actionLabel: view.actionLabel,
    canSave: view.canSave,
    consentState: status.state,
    contactVersion: status.contactVersion,
    desiredConsent: view.desiredConsent,
    maskedMobilePhone: view.maskedMobilePhone,
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
): Pick<
  GroupSettingsPageData,
  'currentGroupCodeDigits' | 'currentGroupName' | 'currentGroupRole' | 'groupCodeAriaLabel'
> {
  const digitValues = group.groupCode?.split('') ?? ['—', '—', '—', '—'];
  return {
    currentGroupCodeDigits: createGroupCodeDigits(digitValues),
    currentGroupName: group.name,
    currentGroupRole: group.isDeveloperAdmin === true ? '后台管理员' : formatRole(group.role),
    groupCodeAriaLabel:
      group.groupCode === undefined ? '群组码暂不可用' : `群组码 ${digitValues.join(' ')}`,
  };
}

function createGroupCodeDigits(
  values: readonly string[] = ['—', '—', '—', '—'],
): readonly GroupCodeDigitView[] {
  return values.map((value, index) => ({ key: `digit-${index}`, value }));
}

function createProfilePatch(): Pick<GroupSettingsPageData, 'profileInitial' | 'profileName'> {
  const profile = getStoredWechatProfile();
  const profileName = profile?.realName ?? '当前账号';
  return {
    profileInitial: [...profileName][0] ?? '我',
    profileName,
  };
}

function createShellLayoutPatch(
  embedded: boolean,
): Pick<GroupSettingsPageData, 'pageScrollStyle' | 'shellHeaderStyle' | 'viewportClass'> {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  return {
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
