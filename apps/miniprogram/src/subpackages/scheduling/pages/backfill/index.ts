import { ClientCoreError } from '@schedule/client-core';
import type {
  CalendarReadModel,
  ConfirmedHolidayDate,
  PastScheduleBackfillBatchResult,
  PastScheduleBackfillBatchItem,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  SchedulingConfig,
} from '@schedule/contracts';
import { MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS } from '@schedule/contracts/past-schedule-limits';
import {
  addBusinessMonths,
  buildMonthDisplayGrid,
  createPastScheduleBackfillBatchSnapshot,
  getBusinessMonthLabel,
  getPastScheduleBackfillBatchFingerprint,
  isWeekend,
  summarizePastScheduleBackfillStages,
  toggleBackfillSelection,
  toggleBackfillStage,
  type PastScheduleBackfillStage,
} from '@schedule/presentation-core';

import {
  createRuntimeManualScheduleClient,
  createRuntimePastScheduleClient,
  createRuntimeSchedulePublicationClient,
} from '../../../../platform/client-core-calendar.js';
import { getStoredWechatToken } from '../../../../platform/wechat-identity.js';
import {
  createWorkbenchReadClient,
  WORKBENCH_GROUP_STORAGE_KEY,
} from '../../../../platform/workbench-read.js';

interface PickerChangeEvent {
  readonly detail: { readonly value: string | number };
}

interface TapEvent {
  readonly currentTarget: {
    readonly dataset: Readonly<Record<string, unknown>>;
  };
}

interface TextareaInputEvent {
  readonly detail: { readonly value: string };
}

interface BackfillMemberView {
  readonly membershipId: string;
  readonly realName: string;
}

interface BackfillShiftTypeView {
  readonly color: string;
  readonly id: string;
  readonly name: string;
  readonly textColor: string;
}

interface BackfillCalendarCellView {
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly day: string;
  readonly duties: readonly {
    readonly abbreviation: string;
    readonly key: string;
    readonly name: string;
  }[];
  readonly holiday: string;
  readonly isCurrentMonth: boolean;
  readonly isFuture: boolean;
  readonly isHoliday: boolean;
  readonly isPending: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly month: string;
}

interface BackfillPendingView {
  readonly businessDate: string;
  readonly key: string;
  readonly memberName: string;
  readonly shiftTypeName: string;
}

interface BackfillRecordView {
  readonly key: string;
  readonly summary: string;
  readonly time: string;
}

interface BackfillRoleOption {
  readonly id: string;
  readonly name: string;
}

interface BackfillPageData {
  readonly activeMemberId: string;
  readonly activeMemberName: string;
  readonly activeShiftTypeId: string;
  readonly activeShiftTypeName: string;
  readonly businessMonth: string;
  readonly calendarCells: readonly BackfillCalendarCellView[];
  readonly currentGroupName: string;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly isBusy: boolean;
  readonly isPaintReady: boolean;
  readonly members: readonly BackfillMemberView[];
  readonly monthLabel: string;
  readonly pageScrollStyle: string;
  readonly paintStatusText: string;
  readonly pending: readonly BackfillPendingView[];
  readonly pendingCount: number;
  readonly reason: string;
  readonly records: readonly BackfillRecordView[];
  readonly roleId: string;
  readonly roleIndex: number;
  readonly roleLabels: readonly string[];
  readonly roleOptions: readonly BackfillRoleOption[];
  readonly shellHeaderStyle: string;
  readonly shiftTypes: readonly BackfillShiftTypeView[];
  readonly state: 'error' | 'loading' | 'ready';
  readonly today: string;
  readonly viewportClass: string;
}

interface BackfillPageInstance {
  _calendar: CalendarReadModel | undefined;
  _config: SchedulingConfig | undefined;
  _confirmFingerprint: string;
  _confirmOperationId: string;
  _currentGroupId: string;
  _holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  _initialPeriodId: string;
  _loadSerial: number;
  _periods: readonly PastSchedulePeriod[];
  _records: readonly PastScheduleBackfillRecord[];
  _staged: Map<string, PastScheduleBackfillStage>;
  readonly data: BackfillPageData;
  setData(patch: Partial<BackfillPageData>, callback?: () => void): void;
}

