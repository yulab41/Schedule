import { getGuestCalendar, resolveGuestGroup } from '../../api/endpoints.js';
import {
  createVisitorCalendarController,
  type VisitorCalendarState,
} from '../../features/visitor/visitor-calendar-controller.js';

const controller = createVisitorCalendarController({
  getGuestCalendar,
  getToday: () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }),
  resolveGuestGroup,
});

interface GuestPageData {
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly groupName: string;
  readonly status: VisitorCalendarState['status'];
  readonly viewModel?: VisitorCalendarState['viewModel'];
}

function pageData(): GuestPageData {
  const state = controller.state;
  return {
    businessMonth: state.businessMonth,
    errorMessage: state.errorMessage ?? '',
    groupName: state.groupName ?? '',
    status: state.status,
    viewModel: state.viewModel,
  };
}

Page({
  data: pageData(),
  onLoad(options: { readonly scene?: unknown }): void {
    wx.hideTabBar({});
    this.sync();
    void controller.activate(options.scene).finally(() => this.sync());
  },
  onShow(): void {
    wx.hideTabBar({});
  },
  onUnload(): void {
    controller.dispose();
  },
  handleNextMonth(): void {
    const operation = controller.changeMonth(1);
    this.sync();
    void operation.finally(() => this.sync());
  },
  handlePreviousMonth(): void {
    const operation = controller.changeMonth(-1);
    this.sync();
    void operation.finally(() => this.sync());
  },
  sync(): void {
    this.setData(pageData());
  },
});
