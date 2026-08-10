Component({
  properties: {
    assignment: { type: Object, value: null },
    changeChainSummary: {
      type: String,
      value: '',
      observer(): void {
        this.setData({ isChainExpanded: false });
      },
    },
    errorMessage: { type: String, value: '' },
    hasMore: { type: Boolean, value: false },
    items: { type: Array, value: [] },
    status: { type: String, value: 'idle' },
  },
  data: { isChainExpanded: false },
  methods: {
    handleChainToggle(): void {
      if (this.properties.changeChainSummary.length === 0) return;
      this.setData({ isChainExpanded: !this.data.isChainExpanded });
    },
  },
});
