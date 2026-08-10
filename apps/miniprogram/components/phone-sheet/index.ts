type PhoneActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

Component({
  properties: {
    memberName: { type: String, value: '' },
    phoneActions: { type: Array, value: [] },
  },
  methods: {
    handleCopy(event: PhoneActionEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0)
        this.triggerEvent('copy', { actionId });
    },
    handleDial(event: PhoneActionEvent): void {
      const actionId = event.currentTarget.dataset.actionId;
      if (typeof actionId === 'string' && actionId.length > 0)
        this.triggerEvent('dial', { actionId });
    },
  },
});
