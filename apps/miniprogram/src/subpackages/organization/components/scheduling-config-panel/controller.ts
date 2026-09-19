import {
  ClientCoreError,
  type OrganizationReadClient,
  type SchedulingConfigWriteClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { GroupSummary, SchedulingConfig, ShiftType } from '@schedule/contracts';
import {
  createRuntimeOrganizationReadClient,
  createRuntimeSchedulingConfigWriteClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getStoredWechatProfile,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { clearWorkbenchCalendarCache } from '../../../../platform/workbench-read.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { normalizeHex, shiftColorPresentation } from '../shift-color-picker/color.js';

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
  readonly currentTarget?: { readonly dataset?: Record<string, string | undefined> };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface ShiftDraftView {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isBuiltIn: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string;
  readonly textColor: string;
  readonly editing: boolean;
  readonly contrastWarning: boolean;
}

interface RoleMemberView {
  readonly id: string;
  readonly membershipId: string;
  readonly name: string;
  readonly selected: boolean;
}
interface RoleCardView {
  readonly id: string;
  readonly members: readonly RoleMemberView[];
  readonly name: string;
}

interface SchedulingConfigPageData {
  readonly roleEditId: string;
  readonly roleEditName: string;
  readonly roleEditError: string;
  readonly roleEditBusy: boolean;
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
  readonly managementError: string;
  readonly managementInfo: string;
  readonly managementState: 'error' | 'loading' | 'ready';
  readonly organizationEnabled: boolean;
  readonly canManage: boolean;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly shiftDrafts: readonly ShiftDraftView[];
  readonly roleCards: readonly RoleCardView[];
  readonly newShiftEditorOpen: boolean;
  readonly newShiftName: string;
  readonly newShiftAbbreviation: string;
  readonly newShiftColor: string;
  readonly newShiftStartTime: string;
  readonly newShiftEndTime: string;
  readonly newShiftCrossesMidnight: boolean;
  readonly newShiftEnabled: boolean;
  readonly newShiftCountsStatistics: boolean;
  readonly newRoleName: string;
  readonly largeText: boolean;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly viewportClass: string;
}

interface SchedulingConfigPageInstance {
  _roleEditContext?:
    | { groupId: string; ownerId: string; roleId: string; version: number; rulesVersion: number }
    | undefined;
  readonly data: SchedulingConfigPageData;
  readonly properties: { readonly groupId: string };
  _organizationReadClient: OrganizationReadClient;
  _schedulingWriteClient: SchedulingConfigWriteClient;
  _groupId: string;
  _group: GroupSummary | undefined;
  _config: SchedulingConfig | undefined;
  _loadSerial: number;
  _operationIds: Map<string, string>;
  _roleMemberIds: Map<string, string[]>;
  setData(
    patch: Partial<SchedulingConfigPageData> & Record<string, unknown>,
    callback?: () => void,
  ): void;
}

const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const schedulingWriteClient = createRuntimeSchedulingConfigWriteClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createSchedulingConfigPanelControllerDefinition() {
  return {
    data: {
      roleEditId: '',
      roleEditName: '',
      roleEditError: '',
      roleEditBusy: false,
      state: 'loading',
      errorMessage: '',
      managementError: '',
      managementInfo: '',
      managementState: 'loading',
      organizationEnabled: false,
      canManage: false,
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      shiftDrafts: [],
      roleCards: [],
      newShiftEditorOpen: false,
      newShiftName: '',
      newShiftAbbreviation: '',
      newShiftColor: '#1F5AA6',
      newShiftStartTime: '',
      newShiftEndTime: '',
      newShiftCrossesMidnight: false,
      newShiftEnabled: false,
      newShiftCountsStatistics: true,
      newRoleName: '',
      largeText: false,
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      viewportClass: '',
    } satisfies SchedulingConfigPageData,

    _organizationReadClient: organizationReadClient,
    _schedulingWriteClient: schedulingWriteClient,
    _groupId: '',
    _group: undefined,
    _config: undefined,
    _loadSerial: 0,
    _operationIds: new Map<string, string>(),
    _roleMemberIds: new Map<string, string[]>(),

    properties: { groupId: { type: String, value: '' } },

    observers: {
      groupId(this: SchedulingConfigPageInstance): void {
        syncGroupId(this);
      },
    },

    lifetimes: {
      attached(this: SchedulingConfigPageInstance): void {
        recordMiniTelemetryBoundary('scheduling-config:controller-attached');
        applyPanelLayout(this);
        syncGroupId(this);
      },
      detached(this: SchedulingConfigPageInstance): void {
        this._roleEditContext = undefined;
        this._loadSerial += 1;
      },
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleRetry(this: SchedulingConfigPageInstance): void {
      void loadConfig(this);
    },

    handleNewShiftToggle(this: SchedulingConfigPageInstance): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      this.setData({ newShiftEditorOpen: !this.data.newShiftEditorOpen, managementError: '' });
    },

    handleNewShiftInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const field = event.currentTarget?.dataset?.field;
      if (field === undefined) return;
      setDataField(this, field, readString(event));
    },

    handleNewShiftToggleField(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const field = event.currentTarget.dataset.field;
      if (field === 'crossesMidnight') {
        this.setData({ newShiftCrossesMidnight: !this.data.newShiftCrossesMidnight });
      } else if (field === 'enabled') {
        this.setData({ newShiftEnabled: !this.data.newShiftEnabled });
      } else if (field === 'countsStatistics') {
        this.setData({ newShiftCountsStatistics: !this.data.newShiftCountsStatistics });
      }
    },

    handleCreateShift(this: SchedulingConfigPageInstance): void {
      void createShift(this);
    },

    handleShiftToggleEditor(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const shiftId = event.currentTarget.dataset.shiftId;
      if (shiftId === undefined) return;
      this.setData({
        shiftDrafts: this.data.shiftDrafts.map((shift) =>
          shift.id === shiftId
            ? { ...shift, editing: !shift.editing }
            : { ...shift, editing: false },
        ),
      });
    },

    handleShiftInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const shiftId = event.currentTarget?.dataset?.shiftId;
      const field = event.currentTarget?.dataset?.field;
      if (shiftId === undefined || field === undefined) return;
      if (field === 'color') {
        updateShiftColor(this, shiftId, readString(event));
        return;
      }
      this.setData({
        shiftDrafts: this.data.shiftDrafts.map((shift) =>
          shift.id === shiftId
            ? ({ ...shift, [field]: readString(event) } as ShiftDraftView)
            : shift,
        ),
      });
    },

    handleShiftColorInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const shiftId = event.currentTarget?.dataset?.shiftId;
      if (shiftId === undefined) return;
      updateShiftColor(this, shiftId, readString(event));
    },

    handleShiftToggleField(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const shiftId = event.currentTarget.dataset.shiftId;
      const field = event.currentTarget.dataset.field;
      if (shiftId === undefined || field === undefined) return;
      this.setData({
        shiftDrafts: this.data.shiftDrafts.map((shift) =>
          shift.id === shiftId && !shift.isAllDay
            ? ({ ...shift, [field]: !shift[field as keyof ShiftDraftView] } as ShiftDraftView)
            : shift,
        ),
      });
    },

    handleSaveShift(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const shiftId = event.currentTarget.dataset.shiftId;
      if (shiftId === undefined) return;
      void saveShift(this, shiftId);
    },

    handleDeleteShift(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const shiftId = event.currentTarget.dataset.shiftId;
      if (shiftId === undefined) return;
      void deleteShift(this, shiftId);
    },

    handleNewRoleInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      this.setData({ newRoleName: readString(event) });
    },

    handleCreateRole(this: SchedulingConfigPageInstance): void {
      void createRole(this);
    },

    handleToggleRoleMember(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const roleId = event.currentTarget.dataset.roleId;
      const membershipId = event.currentTarget.dataset.membershipId;
      if (roleId === undefined || membershipId === undefined) return;
      const selected = new Set(this._roleMemberIds.get(roleId) ?? []);
      if (selected.has(membershipId)) selected.delete(membershipId);
      else selected.add(membershipId);
      this._roleMemberIds.set(roleId, [...selected]);
      this.setData({ roleCards: createRoleCards(this) });
    },

    handleSaveRoleMembers(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const roleId = event.currentTarget.dataset.roleId;
      if (roleId === undefined) return;
      void saveRoleMembers(this, roleId);
    },

    handleRoleRename(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (
        !this.data.canManage ||
        !this.data.organizationEnabled ||
        this.data.managementState === 'loading' ||
        this.data.roleEditBusy
      )
        return;
      const role = this._config?.roles.find(
        (value) => value.id === event.currentTarget.dataset.roleId,
      );
      if (!role || !this._config) return;
      this._roleEditContext = {
        groupId: this._groupId,
        ownerId: getStoredWechatProfile()?.id ?? '',
        roleId: role.id,
        version: role.version,
        rulesVersion: this._config.rulesVersion,
      };
      this.setData({ roleEditId: role.id, roleEditName: role.name, roleEditError: '' });
    },
    handleRoleEditInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.roleEditBusy)
        this.setData({ roleEditName: readString(event), roleEditError: '' });
    },
    handleRoleRenameCancel(this: SchedulingConfigPageInstance): void {
      if (this.data.roleEditBusy) return;
      this._roleEditContext = undefined;
      this.setData({ roleEditId: '', roleEditError: '', roleEditName: '' });
    },
    handleRoleRenameSave(this: SchedulingConfigPageInstance): void {
      void renameRole(this);
    },
    handleRoleDialogTouch(): void {},
    handleRoleDelete(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const roleId = event.currentTarget.dataset.roleId;
      if (roleId === undefined) return;
      void deleteRole(this, roleId);
    },
  };
}

