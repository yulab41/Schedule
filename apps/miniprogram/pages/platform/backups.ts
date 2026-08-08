Page({
  data: {
    errorMessage: '',
  },
  onShow() {
    this.setData({ errorMessage: '平台备份列表将在批次 D 提供。' });
  },
});
