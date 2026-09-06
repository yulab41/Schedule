import type {
  MyProfileCalendarLike,
  MyProfileContactLike,
  MyProfileDutyAssignmentLike,
  MyProfileMemberLike,
  MyProfileMonthStatisticsLike,
  MyProfileYearStatisticsLike,
} from '@schedule/presentation-core';
import {
  addBusinessMonths,
  buildMyProfileOverview,
  emptyMyProfileOverview,
} from '@schedule/presentation-core';

import { buildInfo } from '../../platform/build-info.js';
import {
  createRuntimeCalendarReadClient,
  createRuntimeInsightsReadClient,
  createRuntimeOrganizationReadClient,
} from '../../platform/client-core-calendar.js';
import {
  clearWechatSession,
  getStoredWechatAuthMethod,
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
  getIdentityErrorMessage,
  unbindWechatIdentity,
  type IdentityAuthMethod,
  type WechatAuthenticatedProfile,
} from '../../platform/wechat-identity.js';
import {
  createProfileAccountClient,
  type MiniProgramBindingStatus,
  type MiniProgramPasswordStatus,
  type ProfilePasswordChangeInput,
} from '../../platform/profile-account.js';
import {
  readStoredWorkbenchGroupId,
  readWorkbenchGroupSnapshot,
} from '../../platform/workbench-read.js';
import {
  isDefaultPasswordReminderDismissed,
  persistDefaultPasswordReminderDismissal,
} from '../../platform/password-reminder-storage.js';
import { formatDateLabel, getTodayBusinessDate } from '../../features/workbench/workbench-model.js';

type ProfileMode = 'missing' | 'ready';
type OverviewState = 'error' | 'idle' | 'loading' | 'ready';
type BindingState = 'error' | 'loading' | 'ready';

export interface ProfileGroupInput {
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
  readonly name: string;
  readonly role: 'administrator' | 'guest' | 'member' | 'owner';
}

interface ProfileTrendColumn {
  readonly count: number;
  readonly current: boolean;
  readonly heightStyle: string;
  readonly label: string;
}

interface ProfilePanelData {
  readonly authMethod: IdentityAuthMethod;
  readonly authMethodLabel: string;
  readonly bindingLabel: string;
  readonly bindingState: BindingState;
  readonly buildLabel: string;
  readonly canUnbindWechat: boolean;
  readonly defaultPasswordReminderOpen: boolean;
  readonly currentPassword: string;
  readonly embedded: boolean;
  readonly groupId: string;
  readonly groupIsDeveloperAdmin: boolean;
  readonly groupName: string;
  readonly groupRole: ProfileGroupInput['role'];
  readonly initial: string;
  readonly largeText: boolean;
  readonly mobilePhone: string;
  readonly mode: ProfileMode;
  readonly monthCountLabel: string;
  readonly monthDeltaLabel: string;
  readonly newPassword: string;
  readonly nextDutyDateLabel: string;
  readonly nextDutyEmpty: boolean;
  readonly nextDutyRoleLabel: string;
  readonly nextDutyShiftLabel: string;
  readonly nextDutyTimeLabel: string;
  readonly overviewError: string;
  readonly overviewState: OverviewState;
  readonly overviewYearLabel: string;
  readonly passwordConfirm: string;
  readonly passwordError: string;
  readonly passwordSaving: boolean;
  readonly passwordSheetOpen: boolean;
  readonly unbindSaving: boolean;
  readonly realName: string;
  readonly roleLabel: string;
  readonly shortPhone: string;
  readonly showDutyOverview: boolean;
  readonly specialDateCountLabel: string;
  readonly trend: readonly ProfileTrendColumn[];
  readonly yearCountLabel: string;
}

interface ProfilePanelInstance {
  accountRequestSerial: number;
  data: ProfilePanelData;
  overviewRequestSerial: number;
  _passwordReminderSuppressed?: boolean;
  setData(patch: Partial<ProfilePanelData>): void;
  triggerEvent?(name: string): void;
}

interface InputEvent {
  readonly detail: { readonly value: string };
}