const manualClient = createRuntimeManualScheduleClient(getStoredWechatToken);
const pastScheduleClient = createRuntimePastScheduleClient(getStoredWechatToken);
const publicationClient = createRuntimeSchedulePublicationClient(getStoredWechatToken);
const workbenchClient = createWorkbenchReadClient();
const initialToday = getChinaStandardTimeBusinessDate();

Page({
  data: {
    activeMemberId: '',
    activeMemberName: '未选择成员',
    activeShiftTypeId: '',
    activeShiftTypeName: '未选择班种',
    businessMonth: initialToday.slice(0, 7),
    calendarCells: [],
    currentGroupName: '正在读取群组',
    errorMessage: '',
    infoMessage: '',
    isBusy: false,
    isPaintReady: false,
    members: [],
    monthLabel: getBusinessMonthLabel(initialToday.slice(0, 7)),
    pageScrollStyle: 'height:calc(100% - 64px);',
    paintStatusText: '请选择班种和成员',
    pending: [],
    pendingCount: 0,
    reason: '',
    records: [],
    roleId: '',
    roleIndex: 0,
    roleLabels: [],
    roleOptions: [],
    shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
    shiftTypes: [],
    state: 'loading',
    today: initialToday,
    viewportClass: '',
  } satisfies BackfillPageData,

  _calendar: undefined,
  _config: undefined,
  _confirmFingerprint: '',
  _confirmOperationId: '',
  _currentGroupId: '',
  _holidays: new Map<string, ConfirmedHolidayDate>(),
  _initialPeriodId: '',
  _loadSerial: 0,
  _periods: [] as readonly PastSchedulePeriod[],
  _records: [] as readonly PastScheduleBackfillRecord[],
  _staged: new Map<string, PastScheduleBackfillStage>(),

  onLoad(this: BackfillPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    this._initialPeriodId = decodeQueryValue(query['schedulePeriodId']);
    this.setData(createShellLayoutPatch());
    void loadBackfillPage(this);
  },

  onShow(this: BackfillPageInstance): void {
    const today = getChinaStandardTimeBusinessDate();
    if (today !== this.data.today) {
      this.setData({ today });
      syncBackfillView(this);
    }
  },

  onResize(this: BackfillPageInstance): void {
    this.setData(createShellLayoutPatch());
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  handleReload(this: BackfillPageInstance): void {
    void loadBackfillPage(this);
  },

  handleRoleChange(this: BackfillPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const roleIndex = Number(event.detail.value);
    const role = this.data.roleOptions[roleIndex];
    if (!Number.isInteger(roleIndex) || role === undefined || role.id === this.data.roleId) return;
    resetStagedContext(this);
    this.setData({ roleId: role.id, roleIndex });
    void loadCalendarContext(this);
  },

  handleMonthChange(this: BackfillPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const businessMonth = String(event.detail.value);
    if (!/^\d{4}-\d{2}$/u.test(businessMonth) || businessMonth === this.data.businessMonth) return;
    changeBusinessMonth(this, businessMonth);
  },

  handlePreviousMonth(this: BackfillPageInstance): void {
    if (!this.data.isBusy)
      changeBusinessMonth(this, addBusinessMonths(this.data.businessMonth, -1));
  },

  handleNextMonth(this: BackfillPageInstance): void {
    if (!this.data.isBusy) changeBusinessMonth(this, addBusinessMonths(this.data.businessMonth, 1));
  },

  handleShiftTap(this: BackfillPageInstance, event: TapEvent): void {
    if (this.data.isBusy) return;
    const id = readDatasetString(event, 'id');
    if (id === '') return;
    this.setData({
      activeShiftTypeId: toggleBackfillSelection(this.data.activeShiftTypeId, id),
      infoMessage: '',
    });
    syncBackfillView(this);
  },

  handleMemberTap(this: BackfillPageInstance, event: TapEvent): void {
    if (this.data.isBusy) return;
    const id = readDatasetString(event, 'id');
    if (id === '') return;
    this.setData({
      activeMemberId: toggleBackfillSelection(this.data.activeMemberId, id),
      infoMessage: '',
    });
    syncBackfillView(this);
  },

  handleReasonInput(this: BackfillPageInstance, event: TextareaInputEvent): void {
    if (!this.data.isBusy) this.setData({ reason: event.detail.value });
  },

  handleDateTap(this: BackfillPageInstance, event: TapEvent): void {
    if (this.data.isBusy) return;
    const businessDate = readDatasetString(event, 'date');
    const cellMonth = readDatasetString(event, 'month');
    if (businessDate === '' || cellMonth !== this.data.businessMonth) return;
    const item: PastScheduleBackfillBatchItem = {
      actualMembershipId: this.data.activeMemberId,
      businessDate,
      scheduleRoleId: this.data.roleId,
      shiftTypeId: this.data.activeShiftTypeId,
    };
    const transition = toggleBackfillStage(this._staged, item, {
      businessMonth: this.data.businessMonth,
      maximumItems: MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS,
      today: this.data.today,
    });
    if (transition.outcome === 'added' && alreadyMatchesCurrentAssignment(this, item)) {
      this.setData({
        errorMessage: '',
        infoMessage: `该日期（${businessDate}）已是此配班，无需重复补录。`,
      });
      return;
    }
    this._staged = new Map(transition.stages);
    this.setData({
      errorMessage: stageErrorMessage(transition.outcome, businessDate),
      infoMessage: stageInfoMessage(transition.outcome),
    });
    syncBackfillView(this);
  },

  handleRemovePending(this: BackfillPageInstance, event: TapEvent): void {
    if (this.data.isBusy) return;
    const key = readDatasetString(event, 'key');
    if (key === '' || !this._staged.has(key)) return;
    this._staged.delete(key);
    this.setData({ errorMessage: '', infoMessage: '' });
    syncBackfillView(this);
  },

  handleClear(this: BackfillPageInstance): void {
    if (this.data.isBusy || this._staged.size === 0) return;
    this._staged.clear();
    this.setData({ errorMessage: '', infoMessage: '已清空待确认的补录项。' });
    syncBackfillView(this);
  },

  handleConfirm(this: BackfillPageInstance): void {
    void submitBackfillBatch(this);
  },
});

async function loadBackfillPage(page: BackfillPageInstance): Promise<void> {
  page._staged.clear();
  page._confirmFingerprint = '';
  page._confirmOperationId = '';
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true, state: 'loading' });
  try {
    const groups = await workbenchClient.listGroups();
    const storedGroupId = wx.getStorageSync(WORKBENCH_GROUP_STORAGE_KEY);
    const group =
      groups.find(
        (candidate) =>
          candidate.id === storedGroupId &&
          (candidate.role === 'administrator' ||
            candidate.role === 'owner' ||
            candidate.isDeveloperAdmin),
      ) ??
      groups.find(
        (candidate) =>
          candidate.role === 'administrator' ||
          candidate.role === 'owner' ||
          candidate.isDeveloperAdmin,
      );
    if (group === undefined) throw new Error('仅管理员与群主可以使用排班补录。');
    page._currentGroupId = group.id;
    wx.setStorageSync(WORKBENCH_GROUP_STORAGE_KEY, group.id);
    const [config, periods, records] = await Promise.all([
      manualClient.getConfig(group.id),
      pastScheduleClient.listPeriods(group.id),
      pastScheduleClient.listBackfillRecords(group.id).catch(() => []),
    ]);
    page._config = config;
    page._periods = periods;
    page._records = records;
    const initialPeriod = periods.find((period) => period.id === page._initialPeriodId);
    const roleOptions = config.roles.map((role) => ({ id: role.id, name: role.name }));
    const initialRoleId = initialPeriod?.scheduleRoleId ?? roleOptions[0]?.id ?? '';
    const roleIndex = Math.max(
      0,
      roleOptions.findIndex((role) => role.id === initialRoleId),
    );
    const members = config.groupMembers.map((member) => ({
      membershipId: member.membershipId,
      realName: member.realName,
    }));
    const shiftTypes = config.shiftTypes
      .filter((shiftType) => shiftType.isEnabled)
      .map((shiftType) => ({
        color: shiftType.color,
        id: shiftType.id,
        name: shiftType.name,
        textColor: shiftType.textColor,
      }));
    page.setData({
      businessMonth: initialPeriod?.businessMonth ?? page.data.today.slice(0, 7),
      currentGroupName: group.name,
      isBusy: false,
      members,
      records: createRecordViews(records),
      roleId: initialRoleId,
      roleIndex,
      roleLabels: roleOptions.map((role) => role.name),
      roleOptions,
      shiftTypes,
      state: 'ready',
    });
    await loadCalendarContext(page);
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班补录暂时无法加载，请稍后重试。'),
      isBusy: false,
      state: 'error',
    });
  }
}