function applyPanelLayout(page: SchedulingConfigPageInstance): void {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  page.setData({
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    largeText:
      ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ?? 16) >=
      20,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  });
}

function syncGroupId(page: SchedulingConfigPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId === page._groupId) return;
  page._groupId = groupId;
  page._roleEditContext = undefined;
  page.setData({ roleEditId: '', roleEditName: '', roleEditError: '', roleEditBusy: false });
  if (groupId.length === 0) {
    page._loadSerial += 1;
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      managementError: '当前群组信息缺失，请返回工作台后重试。',
      managementState: 'error',
      state: 'error',
    });
    return;
  }
  void loadConfig(page);
}

async function loadConfig(page: SchedulingConfigPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const serial = ++page._loadSerial;
  page._config = undefined;
  page._group = undefined;
  page.setData({
    state: 'loading',
    errorMessage: '',
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
    shiftDrafts: [],
    roleCards: [],
  });
  try {
    const groups = await page._organizationReadClient.listGroups();
    const group = groups.find((candidate) => candidate.id === page._groupId);
    if (group === undefined) throw new Error('当前群组不可用。');
    if (group.role === 'guest') throw new Error('访客不能修改排班配置。');
    const config = await page._organizationReadClient.getSchedulingConfig(group.id);
    if (serial !== page._loadSerial) return;
    page._group = group;
    page._config = config;
    initializeDrafts(page, config);
    const organizationEnabled = getClientCapabilitySnapshot().organization;
    page.setData({
      ...createShellGroupPatch(group),
      state: 'ready',
      managementState: 'ready',
      organizationEnabled,
      canManage: organizationEnabled && canManageGroup(group),
      shiftDrafts: createShiftDrafts(config),
      roleCards: createRoleCards(page),
    });
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page.setData({
      state: 'error',
      managementState: 'error',
      errorMessage: toUserMessage(error, '排班配置暂时无法加载，请稍后重试。'),
      managementError: toUserMessage(error, '排班配置暂时无法加载，请稍后重试。'),
    });
  }
}

