import { buildInfo } from '../../platform/build-info.js';

interface GuestEntryPage {
  data: { guestCode: string };
  setData(patch: { guestCode?: string; errorMessage?: string }): void;
}

function readGuestKey(value: string): string | undefined {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded.match(/(?:^|[^0-9a-f])([0-9a-f]{32})(?:$|[^0-9a-f])/iu)?.[1];
}

Page({
  data: { buildLabel: buildInfo.buildLabel, guestCode: '', errorMessage: '' },
  handleCodeInput(this: GuestEntryPage, event: { detail: { value: string } }): void {
    this.setData({ guestCode: event.detail.value, errorMessage: '' });
  },
  handleOpen(this: GuestEntryPage): void {
    const key = readGuestKey(this.data.guestCode);
    if (!key) {
      this.setData({ errorMessage: '请输入管理员提供的 32 位访客码。' });
      return;
    }
    wx.navigateTo({ url: `/pages/guest/guest?visitorKey=${encodeURIComponent(key)}` });
  },
  handleScan(this: GuestEntryPage): void {
    (
      wx as unknown as {
        scanCode(options: {
          onlyFromCamera: boolean;
          success(result: { result?: string }): void;
        }): void;
      }
    ).scanCode({
      onlyFromCamera: false,
      success: (result) => {
        const key = readGuestKey(result.result ?? '');
        if (!key) {
          this.setData({ errorMessage: '未识别到访客码，请输入管理员提供的访客码。' });
          return;
        }
        wx.navigateTo({ url: `/pages/guest/guest?visitorKey=${encodeURIComponent(key)}` });
      },
    });
  },
});
