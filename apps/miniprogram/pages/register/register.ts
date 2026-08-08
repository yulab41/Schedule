import { createUserProfile } from '../../api/endpoints.js';
import { sessionStore } from '../../store/session.js';

interface RegisterPageData {
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly realName: string;
}

Page({
  data: {
    errorMessage: '',
    loading: false,
    realName: '',
  } as RegisterPageData,

  handleRealNameInput(event: WechatMiniprogram.Input) {
    this.setData({ realName: event.detail.value });
  },

  async handleSubmit(): Promise<void> {
    if (this.data.loading) {
      return;
    }
    const realName = this.data.realName.trim();
    if (realName.length === 0) {
      this.setData({ errorMessage: '请输入真实姓名。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const profile = await createUserProfile(realName);
      sessionStore.setNeedsProfile(false);
      sessionStore.setSession(sessionStore.state.token as string, profile.id);
      const pendingToken = sessionStore.pendingInviteToken;
      if (pendingToken !== undefined) {
        wx.redirectTo({ url: `/pages/invite/invite?t=${encodeURIComponent(pendingToken)}` });
        return;
      }
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '资料保存失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
