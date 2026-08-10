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
  createCalendarDevFixtureDependencies,
  isCalendarDevFixtureEnabled,
} from '../../features/calendar/calendar-dev-fixture.js';
import {
  calendarFixtureGroupId,
  goldenBusinessMonth,
  goldenToday,
} from '../../features/calendar/calendar-golden-data.js';
import {
  createCalendarPageController,
  parseSelectorPickerIndex,
  type CalendarPageController,
} from '../../features/calendar/calendar-page-controller.js';
import {
  resolveCalendarRouteAction,
  type CalendarRouteTarget,
} from '../../features/calendar/calendar-routing.js';
import {
  createCalendarMonthStateViewModel,
  type CalendarMonthViewModel,
} from '../../features/calendar/calendar-view-model.js';
import { sessionStore } from '../../store/session.js';

interface CalendarPageData {
  readonly activeRole: string;
  readonly businessMonth: string;
  readonly hasActiveGroup: boolean;
  readonly renderer: string;
  readonly viewModel: CalendarMonthViewModel;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type ActionIdEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;

interface CalendarPageMethods {
  controller?: CalendarPageController;
  applyPicker(kind: 'member' | 'role' | 'shift', event: PickerEvent): void;
  handleMemberFilter(event: PickerEvent): void;
  handleNextMonth(): void;
  handleOnlyChanges(event: WechatMiniprogram.SwitchChange): void;
  handlePreviousMonth(): void;
  handleRetry(): void;
  handleRouteAction(event: ActionIdEvent): void;
  handleRoleFilter(event: PickerEvent): void;
  handleShiftFilter(event: PickerEvent): void;
  lastResolvedRoute?: CalendarRouteTarget;
  loadMonth(force?: boolean): void;
}

function getActiveGroup() {
  const state = sessionStore.state;
  if (state.status !== 'authenticated' || state.activeGroupId === undefined) {
    return undefined;
  }
  return state.groups.find(({ id }) => id === state.activeGroupId);
}

function isUsingCalendarDevFixture(): boolean {
  try {
    return isCalendarDevFixtureEnabled(wx.getAccountInfoSync().miniProgram.envVersion);
  } catch {
    return false;
  }
}

function getCalendarGroup() {
  if (isUsingCalendarDevFixture()) {
    return { id: calendarFixtureGroupId, role: 'member' as const };
  }
  return getActiveGroup();
}

function getInitialBusinessMonth(): string {
  return isUsingCalendarDevFixture() ? goldenBusinessMonth : getCurrentBusinessMonth();
}

Page<CalendarPageData, CalendarPageMethods>({
  data: {
    activeRole: '',
    businessMonth: getInitialBusinessMonth(),
    hasActiveGroup: false,
    renderer: 'unknown',
    viewModel: createCalendarMonthStateViewModel(getInitialBusinessMonth(), 'loading'),
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
    const devFixtureDependencies = isUsingCalendarDevFixture()
      ? createCalendarDevFixtureDependencies()
      : undefined;
    this.controller = createCalendarPageController({
      getCalendar:
        devFixtureDependencies?.getCalendar ??
        ((groupId, businessMonth) => getCalendar(groupId, businessMonth)),
      getGuestHolidays:
        devFixtureDependencies?.getGuestHolidays ?? ((year) => getGuestHolidays(year)),
      getHolidays: devFixtureDependencies?.getHolidays ?? ((year) => getHolidays(year)),
      getLoggedInGuestCalendar: (groupId, businessMonth) =>
        devFixtureDependencies?.getLoggedInGuestCalendar(groupId, businessMonth) ??
        getLoggedInGuestCalendar(groupId, businessMonth),
      getToday: () =>
        devFixtureDependencies === undefined ? getCurrentBusinessDate() : goldenToday,
      makePhoneCall: (options) => wx.makePhoneCall(options),
      publish: (viewModel) => this.setData({ viewModel }),
      setClipboardData: (options) => wx.setClipboardData(options),
    });
  },
  onShow(): void {
    const state = sessionStore.state;
    const usingDevFixture = isUsingCalendarDevFixture();
    if (!usingDevFixture && state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    const group = getCalendarGroup();
    if (group === undefined) {
      this.setData({ activeRole: '', hasActiveGroup: false });
      return;
    }
    this.setData({ activeRole: group.role, hasActiveGroup: true });
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
  handlePreviousMonth(): void {
    const businessMonth = addBusinessMonths(this.data.businessMonth, -1);
    this.setData({ businessMonth }, () => this.loadMonth());
  },
  handleRetry(): void {
    this.loadMonth(true);
  },
  handleRouteAction(event): void {
    const actionId = event.detail.actionId;
    if (typeof actionId !== 'string' || actionId.length === 0) {
      return;
    }
    const group = getCalendarGroup();
    const viewModel = this.data.viewModel;
    if (
      group === undefined ||
      (viewModel.status !== 'cached' &&
        viewModel.status !== 'ready' &&
        viewModel.status !== 'refreshing')
    ) {
      return;
    }
    const target = resolveCalendarRouteAction(actionId, group.role, [viewModel]);
    if (target !== undefined) {
      this.lastResolvedRoute = target;
    }
  },
  handleRoleFilter(event): void {
    this.applyPicker('role', event);
  },
  handleShiftFilter(event): void {
    this.applyPicker('shift', event);
  },
  loadMonth(force = false): void {
    const group = getCalendarGroup();
    if (group === undefined) {
      this.setData({ activeRole: '', hasActiveGroup: false });
      return;
    }
    this.setData({ activeRole: group.role, hasActiveGroup: true });
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