export interface ProfilePanelDependencies {
  readonly changePassword: (
    input: ProfilePasswordChangeInput,
  ) => Promise<{ readonly passwordChanged: true }>;
  readonly finishSensitiveSessionChange: () => void;
  readonly getAuthMethod: () => IdentityAuthMethod | undefined;
  readonly getBusinessDate: () => string;
  readonly getBusinessMonth: () => string;
  readonly getCalendar: (
    groupId: string,
    businessMonth: string,
  ) => Promise<MyProfileCalendarLike<MyProfileDutyAssignmentLike>>;
  readonly getMonthStatistics: (
    groupId: string,
    businessMonth: string,
  ) => Promise<MyProfileMonthStatisticsLike>;
  readonly getProfile: () => WechatAuthenticatedProfile | undefined;
  readonly getWechatBinding: () => Promise<MiniProgramBindingStatus>;
  readonly getPasswordStatus: () => Promise<MiniProgramPasswordStatus>;
  readonly getYearStatistics: (
    groupId: string,
    year: number,
  ) => Promise<MyProfileYearStatisticsLike>;
  readonly listGroupContacts: (groupId: string) => Promise<readonly MyProfileContactLike[]>;
  readonly listGroupMembers: (groupId: string) => Promise<readonly MyProfileMemberLike[]>;
  readonly listGroups: () => Promise<readonly ProfileGroupInput[]>;
  readonly navigateTo: (url: string) => void;
  readonly now: () => string;
  readonly signOut: () => void;
  readonly unbindWechat: (idempotencyKey: string) => Promise<{ readonly unbound: true }>;
}

