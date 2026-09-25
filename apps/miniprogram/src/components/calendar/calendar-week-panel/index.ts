Component({
  properties: {
    days: { type: Array, value: [] },
    compact: { type: Boolean, value: false },
  },
  methods: {
    handleSelect(
      this: {
        properties: { days: readonly { businessDate: string; disabled?: boolean }[] };
        triggerEvent(name: string, detail: { businessDate: string }): void;
      },
      event: { currentTarget: { dataset: { businessDate: string } } },
    ) {
      const businessDate = event.currentTarget.dataset.businessDate;
      if (this.properties.days.some((day) => day.businessDate === businessDate && day.disabled))
        return;
      this.triggerEvent('select', { businessDate });
    },
  },
});
