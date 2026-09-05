// Reuse the current page's custom-navigation measurement, including the embedded workbench shell.
declare function getCurrentPages(): readonly {
  readonly data?: { readonly shellHeaderHeight?: unknown };
}[];

function nonnegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function readTopOverlayOffset(minimum = 0): number {
  const windowInfo = wx.getWindowInfo();
  const statusBar = nonnegative(windowInfo.statusBarHeight ?? windowInfo.safeArea?.top);
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const navigationBottom = nonnegative(pages[pages.length - 1]?.data?.shellHeaderHeight);
  let capsuleBottom = statusBar;
  // Some desktop/native transitions temporarily return no usable capsule rectangle.
  try {
    const capsule = wx.getMenuButtonBoundingClientRect();
    if (
      capsule.width > 0 &&
      capsule.height > 0 &&
      capsule.top >= statusBar &&
      capsule.bottom >= capsule.top + capsule.height &&
      capsule.left >= 0 &&
      capsule.right <= windowInfo.windowWidth &&
      Number.isFinite(capsule.bottom)
    ) {
      capsuleBottom = capsule.bottom + Math.max(0, capsule.top - statusBar);
    }
  } catch {
    // The existing navigation/status-bar measurement remains the safe fallback.
  }
  return Math.ceil(Math.max(statusBar, capsuleBottom, navigationBottom, nonnegative(minimum)) + 8);
}