async function loadCalendarContext(page: BackfillPageInstance): Promise<boolean> {
  const serial = ++page._loadSerial;
  const roleId = page.data.roleId;
  const businessMonth = page.data.businessMonth;
  page._calendar = undefined;
  page._holidays = new Map();
  page.setData({
    calendarCells: [],
    errorMessage: '',
    isBusy: true,
    monthLabel: getBusinessMonthLabel(businessMonth),
  });
  if (roleId === '') {
    page.setData({
      errorMessage: '当前群组尚未配置排班岗位，请先完成排班配置。',
      isBusy: false,
    });
    return false;
  }
  try {
    const period = page._periods.find(
      (candidate) =>
        candidate.scheduleRoleId === roleId && candidate.businessMonth === businessMonth,
    );
    const [calendar, holidays] = await Promise.all([
      period === undefined
        ? Promise.resolve(createEmptyCalendar(page, roleId, businessMonth))
        : publicationClient.getPeriodCalendar(page._currentGroupId, period.id),
      workbenchClient.getHolidays(Number(businessMonth.slice(0, 4))),
    ]);
    if (
      serial !== page._loadSerial ||
      page.data.roleId !== roleId ||
      page.data.businessMonth !== businessMonth
    ) {
      return false;
    }
    page._calendar = calendar;
    page._holidays = new Map(holidays.dates.map((holiday) => [holiday.date, holiday]));
    page.setData({ isBusy: false });
    syncBackfillView(page);
    return true;
  } catch (error) {
    if (serial !== page._loadSerial) return false;
    page.setData({
      errorMessage: toUserMessage(error, '排班补录暂时无法完成，请稍后重试。'),
      isBusy: false,
    });
    return false;
  }
}

