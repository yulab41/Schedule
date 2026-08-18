interface UiCheckboxInstance {
  readonly properties: { readonly checked: boolean; readonly disabled: boolean };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    error: { type: Boolean, value: false },
    indeterminate: { type: Boolean, value: false },
    label: { type: String, value: '' },
  },
  methods: {
    handleToggle(this: UiCheckboxInstance): void {
      if (this.properties.disabled) return;
      this.triggerEvent('change', { checked: !this.properties.checked });
    },
  },
});
