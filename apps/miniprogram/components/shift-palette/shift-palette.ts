Component({
  properties: {
    shiftTypes: {
      type: Array,
      value: [] as {
        readonly abbreviation: string;
        readonly color: string;
        readonly id: string;
        readonly name: string;
        readonly textColor: string;
      }[],
    },
    selectedId: {
      type: String,
      value: '',
    },
  },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const id = event.currentTarget.dataset.id;
      if (typeof id === 'string') {
        this.triggerEvent('select', { shiftTypeId: id });
      }
    },
  },
});
