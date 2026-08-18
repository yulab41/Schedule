interface UiRadioInstance {
  readonly properties: {
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly value: string;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    error: { type: Boolean, value: false },
    label: { type: String, value: '' },
    value: { type: String, value: '' },
  },
  methods: {
    handleSelect(this: UiRadioInstance): void {
      if (this.properties.disabled || this.properties.checked) return;
      this.triggerEvent('change', { value: this.properties.value });
    },
  },
});