async function submitBackfillBatch(page: BackfillPageInstance): Promise<void> {
  if (page.data.isBusy) return;
  if (page._staged.size === 0) {
    page.setData({ infoMessage: '没有待确认的补录项。' });
    return;
  }
  let operationId = page._confirmOperationId || createOperationId();
  let snapshot = createPastScheduleBackfillBatchSnapshot(
    page._staged,
    page.data.reason,
    operationId,
  );
  const fingerprint = getPastScheduleBackfillBatchFingerprint(snapshot.items, snapshot.reason);
  if (page._confirmFingerprint !== fingerprint) {
    operationId = createOperationId();
    snapshot = createPastScheduleBackfillBatchSnapshot(page._staged, page.data.reason, operationId);
    page._confirmFingerprint = fingerprint;
    page._confirmOperationId = operationId;
  }
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  let result: PastScheduleBackfillBatchResult;
  try {
    result = await pastScheduleClient.submitBackfillBatch(page._currentGroupId, {
      ...snapshot,
      items: [...snapshot.items],
    });
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班补录暂时无法完成，请稍后重试。'),
      infoMessage: '本批尚未确认结果；待确认项已保留，可直接重试。',
      isBusy: false,
    });
    return;
  }

  const successMessage = `已确认补录 ${result.assignments.length} 条，并留下“排班补录”事件记录。`;
  page._staged.clear();
  page._confirmFingerprint = '';
  page._confirmOperationId = '';
  page.setData({ infoMessage: successMessage });
  syncBackfillView(page);

  let refreshFailed = false;
  try {
    const records = await pastScheduleClient.listBackfillRecords(page._currentGroupId);
    page._records = records;
    page.setData({ records: createRecordViews(records) });
  } catch {
    refreshFailed = true;
  }
  const calendarRefreshed = await loadCalendarContext(page);
  refreshFailed = refreshFailed || !calendarRefreshed;
  page.setData({
    infoMessage: refreshFailed
      ? `${successMessage} 页面资料刷新失败，请稍后重新加载。`
      : successMessage,
    isBusy: false,
  });
}

