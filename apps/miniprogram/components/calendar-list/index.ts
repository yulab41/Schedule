type CalendarRouteEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;
type CalendarDayTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

Component({
  properties: {
    days: { type: Array, value: [] },
    role: { type: String, value: '' },
  },
  methods: {
    handleDayRoute(event: CalendarDayTapEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId });
      }
    },
    handleRoute(event: CalendarRouteEvent): void {
      const actionId = event.detail.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId });
      }
    },
  },
});

export {};
