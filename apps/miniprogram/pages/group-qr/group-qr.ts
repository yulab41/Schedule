import { getGroupQr } from '../../api/endpoints.js';

interface GroupQrPageData {
  readonly errorMessage: string;
  readonly imageUrl: string;
  readonly loading: boolean;
}

Page({
  data: {
    errorMessage: '',
    imageUrl: '',
    loading: false,
  } as GroupQrPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      this.setData({ errorMessage: '缺少群组参数，请从群管理进入。' });
      return;
    }
    void this.loadQr(groupId);
  },

  async loadQr(groupId: string): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const result = await getGroupQr(groupId);
      this.setData({ imageUrl: `data:image/png;base64,${result.imageBase64}` });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '小程序码加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleSave(): void {
    if (this.data.imageUrl.length === 0 || this.data.loading) {
      return;
    }
    const base64 = this.data.imageUrl.replace(/^data:image\/png;base64,/u, '');
    const filePath = `${wx.env.USER_DATA_PATH}/group-qr-${Date.now()}.png`;
    wx.getFileSystemManager().writeFile({
      data: base64,
      encoding: 'base64',
      filePath,
      fail: () => {
        wx.showToast({ icon: 'none', title: '保存失败，请稍后重试' });
      },
      success: () => {
        wx.saveImageToPhotosAlbum({
          fail: (error) => {
            if (
              typeof error.errMsg === 'string' &&
              (error.errMsg.includes('auth deny') || error.errMsg.includes('auth denied'))
            ) {
              this.promptForAlbumPermission();
            } else {
              wx.showToast({ icon: 'none', title: '保存失败，请检查相册权限' });
            }
          },
          filePath,
          success: () => {
            wx.showToast({ icon: 'success', title: '已保存到相册' });
          },
        });
      },
    });
  },

  promptForAlbumPermission(): void {
    wx.showModal({
      cancelText: '取消',
      confirmText: '去设置',
      content: '请在设置中开启“保存到相册”权限后重试。',
      success: (result) => {
        if (result.confirm) {
          wx.openSetting();
        }
      },
      title: '需要相册权限',
    });
  },
});