export function createProfilePanelControllerDefinition(
  embedded = false,
  dependencyOverrides?: ProfilePanelDependencies,
) {
  const dependencies = dependencyOverrides ?? createRuntimeDependencies();
  return {
    data: {
      authMethod: 'wechat' as IdentityAuthMethod,
      authMethodLabel: '微信快捷登录',
      bindingLabel: '正在读取',
      bindingState: 'loading' as BindingState,
      buildLabel: buildInfo.buildLabel,
      canUnbindWechat: false,
      defaultPasswordReminderOpen: false,
      currentPassword: '',
      embedded,
      groupId: '',
      groupIsDeveloperAdmin: false,
      groupName: '未加入排班群组',
      groupRole: 'member' as ProfileGroupInput['role'],
      initial: '我',
      largeText: false,
      mobilePhone: '',
      mode: 'missing' as ProfileMode,
      monthCountLabel: '—',
      monthDeltaLabel: '暂无上月对比',
      newPassword: '',
      nextDutyDateLabel: '暂无待值班次',
      nextDutyEmpty: true,
      nextDutyRoleLabel: '',
      nextDutyShiftLabel: '',
      nextDutyTimeLabel: '',
      overviewError: '',
      overviewState: 'idle' as OverviewState,
      overviewYearLabel: `${new Date().getUTCFullYear()} 年个人值班`,
      passwordConfirm: '',
      passwordError: '',
      passwordSaving: false,
      passwordSheetOpen: false,
      realName: '当前账号',
      roleLabel: '未加入群组',
      shortPhone: '',
      showDutyOverview: false,
      specialDateCountLabel: '—',
      trend: [] as readonly ProfileTrendColumn[],
      unbindSaving: false,
      yearCountLabel: '—',
    } satisfies ProfilePanelData,

    onLoad(this: ProfilePanelInstance): void {
      this.accountRequestSerial = 0;
      this.overviewRequestSerial = 0;
      this._passwordReminderSuppressed = false;
      const windowInfo = wx.getWindowInfo();
      const fontSizeSetting = (windowInfo as unknown as { readonly fontSizeSetting?: number })
        .fontSizeSetting;
      this.setData({ largeText: (fontSizeSetting ?? 16) >= 20 });
      syncProfile(this, dependencies);
      void refreshAccount(this, dependencies);
      if (!embedded) void resolveStandaloneGroup(this, dependencies);
    },

    onShow(this: ProfilePanelInstance): void {
      syncProfile(this, dependencies);
      void refreshAccount(this, dependencies);
    },

    handleGroupChange(this: ProfilePanelInstance, group: ProfileGroupInput | undefined): void {
      applyGroup(this, dependencies, group);
    },

    handleOverviewRetry(this: ProfilePanelInstance): void {
      const group = currentGroup(this);
      if (group !== undefined) void loadOverview(this, dependencies, group);
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleOpenStatistics(this: ProfilePanelInstance): void {
      if (this.data.groupId === '') return;
      if (this.data.embedded) this.triggerEvent?.('openstatistics');
      else
        dependencies.navigateTo(
          `/subpackages/insights/pages/insights/index?groupId=${encodeURIComponent(this.data.groupId)}`,
        );
    },

    handleOpenCalendar(this: ProfilePanelInstance): void {
      if (this.data.embedded) this.triggerEvent?.('opencalendar');
      else dependencies.navigateTo('/pages/workbench/index');
    },

    handleUnbind(this: ProfilePanelInstance): void {
      if (!this.data.canUnbindWechat || this.data.unbindSaving) return;
      try {
        wx.showModal({
          cancelText: '取消',
          confirmText: '解除绑定',
          content: '只移除当前小程序身份，不删除 Web 账号或排班资料。解绑后可重新绑定。',
          title: '解除微信绑定',
          success: (result) => {
            if (result.confirm) void unbindWechat(this, dependencies);
          },
          fail: () => {
            wx.showToast?.({ icon: 'none', title: '弹窗未能打开，请重试。' });
          },
        });
      } catch {
        wx.showToast?.({ icon: 'none', title: '弹窗未能打开，请重试。' });
      }
    },

    handleDefaultPasswordReminderClose(this: ProfilePanelInstance): void {
      if (!this.data.passwordSaving) {
        this._passwordReminderSuppressed = true;
        this.setData({ defaultPasswordReminderOpen: false });
      }
    },

    handleDefaultPasswordReminderDismiss(this: ProfilePanelInstance): void {
      const profile = dependencies.getProfile();
      this._passwordReminderSuppressed = true;
      if (profile !== undefined) persistDefaultPasswordReminderDismissal(profile.id);
      this.setData({ defaultPasswordReminderOpen: false });
    },

    handleDefaultPasswordReminderEdit(this: ProfilePanelInstance): void {
      this._passwordReminderSuppressed = true;
      this.setData({ defaultPasswordReminderOpen: false });
      this.setData({
        currentPassword: '',
        newPassword: '',
        passwordConfirm: '',
        passwordError: '',
        passwordSheetOpen: true,
      });
    },

    handleConfirmDialogTap(): void {
      // Keep taps inside the dialog from closing it through the backdrop handler.
    },

    handleBindingRetry(this: ProfilePanelInstance): void {
      if (this.data.bindingState !== 'loading') void refreshAccount(this, dependencies);
    },

    handlePasswordOpen(this: ProfilePanelInstance): void {
      this.setData({
        currentPassword: '',
        newPassword: '',
        passwordConfirm: '',
        passwordError: '',
        passwordSheetOpen: true,
      });
    },

    handlePasswordClose(this: ProfilePanelInstance): void {
      if (this.data.passwordSaving) return;
      this.setData({
        currentPassword: '',
        newPassword: '',
        passwordConfirm: '',
        passwordError: '',
        passwordSheetOpen: false,
      });
    },

    handleCurrentPasswordInput(this: ProfilePanelInstance, event: InputEvent): void {
      this.setData({ currentPassword: event.detail.value, passwordError: '' });
    },

    handleNewPasswordInput(this: ProfilePanelInstance, event: InputEvent): void {
      this.setData({ newPassword: event.detail.value, passwordError: '' });
    },

    handlePasswordConfirmInput(this: ProfilePanelInstance, event: InputEvent): void {
      this.setData({ passwordConfirm: event.detail.value, passwordError: '' });
    },

    handlePasswordSubmit(this: ProfilePanelInstance): void {
      if (this.data.passwordSaving) return;
      const currentPassword = this.data.currentPassword;
      const newPassword = this.data.newPassword;
      if (
        newPassword.length === 0 ||
        this.data.passwordConfirm.length === 0 ||
        newPassword !== this.data.passwordConfirm
      ) {
        this.setData({ passwordError: '请确认两次输入的新密码一致。' });
        return;
      }
      if (this.data.authMethod === 'password' && currentPassword.length === 0) {
        this.setData({ passwordError: '请输入当前密码。' });
        return;
      }
      if (this.data.authMethod === 'password' && currentPassword === newPassword) {
        this.setData({ passwordError: '新密码不能与当前密码相同。' });
        return;
      }
      const input: ProfilePasswordChangeInput =
        this.data.authMethod === 'password'
          ? { authMethod: 'password', currentPassword, newPassword }
          : { authMethod: 'wechat', newPassword };
      this.setData({ passwordError: '', passwordSaving: true });
      void dependencies
        .changePassword(input)
        .then(() => {
          this.setData({ defaultPasswordReminderOpen: false, passwordSheetOpen: false });
          dependencies.finishSensitiveSessionChange();
        })
        .catch((error: unknown) =>
          this.setData({
            passwordError: error instanceof Error ? error.message : '密码没有修改，请稍后重试。',
          }),
        )
        .finally(() => this.setData({ passwordSaving: false }));
    },

    handleSwitchLogin(this: ProfilePanelInstance): void {
      this.accountRequestSerial += 1;
      this.overviewRequestSerial += 1;
      dependencies.signOut();
      this.setData({ mode: 'missing' });
    },

    handleSignOut(this: ProfilePanelInstance): void {
      this.accountRequestSerial += 1;
      this.overviewRequestSerial += 1;
      dependencies.signOut();
      this.setData({ mode: 'missing' });
    },
  };
}

export function createProfileWorkspaceControllerDefinition(
  dependencyOverrides?: ProfilePanelDependencies,
) {
  return createProfilePanelControllerDefinition(true, dependencyOverrides);
}

function syncProfile(panel: ProfilePanelInstance, dependencies: ProfilePanelDependencies): void {
  const profile = dependencies.getProfile();
  if (profile === undefined) {
    panel.setData({
      bindingLabel: '未登录',
      bindingState: 'error',
      canUnbindWechat: false,
      initial: '我',
      mode: 'missing',
      realName: '当前账号',
    });
    return;
  }
  const realName = profile.realName.trim() || '未完善资料';
  const authMethod = dependencies.getAuthMethod() ?? 'wechat';
  panel.setData({
    authMethod,
    authMethodLabel: authMethod === 'password' ? '账号密码登录' : '微信快捷登录',
    initial: [...realName][0] ?? '我',
    mode: 'ready',
    realName,
  });
}

async function refreshAccount(
  panel: ProfilePanelInstance,
  dependencies: ProfilePanelDependencies,
): Promise<void> {
  const profile = dependencies.getProfile();
  if (profile === undefined) return;
  const requestSerial = ++panel.accountRequestSerial;
  panel.setData({ bindingState: 'loading', bindingLabel: '正在读取', canUnbindWechat: false });
  const [binding, passwordStatus] = await Promise.allSettled([
    dependencies.getWechatBinding(),
    dependencies.getPasswordStatus(),
  ]);
  if (requestSerial !== panel.accountRequestSerial || dependencies.getProfile()?.id !== profile.id)
    return;
  panel.setData({
    bindingLabel:
      binding.status === 'fulfilled' ? (binding.value.bound ? '已绑定' : '未绑定') : '暂时无法读取',
    bindingState: binding.status === 'fulfilled' ? 'ready' : 'error',
    canUnbindWechat: binding.status === 'fulfilled' && binding.value.canUnbind,
    defaultPasswordReminderOpen:
      passwordStatus.status === 'fulfilled' &&
      passwordStatus.value.mustChangePassword &&
      !isDefaultPasswordReminderDismissed(profile.id) &&
      panel._passwordReminderSuppressed !== true,
  });
}

async function unbindWechat(
  panel: ProfilePanelInstance,
  dependencies: ProfilePanelDependencies,
): Promise<void> {
  panel.setData({ unbindSaving: true });
  try {
    await dependencies.unbindWechat(createIdempotencyKey());
    dependencies.finishSensitiveSessionChange();
  } catch (error) {
    panel.setData({ unbindSaving: false });
    wx.showToast?.({ icon: 'none', title: getIdentityErrorMessage(error) });
  }
}

async function resolveStandaloneGroup(
  panel: ProfilePanelInstance,
  dependencies: ProfilePanelDependencies,
): Promise<void> {
  const profile = dependencies.getProfile();
  if (profile === undefined) return;
  const selectedId = readStoredWorkbenchGroupId(profile.id);
  const snapshot = readWorkbenchGroupSnapshot(profile.id) as
    readonly ProfileGroupInput[] | undefined;
  let groups = snapshot;
  if (groups === undefined) {
    try {
      groups = await dependencies.listGroups();
    } catch {
      groups = [];
    }
  }
  applyGroup(panel, dependencies, groups.find((group) => group.id === selectedId) ?? groups[0]);
}

function applyGroup(
  panel: ProfilePanelInstance,
  dependencies: ProfilePanelDependencies,
  group: ProfileGroupInput | undefined,
): void {
  panel.overviewRequestSerial += 1;
  if (group === undefined || group.id.length === 0) {
    panel.setData({
      groupId: '',
      groupIsDeveloperAdmin: false,
      groupName: '未加入排班群组',
      groupRole: 'member',
      overviewError: '',
      overviewState: 'idle',
      roleLabel: '未加入群组',
      showDutyOverview: false,
      ...overviewPatch(emptyMyProfileOverview(), '—'),
    });
    return;
  }
  panel.setData({
    groupId: group.id,
    groupIsDeveloperAdmin: group.isDeveloperAdmin,
    groupName: group.name,
    groupRole: group.role,
    roleLabel: formatRole(group),
    showDutyOverview: group.role !== 'guest',
  });
  if (group.role === 'guest') {
    panel.setData({ overviewError: '', overviewState: 'idle' });
    return;
  }
  void loadOverview(panel, dependencies, group);
}

async function loadOverview(
  panel: ProfilePanelInstance,
  dependencies: ProfilePanelDependencies,
  group: ProfileGroupInput,
): Promise<void> {
  const requestSerial = ++panel.overviewRequestSerial;
  const businessMonth = dependencies.getBusinessMonth();
  panel.setData({ overviewError: '', overviewState: 'loading' });
  try {
    const members = await dependencies.listGroupMembers(group.id);
    if (!isCurrentOverviewRequest(panel, requestSerial, group.id)) return;
    const nextBusinessMonth = addBusinessMonths(businessMonth, 1);
    const [contacts, monthStatistics, yearStatistics, currentCalendar, nextCalendar] =
      await Promise.allSettled([
        dependencies.listGroupContacts(group.id),
        dependencies.getMonthStatistics(group.id, businessMonth),
        dependencies.getYearStatistics(group.id, Number(businessMonth.slice(0, 4))),
        dependencies.getCalendar(group.id, businessMonth),
        dependencies.getCalendar(group.id, nextBusinessMonth),
      ]);
    if (!isCurrentOverviewRequest(panel, requestSerial, group.id)) return;
    const overview = buildMyProfileOverview({
      businessDate: dependencies.getBusinessDate(),
      businessMonth,
      calendars: [currentCalendar, nextCalendar].flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      ),
      contacts: contacts.status === 'fulfilled' ? contacts.value : [],
      members,
      ...(monthStatistics.status === 'fulfilled' ? { monthStatistics: monthStatistics.value } : {}),
      now: dependencies.now(),
      ...(yearStatistics.status === 'fulfilled' ? { yearStatistics: yearStatistics.value } : {}),
    });
    const statisticsFailed =
      monthStatistics.status === 'rejected' && yearStatistics.status === 'rejected';
    panel.setData({
      overviewError: statisticsFailed ? '个人统计暂时无法加载，请稍后重试。' : '',
      overviewState: 'ready',
      ...overviewPatch(overview, `${businessMonth.slice(0, 4)} 年个人值班`, group.name),
    });
  } catch {
    if (!isCurrentOverviewRequest(panel, requestSerial, group.id)) return;
    panel.setData({
      overviewError: '个人值班数据暂时无法加载，请稍后重试。',
      overviewState: 'error',
      ...overviewPatch(emptyMyProfileOverview(), `${businessMonth.slice(0, 4)} 年个人值班`),
    });
  }
}

