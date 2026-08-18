interface UiButtonInstance {
  readonly properties: {
    readonly disabled: boolean;
    readonly loading: boolean;
    readonly variant: string;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    ariaLabel: { type: String, value: '' },
    disabled: { type: Boolean, value: false },
    label: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    variant: { type: String, value: 'secondary' },
  },
  methods: {
    handlePress(this: UiButtonInstance): void {
      if (this.properties.disabled || this.properties.loading) return;
      this.triggerEvent('press', { variant: this.properties.variant });
    },
  },
});
