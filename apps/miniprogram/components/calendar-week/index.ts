type CalendarRouteEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;
type CalendarDayTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

Component({
  properties: {
    role: { type: String, value: '' },
    week: { type: Object, value: null },
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