function overviewPatch(
  overview: ReturnType<typeof emptyMyProfileOverview<MyProfileDutyAssignmentLike>>,
  overviewYearLabel: string,
  groupName = '',
): Partial<ProfilePanelData> {
  const maximum = Math.max(1, ...overview.trend.map((point) => point.count));
  const monthDeltaLabel =
    overview.monthDelta === undefined
      ? '暂无上月对比'
      : overview.monthDelta === 0
        ? '与上月持平'
        : `较上月 ${overview.monthDelta > 0 ? '+' : ''}${overview.monthDelta} 次`;
  const nextDuty = overview.nextDuty;
  return {
    mobilePhone: overview.mobilePhone ?? '',
    monthCountLabel: overview.monthCount === undefined ? '—' : String(overview.monthCount),
    monthDeltaLabel,
    nextDutyDateLabel:
      nextDuty === undefined ? '暂无待值班次' : formatDateLabel(nextDuty.businessDate),
    nextDutyEmpty: nextDuty === undefined,
    nextDutyRoleLabel: nextDuty === undefined ? '' : `${nextDuty.scheduleRoleName} · ${groupName}`,
    nextDutyShiftLabel: nextDuty?.shiftTypeName ?? '',
    nextDutyTimeLabel:
      nextDuty === undefined ? '' : formatDutyTime(nextDuty.startsAt, nextDuty.endsAt),
    overviewYearLabel,
    shortPhone: overview.shortPhone ?? '',
    specialDateCountLabel:
      overview.specialDateCount === undefined ? '—' : String(overview.specialDateCount),
    trend: overview.trend.map((point, index) => ({
      count: point.count,
      current: index === overview.trend.length - 1,
      heightStyle: `height:${Math.max(14, Math.round((point.count / maximum) * 100))}%;`,
      label: point.label,
    })),
    yearCountLabel: overview.yearCount === undefined ? '—' : String(overview.yearCount),
  };
}

