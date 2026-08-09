import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { buildWorkbenchSections } from '../../features/navigation/workbench-navigation.js';
import { sessionStore } from '../../store/session.js';

Page({
  data: { activeGroupId: '', sections: [] as ReturnType<typeof buildWorkbenchSections> },
  onShow(): void {
    this.refresh();
  },
  refresh(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    this.setData({
      activeGroupId: state.activeGroupId ?? '',
      sections: buildWorkbenchSections(state.groups, state.isPlatformAdmin),
    });
  },
  handleSelectGroup(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly groupId?: unknown }>,
  ): void {
    const groupId = event.currentTarget.dataset.groupId;
    if (typeof groupId === 'string' && sessionStore.setActiveGroupId(groupId)) this.refresh();
  },
  handleEntry(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly route?: unknown }>,
  ): void {
    const route = event.currentTarget.dataset.route;
    if (route === '/pages/calendar/index' || route === '/pages/notifications/index')
      wx.switchTab({ url: route });
    else wx.showToast({ icon: 'none', title: '当前版本尚未开放' });
  },
});
