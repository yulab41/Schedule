Page({
  data: {
    errorMessage: '',
  },
  onShow() {
    this.setData({ errorMessage: '排班补录将在批次 C 提供。' });
  },
});
