import {
  ClientCoreError,
  type InviteVisitorWriteClient,
  type OrganizationReadClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type {
  CreateInviteLinkResponse,
  GroupMember,
  GroupSummary,
  SchedulingConfig,
} from '@schedule/contracts';
import {
  createRuntimeInviteVisitorWriteClient,
  createRuntimeOrganizationReadClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface TargetView {
  readonly id: string;
  readonly name: string;
  readonly kind: 'membership' | 'roster';
  readonly version: number;
  readonly statusLabel: string;
}

interface RoleView {
  readonly id: string;
  readonly label: string;
  readonly version: number;
}

interface InviteVisitorPageData {
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
  readonly managementError: string;
  readonly managementInfo: string;
  readonly managementState: 'error' | 'loading' | 'ready';
  readonly organizationEnabled: boolean;
  readonly guestEnabled: boolean;
  readonly canManage: boolean;
  readonly canManageVisitorKey: boolean;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly targets: readonly TargetView[];
  readonly targetIndex: number;
  readonly targetLabel: string;
  readonly roleOptions: readonly RoleView[];
  readonly permissionLabels: readonly string[];
  readonly roleIndex: number;
  readonly roleLabel: string;
  readonly permissionRole: 'administrator' | 'member';
  readonly inviteEditorOpen: boolean;
  readonly inviteSharePath: string;
  readonly inviteGroupName: string;
  readonly inviteRealName: string;
  readonly inviteRoleLabel: string;
  readonly inviteExpiresAt: string;
  readonly qrImageSrc: string;
  readonly qrVisible: boolean;
  readonly visitorState: 'idle' | 'loading' | 'ready' | 'error';
  readonly visitorMessage: string;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly viewportClass: string;
}

interface InviteVisitorPageInstance {
  readonly data: InviteVisitorPageData;
  readonly properties: { readonly groupId: string };
  _organizationReadClient: OrganizationReadClient;
  _inviteVisitorWriteClient: InviteVisitorWriteClient;
  _groupId: string;
  _group: GroupSummary | undefined;
  _members: readonly GroupMember[];
  _config: SchedulingConfig | undefined;
  _inviteToken: string;
  _inviteVersion: number;
  _operationIds: Map<string, string>;
  setData(patch: Partial<InviteVisitorPageData>, callback?: () => void): void;
}

const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const inviteVisitorWriteClient = createRuntimeInviteVisitorWriteClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createInviteVisitorPanelControllerDefinition() {
  return {
    data: {
      state: 'loading',
      errorMessage: '',
      managementError: '',
      managementInfo: '',
      managementState: 'loading',
      organizationEnabled: false,
      guestEnabled: false,
      canManage: false,
      canManageVisitorKey: false,
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      targets: [],
      targetIndex: 0,
      targetLabel: '请选择邀请对象',
      roleOptions: [],
      permissionLabels: ['成员', '管理员'],
      roleIndex: 0,
      roleLabel: '不指定岗位',
      permissionRole: 'member',
      inviteEditorOpen: false,
      inviteSharePath: '',
      inviteGroupName: '',
      inviteRealName: '',
      inviteRoleLabel: '',
      inviteExpiresAt: '',
      qrImageSrc: '',
      qrVisible: false,
      visitorState: 'idle',
      visitorMessage: '',
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      viewportClass: '',
    } satisfies InviteVisitorPageData,

    _organizationReadClient: organizationReadClient,
    _inviteVisitorWriteClient: inviteVisitorWriteClient,
    _groupId: '',
    _group: undefined,
    _members: [],
    _config: undefined,
    _inviteToken: '',
    _inviteVersion: 0,
    _operationIds: new Map<string, string>(),

    properties: { groupId: { type: String, value: '' } },

    observers: {
      groupId(this: InviteVisitorPageInstance): void {
        syncGroupId(this);
      },
    },

    lifetimes: {
      attached(this: InviteVisitorPageInstance): void {
        applyPanelLayout(this);
        syncGroupId(this);
      },
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleRetry(this: InviteVisitorPageInstance): void {
      void loadInviteData(this);
    },

    handleTargetPicker(this: InviteVisitorPageInstance, event: ValueInputEvent): void {
      const index = Number(event.detail?.value);
      const target = this.data.targets[index];
      if (target === undefined) return;
      this.setData({ targetIndex: index, targetLabel: `${target.name} · ${target.statusLabel}` });
    },

    handleRolePicker(this: InviteVisitorPageInstance, event: ValueInputEvent): void {
      const index = Number(event.detail?.value);
      const role = this.data.roleOptions[index];
      if (role === undefined) return;
      this.setData({ roleIndex: index, roleLabel: role.label });
    },

    handlePermissionPicker(this: InviteVisitorPageInstance, event: ValueInputEvent): void {
      const value = event.detail?.value;
      this.setData({
        permissionRole:
          Number(value) === 1 || value === 'administrator' ? 'administrator' : 'member',
      });
    },

    handleInviteToggle(this: InviteVisitorPageInstance): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      this.setData({ inviteEditorOpen: !this.data.inviteEditorOpen, managementError: '' });
    },

    handleCreateInvite(this: InviteVisitorPageInstance): void {
      void createInvite(this);
    },

    handleRevokeInvite(this: InviteVisitorPageInstance): void {
      void revokeInvite(this);
    },

    handleLoadQr(this: InviteVisitorPageInstance): void {
      void loadQr(this);
    },

    handleRegenerateVisitorKey(this: InviteVisitorPageInstance): void {
      void regenerateVisitorKey(this);
    },

    handleHideQr(this: InviteVisitorPageInstance): void {
      this.setData({ qrVisible: false });
    },
  };
}

function applyPanelLayout(page: InviteVisitorPageInstance): void {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  page.setData({
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  });
}

function syncGroupId(page: InviteVisitorPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId === page._groupId) return;
  page._groupId = groupId;
  if (groupId.length === 0) {
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      managementError: '当前群组信息缺失，请返回工作台后重试。',
      managementState: 'error',
      state: 'error',
    });
    return;
  }
  void loadInviteData(page);
}

