type AssignmentRowTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;
type AssignmentRowRouteEvent = WechatMiniprogram.CustomEvent<{
  readonly actionId?: unknown;
}>;

Component({
  properties: {
    assignment: {
      type: Object,
      value: null,
    },
    hideShiftBadge: {
      type: Boolean,
      value: false,
    },
    role: {
      type: String,
      value: '',
    },
  },
  methods: {
    handleRoute(event: AssignmentRowRouteEvent): void {
      const actionId = event.detail.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId });
      }
    },
    handleRowRoute(event: AssignmentRowTapEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0) {
        this.triggerEvent('route', { actionId });
      }
    },
  },
});
