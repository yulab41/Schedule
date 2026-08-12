type GridEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly cycleDay?: unknown; readonly membershipId?: unknown }
>;
let timer: ReturnType<typeof setTimeout> | undefined;
let press:
  { readonly cycleDay: number; readonly membershipId: string; readonly startX: number } | undefined;

Component({
  properties: { columns: { type: Array, value: [] }, rows: { type: Array, value: [] } },
  methods: {
    emit(event: GridEvent, name: 'cell' | 'longpress'): void {
      const { cycleDay, membershipId } = event.currentTarget.dataset;
      if (typeof cycleDay === 'number' && typeof membershipId === 'string')
        this.triggerEvent(name, { cycleDay, membershipId }, { bubbles: true, composed: true });
    },
    handleCell(event: GridEvent): void {
      this.emit(event, 'cell');
    },
    handleTouchStart(event: WechatMiniprogram.TouchEvent): void {
      const { cycleDay, membershipId } = event.currentTarget.dataset;
      const touch = event.touches[0];
      if (typeof cycleDay !== 'number' || typeof membershipId !== 'string' || touch === undefined)
        return;
      press = { cycleDay, membershipId, startX: touch.clientX };
      timer = setTimeout(() => {
        if (press !== undefined)
          this.triggerEvent('longpress', press, { bubbles: true, composed: true });
        press = undefined;
        timer = undefined;
      }, 500);
    },
    handleTouchMove(event: WechatMiniprogram.TouchEvent): void {
      const touch = event.touches[0];
      if (
        press !== undefined &&
        touch !== undefined &&
        Math.abs(touch.clientX - press.startX) >= 12
      )
        this.cancelPress();
    },
    handleTouchEnd(): void {
      this.cancelPress();
    },
    cancelPress(): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      press = undefined;
    },
  },
});
