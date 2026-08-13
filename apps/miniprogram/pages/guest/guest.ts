import { getGuestCalendar, getGuestHolidays, resolveGuestGroup } from '../../api/endpoints.js';
import {
  createVisitorCalendarController,
  type VisitorCalendarController,
  type VisitorCalendarState,
} from '../../features/visitor/visitor-calendar-controller.js';

function getToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

interface GuestPageData {
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly groupName: string;
  readonly status: VisitorCalendarState['status'];
  readonly viewModel?: VisitorCalendarState['viewModel'];
}

interface GuestPageMethods {
  controller?: VisitorCalendarController;
  handleNextMonth(): void;
  handlePreviousMonth(): void;
  sync(): void;
}

function pageData(controller?: VisitorCalendarController): GuestPageData {
  const state = controller?.state;
  return {
    businessMonth: state?.businessMonth ?? getToday().slice(0, 7),
    errorMessage: state?.errorMessage ?? '',
    groupName: state?.groupName ?? '',
    status: state?.status ?? 'loading',
    viewModel: state?.viewModel,
  };
}

Page<GuestPageData, GuestPageMethods>({
  data: pageData(),
  onLoad(options: { readonly scene?: unknown }): void {
    wx.hideTabBar({});
    this.controller = createVisitorCalendarController({
      getGuestCalendar,
      getGuestHolidays,
      getToday,
      publish: () => this.sync(),
      resolveGuestGroup,
    });
    this.sync();
    void this.controller.activate(options.scene);
  },
  onShow(): void {
    wx.hideTabBar({});
  },
  onUnload(): void {
    this.controller?.dispose();
    this.controller = undefined;
  },
  handleNextMonth(): void {
    void this.controller?.changeMonth(1);
  },
  handlePreviousMonth(): void {
    void this.controller?.changeMonth(-1);
  },
  sync(): void {
    this.setData(pageData(this.controller));
  },
});
