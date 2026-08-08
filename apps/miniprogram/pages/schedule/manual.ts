Page({
  data: {
    errorMessage: '',
  },
  onShow() {
    this.setData({ errorMessage: '手动排班将在批次 B 提供。' });
  },
});
