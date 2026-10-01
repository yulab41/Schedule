import type { WorkbenchDuty, WorkbenchListDay, WorkbenchListPanel } from './workbench-model.js';

export type DeferredListPanel = Omit<WorkbenchListPanel, 'days'> & {
  readonly days: readonly (Omit<WorkbenchListDay, 'duties'> & {
    readonly duties: readonly (WorkbenchDuty | { readonly key: string; readonly phone: boolean })[];
  })[];
};

interface ListPage {
  readonly data: {
    readonly listPanels: readonly DeferredListPanel[];
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
  {
    observer: MiniProgramIntersectionObserver;
    key: string;
    groupId: string;
    queued: boolean;
    pending: Map<string, { panelKey: unknown; businessDate: unknown }>;
  }
>();
const sources = new WeakMap<ListPage, { groupId: string; panels: readonly WorkbenchListPanel[] }>();

/** Keep the original row shells/phone height; defer only their offscreen contents. */
export function prepareDeferredListPanels(
  panels: readonly WorkbenchListPanel[],
  previous: readonly DeferredListPanel[],
  scrollTarget = '',
  page?: ListPage,
): readonly DeferredListPanel[] {
  // Large text can make the copy taller than the phone action; keep its natural full layout.
  const fontSize =
    typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo().fontSizeSetting : undefined;
  const supported = typeof wx.createIntersectionObserver === 'function' && (fontSize ?? 16) <= 16;
  if (page) {
    if (supported) sources.set(page, { groupId: page.data.currentGroupId, panels });
    else sources.delete(page);
  }
  const viewport = wx.getWindowInfo().windowHeight;
  return panels.map((panel) => {
    const rendered = new Set(
      previous
        .find((value) => value.key === panel.key)
        ?.days.filter((day) => day.renderDuties === true)
        .map((day) => day.businessDate),
    );
    let height = 0;
    return {
      ...panel,
      days: panel.days.map((day, index) => {
        const renderDuties =
          !supported ||
          index < 2 ||
          (panel.relative === 0 && height < viewport) ||
          rendered.has(day.businessDate) ||
          scrollTarget === `list-day-${day.businessDate}`;
        // Lower bounds from the shared WXSS; taller rows only increase the prepared buffer.
        height += 60 + day.duties.length * 52;
        return {
          ...day,
          renderDuties,
          ...(page
            ? {
                duties: renderDuties
                  ? day.duties
                  : day.duties.map((duty) => ({ key: duty.key, phone: !!duty.phone })),
              }
            : {}),
        };
      }),
    };
  });
}

export function stopDeferredListRendering(page: ListPage): void {
  disconnectObserver(page);
  sources.delete(page);
}

function disconnectObserver(page: ListPage): void {
  observers.get(page)?.observer.disconnect();
  observers.delete(page);
}

function canRender(page: ListPage): boolean {
  return (
    page.data.viewMode === 'list' &&
    ['ready', 'offline'].includes(page.data.state) &&
    page.visible !== false &&
    page.isVisible !== false &&
    (page.data.activeWorkspace === undefined || page.data.activeWorkspace === 'calendar')
  );
}

function revealDay(
  page: ListPage,
  panel: number,
  day: number,
  patch: Record<string, unknown>,
): void {
  const target = page.data.listPanels[panel]?.days[day];
  if (!target || target.renderDuties !== false) return;
  const source = sources.get(page);
  if (source) {
    if (source.groupId !== page.data.currentGroupId) return;
    const full = source.panels
      .find((value) => value.key === page.data.listPanels[panel]?.key)
      ?.days.find((value) => value.businessDate === target.businessDate);
    if (!full) return;
    patch[`listPanels[${panel}].days[${day}].duties`] = full.duties;
  }
  patch[`listPanels[${panel}].days[${day}].renderDuties`] = true;
}

export function syncDeferredListRendering(page: ListPage): void {
  if (!canRender(page)) {
    stopDeferredListRendering(page);
    return;
  }
  if (typeof wx.createIntersectionObserver !== 'function') return;
  const key = JSON.stringify([
    page.data.currentGroupId,
    page.data.listPanels.map((panel) => [panel.key, panel.days.map((day) => day.businessDate)]),
  ]);
  if (observers.get(page)?.key === key) return;
  disconnectObserver(page);
  try {
    const observer = wx.createIntersectionObserver(page, { observeAll: true });
    const state = {
      observer,
      key,
      groupId: page.data.currentGroupId,
      queued: false,
      pending: new Map<string, { panelKey: unknown; businessDate: unknown }>(),
    };
    observers.set(page, state);
    const info = wx.getWindowInfo();
    observer
      .relativeToViewport({
        top: info.windowHeight,
        bottom: info.windowHeight,
        left: 0,
        right: 0,
      })
      .observe('.list-day-slot', (result) => {
        if (
          observers.get(page) !== state ||
          page.data.currentGroupId !== state.groupId ||
          result.intersectionRatio <= 0 ||
          !canRender(page)
        )
          return;
        const { panelKey, businessDate } = result.dataset;
        state.pending.set(JSON.stringify([panelKey, businessDate]), { panelKey, businessDate });
        if (state.queued) return;
        state.queued = true;
        void Promise.resolve().then(() => {
          state.queued = false;
          if (
            observers.get(page) !== state ||
            page.data.currentGroupId !== state.groupId ||
            !canRender(page)
          )
            return;
          const patch: Record<string, unknown> = {};
          for (const entry of state.pending.values()) {
            const panel = page.data.listPanels.findIndex((value) => value.key === entry.panelKey);
            const day =
              page.data.listPanels[panel]?.days.findIndex(
                (value) => value.businessDate === entry.businessDate,
              ) ?? -1;
            revealDay(page, panel, day, patch);
          }
          state.pending.clear();
          if (Object.keys(patch).length > 0) page.setData(patch);
        });
      });
  } catch {
    // A platform observer failure must never leave readable rows blank.
    disconnectObserver(page);
    const patch: Record<string, unknown> = {};
    page.data.listPanels.forEach((panel, i) =>
      panel.days.forEach((day, j) => {
        if (day.renderDuties === false) revealDay(page, i, j, patch);
      }),
    );
    if (Object.keys(patch).length > 0) page.setData(patch);
    sources.delete(page);
  }
}
