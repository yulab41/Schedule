import {
  ClientCoreError,
  type OrganizationReadClient,
  type SchedulingConfigWriteClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { GroupSummary, ScheduleRole, SchedulingConfig, ShiftType } from '@schedule/contracts';
import {
  createRuntimeOrganizationReadClient,
  createRuntimeSchedulingConfigWriteClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

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
  readonly version: number;
  readonly editing: boolean;
  readonly contrastWarning: boolean;
}

interface RoleMemberView {
  readonly id: string;
  readonly membershipId: string;
  readonly name: string;
  readonly position: number;
  readonly selected: boolean;
  readonly version: number;
}

interface RoleCardView {
  readonly id: string;
  readonly members: readonly RoleMemberView[];
  readonly name: string;
  readonly version: number;
  readonly rotationVersion: number;
  readonly currentPosition: number;
  readonly defaultShiftTypeId: string;
  readonly defaultShiftTypeName: string;
  readonly defaultShiftIndex: number;
  readonly requiredMembersPerDay: number;
  readonly startDate: string;
  readonly startingMemberId: string;
  readonly startingMemberName: string;
  readonly startingMemberIndex: number;
  readonly memberNames: readonly string[];
  readonly editing: boolean;
}

interface SchedulingConfigPageData {
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
  readonly managementError: string;
  readonly managementInfo: string;
  readonly managementState: 'error' | 'loading' | 'ready';
  readonly organizationEnabled: boolean;
  readonly canManage: boolean;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly rulesVersion: number;
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
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly viewportClass: string;
}

interface SchedulingConfigPageInstance {
  readonly data: SchedulingConfigPageData;
  readonly properties: { readonly groupId: string };
  readonly _organizationReadClient: OrganizationReadClient;
  readonly _schedulingWriteClient: SchedulingConfigWriteClient;
  _groupId: string;
  _group: GroupSummary | undefined;
  _config: SchedulingConfig | undefined;
  _loadSerial: number;
  _operationIds: Map<string, string>;
  _roleMemberIds: Map<string, string[]>;
  _roleMemberOrder: Map<string, string[]>;
  _rotationDrafts: Map<string, RotationDraft>;
  setData(patch: Partial<SchedulingConfigPageData>, callback?: () => void): void;
}

interface RotationDraft {
  readonly currentPosition: number;
  readonly defaultShiftTypeId: string;
  readonly requiredMembersPerDay: number;
  readonly startDate: string;
  readonly startingMemberId: string;
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
      state: 'loading',
      errorMessage: '',
      managementError: '',
      managementInfo: '',
      managementState: 'loading',
      organizationEnabled: false,
      canManage: false,
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      rulesVersion: 0,
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
    _roleMemberOrder: new Map<string, string[]>(),
    _rotationDrafts: new Map<string, RotationDraft>(),

    properties: { groupId: { type: String, value: '' } },

    observers: {
      groupId(this: SchedulingConfigPageInstance): void {
        syncGroupId(this);
      },
    },

    lifetimes: {
      attached(this: SchedulingConfigPageInstance): void {
        applyPanelLayout(this);
        syncGroupId(this);
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
      this.setData({
        shiftDrafts: this.data.shiftDrafts.map((shift) =>
          shift.id === shiftId ? { ...shift, color: readString(event) } : shift,
        ),
      });
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

    handleMoveRoleMember(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const roleId = event.currentTarget.dataset.roleId;
      const memberId = event.currentTarget.dataset.memberId;
      const direction = event.currentTarget.dataset.direction;
      if (roleId === undefined || memberId === undefined || direction === undefined) return;
      const order = [...(this._roleMemberOrder.get(roleId) ?? [])];
      const index = order.indexOf(memberId);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
      const currentMember = order[index];
      const nextMember = order[nextIndex];
      if (currentMember === undefined || nextMember === undefined) return;
      order[index] = nextMember;
      order[nextIndex] = currentMember;
      this._roleMemberOrder.set(roleId, order);
      this.setData({ roleCards: createRoleCards(this) });
    },

    handleSaveRoleOrder(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const roleId = event.currentTarget.dataset.roleId;
      if (roleId === undefined) return;
      void saveRoleOrder(this, roleId);
    },

    handleRotationInput(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const roleId = event.currentTarget?.dataset?.roleId;
      const field = event.currentTarget?.dataset?.field;
      if (roleId === undefined || field === undefined) return;
      const current = this._rotationDrafts.get(roleId);
      if (current === undefined) return;
      const value = readString(event);
      this._rotationDrafts.set(roleId, {
        ...current,
        [field]:
          field === 'requiredMembersPerDay' || field === 'currentPosition'
            ? toPositiveInt(value)
            : value,
      });
      this.setData({ roleCards: createRoleCards(this) });
    },

    handleRotationPicker(this: SchedulingConfigPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const roleId = event.currentTarget?.dataset?.roleId;
      const field = event.currentTarget?.dataset?.field;
      if (roleId === undefined) return;
      const current = this._rotationDrafts.get(roleId);
      if (current === undefined) return;
      const index = Number(event.detail?.value);
      const role = this.data.roleCards.find((candidate) => candidate.id === roleId);
      if (role === undefined || !Number.isInteger(index) || index < 0) return;
      if (field === 'defaultShift') {
        const shift = this._config?.shiftTypes[index];
        if (shift === undefined) return;
        this._rotationDrafts.set(roleId, { ...current, defaultShiftTypeId: shift.id });
      } else if (field === 'startingMember') {
        const member = role.members[index];
        if (member === undefined) return;
        this._rotationDrafts.set(roleId, { ...current, startingMemberId: member.id });
      }
      this.setData({ roleCards: createRoleCards(this) });
    },

    handleRotationToggle(this: SchedulingConfigPageInstance, event: TapEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      const roleId = event.currentTarget.dataset.roleId;
      if (roleId === undefined) return;
      this.setData({
        roleCards: this.data.roleCards.map((role) =>
          role.id === roleId ? { ...role, editing: !role.editing } : role,
        ),
      });
    },

    handleSaveRotation(this: SchedulingConfigPageInstance, event: TapEvent): void {
      const roleId = event.currentTarget.dataset.roleId;
      if (roleId === undefined) return;
      void saveRotation(this, roleId);
    },

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
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  });
}

function syncGroupId(page: SchedulingConfigPageInstance): void {
  const groupId = page.properties.groupId;
  if (groupId === page._groupId) return;
  page._groupId = groupId;
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
      rulesVersion: config.rulesVersion,
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

function initializeDrafts(page: SchedulingConfigPageInstance, config: SchedulingConfig): void {
  page._roleMemberIds = new Map(
    config.roles.map((role) => [role.id, role.members.map((member) => member.membershipId)]),
  );
  page._roleMemberOrder = new Map(
    config.roles.map((role) => [role.id, role.members.map((member) => member.id)]),
  );
  page._rotationDrafts = new Map(config.roles.map((role) => [role.id, toRotationDraft(role)]));
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
    const rotation = page._rotationDrafts.get(role.id) ?? toRotationDraft(role);
    const selected = new Set(page._roleMemberIds.get(role.id) ?? []);
    const order = page._roleMemberOrder.get(role.id) ?? role.members.map((member) => member.id);
    const roleMemberByMembership = new Map(
      role.members.map((member) => [member.membershipId, member]),
    );
    const members = [...config.groupMembers]
      .sort((left, right) => {
        const leftRoleMember = roleMemberByMembership.get(left.membershipId);
        const rightRoleMember = roleMemberByMembership.get(right.membershipId);
        const leftPosition =
          leftRoleMember === undefined ? Number.MAX_SAFE_INTEGER : order.indexOf(leftRoleMember.id);
        const rightPosition =
          rightRoleMember === undefined
            ? Number.MAX_SAFE_INTEGER
            : order.indexOf(rightRoleMember.id);
        return (
          leftPosition - rightPosition || left.realName.localeCompare(right.realName, 'zh-Hans')
        );
      })
      .map((member, index) => {
        const roleMember = roleMemberByMembership.get(member.membershipId);
        return {
          id: roleMember?.id ?? `unassigned:${member.membershipId}`,
          membershipId: member.membershipId,
          name: member.realName,
          position: index + 1,
          selected: selected.has(member.membershipId),
          version: roleMember?.version ?? 0,
        };
      });
    const defaultShift = config.shiftTypes.find(
      (shift) => shift.id === rotation.defaultShiftTypeId,
    );
    const startingMember = members.find((member) => member.id === rotation.startingMemberId);
    const defaultShiftIndex = config.shiftTypes.findIndex(
      (shift) => shift.id === rotation.defaultShiftTypeId,
    );
    const startingMemberIndex = members.findIndex(
      (member) => member.id === rotation.startingMemberId,
    );
    const existing = page.data.roleCards.find((card) => card.id === role.id);
    return {
      id: role.id,
      members,
      name: role.name,
      version: role.version,
      rotationVersion: role.rotationRule.version,
      currentPosition: rotation.currentPosition,
      defaultShiftTypeId: rotation.defaultShiftTypeId,
      defaultShiftTypeName: defaultShift?.name ?? '未选择',
      defaultShiftIndex: Math.max(0, defaultShiftIndex),
      requiredMembersPerDay: rotation.requiredMembersPerDay,
      startDate: rotation.startDate,
      startingMemberId: rotation.startingMemberId,
      startingMemberName: startingMember?.name ?? '按顺序开始',
      startingMemberIndex: Math.max(0, startingMemberIndex),
      memberNames: members.map((member) => member.name),
      editing: existing?.editing === true,
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

async function saveRoleMembers(page: SchedulingConfigPageInstance, roleId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const role = config?.roles.find((candidate) => candidate.id === roleId);
  if (config === undefined || role === undefined) return;
  const key = `role-members:${role.id}:${role.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.replaceScheduleRoleMembers(page._groupId, role.id, {
      expectedRoleVersion: role.version,
      expectedRotationRuleVersion: role.rotationRule.version,
      expectedRulesVersion: config.rulesVersion,
      membershipIds: page._roleMemberIds.get(role.id) ?? [],
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: '岗位成员已保存。' });
  });
}

async function saveRoleOrder(page: SchedulingConfigPageInstance, roleId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const role = config?.roles.find((candidate) => candidate.id === roleId);
  if (config === undefined || role === undefined) return;
  const roleMemberIds = new Set(role.members.map((member) => member.id));
  const order = (page._roleMemberOrder.get(role.id) ?? []).filter((memberId) =>
    roleMemberIds.has(memberId),
  );
  const key = `role-order:${role.id}:${role.version}:${role.rotationRule.version}:${order.join('|')}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.reorderRotationMembers(page._groupId, role.id, {
      expectedRoleVersion: role.version,
      expectedRotationRuleVersion: role.rotationRule.version,
      expectedRulesVersion: config.rulesVersion,
      members: order.map((scheduleRoleMemberId, index) => ({
        position: index + 1,
        scheduleRoleMemberId,
      })),
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: '轮转顺序已保存。' });
  });
}

async function saveRotation(page: SchedulingConfigPageInstance, roleId: string): Promise<void> {
  if (!(await ensureManage(page))) return;
  const config = page._config;
  const role = config?.roles.find((candidate) => candidate.id === roleId);
  const draft = page._rotationDrafts.get(roleId);
  if (config === undefined || role === undefined || draft === undefined) return;
  const key = `rotation-rule:${role.id}:${role.version}:${role.rotationRule.version}:${config.rulesVersion}`;
  await runWrite(page, async () => {
    await page._schedulingWriteClient.updateRotationRule(page._groupId, role.id, {
      currentPosition: Math.max(1, draft.currentPosition),
      defaultShiftTypeId: draft.defaultShiftTypeId,
      expectedRoleVersion: role.version,
      expectedRotationRuleVersion: role.rotationRule.version,
      expectedRulesVersion: config.rulesVersion,
      operationId: resolveOperationId(page, key),
      requiredMembersPerDay: Math.max(1, draft.requiredMembersPerDay),
      startDate: emptyToNull(draft.startDate),
      startingMemberScheduleRoleId: emptyToNull(draft.startingMemberId),
    });
    page._operationIds.delete(key);
    page.setData({ managementInfo: '轮转规则已保存。' });
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
    version: shift.version,
    editing,
    contrastWarning: bestContrastRatio(shift.color) < 4.5,
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

function toRotationDraft(role: ScheduleRole): RotationDraft {
  return {
    currentPosition: role.rotationRule.currentPosition,
    defaultShiftTypeId: role.rotationRule.defaultShiftTypeId,
    requiredMembersPerDay: role.rotationRule.requiredMembersPerDay,
    startDate: role.rotationRule.startDate ?? '',
    startingMemberId: role.rotationRule.startingMemberScheduleRoleId ?? '',
  };
}

function bestContrastRatio(color: string): number {
  const value = color.replace('#', '');
  if (!/^[\da-f]{6}$/iu.test(value)) return 7;
  const channels = [0, 2, 4].map(
    (index) => Number.parseInt(value.slice(index, index + 2), 16) / 255,
  );
  const weights = [0.2126, 0.7152, 0.0722] as const;
  const luminance = channels.reduce(
    (sum, channel, index) =>
      sum +
      (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
        (weights[index] ?? 0),
    0,
  );
  return 1.05 / (luminance + 0.05);
}

function setDataField(page: SchedulingConfigPageInstance, field: string, value: string): void {
  if (field === 'name') page.setData({ newShiftName: value });
  else if (field === 'abbreviation') page.setData({ newShiftAbbreviation: value });
  else if (field === 'startTime') page.setData({ newShiftStartTime: value });
  else if (field === 'endTime') page.setData({ newShiftEndTime: value });
  else if (field === 'color') page.setData({ newShiftColor: value });
}

function readString(event: ValueInputEvent): string {
  return typeof event.detail?.value === 'string' ? event.detail.value : '';
}

function toPositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
