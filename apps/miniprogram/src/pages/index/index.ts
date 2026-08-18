interface BooleanChangeEvent {
  readonly detail: { readonly checked: boolean };
}

interface RadioChangeEvent {
  readonly detail: { readonly value: 'month' | 'week' };
}

interface TextChangeEvent {
  readonly detail: { readonly value: string };
}

interface FoundationPageInstance {
  readonly data: {
    readonly calendarView: 'month' | 'week';
    readonly changesOnly: boolean;
    readonly notifications: boolean;
  };
  setData(patch: Record<string, unknown>): void;
}

Page({
  data: {
    calendarView: 'month' as const,
    changesOnly: true,
    contactChecked: true,
    notifications: false,
    templateName: '十月头颈外科值班',
  },
  handleCalendarViewChange(this: FoundationPageInstance, event: RadioChangeEvent): void {
    this.setData({ calendarView: event.detail.value });
  },
  handleChangesOnlyChange(this: FoundationPageInstance, event: BooleanChangeEvent): void {
    this.setData({ changesOnly: event.detail.checked });
  },
  handleChangesOnlyCopyPress(this: FoundationPageInstance): void {
    this.setData({ changesOnly: !this.data.changesOnly });
  },
  handleContactCheckedChange(this: FoundationPageInstance, event: BooleanChangeEvent): void {
    this.setData({ contactChecked: event.detail.checked });
  },
  handleNotificationsChange(this: FoundationPageInstance, event: BooleanChangeEvent): void {
    this.setData({ notifications: event.detail.checked });
  },
  handleNotificationsCopyPress(this: FoundationPageInstance): void {
    this.setData({ notifications: !this.data.notifications });
  },
  handleTemplateNameChange(this: FoundationPageInstance, event: TextChangeEvent): void {
    this.setData({ templateName: event.detail.value });
  },
});
