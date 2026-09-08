import { ClientCoreError } from '@schedule/client-core';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
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
  getCurrentBusinessDate,
  getPastScheduleBackfillBatchFingerprint,
  isWeekend,
  toggleBackfillSelection,
  toggleBackfillStage,
  type PastScheduleBackfillStage,
} from '@schedule/presentation-core';
import {
  mapCalendarPeriodRing,
  type CalendarPeriodSlot,
} from '../../../../components/calendar/calendar-period-pager.js';

import {
  createRuntimeManualScheduleClient,
  createRuntimePastScheduleClient,
  createRuntimeSchedulePublicationClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import {
  createWorkbenchReadClient,
  readStoredWorkbenchGroupId,
  writeStoredWorkbenchGroupId,
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
  readonly disabled: boolean;
  readonly isSelected: boolean;
  readonly isBottomRow: boolean;
  readonly isBottomLeft: boolean;
  readonly isBottomRight: boolean;
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly day: string;
  readonly duties: readonly {
    readonly abbreviation: string;
    readonly key: string;
    readonly name: string;
    readonly state: 'normal' | 'removed' | 'added';
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
  readonly monthPanels: readonly BackfillMonthPanel[];
  readonly monthPanelHeights: readonly number[];
  readonly gridHeight: number;
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
  _disposed: boolean;
  _submitting: boolean;
  _calendarByKey: Map<string, CalendarReadModel>;
  _monthRingSlot: CalendarPeriodSlot;
  selectComponent(
    selector: string,
  ): { finishPeriodShift(): void; continueQueuedShift(): void } | undefined;
  handleDateTap(event: TapEvent): void;
  _calendar: CalendarReadModel | undefined;
  _config: SchedulingConfig | undefined;
  _confirmFingerprint: string;
  _confirmOperationId: string;
  _currentGroupId: string;
  _holidays: Map<string, ConfirmedHolidayDate>;
  _initialPeriodId: string;
  _loadSerial: number;
  _periods: readonly PastSchedulePeriod[];
  _records: readonly PastScheduleBackfillRecord[];
  _staged: Map<string, PastScheduleBackfillStage>;
  readonly data: BackfillPageData;
  setData(patch: Partial<BackfillPageData>, callback?: () => void): void;
}

interface BackfillMonthPanel {
  readonly key: string;
  readonly relative: -1 | 0 | 1;
  readonly slot: CalendarPeriodSlot;
  readonly rowHeight: number;
  readonly cells: readonly BackfillCalendarCellView[];
}

const requestAuthentication = getWechatRequestAuthentication();
const manualClient = createRuntimeManualScheduleClient(getStoredWechatToken, requestAuthentication);
const pastScheduleClient = createRuntimePastScheduleClient(
  getStoredWechatToken,
  requestAuthentication,
);
const publicationClient = createRuntimeSchedulePublicationClient(
  getStoredWechatToken,
  requestAuthentication,
);
const workbenchClient = createWorkbenchReadClient();
const initialToday = getChinaStandardTimeBusinessDate();

Page({
  data: {
    monthPanels: [],
    monthPanelHeights: [270, 270, 270],
    gridHeight: 270,
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
  _disposed: false,
  _submitting: false,
  _calendarByKey: new Map<string, CalendarReadModel>(),
  _monthRingSlot: 1,
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
    this._disposed = false;
    this._initialPeriodId = decodeQueryValue(query['schedulePeriodId']);
    this.setData(createShellLayoutPatch());
    void loadBackfillPageWithCapability(this);
  },

  onShow(this: BackfillPageInstance): void {
    void requireClientCapability('core').catch((error: unknown) =>
      setBackfillCapabilityError(this, error),
    );
    const today = getChinaStandardTimeBusinessDate();
    if (today !== this.data.today) {
      this.setData({ today });
      syncBackfillView(this);
    }
  },

  onResize(this: BackfillPageInstance): void {
    this.setData(createShellLayoutPatch());
  },

  handleBack(this: BackfillPageInstance): void {
    if (this.data.isBusy) return;
    if (this._staged.size === 0) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.showModal({
      title: '尚有未确认补录',
      content: '离开将清空当前草稿。',
      confirmText: '清空并离开',
      success: (result) => {
        if (result.confirm) wx.navigateBack({ delta: 1 });
      },
    });
  },

  onUnload(this: BackfillPageInstance): void {
    this._disposed = true;
    this._loadSerial += 1;
    this._staged.clear();
    this._calendarByKey.clear();
  },

  handleReload(this: BackfillPageInstance): void {
    if (this._submitting) return;
    void loadBackfillPageWithCapability(this);
  },

  handleRoleChange(this: BackfillPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const roleIndex = Number(event.detail.value);
    const role = this.data.roleOptions[roleIndex];
    if (!Number.isInteger(roleIndex) || role === undefined || role.id === this.data.roleId) return;
    this.setData({ roleId: role.id, roleIndex });
    void loadCalendarContext(this);
  },

  handleMonthChange(this: BackfillPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const businessMonth = String(event.detail.value);
    if (!/^\d{4}-\d{2}$/u.test(businessMonth) || businessMonth === this.data.businessMonth) return;
    changeBusinessMonth(this, businessMonth);
  },

  handleCalendarMonthChange(
    this: BackfillPageInstance,
    event: { detail: { delta: -1 | 1; current: CalendarPeriodSlot } },
  ): void {
    this._monthRingSlot = event.detail.current;
    this.setData({ businessMonth: addBusinessMonths(this.data.businessMonth, event.detail.delta) });
    syncBackfillView(this, () => {
      const month = this.selectComponent?.('#backfill-month');
      if (month) month.finishPeriodShift();
      else void loadCalendarContext(this);
    });
  },

  handleCalendarMonthSettled(
    this: BackfillPageInstance,
    event: { detail: { continues: boolean } },
  ): void {
    if (event.detail.continues) this.selectComponent?.('#backfill-month')?.continueQueuedShift();
    else void loadCalendarContext(this);
  },

  handleLocateToday(this: BackfillPageInstance): void {
    changeBusinessMonth(this, getCurrentBusinessDate().slice(0, 7));
  },

  handleCalendarSelect(
    this: BackfillPageInstance,
    event: { detail: { businessDate: string } },
  ): void {
    const date = event.detail.businessDate;
    this.handleDateTap({ currentTarget: { dataset: { date, month: date.slice(0, 7) } } });
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
    if (this.data.isBusy || this._submitting) return;
    const businessDate = readDatasetString(event, 'date');
    const cellMonth = readDatasetString(event, 'month');
    if (businessDate === '' || cellMonth !== this.data.businessMonth) return;
    if (!this._calendarByKey.has(`${this.data.roleId}:${cellMonth}`)) {
      this.setData({ errorMessage: '排班资料尚未加载，请重新加载后再补录。' });
      return;
    }
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
  page._calendarByKey = new Map();
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true, state: 'loading' });
  try {
    const groups = await workbenchClient.listGroups();
    const ownerId = getStoredWechatProfile()?.id;
    if (ownerId === undefined) throw new Error('登录状态已失效，请重新登录。');
    const storedGroupId = readStoredWorkbenchGroupId(ownerId);
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
    writeStoredWorkbenchGroupId(ownerId, group.id);
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

async function loadBackfillPageWithCapability(page: BackfillPageInstance): Promise<void> {
  try {
    await requireClientCapability('core');
    await loadBackfillPage(page);
  } catch (error) {
    setBackfillCapabilityError(page, error);
  }
}

function setBackfillCapabilityError(page: BackfillPageInstance, error: unknown): void {
  if (!(error instanceof ClientCapabilityDisabledError)) return;
  page._loadSerial += 1;
  page.setData({ errorMessage: error.message, isBusy: false, state: 'error' });
}

async function loadCalendarContext(page: BackfillPageInstance): Promise<boolean> {
  if (page._disposed) return false;
  const serial = ++page._loadSerial;
  const roleId = page.data.roleId;
  const businessMonth = page.data.businessMonth;
  page._calendar = undefined;
  page._calendarByKey.delete(`${roleId}:${businessMonth}`);
  page.setData({
    calendarCells: [],
    errorMessage: '',
    isBusy: true,
    monthLabel: getBusinessMonthLabel(businessMonth),
  });
  syncBackfillView(page);
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
    page._calendarByKey.set(`${roleId}:${businessMonth}`, calendar);
    for (const holiday of holidays.dates) page._holidays.set(holiday.date, holiday);
    page.setData({ isBusy: page._submitting });
    syncBackfillView(page);
    void preloadBackfillMonths(page, serial, roleId, businessMonth);
    return true;
  } catch (error) {
    if (serial !== page._loadSerial) return false;
    page.setData({
      errorMessage: toUserMessage(error, '排班补录暂时无法完成，请稍后重试。'),
      isBusy: page._submitting,
    });
    syncBackfillView(page);
    return false;
  }
}

async function submitBackfillBatch(page: BackfillPageInstance): Promise<void> {
  if (page.data.isBusy || page._submitting) return;
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
  page._submitting = true;
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  let result: PastScheduleBackfillBatchResult;
  try {
    result = await pastScheduleClient.submitBackfillBatch(page._currentGroupId, {
      ...snapshot,
      items: [...snapshot.items],
    });
    if (page._disposed) {
      page._submitting = false;
      return;
    }
  } catch (error) {
    page._submitting = false;
    if (page._disposed) return;
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
    page._periods = await pastScheduleClient.listPeriods(page._currentGroupId);
    page._calendarByKey.clear();
    const records = await pastScheduleClient.listBackfillRecords(page._currentGroupId);
    page._records = records;
    page.setData({ records: createRecordViews(records) });
  } catch {
    refreshFailed = true;
  }
  const calendarRefreshed = await loadCalendarContext(page);
  refreshFailed = refreshFailed || !calendarRefreshed;
  page._submitting = false;
  if (page._disposed) return;
  page.setData({
    infoMessage: refreshFailed
      ? `${successMessage} 页面资料刷新失败，请稍后重新加载。`
      : successMessage,
    isBusy: false,
  });
}

function syncBackfillView(page: BackfillPageInstance, callback?: () => void): void {
  const monthPanels = createBackfillMonthPanels(page);
  const monthPanelHeights = monthPanels.map((panel) => (panel.cells.length / 7) * panel.rowHeight);
  const memberNames = new Map(
    page.data.members.map((member) => [member.membershipId, member.realName]),
  );
  const shiftTypeNames = new Map(
    page.data.shiftTypes.map((shiftType) => [shiftType.id, shiftType.name]),
  );
  const isPaintReady =
    page.data.roleId !== '' &&
    page.data.activeMemberId !== '' &&
    page.data.activeShiftTypeId !== '';
  page.setData(
    {
      activeMemberName: memberNames.get(page.data.activeMemberId) ?? '未选择成员',
      activeShiftTypeName: shiftTypeNames.get(page.data.activeShiftTypeId) ?? '未选择班种',
      calendarCells: createCalendarCells(page),
      monthPanels,
      monthPanelHeights,
      gridHeight: monthPanelHeights[page._monthRingSlot ?? 1] ?? 270,
      isPaintReady,
      monthLabel: getBusinessMonthLabel(page.data.businessMonth),
      paintStatusText: isPaintReady
        ? '可以连续点选既往日期'
        : page.data.activeMemberId === '' && page.data.activeShiftTypeId === ''
          ? '请选择班种和成员'
          : page.data.activeShiftTypeId === ''
            ? '还需选择班种'
            : '还需选择成员',
      pendingCount: page._staged.size,
    },
    callback,
  );
}

async function preloadBackfillMonths(
  page: BackfillPageInstance,
  serial: number,
  roleId: string,
  month: string,
): Promise<void> {
  const months = [-1, 1].map((delta) => addBusinessMonths(month, delta));
  await Promise.all(
    months.map(async (businessMonth) => {
      const key = `${roleId}:${businessMonth}`;
      if (page._calendarByKey.has(key)) return;
      try {
        const period = page._periods.find(
          (value) => value.scheduleRoleId === roleId && value.businessMonth === businessMonth,
        );
        const [calendar, holidays] = await Promise.all([
          period === undefined
            ? Promise.resolve(createEmptyCalendar(page, roleId, businessMonth))
            : publicationClient.getPeriodCalendar(page._currentGroupId, period.id),
          workbenchClient.getHolidays(Number(businessMonth.slice(0, 4))),
        ]);
        if (serial !== page._loadSerial) return;
        page._calendarByKey.set(key, calendar);
        for (const holiday of holidays.dates) page._holidays.set(holiday.date, holiday);
      } catch {
        /* An unread adjacent month stays disabled until a successful active read. */
      }
    }),
  );
  if (serial === page._loadSerial) syncBackfillView(page);
}

function createBackfillMonthPanels(page: BackfillPageInstance): readonly BackfillMonthPanel[] {
  const logical = ([-1, 0, 1] as const).map((relative) => {
    const month = addBusinessMonths(page.data.businessMonth, relative);
    const cells = createCalendarCells(page, month);
    return {
      key: month,
      relative,
      slot: 1 as CalendarPeriodSlot,
      cells,
      rowHeight: Math.max(54, 30 + Math.max(1, ...cells.map((cell) => cell.duties.length)) * 16),
    };
  });
  return mapCalendarPeriodRing(logical, page._monthRingSlot ?? 1);
}

function createCalendarCells(
  page: BackfillPageInstance,
  month = page.data.businessMonth,
): readonly BackfillCalendarCellView[] {
  const calendar = page._calendarByKey?.get(`${page.data.roleId}:${month}`);
  const assignmentsByDate = new Map<string, CalendarReadModel['assignments'][number][]>();
  for (const assignment of calendar?.assignments ?? []) {
    const rows = assignmentsByDate.get(assignment.businessDate) ?? [];
    rows.push(assignment);
    assignmentsByDate.set(assignment.businessDate, rows);
  }
  const cells = buildMonthDisplayGrid(month).flat();
  return cells.map((cell, index) => {
    const assignments = [...(assignmentsByDate.get(cell.businessDate) ?? [])].sort(
      (a, b) => a.slotPosition - b.slotPosition || a.id.localeCompare(b.id),
    );
    const draft = page._staged.get(`${page.data.roleId}:${cell.businessDate}`);
    const holiday = page._holidays.get(cell.businessDate);
    const isCurrentMonth = !cell.isOutsideMonth;
    const duties: Array<BackfillCalendarCellView['duties'][number]> = assignments.map(
      (assignment, i) => ({
        abbreviation:
          assignments.length > 1 || draft !== undefined ? assignment.shiftTypeAbbreviation : '',
        key: assignment.id,
        name: assignment.actualMemberName ?? assignment.plannedMemberName ?? '待安排',
        state: draft !== undefined && i === 0 ? 'removed' : 'normal',
      }),
    );
    if (draft !== undefined) {
      const shift = page._config?.shiftTypes.find((value) => value.id === draft.shiftTypeId);
      duties.splice(assignments.length > 0 ? 1 : 0, 0, {
        abbreviation:
          shift?.abbreviation ??
          page.data.shiftTypes.find((value) => value.id === draft.shiftTypeId)?.name ??
          '',
        key: `draft:${page.data.roleId}:${cell.businessDate}`,
        name:
          page.data.members.find((value) => value.membershipId === draft.actualMembershipId)
            ?.realName ?? '待安排',
        state: 'added',
      });
    }
    const disabled =
      !isCurrentMonth || cell.businessDate >= page.data.today || calendar === undefined;
    return {
      ariaLabel: `${cell.businessDate}，${duties.map((duty) => `${duty.state === 'removed' ? '原排班' : duty.state === 'added' ? '拟改为' : ''}${duty.name}`).join('，')}${disabled ? '，不可补录' : ''}`,
      businessDate: cell.businessDate,
      day: cell.businessDate.slice(8),
      duties,
      disabled,
      holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
      isCurrentMonth,
      isFuture: !isCurrentMonth || cell.businessDate >= page.data.today,
      isHoliday: isCurrentMonth && holiday?.isOffDay === true,
      isPending: isCurrentMonth && draft !== undefined,
      isSelected: isCurrentMonth && draft !== undefined,
      isToday: isCurrentMonth && cell.businessDate === page.data.today,
      isWeekend: isWeekend(cell.businessDate),
      month: cell.businessDate.slice(0, 7),
      isBottomRow: index >= cells.length - 7,
      isBottomLeft: index === cells.length - 7,
      isBottomRight: index === cells.length - 1,
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
  page.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth) });
  void loadCalendarContext(page);
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
  return getCurrentBusinessDate(now);
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
