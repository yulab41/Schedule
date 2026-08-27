type UiSheetCloseSource = 'backdrop' | 'button' | 'swipe';

interface UiSheetInstance {
  triggerEvent(name: 'close', detail: { readonly source: UiSheetCloseSource }): void;
}

Component({
  properties: {
    closeLabel: { type: String, value: '完成' },
    swipeDismiss: { type: Boolean, value: false },
    title: { type: String, value: '' },
    visible: { type: Boolean, value: false },
  },
  methods: {
    handleBackdropClose(this: UiSheetInstance): void {
      emitClose(this, 'backdrop');
    },
    handleButtonClose(this: UiSheetInstance): void {
      emitClose(this, 'button');
    },
    handleSwipeDismiss(this: UiSheetInstance): void {
      emitClose(this, 'swipe');
    },
    preventTouchMove(): void {},
  },
});

function emitClose(sheet: UiSheetInstance, source: UiSheetCloseSource): void {
  sheet.triggerEvent('close', { source });
}
