import {
  navigateForCurrentSession,
  resetUnauthorizedNavigation,
} from '../../../features/auth/auth-runtime.js';
import { sessionStore } from '../../../store/session.js';

Page({
  data: { errorMessage: '', renderer: 'unknown', submitting: false },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
  async handleLogin(): Promise<void> {
    if (this.data.submitting) return;
    this.setData({ errorMessage: '', submitting: true });
    try {
      await sessionStore.signInWithWechat();
      resetUnauthorizedNavigation();
      navigateForCurrentSession();
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '登录失败，请重试。' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
