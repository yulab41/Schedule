import { createUserProfile } from '../../api/endpoints.js';
import { sessionStore } from '../../store/session.js';

interface RegisterPageData {
  readonly errorMessage: string;
  readonly realName: string;
  readonly submitting: boolean;
}

Page({
  data: {
    errorMessage: '',
    realName: '',
    submitting: false,
  } as RegisterPageData,

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ realName: event.detail.value });
  },

  async handleSubmit(): Promise<void> {
    const realName = this.data.realName.trim();
    if (realName.length === 0) {
      this.setData({ errorMessage: '请填写真实姓名。' });
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      const profile = await createUserProfile(realName);
      sessionStore.setSession(sessionStore.state.token ?? '', profile.id);
      sessionStore.setNeedsProfile(false);
      const pendingInvite = sessionStore.pendingInviteToken;
      if (pendingInvite !== undefined) {
        wx.reLaunch({
          url: `/pages/invite/invite?token=${encodeURIComponent(pendingInvite)}`,
        });
        return;
      }
      wx.reLaunch({ url: '/pages/workbench/workbench' });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '资料保存失败，请稍后重试。',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
