Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    showBack: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '',
    },
  },
  methods: {
    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },
  },
});
