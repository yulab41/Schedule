import type { WorkbenchListPanel } from './workbench-model.js';

interface ListPage {
  readonly data: {
    readonly listPanels: readonly WorkbenchListPanel[];
    readonly currentGroupId: string;
    readonly viewMode: string;
    readonly state: string;
    readonly activeWorkspace?: string;
  };
  readonly isVisible?: boolean;
  readonly visible?: boolean;
  setData(patch: Record<string, unknown>): void;
}

const observers = new WeakMap<
  ListPage,
  { observer: MiniProgramIntersectionObserver; key: string }
>();

/** Keep the original row shells/phone height; defer only their offscreen contents. */
export function prepareDeferredListPanels(
  panels: readonly WorkbenchListPanel[],
  previous: readonly WorkbenchListPanel[],
  scrollTarget = '',
): readonly WorkbenchListPanel[] {
  // Large text can make the copy taller than the phone action; keep its natural full layout.
  const fontSize =
    typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo().fontSizeSetting : undefined;
  const supported = typeof wx.createIntersectionObserver === 'function' && (fontSize ?? 16) <= 16;
  return panels.map((panel) => {
    const rendered = new Set(
      previous
        .find((value) => value.key === panel.key)
        ?.days.filter((day) => day.renderDuties === true)
        .map((day) => day.businessDate),
    );
    return {
      ...panel,
      days: panel.days.map((day, index) => ({
        ...day,
        renderDuties:
          !supported ||
          index < 2 ||
          rendered.has(day.businessDate) ||
          scrollTarget === `list-day-${day.businessDate}`,
      })),
    };
  });
}

export function stopDeferredListRendering(page: ListPage): void {
  observers.get(page)?.observer.disconnect();
  observers.delete(page);
}

export function syncDeferredListRendering(page: ListPage): void {
  if (
    page.data.viewMode !== 'list' ||
    !['ready', 'offline'].includes(page.data.state) ||
    page.visible === false ||
    page.isVisible === false ||
    (page.data.activeWorkspace !== undefined && page.data.activeWorkspace !== 'calendar')
  ) {
    stopDeferredListRendering(page);
    return;
  }
  if (typeof wx.createIntersectionObserver !== 'function') return;
  const key = JSON.stringify([
    page.data.currentGroupId,
    page.data.listPanels.map((panel) => [panel.key, panel.days.map((day) => day.businessDate)]),
  ]);
  if (observers.get(page)?.key === key) return;
  stopDeferredListRendering(page);
  try {
    const observer = wx.createIntersectionObserver(page, { observeAll: true });
    const state = { observer, key };
    const groupId = page.data.currentGroupId;
    observers.set(page, state);
    const info = wx.getWindowInfo();
    observer
      .relativeToViewport({
        top: info.windowHeight,
        bottom: info.windowHeight,
        left: info.windowWidth,
        right: info.windowWidth,
      })
      .observe('.list-day-slot', (result) => {
        if (
          observers.get(page) !== state ||
          page.data.currentGroupId !== groupId ||
          result.intersectionRatio <= 0 ||
          page.data.viewMode !== 'list' ||
          !['ready', 'offline'].includes(page.data.state) ||
          page.visible === false ||
          page.isVisible === false
        )
          return;
        if (page.data.activeWorkspace !== undefined && page.data.activeWorkspace !== 'calendar')
          return;
        const panel = page.data.listPanels.findIndex(
          (value) => value.key === result.dataset.panelKey,
        );
        const day =
          page.data.listPanels[panel]?.days.findIndex(
            (value) => value.businessDate === result.dataset.businessDate,
          ) ?? -1;
        if (day < 0 || page.data.listPanels[panel]?.days[day]?.renderDuties !== false) return;
        page.setData({ [`listPanels[${panel}].days[${day}].renderDuties`]: true });
      });
  } catch {
    // A platform observer failure must never leave readable rows blank.
    stopDeferredListRendering(page);
    const patch: Record<string, unknown> = {};
    page.data.listPanels.forEach((panel, i) =>
      panel.days.forEach((day, j) => {
        if (day.renderDuties === false) patch[`listPanels[${i}].days[${j}].renderDuties`] = true;
      }),
    );
    if (Object.keys(patch).length > 0) page.setData(patch);
  }
}
