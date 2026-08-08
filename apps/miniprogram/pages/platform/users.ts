import { setPlatformUserStatus } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';

interface UsersPageData {
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly submitting: boolean;
  readonly userId: string;
}

Page({
  data: {
    errorMessage: '',
    infoMessage: '',
    submitting: false,
    userId: '',
  } as UsersPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
  },

  onUserIdInput(event: WechatMiniprogram.Input) {
    this.setData({ userId: event.detail.value });
  },

  async handleStatus(status: 'active' | 'suspended'): Promise<void> {
    const userId = this.data.userId.trim();
    if (userId.length === 0) {
      this.setData({ errorMessage: '请先输入用户 ID。' });
      return;
    }
    const confirmed = await confirmAction(
      status === 'suspended' ? '停用账号' : '启用账号',
      status === 'suspended' ? '停用后该用户将无法登录与操作。' : '启用后该用户恢复登录与操作。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await setPlatformUserStatus(userId, { status });
      this.setData({ infoMessage: `已${status === 'suspended' ? '停用' : '启用'}账号。` });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '操作失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleSuspend() {
    void this.handleStatus('suspended');
  },

  handleActivate() {
    void this.handleStatus('active');
  },
});

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}
