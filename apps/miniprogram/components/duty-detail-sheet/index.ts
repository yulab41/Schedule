type DutyDetailActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;
type DutyDetailRouteEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;

Component({
  properties: {
    assignment: { type: Object, value: null },
    role: { type: String, value: '' },
  },
  methods: {
    handleActionRoute(event: DutyDetailActionEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0)
        this.triggerEvent('route', { actionId });
    },
    handleMarkerRoute(event: DutyDetailRouteEvent): void {
      const actionId = event.detail.actionId;
      if (typeof actionId === 'string' && actionId.length > 0)
        this.triggerEvent('route', { actionId });
    },
  },
});