async function loadInviteData(page: InviteVisitorPageInstance): Promise<void> {
  initializeRuntimeState(page);
  page.setData({
    state: 'loading',
    errorMessage: '',
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
    inviteEditorOpen: false,
    qrVisible: false,
    qrImageSrc: '',
    visitorState: 'idle',
    visitorMessage: '',
  });
  try {
    const groups = await page._organizationReadClient.listGroups();
    const group = groups.find((candidate) => candidate.id === page._groupId);
    if (group === undefined) throw new Error('当前群组不可用。');
    if (group.role === 'guest') throw new Error('访客不能管理邀请和访客入口。');
    const [members, config] = await Promise.all([
      page._organizationReadClient.listGroupMembers(group.id),
      page._organizationReadClient.getSchedulingConfig(group.id),
    ]);
    page._group = group;
    page._members = members;
    page._config = config;
    const capabilities = getClientCapabilitySnapshot();
    const targets = createTargetViews(members);
    const roleOptions = config.roles.map((role) => ({
      id: role.id,
      label: role.name,
      version: role.version,
    }));
    page.setData({
      state: 'ready',
      managementState: 'ready',
      organizationEnabled: capabilities.organization,
      guestEnabled: capabilities.guest,
      canManage: capabilities.organization && canManage(group),
      canManageVisitorKey:
        capabilities.organization && capabilities.guest && group.role === 'owner',
      currentGroupName: group.name,
      currentGroupRole: group.isDeveloperAdmin === true ? '后台管理员' : formatRole(group.role),
      targets,
      targetIndex: 0,
      targetLabel:
        targets[0] === undefined
          ? '暂无可邀请成员'
          : `${targets[0].name} · ${targets[0].statusLabel}`,
      roleOptions,
      roleIndex: 0,
      roleLabel: roleOptions[0]?.label ?? '不指定岗位',
    });
  } catch (error) {
    page.setData({
      state: 'error',
      managementState: 'error',
      errorMessage: toUserMessage(error, '邀请和访客入口暂时无法加载，请稍后重试。'),
      managementError: toUserMessage(error, '邀请和访客入口暂时无法加载，请稍后重试。'),
    });
  }
}

function initializeRuntimeState(page: InviteVisitorPageInstance): void {
  // Underscore-prefixed factory fields are not copied by WeChat Component;
  // restore the clients and mutable operation state on the live instance.
  page._organizationReadClient = organizationReadClient;
  page._inviteVisitorWriteClient = inviteVisitorWriteClient;
  if (typeof page._groupId !== 'string') page._groupId = '';
  if (!Array.isArray(page._members)) page._members = [];
  if (!(page._operationIds instanceof Map)) page._operationIds = new Map();
}

async function createInvite(page: InviteVisitorPageInstance): Promise<void> {
  if (!(await ensureOrganization(page))) return;
  const target = page.data.targets[page.data.targetIndex];
  const config = page._config;
  if (target === undefined || config === undefined) {
    page.setData({ managementError: '当前没有可邀请的成员。', managementState: 'error' });
    return;
  }
  const role = page.data.roleOptions[page.data.roleIndex];
  const key = `invite-create:${target.id}:${target.version}:${page.data.permissionRole}:${role?.id ?? ''}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const response = await page._inviteVisitorWriteClient.createInviteLink(page._groupId, {
      expectedScheduleRoleVersion: role?.version,
      expectedTargetVersion: target.version,
      operationId: resolveOperationId(page, key),
      permissionRole: page.data.permissionRole,
      scheduleRoleId: role?.id,
      ...(target.kind === 'roster'
        ? { targetRosterEntryId: target.id }
        : { targetMembershipId: target.id }),
    });
    page._operationIds.delete(key);
    page._inviteToken = response.token;
    page._inviteVersion = response.version;
    page.setData({
      inviteEditorOpen: false,
      inviteSharePath: response.sharePath,
      inviteGroupName: response.groupName,
      inviteRealName: response.realName,
      inviteRoleLabel: response.scheduleRoleName ?? '未指定岗位',
      inviteExpiresAt: formatDate(response.expiresAt),
      managementInfo: '邀请已生成，仅在当前页面内存中保留；请在本次操作中完成转发。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '邀请没有生成，请稍后重试。')} 可保持当前选择重试。`,
      managementState: 'error',
    });
  }
}

