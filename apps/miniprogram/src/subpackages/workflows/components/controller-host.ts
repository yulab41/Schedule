import {
  recordMiniTelemetryBoundary,
  type MiniTelemetryBoundaryMarker,
} from '../../../platform/telemetry.js';

type ControllerMethod = (this: WorkflowPanelHost, ...arguments_: unknown[]) => unknown;

interface ControllerDefinition {
  readonly data: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

interface WorkflowPanelHost {
  __attached?: boolean;
  __workflowAttachmentToken?: object;
  __controller: ControllerDefinition | undefined;
  __workflowControllerToken?: object;
  __infoMessageTimer?: unknown;
  __infoMessageToken?: object;
  __workflowPageHidden?: boolean;
  __loadedGroupId?: string;
  __workflowLifecycleManaged?: true;
  readonly data: Readonly<Record<string, unknown>>;
  readonly properties: {
    readonly active: boolean;
    readonly embedded: boolean;
    readonly groupId: string;
  };
  selectAllComponents?(selector: string): readonly { closeFromParent?(): void }[];
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
  triggerEvent?(name: string): void;
}

interface WorkflowPageHost extends WorkflowPanelHost {
  __workflowPageOriginalSetData?: WorkflowPanelHost['setData'];
}

interface WorkflowPageBoundaries {
  readonly controller: MiniTelemetryBoundaryMarker;
  readonly page: MiniTelemetryBoundaryMarker;
}

export interface WorkflowControllerTask {
  isCurrent(): boolean;
}

export function captureWorkflowControllerTask(host: object): WorkflowControllerTask {
  const target = host as WorkflowPanelHost;
  if (target.__workflowLifecycleManaged !== true) return { isCurrent: () => true };
  const controller = target.__controller;
  const token = target.__workflowControllerToken;
  return {
    isCurrent: () =>
      token !== undefined &&
      target.__attached === true &&
      target.__controller === controller &&
      target.__workflowControllerToken === token,
  };
}

export function createWorkflowPageDefinition(
  createDefinition: (embedded: boolean) => unknown,
  boundaries?: WorkflowPageBoundaries,
): ControllerDefinition {
  const prototype = normalizeDefinition(createDefinition(false));
  const delegatedMethods = Object.fromEntries(
    Object.entries(prototype).flatMap(([key, value]) =>
      isControllerMethod(key, value)
        ? [
            [
              key,
              function (this: WorkflowPageHost, ...arguments_: unknown[]) {
                const method = this.__controller?.[key];
                return typeof method === 'function'
                  ? (method as ControllerMethod).apply(this, arguments_)
                  : undefined;
              },
            ],
          ]
        : [],
    ),
  );

  return {
    data: { ...prototype.data, embedded: false },
    ...delegatedMethods,
    onLoad(this: WorkflowPageHost, query: Readonly<Record<string, string | undefined>>): void {
      if (boundaries !== undefined) recordMiniTelemetryBoundary(boundaries.page);
      attachWorkflowPageHost(this);
      startWorkflowPageController(this, createDefinition, query, boundaries?.controller);
    },
    onShow(this: WorkflowPageHost): void {
      resumeWorkflowFeedback(this);
      const onShow = this.__controller?.['onShow'];
      if (typeof onShow === 'function') (onShow as ControllerMethod).call(this);
    },
    onHide(this: WorkflowPageHost): void {
      suspendWorkflowFeedback(this);
      const onHide = this.__controller?.['onHide'];
      if (typeof onHide === 'function') (onHide as ControllerMethod).call(this);
    },
    onUnload(this: WorkflowPageHost): void {
      detachWorkflowPageHost(this);
    },
    handlePickerRequestOpen(this: WorkflowPageHost): void {
      closeWorkflowPickers(this);
    },
    handlePanelBackgroundTap(this: WorkflowPageHost): void {
      closeWorkflowPickers(this);
    },
  };
}

export function registerWorkflowPanel(createDefinition: (embedded: boolean) => unknown): void {
  const prototype = normalizeDefinition(createDefinition(true));
  const delegatedMethods = Object.fromEntries(
    Object.entries(prototype).flatMap(([key, value]) =>
      isControllerMethod(key, value)
        ? [
            [
              key,
              function (this: WorkflowPanelHost, ...arguments_: unknown[]) {
                const method = this.__controller?.[key];
                return typeof method === 'function'
                  ? (method as ControllerMethod).apply(this, arguments_)
                  : undefined;
              },
            ],
          ]
        : [],
    ),
  );

  Component({
    properties: {
      active: { type: Boolean, value: false },
      embedded: { type: Boolean, value: true },
      groupId: { type: String, value: '' },
    },
    data: { ...prototype.data, embedded: true },
    lifetimes: {
      attached(this: WorkflowPanelHost): void {
        const attachmentToken = attachWorkflowHost(this);
        this.setData({ embedded: this.properties.embedded }, () => {
          if (isWorkflowAttachmentCurrent(this, attachmentToken)) {
            this.triggerEvent?.('workspaceready');
          }
        });
        startController(this, createDefinition);
      },
      detached(this: WorkflowPanelHost): void {
        detachWorkflowHost(this);
      },
    },
    observers: {
      groupId(this: WorkflowPanelHost): void {
        if (this.__attached === true) startController(this, createDefinition);
      },
      infoMessage(this: WorkflowPanelHost, value: unknown): void {
        updateInfoMessageTimer(this, value);
      },
    },
    pageLifetimes: {
      hide(this: WorkflowPanelHost): void {
        suspendWorkflowFeedback(this);
      },
      show(this: WorkflowPanelHost): void {
        resumeWorkflowFeedback(this);
        if (!this.properties.active) return;
        const onShow = this.__controller?.['onShow'];
        if (typeof onShow === 'function') {
          this.triggerEvent?.('workspacerequest');
          onShow.call(this);
        }
      },
    },
    methods: {
      ...delegatedMethods,
      handlePickerRequestOpen(this: WorkflowPanelHost): void {
        closeWorkflowPickers(this);
      },
      handlePanelBackgroundTap(this: WorkflowPanelHost): void {
        closeWorkflowPickers(this);
      },
    },
  });
}

function attachWorkflowPageHost(host: WorkflowPageHost): void {
  attachWorkflowHost(host);
  if (host.__workflowPageOriginalSetData !== undefined) return;
  const originalSetData = host.setData;
  host.__workflowPageOriginalSetData = originalSetData;
  host.setData = function (
    this: WorkflowPageHost,
    patch: Readonly<Record<string, unknown>>,
    callback?: () => void,
  ): void {
    if (Object.prototype.hasOwnProperty.call(patch, 'infoMessage')) {
      updateInfoMessageTimer(this, patch['infoMessage']);
    }
    originalSetData.call(this, patch, callback);
  };
}

function detachWorkflowPageHost(host: WorkflowPageHost): void {
  detachWorkflowHost(host);
  const originalSetData = host.__workflowPageOriginalSetData;
  if (originalSetData !== undefined) host.setData = originalSetData;
  delete host.__workflowPageOriginalSetData;
}

function startWorkflowPageController(
  host: WorkflowPageHost,
  createDefinition: (embedded: boolean) => unknown,
  query: Readonly<Record<string, string | undefined>>,
  boundary?: MiniTelemetryBoundaryMarker,
): void {
  if (boundary !== undefined) recordMiniTelemetryBoundary(boundary);
  disposeWorkflowController(host);
  const controller = normalizeDefinition(createDefinition(false));
  installWorkflowController(host, controller);
  host.setData(controller.data);
  const onLoad = controller['onLoad'];
  if (typeof onLoad === 'function') (onLoad as ControllerMethod).call(host, query);
}

function closeWorkflowPickers(host: WorkflowPanelHost): void {
  for (const picker of host.selectAllComponents?.('workflow-picker') ?? []) {
    picker.closeFromParent?.();
  }
}

function clearInfoMessageTimer(host: WorkflowPanelHost): void {
  delete host.__infoMessageToken;
  if (host.__infoMessageTimer === undefined) return;
  clearTimeout(host.__infoMessageTimer);
  host.__infoMessageTimer = undefined;
}

function updateInfoMessageTimer(host: WorkflowPanelHost, value: unknown): void {
  clearInfoMessageTimer(host);
  if (typeof value !== 'string' || value === '' || host.__workflowPageHidden === true) return;
  const expected = value;
  const task = captureWorkflowControllerTask(host);
  if (!task.isCurrent()) return;
  const token = {};
  host.__infoMessageToken = token;
  host.__infoMessageTimer = setTimeout(() => {
    if (host.__infoMessageToken !== token) return;
    delete host.__infoMessageToken;
    host.__infoMessageTimer = undefined;
    if (task.isCurrent() && host.data['infoMessage'] === expected) {
      host.setData({ infoMessage: '' });
    }
  }, 2_000);
}

function suspendWorkflowFeedback(host: WorkflowPanelHost): void {
  host.__workflowPageHidden = true;
  clearInfoMessageTimer(host);
}

function resumeWorkflowFeedback(host: WorkflowPanelHost): void {
  if (host.__workflowPageHidden === true && host.__attached === true) {
    // Hidden-page operations may finish normally, but their old feedback must not reappear.
    host.setData({ infoMessage: '' });
  }
  host.__workflowPageHidden = false;
}

function startController(
  host: WorkflowPanelHost,
  createDefinition: (embedded: boolean) => unknown,
): void {
  const groupId = host.properties.groupId;
  if (groupId === '') {
    disposeWorkflowController(host);
    return;
  }
  if (host.__loadedGroupId === groupId) return;
  disposeWorkflowController(host);
  const controller = normalizeDefinition(createDefinition(host.properties.embedded));
  host.__loadedGroupId = groupId;
  installWorkflowController(host, controller);
  host.setData(controller.data);
  const onLoad = controller['onLoad'];
  if (typeof onLoad === 'function') {
    host.triggerEvent?.('workspacerequest');
    onLoad.call(host, { groupId });
  }
}

function attachWorkflowHost(host: WorkflowPanelHost): object {
  const token = {};
  host.__workflowLifecycleManaged = true;
  host.__attached = true;
  host.__workflowPageHidden = false;
  host.__workflowAttachmentToken = token;
  return token;
}

function detachWorkflowHost(host: WorkflowPanelHost): void {
  host.__attached = false;
  delete host.__workflowAttachmentToken;
  disposeWorkflowController(host);
}

function disposeWorkflowController(host: WorkflowPanelHost): void {
  const controller = host.__controller;
  try {
    closeWorkflowPickers(host);
    const onUnload = controller?.['onUnload'];
    if (typeof onUnload === 'function') (onUnload as ControllerMethod).call(host);
  } finally {
    clearInfoMessageTimer(host);
    delete host.__workflowControllerToken;
    host.__controller = undefined;
    host.__loadedGroupId = '';
  }
}

function installWorkflowController(
  host: WorkflowPanelHost,
  controller: ControllerDefinition,
): void {
  host.__controller = controller;
  host.__workflowControllerToken = {};
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) (host as unknown as Record<string, unknown>)[key] = value;
  }
}

function isWorkflowAttachmentCurrent(host: WorkflowPanelHost, token: object): boolean {
  return host.__attached === true && host.__workflowAttachmentToken === token;
}

function normalizeDefinition(value: unknown): ControllerDefinition {
  if (value === null || typeof value !== 'object' || !('data' in value)) {
    throw new Error('Workflow panel controller definition is invalid.');
  }
  return value as ControllerDefinition;
}

function isControllerMethod(key: string, value: unknown): value is ControllerMethod {
  return (
    typeof value === 'function' &&
    key !== 'onLoad' &&
    key !== 'onShow' &&
    key !== 'onHide' &&
    key !== 'onUnload'
  );
}