function initializeRuntimeState(page: SchedulingConfigPageInstance): void {
  // WeChat does not copy private controller keys from Component config. Make
  // the clients, serial guard and draft maps explicit on the live instance.
  page._organizationReadClient = organizationReadClient;
  page._schedulingWriteClient = schedulingWriteClient;
  if (!Number.isFinite(page._loadSerial)) page._loadSerial = 0;
  if (!(page._operationIds instanceof Map)) page._operationIds = new Map();
  if (!(page._roleMemberIds instanceof Map)) page._roleMemberIds = new Map();
  if (typeof page._groupId !== 'string') page._groupId = '';
}

function initializeDrafts(page: SchedulingConfigPageInstance, config: SchedulingConfig): void {
  page._roleMemberIds = new Map(
    config.roles.map((role) => [role.id, role.members.map((member) => member.membershipId)]),
  );
}

function createShellGroupPatch(
  group: GroupSummary,
): Pick<SchedulingConfigPageData, 'currentGroupName' | 'currentGroupRole'> {
  return {
    currentGroupName: group.name,
    currentGroupRole: group.isDeveloperAdmin === true ? '后台管理员' : formatRole(group.role),
  };
}

function canManageGroup(group: GroupSummary): boolean {
  return (
    group.role === 'owner' || group.role === 'administrator' || group.isDeveloperAdmin === true
  );
}

