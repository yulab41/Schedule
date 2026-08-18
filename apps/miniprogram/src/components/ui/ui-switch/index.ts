interface UiSwitchInstance {
  readonly properties: {
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly loading: boolean;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    label: { type: String, value: '' },
    loading: { type: Boolean, value: false },
  },
  methods: {
    handleToggle(this: UiSwitchInstance): void {
      if (this.properties.disabled || this.properties.loading) return;
      this.triggerEvent('change', { checked: !this.properties.checked });
    },
  },
});