function currentGroup(panel: ProfilePanelInstance): ProfileGroupInput | undefined {
  if (panel.data.groupId === '') return undefined;
  return {
    id: panel.data.groupId,
    isDeveloperAdmin: panel.data.groupIsDeveloperAdmin,
    name: panel.data.groupName,
    role: panel.data.groupRole,
  };
}

function isCurrentOverviewRequest(
  panel: ProfilePanelInstance,
  requestSerial: number,
  groupId: string,
): boolean {
  return panel.overviewRequestSerial === requestSerial && panel.data.groupId === groupId;
}

function formatRole(group: ProfileGroupInput): string {
  if (group.isDeveloperAdmin) return '平台管理员';
  if (group.role === 'owner') return '群主';
  if (group.role === 'administrator') return '管理员';
  if (group.role === 'guest') return '访客';
  return '成员';
}

function formatDutyTime(startsAt: string, endsAt: string): string {
  return `${formatChinaClock(startsAt)}–${formatChinaClock(endsAt)}`;
}

function formatChinaClock(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '--:--';
  const shifted = new Date(timestamp + 8 * 60 * 60 * 1_000);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

function createRuntimeDependencies(): ProfilePanelDependencies {
  const authentication = getWechatRequestAuthentication();
  const organization = createRuntimeOrganizationReadClient(getStoredWechatToken, authentication);
  const insights = createRuntimeInsightsReadClient(getStoredWechatToken, authentication);
  const calendar = createRuntimeCalendarReadClient(getStoredWechatToken, authentication);
  const account = createProfileAccountClient(getStoredWechatToken, authentication);
  return {
    changePassword: (input) => account.changePassword(input),
    finishSensitiveSessionChange,
    getAuthMethod: getStoredWechatAuthMethod,
    getBusinessDate: getTodayBusinessDate,
    getBusinessMonth: () => getTodayBusinessDate().slice(0, 7),
    getCalendar: (groupId, businessMonth) => calendar.getCalendar(groupId, businessMonth),
    getMonthStatistics: (groupId, businessMonth) =>
      insights.getMonthStatistics(groupId, businessMonth),
    getProfile: getStoredWechatProfile,
    getWechatBinding: () => account.getWechatBinding(),
    getPasswordStatus: () => account.getPasswordStatus(),
    getYearStatistics: (groupId, year) => insights.getYearStatistics(groupId, year),
    listGroupContacts: (groupId) => organization.listGroupContacts(groupId),
    listGroupMembers: (groupId) => organization.listGroupMembers(groupId),
    listGroups: () => organization.listGroups() as Promise<readonly ProfileGroupInput[]>,
    navigateTo: (url) => wx.navigateTo({ url }),
    now: () => new Date().toISOString(),
    signOut: finishSensitiveSessionChange,
    unbindWechat: (idempotencyKey) => unbindWechatIdentity(idempotencyKey),
  };
}

function createIdempotencyKey(): string {
  const seed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const hex = seed
    .replace(/[^a-f0-9]/giu, '')
    .padEnd(32, '0')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function finishSensitiveSessionChange(): void {
  clearWechatSession(true);
  (
    wx as unknown as {
      reLaunch(options: { readonly url: string }): unknown;
    }
  ).reLaunch({ url: '/pages/identity/index' });
}
