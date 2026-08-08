Page({
  data: {
    errorMessage: '',
  },
  onShow() {
    this.setData({ errorMessage: '节假日导入将在批次 D 提供。' });
  },
});
