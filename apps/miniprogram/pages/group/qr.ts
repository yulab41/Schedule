import { getGroupQr } from '../../api/endpoints.js';

interface QrPageData {
  readonly errorMessage: string;
  readonly imageSrc: string;
  readonly infoMessage: string;
}

Page({
  data: {
    errorMessage: '',
    imageSrc: '',
    infoMessage: '',
  } as QrPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId ?? '';
    if (groupId.length > 0) {
      void this.loadQr(groupId);
    }
  },

  async loadQr(groupId: string): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const result = await getGroupQr(groupId);
      this.setData({ imageSrc: `data:image/png;base64,${result.imageBase64}` });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '二维码加载失败。') });
    }
  },

  handleSave() {
    if (this.data.imageSrc.length === 0) {
      return;
    }
    const base64 = this.data.imageSrc.replace(/^data:image\/\w+;base64,/u, '');
    const filePath = `${wx.env.USER_DATA_PATH}/group-qr.png`;
    try {
      wx.getFileSystemManager().writeFileSync(filePath, base64, 'base64');
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => wx.showToast({ icon: 'success', title: '已保存到相册' }),
        fail: () => this.setData({ errorMessage: '保存失败，请检查相册权限。' }),
      });
    } catch {
      this.setData({ errorMessage: '二维码写入失败。' });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
