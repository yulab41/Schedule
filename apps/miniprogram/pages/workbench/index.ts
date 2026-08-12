import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import {
  buildWorkflowRequestRoute,
  buildWorkbenchSections,
  groupsRoute,
  resolveWorkflowRouteContext,
} from '../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../features/navigation/route-guard.js';
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
    if (
      !guardMiniprogramRoute(state, '/pages/workbench/index', {
        hideTabBar: () => wx.hideTabBar({}),
        reLaunch: (options) => wx.reLaunch(options),
        showTabBar: () => wx.showTabBar({}),
        switchTab: (options) => wx.switchTab(options),
      })
    )
      return;
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
    event: WechatMiniprogram.BaseEvent<
      Record<string, never>,
      { readonly entry?: unknown; readonly groupId?: unknown; readonly route?: unknown }
    >,
  ): void {
    const entry = event.currentTarget.dataset.entry;
    const groupId = event.currentTarget.dataset.groupId;
    const route = event.currentTarget.dataset.route;
    if (route === '/pages/calendar/index' || route === '/pages/notifications/index')
      wx.switchTab({ url: route });
    else if (route === groupsRoute) wx.navigateTo({ url: groupsRoute });
    else if (
      (entry === 'leave' || entry === 'swap' || entry === 'duty') &&
      typeof groupId === 'string' &&
      sessionStore.state.status === 'authenticated'
    ) {
      const context = resolveWorkflowRouteContext(sessionStore.state.groups, groupId);
      if (context === undefined) return;
      wx.navigateTo({ url: buildWorkflowRequestRoute(context) });
    } else wx.showToast({ icon: 'none', title: '当前版本尚未开放' });
  },
});
