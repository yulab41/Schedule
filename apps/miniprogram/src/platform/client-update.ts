interface UpdateManager {
  onUpdateReady(callback: () => void): void;
  onUpdateFailed(callback: () => void): void;
  applyUpdate(): void;
}
interface UpdateDialog {
  title: string;
  content: string;
  confirmText: string;
  showCancel: boolean;
  success(result: { confirm: boolean }): void;
  fail(): void;
}

export function createClientUpdateController(input: {
  getManager(): UpdateManager | undefined;
  showDialog(options: UpdateDialog): void;
}): { initialize(): void; requestUpdate(): void } {
  let manager: UpdateManager | undefined;
  let initialized = false,
    required = false,
    ready = false,
    promptOpen = false;
  let hintShown = false,
    restartOffered = false;
  function offerRestart(): void {
    if (!required || !ready || promptOpen || restartOffered || manager === undefined) return;
    promptOpen = true;
    restartOffered = true;
    try {
      input.showDialog({
        title: '新版已准备好',
        content: '请先保存当前编辑内容。确认后重启小程序并使用新版。',
        confirmText: '重启更新',
        showCancel: true,
        success(result) {
          promptOpen = false;
          if (result.confirm) manager?.applyUpdate();
        },
        fail() {
          promptOpen = false;
          restartOffered = false;
        },
      });
    } catch {
      promptOpen = false;
      restartOffered = false;
    }
  }
  function initialize(): void {
    if (initialized) return;
    initialized = true;
    try {
      manager = input.getManager();
      manager?.onUpdateReady(() => {
        ready = true;
        offerRestart();
      });
      manager?.onUpdateFailed(() => {
        ready = false;
      });
    } catch {
      manager = undefined;
    }
  }
  return {
    initialize,
    requestUpdate() {
      required = true;
      initialize();
      if (ready) {
        offerRestart();
        return;
      }
      if (hintShown || promptOpen) return;
      hintShown = true;
      promptOpen = true;
      try {
        input.showDialog({
          title: '请更新小程序',
          content:
            '当前版本已停用。请先保存编辑内容，再关闭并重新进入小程序获取新版；下载完成后会提示重启。',
          confirmText: '知道了',
          showCancel: false,
          success() {
            promptOpen = false;
            offerRestart();
          },
          fail() {
            promptOpen = false;
            hintShown = false;
          },
        });
      } catch {
        promptOpen = false;
        hintShown = false;
      }
    },
  };
}

const runtimeUpdate = createClientUpdateController({
  getManager: () => (typeof wx.getUpdateManager === 'function' ? wx.getUpdateManager() : undefined),
  showDialog: (options) => wx.showModal(options),
});
function resolveRuntimeUpdate(): ReturnType<typeof createClientUpdateController> {
  if (typeof getApp === 'function') {
    try {
      const data = getApp<{
        globalData?: { clientUpdateController?: ReturnType<typeof createClientUpdateController> };
      }>().globalData;
      if (data !== undefined) {
        data.clientUpdateController ??= runtimeUpdate;
        return data.clientUpdateController;
      }
    } catch {
      /* App may not yet be registered. */
    }
  }
  return runtimeUpdate;
}
export function initializeClientUpdate(): void {
  resolveRuntimeUpdate().initialize();
}
export { requestClientUpdate } from './client-update-request.js';