function syncBackfillView(page: BackfillPageInstance): void {
  const memberNames = new Map(
    page.data.members.map((member) => [member.membershipId, member.realName]),
  );
  const shiftTypeNames = new Map(
    page.data.shiftTypes.map((shiftType) => [shiftType.id, shiftType.name]),
  );
  const pending = summarizePastScheduleBackfillStages(page._staged, {
    memberNames,
    shiftTypeNames,
  }).map((item) => ({
    businessDate: item.businessDate,
    key: `${item.scheduleRoleId}:${item.businessDate}`,
    memberName: item.memberName,
    shiftTypeName: item.shiftTypeName,
  }));
  const isPaintReady =
    page.data.roleId !== '' &&
    page.data.activeMemberId !== '' &&
    page.data.activeShiftTypeId !== '';
  page.setData({
    activeMemberName: memberNames.get(page.data.activeMemberId) ?? '未选择成员',
    activeShiftTypeName: shiftTypeNames.get(page.data.activeShiftTypeId) ?? '未选择班种',
    calendarCells: createCalendarCells(page),
    isPaintReady,
    monthLabel: getBusinessMonthLabel(page.data.businessMonth),
    paintStatusText: isPaintReady
      ? '可以连续点选既往日期'
      : page.data.activeMemberId === '' && page.data.activeShiftTypeId === ''
        ? '请选择班种和成员'
        : page.data.activeShiftTypeId === ''
          ? '还需选择班种'
          : '还需选择成员',
    pending,
    pendingCount: pending.length,
  });
}

function createCalendarCells(page: BackfillPageInstance): readonly BackfillCalendarCellView[] {
  const assignmentsByDate = new Map<string, CalendarReadModel['assignments'][number][]>();
  for (const assignment of page._calendar?.assignments ?? []) {
    const rows = assignmentsByDate.get(assignment.businessDate) ?? [];
    rows.push(assignment);
    assignmentsByDate.set(assignment.businessDate, rows);
  }
  return buildMonthDisplayGrid(page.data.businessMonth)
    .flat()
    .map((cell) => {
      const assignments = assignmentsByDate.get(cell.businessDate) ?? [];
      const holiday = page._holidays.get(cell.businessDate);
      const isCurrentMonth = !cell.isOutsideMonth;
      const duties = assignments.map((assignment) => ({
        abbreviation: assignments.length > 1 ? assignment.shiftTypeAbbreviation : '',
        key: `${assignment.schedulePeriodId}:${assignment.businessDate}:${assignment.slotPosition}`,
        name: assignment.actualMemberName ?? assignment.plannedMemberName ?? '待安排',
      }));
      return {
        ariaLabel: `${cell.businessDate}${duties.length === 0 ? '，暂无排班' : `，${duties.length}个班次`}${cell.businessDate >= page.data.today ? '，不可补录' : ''}`,
        businessDate: cell.businessDate,
        day: cell.businessDate.slice(8),
        duties,
        holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
        isCurrentMonth,
        isFuture: !isCurrentMonth || cell.businessDate >= page.data.today,
        isHoliday: isCurrentMonth && holiday?.isOffDay === true,
        isPending: isCurrentMonth && page._staged.has(`${page.data.roleId}:${cell.businessDate}`),
        isToday: isCurrentMonth && cell.businessDate === page.data.today,
        isWeekend: isWeekend(cell.businessDate),
        month: cell.businessDate.slice(0, 7),
      };
    });
}

