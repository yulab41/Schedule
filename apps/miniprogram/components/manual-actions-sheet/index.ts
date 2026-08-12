Component({
  properties: { canUndo: { type: Boolean, value: false } },
  methods: {
    handleUndo(): void {
      this.triggerEvent('undo', {}, { bubbles: true, composed: true });
    },
  },
});