function createShiftDrafts(config: SchedulingConfig): readonly ShiftDraftView[] {
  return config.shiftTypes.map((shift) => toShiftDraftView(shift, false));
}

function createRoleCards(page: SchedulingConfigPageInstance): readonly RoleCardView[] {
  const config = page._config;
  if (config === undefined) return [];
  return config.roles.map((role) => {
    const selected = new Set(page._roleMemberIds.get(role.id) ?? []);
    return {
      id: role.id,
      name: role.name,
      members: [...config.groupMembers]
        .sort(
          (a, b) =>
            a.realName.localeCompare(b.realName, 'zh-Hans') ||
            a.membershipId.localeCompare(b.membershipId),
        )
        .map((member) => ({
          id:
            role.members.find((m) => m.membershipId === member.membershipId)?.id ??
            'unassigned:' + member.membershipId,
          membershipId: member.membershipId,
          name: member.realName,
          selected: selected.has(member.membershipId),
        })),
    };
  });
}

async function createShift(page: SchedulingConfigPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const name = page.data.newShiftName.trim();
  const abbreviation = page.data.newShiftAbbreviation.trim();
  if (config === undefined || name.length === 0 || abbreviation.length === 0) {
    page.setData({ managementError: '请填写班种名称和简称。', managementState: 'error' });
    return;
  }
  const key = `shift-create:${name}:${abbreviation}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.createShiftType(page._groupId, {
      abbreviation,
      color: page.data.newShiftColor,
      countsTowardStatistics: page.data.newShiftCountsStatistics,
      crossesMidnight: page.data.newShiftCrossesMidnight,
      endTime: emptyToNull(page.data.newShiftEndTime),
      expectedRulesVersion: config.rulesVersion,
      isEnabled: page.data.newShiftEnabled,
      name,
      operationId: resolveOperationId(page, key),
      startTime: emptyToNull(page.data.newShiftStartTime),
    });
    page._operationIds.delete(key);
    page.setData({
      newShiftEditorOpen: false,
      newShiftName: '',
      newShiftAbbreviation: '',
      newShiftStartTime: '',
      newShiftEndTime: '',
      managementInfo: '自定义班种已创建。',
    });
  });
}

async function saveShift(page: SchedulingConfigPageInstance, shiftId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const shift = config?.shiftTypes.find((candidate) => candidate.id === shiftId);
  const draft = page.data.shiftDrafts.find((candidate) => candidate.id === shiftId);
  if (config === undefined || shift === undefined || draft === undefined) return;
  if (draft.name.trim() === '' || draft.abbreviation.trim() === '') {
    page.setData({ managementError: '请填写班种名称和简称。', managementState: 'error' });
    return;
  }
  const key = `shift-update:${shift.id}:${shift.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.updateShiftType(page._groupId, shift.id, {
      ...toShiftInput(draft),
      expectedRulesVersion: config.rulesVersion,
      expectedVersion: shift.version,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: `${draft.name}已保存。` });
  });
}

