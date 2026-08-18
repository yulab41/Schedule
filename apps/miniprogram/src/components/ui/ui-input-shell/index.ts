interface MiniInputEvent {
  readonly detail: { readonly value: string };
}

interface UiInputShellInstance {
  setData(patch: Record<string, unknown>): void;
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    disabled: { type: Boolean, value: false },
    error: { type: String, value: '' },
    help: { type: String, value: '' },
    label: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    required: { type: Boolean, value: false },
    value: { type: String, value: '' },
  },
  data: { focused: false },
  methods: {
    handleBlur(this: UiInputShellInstance): void {
      this.setData({ focused: false });
      this.triggerEvent('blur');
    },
    handleFocus(this: UiInputShellInstance): void {
      this.setData({ focused: true });
      this.triggerEvent('focus');
    },
    handleInput(this: UiInputShellInstance, event: MiniInputEvent): void {
      this.triggerEvent('change', { value: event.detail.value });
    },
  },
});
