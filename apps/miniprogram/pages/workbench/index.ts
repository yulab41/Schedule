import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import {
  activateGlobalWorkbenchAction,
  activateWorkbenchEntry,
  buildWorkbenchPageModel,
} from '../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../features/navigation/route-guard.js';
import { sessionStore } from '../../store/session.js';

Page({
  data: {
    globalActions: [] as ReturnType<typeof buildWorkbenchPageModel>['globalActions'],
    sections: [] as ReturnType<typeof buildWorkbenchPageModel>['sections'],
  },
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
    this.setData(buildWorkbenchPageModel(state.groups, state.isPlatformAdmin, state.activeGroupId));
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
      { readonly entry?: unknown; readonly groupId?: unknown }
    >,
  ): void {
    const entry = event.currentTarget.dataset.entry;
    const groupId = event.currentTarget.dataset.groupId;
    const state = sessionStore.state;
    if (
      state.status !== 'authenticated' ||
      typeof groupId !== 'string' ||
      !(
        entry === 'backfill' ||
        entry === 'calendar' ||
        entry === 'config' ||
        entry === 'duty' ||
        entry === 'events' ||
        entry === 'groups' ||
        entry === 'leave' ||
        entry === 'manual' ||
        entry === 'members' ||
        entry === 'notifications' ||
        entry === 'statistics' ||
        entry === 'swap'
      )
    )
      return;
    activateWorkbenchEntry(
      state.groups,
      { entryId: entry, groupId },
      {
        navigateTo: (options) => wx.navigateTo(options),
        setActiveGroupId: (targetGroupId) => {
          const selected = sessionStore.setActiveGroupId(targetGroupId);
          if (selected) this.refresh();
          return selected;
        },
        showUnavailable: () => wx.showToast({ icon: 'none', title: '当前版本尚未开放' }),
        switchTab: (options) => wx.switchTab(options),
      },
    );
  },
  handleGlobalAction(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly action?: unknown }>,
  ): void {
    activateGlobalWorkbenchAction(event.currentTarget.dataset.action, {
      navigateTo: (options) => wx.navigateTo(options),
      switchTab: (options) => wx.switchTab(options),
    });
  },
});
