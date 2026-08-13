type DateDetailRouteEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;

Component({
  properties: {
    day: { type: Object, value: null },
  },
  methods: {
    handleRoute(event: DateDetailRouteEvent): void {
      const actionId = event.detail.actionId;
      if (typeof actionId === 'string' && actionId.length > 0)
        this.triggerEvent('route', { actionId }, { bubbles: true, composed: true });
    },
  },
});