function createRecordViews(
  records: readonly PastScheduleBackfillRecord[],
): readonly BackfillRecordView[] {
  return records.map((record) => ({
    key: record.assignmentId,
    summary: [
      record.businessDate,
      record.actualMemberName ?? '',
      record.shiftTypeName,
      record.reason ?? '',
      record.operatorName === '' ? '' : `操作人：${record.operatorName}`,
    ]
      .filter(Boolean)
      .join(' · '),
    time: formatEventTime(record.backfilledAt),
  }));
}

function createEmptyCalendar(
  page: BackfillPageInstance,
  roleId: string,
  businessMonth: string,
): CalendarReadModel {
  const role = page._config?.roles.find((candidate) => candidate.id === roleId);
  return {
    assignments: [],
    businessMonth,
    groupId: page._currentGroupId,
    members: page.data.members.map((member) => ({
      isConfirmed: false,
      membershipId: member.membershipId,
      realName: member.realName,
    })),
    roles: role === undefined ? [] : [{ id: role.id, name: role.name }],
    shiftTypes: (page._config?.shiftTypes ?? [])
      .filter((shiftType) => shiftType.isEnabled)
      .map((shiftType) => ({
        abbreviation: shiftType.abbreviation,
        color: shiftType.color,
        crossesMidnight: shiftType.crossesMidnight,
        ...(shiftType.endTime === undefined ? {} : { endTime: shiftType.endTime }),
        id: shiftType.id,
        isAllDay: shiftType.isAllDay,
        name: shiftType.name,
        ...(shiftType.startTime === undefined ? {} : { startTime: shiftType.startTime }),
        textColor: shiftType.textColor,
      })),
  };
}

function alreadyMatchesCurrentAssignment(
  page: BackfillPageInstance,
  item: PastScheduleBackfillBatchItem,
): boolean {
  const existing = page._calendar?.assignments.find(
    (assignment) => assignment.businessDate === item.businessDate,
  );
  return (
    existing !== undefined &&
    (existing.actualMembershipId ?? existing.plannedMembershipId) === item.actualMembershipId &&
    existing.shiftTypeId === item.shiftTypeId
  );
}

function changeBusinessMonth(page: BackfillPageInstance, businessMonth: string): void {
  resetStagedContext(page);
  page.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth) });
  void loadCalendarContext(page);
}

function resetStagedContext(page: BackfillPageInstance): void {
  page._staged.clear();
  page._confirmFingerprint = '';
  page._confirmOperationId = '';
  page.setData({ errorMessage: '', infoMessage: '', pending: [], pendingCount: 0 });
}

function stageErrorMessage(outcome: string, businessDate: string): string {
  if (outcome === 'not-past') {
    return `该日期（${businessDate}）尚未过去，请使用正常排班功能修改。`;
  }
  if (outcome === 'limit-reached') {
    return `一次最多补录 ${MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS} 个日期。`;
  }
  if (outcome === 'invalid-date' || outcome === 'outside-month')
    return '只能选择当前月份内的日期。';
  return '';
}

function stageInfoMessage(outcome: string): string {
  if (outcome === 'selection-required') {
    return '请先选择班种和成员（保持选中），再点击既往日期进行配班。';
  }
  return '';
}

function getChinaStandardTimeBusinessDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  if (shifted.getUTCHours() < 8) shifted.setUTCDate(shifted.getUTCDate() - 1);
  return shifted.toISOString().slice(0, 10);
}

function formatEventTime(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) return value;
  const shifted = new Date(instant.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}/${String(shifted.getUTCMonth() + 1).padStart(2, '0')}/${String(shifted.getUTCDate()).padStart(2, '0')} ${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}:${String(shifted.getUTCSeconds()).padStart(2, '0')}`;
}

function createShellLayoutPatch(): Pick<
  BackfillPageData,
  'pageScrollStyle' | 'shellHeaderStyle' | 'viewportClass'
> {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  return {
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  };
}

function readDatasetString(event: TapEvent, key: string): string {
  const value = event.currentTarget.dataset[key];
  return typeof value === 'string' ? value : '';
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
