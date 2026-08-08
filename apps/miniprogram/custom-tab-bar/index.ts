interface TabItem {
  readonly icon: 'bell' | 'calendar' | 'home' | 'user';
  readonly pagePath: string;
  readonly text: string;
}

export {};

interface TabBarData {
  readonly list: readonly TabItem[];
  readonly selected: number;
}

Component({
  data: {
    list: [
      { icon: 'home', pagePath: 'pages/workbench/workbench', text: '工作台' },
      { icon: 'calendar', pagePath: 'pages/calendar/calendar', text: '日历' },
      { icon: 'bell', pagePath: 'pages/notifications/notifications', text: '通知' },
      { icon: 'user', pagePath: 'pages/profile/profile', text: '我的' },
    ] as readonly TabItem[],
    selected: 0,
  } as TabBarData,

  methods: {
    onSwitchTab(event: WechatMiniprogram.TouchEvent) {
      const path = event.currentTarget.dataset.path;
      if (typeof path === 'string' && path.length > 0) {
        // 路由跳转与图标动画同步：wx.switchTab 是原生跳转，
        // 目标页 onShow 会重新 setData(selected)，CSS 动画随状态切换播放。
        wx.switchTab({ url: `/${path}` });
      }
    },
  },
});
