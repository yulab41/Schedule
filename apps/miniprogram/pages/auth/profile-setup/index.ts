import { navigateForCurrentSession } from '../../../features/auth/auth-runtime.js';
import { sessionStore } from '../../../store/session.js';

Page({
  data: { errorMessage: '', realName: '', submitting: false },
  handleNameInput(event: WechatMiniprogram.Input): void {
    this.setData({ realName: event.detail.value });
  },
  async handleSubmit(): Promise<void> {
    if (this.data.submitting) return;
    this.setData({ errorMessage: '', submitting: true });
    try {
      await sessionStore.completeProfile(this.data.realName);
      navigateForCurrentSession();
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '保存失败，请重试。' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
