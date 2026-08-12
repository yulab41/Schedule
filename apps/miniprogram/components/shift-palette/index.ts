type ShiftEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly shiftId?: unknown }
>;
Component({
  properties: { shifts: { type: Array, value: [] } },
  methods: {
    handleShift(event: ShiftEvent): void {
      const shiftId = event.currentTarget.dataset.shiftId;
      if (typeof shiftId === 'string')
        this.triggerEvent('shift', { shiftId }, { bubbles: true, composed: true });
    },
  },
});
