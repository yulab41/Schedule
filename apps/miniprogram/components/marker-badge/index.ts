type MarkerBadgeTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

Component({
  properties: {
    marker: {
      type: Object,
      value: null,
    },
  },
  methods: {
    handleRoute(event: MarkerBadgeTapEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId });
      }
    },
  },
});
