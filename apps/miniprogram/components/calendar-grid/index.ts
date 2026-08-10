type CalendarGridTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;
type CalendarGridRouteEvent = WechatMiniprogram.CustomEvent<{
  readonly actionId?: unknown;
}>;

Component({
  properties: {
    role: {
      type: String,
      value: '',
    },
    weeks: {
      type: Array,
      value: [],
    },
  },
  methods: {
    handleDayRoute(event: CalendarGridTapEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId }, { bubbles: true, composed: true });
      }
    },
    handleRoute(event: CalendarGridRouteEvent): void {
      const actionId = event.detail.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId }, { bubbles: true, composed: true });
      }
    },
  },
});
