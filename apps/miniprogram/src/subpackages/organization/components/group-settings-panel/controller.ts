import { ClientCoreError, type GroupMobilePhoneConsentSubmission } from '@schedule/client-core';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { GroupMobilePhoneConsent, GroupSummary } from '@schedule/contracts';
import {
  createGroupMobilePhoneConsentDraft,
  createGroupMobilePhoneConsentViewModel,
  resolveGroupMobilePhoneConsentSubmission,
  setGroupMobilePhoneConsentDesired,
  type GroupMobilePhoneConsentDraft,
} from '@schedule/presentation-core';

import { createRuntimeGroupMobilePhoneConsentClient } from '../../../../platform/client-core-calendar.js';
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

interface GroupSettingsPageData {
  readonly actionLabel: '已同意' | '保存同意' | '撤回同意';
  readonly canSave: boolean;
  readonly consentState: GroupMobilePhoneConsent['state'];
  readonly contactVersion: number;
  readonly currentGroupCodeDigits: readonly GroupCodeDigitView[];
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
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
  readonly data: GroupSettingsPageData;
  setData(patch: Partial<GroupSettingsPageData>, callback?: () => void): void;
}

const consentClient = createRuntimeGroupMobilePhoneConsentClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const workbenchClient = createWorkbenchReadClient();

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
  };
}

async function loadGroupSettings(page: GroupSettingsPageInstance): Promise<void> {
  const serial = ++page._loadSerial;
  page._consentDraft = undefined;
  page._consentStatus = undefined;
  page._currentGroupId = '';
  page.setData({
    canSave: false,
    errorMessage: '',
    infoMessage: '',
    isSaving: false,
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
    page.setData(createGroupPatch(group));
    const status = await consentClient.getStatus(group.id);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    applyConsentStatus(page, status, { state: 'ready' });
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page.setData({
      errorMessage: toUserMessage(error, '群组设置暂时无法加载，请稍后重试。'),
      isSaving: false,
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
    currentGroupRole: formatRole(group.role),
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
