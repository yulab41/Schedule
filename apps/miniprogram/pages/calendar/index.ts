import {
  getCalendar,
  getGuestHolidays,
  getHolidays,
  getLoggedInGuestCalendar,
} from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import {
  addBusinessMonths,
  getCurrentBusinessDate,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import {
  createCalendarPageController,
  parseSelectorPickerIndex,
  type CalendarPageController,
} from '../../features/calendar/calendar-page-controller.js';
import {
  createCalendarMonthStateViewModel,
  type CalendarMonthViewModel,
} from '../../features/calendar/calendar-view-model.js';
import { sessionStore } from '../../store/session.js';

interface CalendarPageData {
  readonly businessMonth: string;
  readonly hasActiveGroup: boolean;
  readonly renderer: string;
  readonly viewModel: CalendarMonthViewModel;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type PhoneActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

interface CalendarPageMethods {
  controller?: CalendarPageController;
  applyPicker(kind: 'member' | 'role' | 'shift', event: PickerEvent): void;
  handleMemberFilter(event: PickerEvent): void;
  handleNextMonth(): void;
  handleOnlyChanges(event: WechatMiniprogram.SwitchChange): void;
  handlePhoneAction(event: PhoneActionEvent): void;
  handlePreviousMonth(): void;
  handleRetry(): void;
  handleRoleFilter(event: PickerEvent): void;
  handleShiftFilter(event: PickerEvent): void;
  loadMonth(force?: boolean): void;
}

function getActiveGroup() {
  const state = sessionStore.state;
  if (state.status !== 'authenticated' || state.activeGroupId === undefined) {
    return undefined;
  }
  return state.groups.find(({ id }) => id === state.activeGroupId);
}

Page<CalendarPageData, CalendarPageMethods>({
  data: {
    businessMonth: getCurrentBusinessMonth(),
    hasActiveGroup: false,
    renderer: 'unknown',
    viewModel: createCalendarMonthStateViewModel(getCurrentBusinessMonth(), 'loading'),
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
    this.controller = createCalendarPageController({
      getCalendar: (groupId, businessMonth) => getCalendar(groupId, businessMonth),
      getGuestHolidays: (year) => getGuestHolidays(year),
      getHolidays: (year) => getHolidays(year),
      getLoggedInGuestCalendar: (groupId, businessMonth) =>
        getLoggedInGuestCalendar(groupId, businessMonth),
      getToday: () => getCurrentBusinessDate(),
      makePhoneCall: (options) => wx.makePhoneCall(options),
      publish: (viewModel) => this.setData({ viewModel }),
      setClipboardData: (options) => wx.setClipboardData(options),
    });
  },
  onShow(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    if (getActiveGroup() === undefined) {
      this.setData({ hasActiveGroup: false });
      return;
    }
    this.setData({ hasActiveGroup: true });
    this.loadMonth();
  },
  applyPicker(kind, event): void {
    const viewModel = this.data.viewModel;
    if (
      viewModel.status !== 'cached' &&
      viewModel.status !== 'ready' &&
      viewModel.status !== 'refreshing'
    ) {
      return;
    }
    const options =
      kind === 'role'
        ? viewModel.filters.roles
        : kind === 'shift'
          ? viewModel.filters.shiftTypes
          : viewModel.filters.members;
    const index = parseSelectorPickerIndex(event.detail.value, options.length);
    if (index === undefined) {
      return;
    }
    const selectedId = index === 0 ? undefined : options[index]?.id;
    if (index > 0 && selectedId === undefined) {
      return;
    }
    this.controller?.setFilters({
      membershipIds:
        kind === 'member'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedMembershipIds,
      onlyChanges: viewModel.filters.onlyChanges,
      roleIds:
        kind === 'role'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedRoleIds,
      shiftTypeIds:
        kind === 'shift'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedShiftTypeIds,
    });
  },
  handleMemberFilter(event): void {
    this.applyPicker('member', event);
  },
  handleNextMonth(): void {
    const businessMonth = addBusinessMonths(this.data.businessMonth, 1);
    this.setData({ businessMonth }, () => this.loadMonth());
  },
  handleOnlyChanges(event): void {
    if (typeof event.detail.value !== 'boolean') {
      return;
    }
    const viewModel = this.data.viewModel;
    if (
      viewModel.status !== 'cached' &&
      viewModel.status !== 'ready' &&
      viewModel.status !== 'refreshing'
    ) {
      return;
    }
    this.controller?.setFilters({
      membershipIds: viewModel.filters.selectedMembershipIds,
      onlyChanges: event.detail.value,
      roleIds: viewModel.filters.selectedRoleIds,
      shiftTypeIds: viewModel.filters.selectedShiftTypeIds,
    });
  },
  handlePhoneAction(event): void {
    const actionId = event.currentTarget.dataset.actionId;
    if (typeof actionId === 'string' && actionId.length > 0) {
      this.controller?.performPhoneAction(actionId);
    }
  },
  handlePreviousMonth(): void {
    const businessMonth = addBusinessMonths(this.data.businessMonth, -1);
    this.setData({ businessMonth }, () => this.loadMonth());
  },
  handleRetry(): void {
    this.loadMonth(true);
  },
  handleRoleFilter(event): void {
    this.applyPicker('role', event);
  },
  handleShiftFilter(event): void {
    this.applyPicker('shift', event);
  },
  loadMonth(force = false): void {
    const group = getActiveGroup();
    if (group === undefined) {
      this.setData({ hasActiveGroup: false });
      return;
    }
    this.setData({ hasActiveGroup: true });
    void this.controller?.load(
      {
        businessMonth: this.data.businessMonth,
        groupId: group.id,
        groupRole: group.role,
      },
      force,
    );
  },
});
