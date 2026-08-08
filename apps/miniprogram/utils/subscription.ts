import { appConfig } from '../config/index.js';

export function requestApprovalSubscription(): Promise<void> {
  const templateId = appConfig.templateIds.approvalResult;
  if (templateId.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      complete: () => resolve(),
      fail: () => resolve(),
      success: () => resolve(),
      tmplIds: [templateId],
    });
  });
}
