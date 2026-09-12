import {
  ClientCoreError,
  type InviteVisitorWriteClient,
  type OrganizationReadClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { GroupMember, GroupSummary, SchedulingConfig } from '@schedule/contracts';
import {
  createRuntimeInviteVisitorWriteClient,
  createRuntimeOrganizationReadClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import {
  clearInfoMessageTimer,
  scheduleInfoMessageExpiry,
} from '../../../../platform/info-message-lifetime.js';
import { parseVisitorQrImage, saveVisitorQrImage } from '../../../../platform/visitor-qr-image.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
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
  readonly infoMessage: string;
  readonly infoTone: 'success' | 'info' | 'error';
  readonly qrSaving: boolean;
  readonly albumPermissionDenied: boolean;
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
  readonly largeText: boolean;
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
  _inviteExpiresAtMs: number;
  _inviteGeneration: number;
  _disposed: boolean;
  _qrGeneration: number;
  _qrReading?: object;
  _qrRotating?: object;
  _qrSaveTask?: object;
  __infoMessageTimer?: unknown;
  __infoMessageToken?: object;
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
      infoMessage: '',
      infoTone: 'info',
      qrSaving: false,
      albumPermissionDenied: false,
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
      largeText: false,
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
    _inviteExpiresAtMs: 0,
    _inviteGeneration: 0,
    _disposed: false,
    _operationIds: new Map<string, string>(),

    properties: { groupId: { type: String, value: '' } },

    observers: {
      groupId(this: InviteVisitorPageInstance): void {
        syncGroupId(this);
      },
    },

    lifetimes: {
      attached(this: InviteVisitorPageInstance): void {
        this._disposed = false;
        recordMiniTelemetryBoundary('invite-visitor:controller-attached');
        applyPanelLayout(this);
        syncGroupId(this);
      },
      detached(this: InviteVisitorPageInstance): void {
        clearInfoMessageTimer(this);
        invalidateQr(this);
        this._disposed = true;
        this._inviteGeneration = (this._inviteGeneration ?? 0) + 1;
        this._inviteToken = '';
        this._inviteVersion = 0;
        this._inviteExpiresAtMs = 0;
        this._operationIds?.clear();
      },
    },

    handleRefreshInviteExpiry(this: InviteVisitorPageInstance): void {
      if (!this._inviteToken || this._inviteExpiresAtMs > Date.now()) return;
      this._inviteToken = '';
      this._inviteVersion = 0;
      this._inviteExpiresAtMs = 0;
      updatePanel(this, { inviteSharePath: '', managementInfo: '邀请已过期，请重新生成邀请。' });
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

    handleSaveQr(this: InviteVisitorPageInstance): void {
      void saveQr(this);
    },

    handleAlbumSettings(
      this: InviteVisitorPageInstance,
      event: {
        detail?: { authSetting?: Readonly<Record<string, boolean>> };
      },
    ): void {
      if (this._disposed || !this.data.albumPermissionDenied || !this.data.qrVisible) return;
      const enabled = event.detail?.authSetting?.['scope.writePhotosAlbum'] === true;
      updatePanel(this, {
        albumPermissionDenied: !enabled,
        infoTone: 'info',
        managementInfo: enabled
          ? '相册权限已开启，请再次点击保存到相册。'
          : '未开启相册权限，二维码未保存。',
      });
    },

    handleHideQr(this: InviteVisitorPageInstance): void {
      invalidateQr(this);
    },
  };
}

function applyPanelLayout(page: InviteVisitorPageInstance): void {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  updatePanel(page, {
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    largeText:
      ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ?? 16) >=
      20,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  });
}

