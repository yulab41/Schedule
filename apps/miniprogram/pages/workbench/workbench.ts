import type { GroupSummary, UserProfile } from '@schedule/contracts';

import { getCurrentProfile, getPlatformMe, listGroups } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  getVisibleNavItems,
  type WorkbenchNavItem,
  type WorkbenchTabId,
} from '../../utils/workbench-nav.js';
import { syncTabBar } from '../../utils/tab-bar.js';

interface WorkbenchModule {
  readonly icon: string;
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

interface WorkbenchPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly isPlatformAdmin: boolean;
  readonly modules: readonly WorkbenchModule[];
  readonly profile: UserProfile | undefined;
  readonly selectedGroupId: string;
  readonly selectedRole: string;
}

const moduleUrls: Readonly<Record<WorkbenchTabId, string>> = {
  backfill: '/pages/schedule/backfill',
  calendar: '/pages/calendar/calendar',
  config: '/pages/schedule/config',
  duty: '/pages/requests/requests?type=duty',
  events: '/pages/events/events',
  groups: '/pages/group/groups',
  leave: '/pages/requests/requests?type=leave',
  manual: '/pages/schedule/manual',
  members: '/pages/group/members',
  notifications: '/pages/notifications/notifications',
  statistics: '/pages/schedule/statistics',
  swap: '/pages/requests/requests?type=swap',
};

Page({
  data: {
    errorMessage: '',
    groups: [],
    isPlatformAdmin: false,
    modules: [],
    profile: undefined,
    selectedGroupId: '',
    selectedRole: '',
  } as WorkbenchPageData,

  onShow() {
    syncTabBar(this, 0);
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const [groups, profile, platform] = await Promise.all([
        listGroups(),
        getCurrentProfile(),
        getPlatformMe().catch(() => ({ isPlatformAdmin: false })),
      ]);
      const selected = resolveSelectedGroup(groups, this.data.selectedGroupId);
      const selectedRole = selected?.role ?? 'member';
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
      }
      const modules = this.buildModules(selectedRole, groups.length, platform.isPlatformAdmin);
      this.setData({
        groups,
        isPlatformAdmin: platform.isPlatformAdmin,
        modules,
        profile,
        selectedGroupId: selected?.id ?? '',
        selectedRole,
      });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '工作台加载失败，请稍后重试。',
      });
    }
  },

  buildModules(
    role: GroupSummary['role'],
    groupCount: number,
    isPlatformAdmin: boolean,
  ): readonly WorkbenchModule[] {
    const navItems = getVisibleNavItems(role);
    const modules: WorkbenchModule[] = navItems.map((item: WorkbenchNavItem) => ({
      icon: moduleIcon(item.id),
      id: item.id,
      label: item.label,
      url: moduleUrls[item.id],
    }));
    if (groupCount === 0) {
      modules.unshift({
        icon: '+',
        id: 'create-group',
        label: '创建群组',
        url: '/pages/group/groups?action=create',
      });
    }
    if (isPlatformAdmin) {
      modules.push({
        icon: '⚙',
        id: 'platform',
        label: '平台运维',
        url: '/pages/platform/jobs',
      });
    }
    return modules;
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ selectedGroupId: groupId });
      setSelectedGroupId(groupId);
      const selected = this.data.groups.find((group) => group.id === groupId);
      this.setData({
        modules: this.buildModules(
          selected?.role ?? 'member',
          this.data.groups.length,
          this.data.isPlatformAdmin,
        ),
        selectedRole: selected?.role ?? 'member',
      });
    }
  },

  openModule(event: WechatMiniprogram.TouchEvent) {
    const url = event.currentTarget.dataset.url;
    if (typeof url !== 'string' || url.length === 0) {
      return;
    }
    if (url === '/pages/calendar/calendar' || url === '/pages/notifications/notifications') {
      wx.switchTab({ url });
      return;
    }
    wx.navigateTo({ url });
  },
});

function moduleIcon(id: string): string {
  const icons: Readonly<Record<string, string>> = {
    backfill: '补',
    calendar: '历',
    config: '配',
    duty: '加',
    events: '事',
    groups: '群',
    leave: '假',
    manual: '排',
    members: '员',
    notifications: '知',
    statistics: '统',
    swap: '换',
  };
  return icons[id] ?? '•';
}
