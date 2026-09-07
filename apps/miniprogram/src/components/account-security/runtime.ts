import { createAccountSecurityController } from './controller.js';
import { createProfileAccountClient } from '../../platform/profile-account.js';
import {
  awaitWechatSessionRecovery,
  clearWechatSession,
  getStoredWechatAuthMethod,
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../platform/wechat-identity.js';

export function createRuntimeAccountSecurityController() {
  const account = createProfileAccountClient(
    getStoredWechatToken,
    getWechatRequestAuthentication(),
  );
  return createAccountSecurityController({
    waitForSession: awaitWechatSessionRecovery,
    getProfile: getStoredWechatProfile,
    getAuthMethod: getStoredWechatAuthMethod,
    getPasswordStatus: () => account.getPasswordStatus(),
    changePassword: (input) => account.changePassword(input),
    finishSensitiveSessionChange: () => {
      clearWechatSession(true);
      wx.reLaunch({ url: '/pages/identity/index' });
    },
  });
}