async function revokeInvite(page: InviteVisitorPageInstance): Promise<void> {
  if (!(await ensureOrganization(page))) return;
  if (page._inviteToken === '' || page._inviteVersion < 1) return;
  if (!(await showConfirm('撤销当前邀请吗？撤销后该邀请链接立即失效。'))) return;
  const key = `invite-revoke:${page._inviteToken}:${page._inviteVersion}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._inviteVisitorWriteClient.revokeInvite(page._groupId, page._inviteToken, {
      expectedVersion: page._inviteVersion,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page._inviteToken = '';
    page._inviteVersion = 0;
    page.setData({
      inviteSharePath: '',
      inviteGroupName: '',
      inviteRealName: '',
      managementInfo: '当前邀请已撤销。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '邀请没有撤销，请稍后重试。')} 可保持当前邀请重试。`,
      managementState: 'error',
    });
  }
}

async function regenerateVisitorKey(page: InviteVisitorPageInstance): Promise<void> {
  if (
    !page.data.canManageVisitorKey ||
    !(await ensureGuest(page)) ||
    !(await ensureOrganization(page))
  )
    return;
  const group = page._group;
  if (group === undefined) return;
  const key = `visitor-key:${group.id}:${group.version}`;
  page.setData({
    managementError: '',
    managementInfo: '',
    visitorState: 'loading',
    visitorMessage: '',
  });
  try {
    await page._inviteVisitorWriteClient.regenerateVisitorKey(page._groupId, {
      expectedVersion: group.version,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({
      visitorState: 'ready',
      visitorMessage: '访客码已轮换，旧入口立即失效。',
      managementInfo: '访客码已轮换。',
    });
  } catch (error) {
    page.setData({
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '访客码没有轮换，请稍后重试。'),
      managementState: 'error',
    });
  }
}

async function loadQr(page: InviteVisitorPageInstance): Promise<void> {
  if (!(await ensureGuest(page)) || !(await ensureOrganization(page))) return;
  page.setData({ visitorState: 'loading', visitorMessage: '', managementError: '' });
  try {
    const response = await page._organizationReadClient.getGroupQr(page._groupId);
    page.setData({
      qrImageSrc: `data:image/png;base64,${response.imageBase64}`,
      qrVisible: true,
      visitorState: 'ready',
      visitorMessage: '二维码仅保留在当前页面内存中。',
    });
  } catch (error) {
    page.setData({
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '群组二维码暂时无法加载，请稍后重试。'),
    });
  }
}

async function ensureOrganization(page: InviteVisitorPageInstance): Promise<boolean> {
  try {
    await requireClientCapability('organization');
    return page.data.canManage;
  } catch (error) {
    page.setData({
      managementError: error instanceof Error ? error.message : '组织管理能力暂未开放。',
      managementState: 'error',
    });
    return false;
  }
}

async function ensureGuest(page: InviteVisitorPageInstance): Promise<boolean> {
  try {
    await requireClientCapability('guest');
    return page.data.guestEnabled;
  } catch (error) {
    page.setData({
      visitorState: 'error',
      visitorMessage: error instanceof Error ? error.message : '访客入口能力暂未开放。',
    });
    return false;
  }
}

function createTargetViews(members: readonly GroupMember[]): readonly TargetView[] {
  return members.map((member) => ({
    id: member.id,
    name: member.realName,
    kind: member.isPendingRoster === true ? 'roster' : 'membership',
    version: member.version,
    statusLabel: member.isPendingRoster === true ? '预设成员' : '正式成员',
  }));
}

function canManage(group: GroupSummary): boolean {
  return (
    group.role === 'owner' || group.role === 'administrator' || group.isDeveloperAdmin === true
  );
}

function resolveOperationId(page: InviteVisitorPageInstance, key: string): string {
  const existing = page._operationIds.get(key);
  if (existing !== undefined) return existing;
  const operationId = createOperationId();
  page._operationIds.set(key, operationId);
  return operationId;
}

function createOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function formatDate(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner' ? '群主' : role === 'administrator' ? '管理员' : '成员';
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

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
