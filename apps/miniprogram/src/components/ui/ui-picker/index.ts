interface UiPickerInstance {
  readonly properties: { readonly disabled: boolean; readonly value: string };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    disabled: { type: Boolean, value: false },
    label: { type: String, value: '' },
    value: { type: String, value: '' },
  },
  methods: {
    handlePress(this: UiPickerInstance): void {
      if (this.properties.disabled) return;
      this.triggerEvent('press', { value: this.properties.value });
    },
  },
});
