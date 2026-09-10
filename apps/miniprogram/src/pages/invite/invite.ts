// Keep the existing invitation URL stable without loading organization clients in the main package.
Page({
  data: { errorMessage: '' },
  onLoad(this: { setData(patch: { errorMessage: string }): void }, options: { t?: string }) {
    const token = options.t;
    if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/u.test(token)) {
      this.setData({ errorMessage: '邀请链接无效，请向管理员重新获取。' });
      return;
    }
    wx.redirectTo({
      url: `/subpackages/organization/pages/invite-accept/index?t=${encodeURIComponent(token)}`,
      fail: () => this.setData({ errorMessage: '邀请页面暂时无法打开，请重新打开邀请卡片。' }),
    });
  },
});
