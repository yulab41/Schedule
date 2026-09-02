interface ShiftEventRecordsInstance {
  triggerEvent(name: 'retry'): void;
}

Component({
  properties: {
    cards: { type: Array, value: [] },
    changeChain: { type: String, value: '' },
    errorMessage: { type: String, value: '' },
    meta: { type: String, value: '' },
    state: { type: String, value: 'closed' },
  },
  methods: {
    handleRetry(this: ShiftEventRecordsInstance): void {
      this.triggerEvent('retry');
    },
  },
});