async function deleteShift(page: SchedulingConfigPageInstance, shiftId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const shift = config?.shiftTypes.find((candidate) => candidate.id === shiftId);
  if (config === undefined || shift === undefined || shift.isBuiltIn) return;
  if (!(await showConfirm(`确定删除班种“${shift.name}”吗？删除后不可恢复。`))) return;
  const key = `shift-delete:${shift.id}:${shift.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.deleteShiftType(page._groupId, shift.id, {
      expectedRulesVersion: config.rulesVersion,
      expectedVersion: shift.version,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: `班种“${shift.name}”已删除。` });
  });
}

async function createRole(page: SchedulingConfigPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const name = page.data.newRoleName.trim();
  if (config === undefined || name.length === 0) {
    page.setData({ managementError: '请填写排班岗位名称。', managementState: 'error' });
    return;
  }
  const key = `role-create:${name}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.createScheduleRole(page._groupId, {
      expectedRulesVersion: config.rulesVersion,
      name,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ newRoleName: '', managementInfo: '排班岗位已创建，请配置参与成员。' });
  });
}

async function renameRole(page: SchedulingConfigPageInstance): Promise<void> {
  const context = page._roleEditContext;
  if (!context || page.data.roleEditBusy || !page.data.canManage || !page.data.organizationEnabled)
    return;
  const current = () =>
    page._roleEditContext === context &&
    page._groupId === context.groupId &&
    (getStoredWechatProfile()?.id ?? '') === context.ownerId;
  const name = page.data.roleEditName.trim();
  if (!name || name.length > 100) {
    page.setData({ roleEditError: '岗位名称须为1–100字。' });
    return;
  }
  if (name === page._config?.roles.find((role) => role.id === context.roleId)?.name) {
    page._roleEditContext = undefined;
    page.setData({ roleEditId: '', roleEditError: '' });
    return;
  }
  page.setData({ roleEditBusy: true, roleEditError: '' });
  const key = `role-rename:${context.roleId}:${context.version}:${context.rulesVersion}:${name}`;
  try {
    await requireClientCapability('organization');
    if (!current()) return;
    const updated = await page._schedulingWriteClient.updateScheduleRole(
      context.groupId,
      context.roleId,
      {
        name,
        expectedVersion: context.version,
        expectedRulesVersion: context.rulesVersion,
        operationId: resolveOperationId(page, key),
      },
    );
    if (!current() || !page._config) return;
    page._operationIds.delete(key);
    page._config = {
      ...page._config,
      rulesVersion: context.rulesVersion + 1,
      roles: page._config.roles.map((role) => (role.id === updated.id ? updated : role)),
    };
    clearWorkbenchCalendarCache(context.ownerId, context.groupId);
    page._roleEditContext = undefined;
    page.setData({
      roleCards: createRoleCards(page),
      roleEditId: '',
      roleEditBusy: false,
      roleEditError: '',
      managementInfo: '岗位名称已更新，返回日历后同步显示。',
    });
  } catch (error) {
    if (!current()) return;
    page.setData({
      roleEditBusy: false,
      roleEditError: toUserMessage(error, '名称暂未保存，请重试。'),
    });
  }
}

async function saveRoleMembers(page: SchedulingConfigPageInstance, roleId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const role = config?.roles.find((candidate) => candidate.id === roleId);
  if (config === undefined || role === undefined) return;
  const key = `role-members:${role.id}:${role.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.replaceScheduleRoleMembers(page._groupId, role.id, {
      expectedRoleVersion: role.version,
      expectedRulesVersion: config.rulesVersion,
      membershipIds: page._roleMemberIds.get(role.id) ?? [],
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: '岗位成员已保存。' });
  });
}

async function deleteRole(page: SchedulingConfigPageInstance, roleId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const role = config?.roles.find((candidate) => candidate.id === roleId);
  if (config === undefined || role === undefined) return;
  if (!(await showConfirm(`确定删除排班岗位“${role.name}”吗？删除后不可恢复。`))) return;
  const key = `role-delete:${role.id}:${role.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.deleteScheduleRole(page._groupId, role.id, {
      expectedRulesVersion: config.rulesVersion,
      expectedVersion: role.version,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: `排班岗位“${role.name}”已删除。` });
  });
}

