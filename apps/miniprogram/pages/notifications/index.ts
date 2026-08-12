import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { guardMiniprogramRoute } from '../../features/navigation/route-guard.js';
import { sessionStore } from '../../store/session.js';

Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
  onShow(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    guardMiniprogramRoute(state, '/pages/notifications/index', {
      hideTabBar: () => wx.hideTabBar({}),
      reLaunch: (options) => wx.reLaunch(options),
      showTabBar: () => wx.showTabBar({}),
      switchTab: (options) => wx.switchTab(options),
    });
  },
});
