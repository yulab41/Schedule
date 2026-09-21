import {
  ClientCoreError,
  type InviteVisitorWriteClient,
  type OrganizationReadClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { GroupMember, GroupSummary } from '@schedule/contracts';
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
import { parseVisitorQrImage } from '../../../../platform/visitor-qr-image.js';
import { composeVisitorQrCard } from '../../../../platform/visitor-qr-card.js';
import { composeMemberBindingQrCard } from '../../../../platform/member-binding-qr-card.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { resolveCurrentQrEnvironment } from '../../../../platform/runtime-environment.js';

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

interface InviteVisitorPageData {
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly infoTone: 'success' | 'info' | 'error';
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
  readonly bindingQrImageSrc: string;
  readonly bindingQrVisible: boolean;
  readonly bindingQrExpiresAt: string;
  readonly bindingQrSummary: string;
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
  _inviteGeneration: number;
  _disposed: boolean;
  _qrGeneration: number;
  _qrReading?: object;
  _qrRotating?: object;
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
      targetLabel: '请选择绑定对象',
      bindingQrImageSrc: '',
      bindingQrVisible: false,
      bindingQrExpiresAt: '',
      bindingQrSummary: '',
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
        this._operationIds?.clear();
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

    handleCreateBindingQr(this: InviteVisitorPageInstance): void {
      void createBindingQr(this);
    },

    handleLoadQr(this: InviteVisitorPageInstance): void {
      void loadQr(this);
    },

    handleRegenerateVisitorKey(this: InviteVisitorPageInstance): void {
      void regenerateVisitorKey(this);
    },

    handlePreviewQr(
      this: InviteVisitorPageInstance,
      event?: { readonly currentTarget: { readonly dataset: { readonly src?: string } } },
    ): void {
      previewQr(this, event?.currentTarget.dataset.src ?? this.data.qrImageSrc);
    },
    handleHideQr(this: InviteVisitorPageInstance): void {
      invalidateQr(this);
    },
    handleHideBindingQr(this: InviteVisitorPageInstance): void {
      this.setData({ bindingQrVisible: false });
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
  page._group = undefined;
  page._members = [];
  page._operationIds.clear();
  updatePanel(page, {
    bindingQrImageSrc: '',
    bindingQrVisible: false,
    bindingQrExpiresAt: '',
    bindingQrSummary: '',
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
    if (group.role === 'guest') throw new Error('访客不能管理二维码入口。');
    const members = await page._organizationReadClient.listGroupMembers(group.id);
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    page._group = group;
    page._members = members;
    const capabilities = getClientCapabilitySnapshot();
    const targets = createTargetViews(members);
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
          ? '暂无可绑定成员'
          : `${targets[0].name} · ${targets[0].statusLabel}`,
    });
  } catch (error) {
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    updatePanel(page, {
      state: 'error',
      managementState: 'error',
      errorMessage: toUserMessage(error, '二维码与访客入口暂时无法加载，请稍后重试。'),
      managementError: toUserMessage(error, '二维码与访客入口暂时无法加载，请稍后重试。'),
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

async function createBindingQr(page: InviteVisitorPageInstance): Promise<void> {
  const groupId = page._groupId;
  const generation = page._inviteGeneration;
  if (!(await ensureOrganization(page, () => isCurrentInvitePage(page, groupId, generation))))
    return;
  if (!isCurrentInvitePage(page, groupId, generation) || page.data.managementState === 'loading')
    return;
  const target = page.data.targets[page.data.targetIndex];
  if (target === undefined || target.kind !== 'membership') {
    updatePanel(page, {
      managementError: '待认领名单尚无账号，请选择已创建账号的群成员。',
      managementState: 'error',
    });
    return;
  }
  const environment = resolveCurrentQrEnvironment();
  const key = `member-binding-qr:${target.id}:${target.version}:${environment ?? 'unknown'}`;
  updatePanel(page, {
    bindingQrImageSrc: '',
    bindingQrVisible: false,
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
  });
  try {
    if (environment === undefined) throw new Error('无法识别当前小程序版本，请重新进入后再试。');
    const response = await page._inviteVisitorWriteClient.createCurrentMemberWechatBindingQr(
      groupId,
      target.id,
      {
        environment,
        expectedMembershipVersion: target.version,
        operationId: resolveOperationId(page, key),
      },
    );
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    const image = parseVisitorQrImage(response.imageBase64);
    if (image === undefined) throw new Error('微信绑定二维码资料无效。');
    const details = {
      ...(response.employeeCode === undefined ? {} : { employeeCode: response.employeeCode }),
      expiresAt: response.expiresAt,
      groupName: response.groupName,
      realName: response.realName,
    };
    const card = await composeMemberBindingQrCard(image.imageSrc, details);
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    page._operationIds.delete(key);
    updatePanel(page, {
      bindingQrExpiresAt: formatDate(response.expiresAt),
      bindingQrImageSrc: card,
      bindingQrSummary: `${response.groupName} · ${response.realName} · 工号 ${response.employeeCode ?? '未设置'}`,
      bindingQrVisible: true,
      managementInfo: '一次性微信绑定二维码已生成。',
      managementState: 'ready',
    });
  } catch (error) {
    if (!isCurrentInvitePage(page, groupId, generation)) return;
    updatePanel(page, {
      managementError: toUserMessage(error, '绑定二维码没有生成，请稍后重试。'),
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
  let shouldLoadNewQr = false;
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
    shouldLoadNewQr = true;
    updatePanel(page, { visitorState: 'ready', visitorMessage: '访客码已刷新，旧入口立即失效。' });
  } catch (error) {
    if (!isCurrent()) return;
    updatePanel(page, {
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '访客码没有刷新，请稍后重试。'),
    });
  } finally {
    if (page._qrRotating === task) {
      delete page._qrRotating;
      if (shouldLoadNewQr && isCurrent()) {
        // Release the rotation lock before starting the read; loadQr uses the
        // new QR generation to invalidate every pre-rotation read result.
        void loadQr(page);
      } else if (isCurrent() && page.data.visitorState === 'loading')
        updatePanel(page, { visitorState: 'idle' });
    }
  }
}

function previewQr(page: InviteVisitorPageInstance, source?: string): void {
  if (page._disposed || !page.data.qrVisible || !source) return;
  const imageSrc = source;
  const isCurrent = qrContext(page);
  const previewImage = (
    wx as unknown as {
      previewImage?: (options: {
        current: string;
        urls: readonly string[];
        fail?: () => void;
      }) => void;
    }
  ).previewImage;
  const fallback = (): void => {
    if (isCurrent())
      updatePanel(page, {
        managementError: '二维码预览暂不可用，请长按二维码保存或转发。',
      });
  };
  if (typeof previewImage !== 'function') {
    fallback();
    return;
  }
  try {
    previewImage({ current: imageSrc, urls: [imageSrc], fail: fallback });
  } catch {
    fallback();
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
    const environment = resolveCurrentQrEnvironment();
    if (environment === undefined) throw new Error('无法识别当前小程序版本，请重新进入后再试。');
    const response = await page._organizationReadClient.getVisitorQr(groupId, environment);
    if (!isCurrent()) return;
    const image = parseVisitorQrImage(response.imageBase64);
    if (!image) throw new Error('二维码图片无效，请重新读取。');
    const card = await composeVisitorQrCard(image.imageSrc, page.data.currentGroupName);
    if (!isCurrent()) return;
    updatePanel(page, {
      qrImageSrc: card,
      qrVisible: true,
      visitorState: 'ready',
      visitorMessage: '二维码已读取，可长按二维码保存或转发。',
    });
  } catch (error) {
    if (!isCurrent()) return;
    updatePanel(page, {
      visitorState: 'error',
      visitorMessage: toUserMessage(error, '访客二维码暂时无法加载，请稍后重试。'),
    });
  } finally {
    if (page._qrReading === task) {
      delete page._qrReading;
      if (isCurrent() && page.data.visitorState === 'loading')
        updatePanel(page, { visitorState: 'idle' });
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

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