async function runWrite(
  page: SchedulingConfigPageInstance,
  operation: () => Promise<void>,
): Promise<void> {
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    await operation();
    const infoMessage = page.data.managementInfo;
    await loadConfig(page);
    if (page.data.state === 'ready') {
      page.setData({ managementInfo: infoMessage, managementState: 'ready' });
    }
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '排班配置暂时无法保存，请稍后重试。')} 可保持当前内容重试。`,
      managementState: 'error',
    });
  }
}

async function ensureManage(page: SchedulingConfigPageInstance): Promise<boolean> {
  if (!page.data.canManage || !page.data.organizationEnabled) {
    page.setData({
      managementError: '组织管理能力暂未开放，当前仅可查看排班配置。',
      managementState: 'error',
    });
    return false;
  }
  try {
    await requireClientCapability('organization');
    return true;
  } catch (error) {
    page.setData({
      managementError: error instanceof Error ? error.message : '组织管理能力暂未开放。',
      managementState: 'error',
    });
    return false;
  }
}

function createOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function resolveOperationId(page: SchedulingConfigPageInstance, key: string): string {
  const existing = page._operationIds.get(key);
  if (existing !== undefined) return existing;
  const operationId = createOperationId();
  page._operationIds.set(key, operationId);
  return operationId;
}

function toShiftDraftView(shift: ShiftType, editing: boolean): ShiftDraftView {
  return {
    abbreviation: shift.abbreviation,
    color: shift.color,
    countsTowardStatistics: shift.countsTowardStatistics,
    crossesMidnight: shift.crossesMidnight,
    endTime: shift.endTime ?? '',
    id: shift.id,
    isAllDay: shift.isAllDay,
    isBuiltIn: shift.isBuiltIn,
    isEnabled: shift.isEnabled,
    name: shift.name,
    startTime: shift.startTime ?? '',
    textColor: shift.textColor,
    editing,
    contrastWarning: shiftColorPresentation(shift.color).contrastWarning,
  };
}

function toShiftInput(shift: ShiftDraftView): {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string | null;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string | null;
} {
  return {
    abbreviation: shift.abbreviation.trim(),
    color: shift.color,
    countsTowardStatistics: shift.countsTowardStatistics,
    crossesMidnight: shift.crossesMidnight,
    endTime: emptyToNull(shift.endTime),
    isEnabled: shift.isEnabled,
    name: shift.name.trim(),
    startTime: emptyToNull(shift.startTime),
  };
}

function updateShiftColor(
  page: SchedulingConfigPageInstance,
  shiftId: string,
  value: string,
): void {
  if (page.data.managementState === 'loading') return;
  const color = normalizeHex(value);
  const index = page.data.shiftDrafts.findIndex((shift) => shift.id === shiftId);
  if (color === undefined || index < 0) return;
  const presentation = shiftColorPresentation(color);
  page.setData({
    [`shiftDrafts[${index}].color`]: color,
    [`shiftDrafts[${index}].textColor`]: presentation.textColor,
    [`shiftDrafts[${index}].contrastWarning`]: presentation.contrastWarning,
  });
}

function setDataField(page: SchedulingConfigPageInstance, field: string, value: string): void {
  if (field === 'name') page.setData({ newShiftName: value });
  else if (field === 'abbreviation') page.setData({ newShiftAbbreviation: value });
  else if (field === 'startTime') page.setData({ newShiftStartTime: value });
  else if (field === 'endTime') page.setData({ newShiftEndTime: value });
  else if (field === 'color' && page.data.managementState !== 'loading') {
    const color = normalizeHex(value);
    if (color !== undefined) page.setData({ newShiftColor: color });
  }
}

function readString(event: ValueInputEvent): string {
  return typeof event.detail?.value === 'string' ? event.detail.value : '';
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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
