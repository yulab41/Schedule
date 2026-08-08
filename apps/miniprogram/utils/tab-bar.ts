interface TabBarLike {
  readonly getTabBar?: () => {
    setData?: (data: { readonly selected: number }) => void;
  };
}

/**
 * 自定义 TabBar 选中态同步。
 * 页面 onShow 时调用，确保图标切换动画与路由跳转同步：
 * wx.switchTab 到达目标页后立即更新 selected，CSS 动画随之播放，避免闪跳。
 */
export function syncTabBar(page: unknown, selected: number): void {
  (page as TabBarLike).getTabBar?.().setData?.({ selected });
}