function syncGroupId(page: InviteVisitorPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId === page._groupId) return;
  page._inviteGeneration = (page._inviteGeneration ?? 0) + 1;
  clearInfoMessageTimer(page);
  invalidateQr(page);
  page._inviteToken = '';
  page._inviteVersion = 0;
  page._inviteExpiresAtMs = 0;
  page._group = undefined;
  page._config = undefined;
  page._members = [];
  page._operationIds.clear();
  updatePanel(page, {
    inviteSharePath: '',
    inviteGroupName: '',
    inviteRealName: '',
    canManage: false,
    canManageVisitorKey: false,
    infoMessage: '',
  });
  page._groupId = groupId;
  if (groupId.length === 0) {
    updatePanel(page, {
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
  const groupId = page._groupId;
  const generation = page._inviteGeneration;
  invalidateQr(page);
  updatePanel(page, {
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
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    const group = groups.find((candidate) => candidate.id === groupId);
    if (group === undefined) throw new Error('当前群组不可用。');
    if (group.role === 'guest') throw new Error('访客不能管理邀请和访客入口。');
    const [members, config] = await Promise.all([
      page._organizationReadClient.listGroupMembers(group.id),
      page._organizationReadClient.getSchedulingConfig(group.id),
    ]);
    if (!isCurrentInvitePage(page, groupId, generation)) return;
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
    updatePanel(page, {
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
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    updatePanel(page, {
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
  if (typeof page._inviteGeneration !== 'number') page._inviteGeneration = 0;
  if (typeof page._qrGeneration !== 'number') page._qrGeneration = 0;
  if (!Array.isArray(page._members)) page._members = [];
  if (!(page._operationIds instanceof Map)) page._operationIds = new Map();
}

async function createInvite(page: InviteVisitorPageInstance): Promise<void> {
  const groupId = page._groupId;
  const generation = page._inviteGeneration;
  if (!(await ensureOrganization(page, () => isCurrentInvitePage(page, groupId, generation))))
    return;
  if (!isCurrentInvitePage(page, groupId, generation) || page.data.managementState === 'loading')
    return;
  const target = page.data.targets[page.data.targetIndex];
  const config = page._config;
  if (target === undefined || config === undefined) {
    updatePanel(page, { managementError: '当前没有可邀请的成员。', managementState: 'error' });
    return;
  }
  const role = page.data.roleOptions[page.data.roleIndex];
  const key = `invite-create:${target.id}:${target.version}:${page.data.permissionRole}:${role?.id ?? ''}`;
  updatePanel(page, { managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const response = await page._inviteVisitorWriteClient.createInviteLink(groupId, {
      expectedScheduleRoleVersion: role?.version,
      expectedTargetVersion: target.version,
      operationId: resolveOperationId(page, key),
      permissionRole: page.data.permissionRole,
      scheduleRoleId: role?.id,
      ...(target.kind === 'roster'
        ? { targetRosterEntryId: target.id }
        : { targetMembershipId: target.id }),
    });
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    page._operationIds.delete(key);
    page._inviteToken = response.token;
    page._inviteVersion = response.version;
    page._inviteExpiresAtMs = Date.parse(response.expiresAt) || 0;
    updatePanel(page, {
      inviteEditorOpen: false,
      inviteSharePath: response.sharePath,
      inviteGroupName: response.groupName,
      inviteRealName: response.realName,
      inviteRoleLabel: response.scheduleRoleName ?? '未指定岗位',
      inviteExpiresAt: formatDate(response.expiresAt),
      managementInfo: '邀请已生成，请在本页完成转发。',
      managementState: 'ready',
    });
  } catch (error) {
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    updatePanel(page, {
      managementError: `${toUserMessage(error, '邀请没有生成，请稍后重试。')} 可保持当前选择重试。`,
      managementState: 'error',
    });
  }
}

async function revokeInvite(page: InviteVisitorPageInstance): Promise<void> {
  const groupId = page._groupId;
  const generation = page._inviteGeneration;
  if (!(await ensureOrganization(page, () => isCurrentInvitePage(page, groupId, generation))))
    return;
  if (page._inviteToken === '' || page._inviteVersion < 1) return;
  if (!(await showConfirm('撤销当前邀请吗？撤销后该邀请链接立即失效。'))) return;
  if (!isCurrentInvitePage(page, groupId, generation)) return;
  const key = `invite-revoke:${page._inviteToken}:${page._inviteVersion}`;
  updatePanel(page, { managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await page._inviteVisitorWriteClient.revokeInvite(page._groupId, page._inviteToken, {
      expectedVersion: page._inviteVersion,
      operationId: resolveOperationId(page, key),
    });
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    page._operationIds.delete(key);
    page._inviteToken = '';
    page._inviteVersion = 0;
    page._inviteExpiresAtMs = 0;
    updatePanel(page, {
      inviteSharePath: '',
      inviteGroupName: '',
      inviteRealName: '',
      managementInfo: '当前邀请已撤销。',
      managementState: 'ready',
    });
  } catch (error) {
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    updatePanel(page, {
      managementError: `${toUserMessage(error, '邀请没有撤销，请稍后重试。')} 可保持当前邀请重试。`,
      managementState: 'error',
    });
  }
}

function isCurrentInvitePage(
  page: InviteVisitorPageInstance,
  groupId: string,
  generation: number,
): boolean {
  return !page._disposed && page._groupId === groupId && page._inviteGeneration === generation;
}

function invalidateQr(page: InviteVisitorPageInstance): void {
  page._qrGeneration = (page._qrGeneration ?? 0) + 1;
  delete page._qrReading;
  delete page._qrRotating;
  updatePanel(page, {
    qrImageSrc: '',
    qrVisible: false,
    albumPermissionDenied: false,
    visitorState: 'idle',
  });
}

function qrContext(page: InviteVisitorPageInstance): () => boolean {
  const groupId = page._groupId;
  const generation = page._inviteGeneration;
  const qrGeneration = page._qrGeneration;
  return () =>
    isCurrentInvitePage(page, groupId, generation) && page._qrGeneration === qrGeneration;
}

async function regenerateVisitorKey(page: InviteVisitorPageInstance): Promise<void> {
  if (page._disposed || page._qrRotating || !page.data.canManageVisitorKey) return;
  invalidateQr(page);
  const task = {};
  page._qrRotating = task;
  const isCurrent = qrContext(page);
  const group = page._group;
  const groupId = page._groupId;
  updatePanel(page, {
    visitorState: 'loading',
    visitorMessage: '',
    managementInfo: '',
    managementError: '',
  });
  try {
    if (
      !(await ensureGuest(page, isCurrent)) ||
      !(await ensureOrganization(page, isCurrent)) ||
      !isCurrent() ||
      !group
    )
      return;
    const key = `visitor-key:${group.id}:${group.version}`;
    await page._inviteVisitorWriteClient.regenerateVisitorKey(groupId, {
      expectedVersion: group.version,
      operationId: resolveOperationId(page, key),
    });
    if (!isCurrent()) return;
    page._operationIds.delete(key);
    updatePanel(page, { visitorState: 'ready', visitorMessage: '访客码已轮换，旧入口立即失效。' });
  } catch (error) {
    if (!isCurrent()) return;
    updatePanel(page, {
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '访客码没有轮换，请稍后重试。'),
    });
  } finally {
    if (page._qrRotating === task) {
      delete page._qrRotating;
      if (isCurrent() && page.data.visitorState === 'loading')
        updatePanel(page, { visitorState: 'idle' });
    }
  }
}

async function loadQr(page: InviteVisitorPageInstance): Promise<void> {
  if (page._disposed || page._qrRotating || page._qrReading || page.data.state !== 'ready') return;
  invalidateQr(page);
  const task = {};
  page._qrReading = task;
  const isCurrent = qrContext(page);
  const groupId = page._groupId;
  updatePanel(page, {
    visitorState: 'loading',
    visitorMessage: '',
    managementError: '',
    managementInfo: '',
  });
  try {
    if (
      !(await ensureGuest(page, isCurrent)) ||
      !(await ensureOrganization(page, isCurrent)) ||
      !isCurrent()
    )
      return;
    const response = await page._organizationReadClient.getGroupQr(groupId);
    if (!isCurrent()) return;
    const image = parseVisitorQrImage(response.imageBase64);
    if (!image) throw new Error('二维码图片无效，请重新读取。');
    updatePanel(page, {
      qrImageSrc: image.imageSrc,
      qrVisible: true,
      visitorState: 'ready',
      visitorMessage: '二维码已读取，可点击保存到相册。',
    });
  } catch (error) {
    if (!isCurrent()) return;
    updatePanel(page, {
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '群组二维码暂时无法加载，请稍后重试。'),
    });
  } finally {
    if (page._qrReading === task) {
      delete page._qrReading;
      if (isCurrent() && page.data.visitorState === 'loading')
        updatePanel(page, { visitorState: 'idle' });
    }
  }
}

async function saveQr(page: InviteVisitorPageInstance): Promise<void> {
  if (
    page._disposed ||
    page._qrSaveTask ||
    !page.data.qrVisible ||
    !page.data.qrImageSrc ||
    !page.data.canManage ||
    !page.data.organizationEnabled ||
    !page.data.guestEnabled ||
    page.data.visitorState === 'loading'
  )
    return;
  const task = {};
  page._qrSaveTask = task;
  const isCurrent = qrContext(page);
  const imageSrc = page.data.qrImageSrc;
  updatePanel(page, {
    qrSaving: true,
    managementError: '',
    managementInfo: '',
    visitorMessage: '',
  });
  try {
    if (
      !(await ensureGuest(page, isCurrent)) ||
      !(await ensureOrganization(page, isCurrent)) ||
      !isCurrent()
    )
      return;
    const result = await saveVisitorQrImage(
      imageSrc,
      () =>
        isCurrent() &&
        page.data.canManage &&
        page.data.organizationEnabled &&
        page.data.guestEnabled &&
        page.data.qrVisible &&
        page.data.qrImageSrc === imageSrc,
    );
    if (!isCurrent() || result === 'stale') return;
    if (result === 'saved' || result === 'saved-cleanup-failed' || result === 'cancelled') {
      updatePanel(page, {
        albumPermissionDenied: false,
        infoTone: result === 'cancelled' ? 'info' : 'success',
        managementInfo:
          result === 'saved-cleanup-failed'
            ? '二维码已保存到相册，但临时文件清理失败，请联系管理员。'
            : result === 'saved'
              ? '二维码已保存到相册。'
              : '已取消保存二维码。',
      });
    } else {
      const message =
        result === 'privacy-denied'
          ? '微信隐私检查未通过，二维码未保存。请前往测试工具复制简化报告。'
          : result === 'permission-denied'
            ? '未获相册权限，请点击相册设置后重新保存。'
            : result === 'write-failed'
              ? '二维码临时文件写入失败，请稍后重试。'
              : result === 'invalid-image'
                ? '二维码图片无效，请重新读取。'
                : '二维码未保存，请前往测试工具复制简化报告。';
      updatePanel(page, {
        albumPermissionDenied: result === 'permission-denied',
        managementError: message,
      });
    }
  } finally {
    // Keep the lock across group changes until native completion and unlink have settled.
    if (page._qrSaveTask === task) {
      delete page._qrSaveTask;
      if (!page._disposed) updatePanel(page, { qrSaving: false });
    }
  }
}

async function ensureOrganization(
  page: InviteVisitorPageInstance,
  isCurrent = () => !page._disposed,
): Promise<boolean> {
  try {
    await requireClientCapability('organization');
    return isCurrent() && page.data.canManage;
  } catch (error) {
    if (isCurrent())
      updatePanel(page, {
        managementError: error instanceof Error ? error.message : '组织管理能力暂未开放。',
        managementState: 'error',
      });
    return false;
  }
}

async function ensureGuest(
  page: InviteVisitorPageInstance,
  isCurrent: () => boolean,
): Promise<boolean> {
  try {
    await requireClientCapability('guest');
    return isCurrent() && page.data.guestEnabled;
  } catch (error) {
    if (isCurrent())
      updatePanel(page, {
        visitorState: 'error',
        visitorMessage: error instanceof Error ? error.message : '访客入口能力暂未开放。',
      });
    return false;
  }
}

/** Preserve operation state fields while presenting all action feedback in one host-owned toast. */
function updatePanel(page: InviteVisitorPageInstance, patch: Partial<InviteVisitorPageData>): void {
  if (page._disposed) return;
  const message = patch.managementError || patch.visitorMessage || patch.managementInfo;
  const hasFeedback =
    patch.managementError !== undefined ||
    patch.visitorMessage !== undefined ||
    patch.managementInfo !== undefined;
  if (!hasFeedback) {
    page.setData(patch);
    return;
  }
  clearInfoMessageTimer(page);
  const infoMessage = patch.state === 'error' || patch.state === 'loading' ? '' : (message ?? '');
  const infoTone =
    patch.infoTone ??
    (patch.managementError || patch.visitorState === 'error' ? 'error' : 'success');
  page.setData({ ...patch, infoMessage, infoTone });
  if (infoMessage) {
    const groupId = page._groupId;
    const generation = page._inviteGeneration;
    scheduleInfoMessageExpiry(page, infoMessage, () =>
      isCurrentInvitePage(page, groupId, generation),
    );
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
