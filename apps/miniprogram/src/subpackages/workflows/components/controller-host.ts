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
  __controller: ControllerDefinition | undefined;
  __infoMessageTimer?: unknown;
  __loadedGroupId?: string;
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
      const onShow = this.__controller?.['onShow'];
      if (typeof onShow === 'function') (onShow as ControllerMethod).call(this);
    },
    onHide(this: WorkflowPageHost): void {
      const onHide = this.__controller?.['onHide'];
      if (typeof onHide === 'function') (onHide as ControllerMethod).call(this);
    },
    onUnload(this: WorkflowPageHost): void {
      try {
        const onUnload = this.__controller?.['onUnload'];
        if (typeof onUnload === 'function') (onUnload as ControllerMethod).call(this);
      } finally {
        detachWorkflowPageHost(this);
      }
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
        this.__attached = true;
        this.setData({ embedded: this.properties.embedded }, () =>
          this.triggerEvent?.('workspaceready'),
        );
        startController(this, createDefinition);
      },
      detached(this: WorkflowPanelHost): void {
        clearInfoMessageTimer(this);
        this.__attached = false;
        this.__controller = undefined;
        this.__loadedGroupId = '';
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
      show(this: WorkflowPanelHost): void {
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
  host.__attached = true;
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
  clearInfoMessageTimer(host);
  host.__attached = false;
  host.__controller = undefined;
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
  const controller = normalizeDefinition(createDefinition(false));
  host.__controller = controller;
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) (host as unknown as Record<string, unknown>)[key] = value;
  }
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
  if (host.__infoMessageTimer === undefined) return;
  clearTimeout(host.__infoMessageTimer);
  host.__infoMessageTimer = undefined;
}

function updateInfoMessageTimer(host: WorkflowPanelHost, value: unknown): void {
  clearInfoMessageTimer(host);
  if (typeof value !== 'string' || value === '') return;
  const expected = value;
  host.__infoMessageTimer = setTimeout(() => {
    host.__infoMessageTimer = undefined;
    if (host.__attached === true && host.data['infoMessage'] === expected) {
      host.setData({ infoMessage: '' });
    }
  }, 2_000);
}

function startController(
  host: WorkflowPanelHost,
  createDefinition: (embedded: boolean) => unknown,
): void {
  const groupId = host.properties.groupId;
  if (groupId === '') {
    const onUnload = host.__controller?.['onUnload'];
    if (typeof onUnload === 'function') onUnload.call(host);
    host.__controller = undefined;
    host.__loadedGroupId = '';
    return;
  }
  if (host.__loadedGroupId === groupId) return;
  const controller = normalizeDefinition(createDefinition(host.properties.embedded));
  host.__controller = controller;
  host.__loadedGroupId = groupId;
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) (host as unknown as Record<string, unknown>)[key] = value;
  }
  host.setData(controller.data);
  const onLoad = controller['onLoad'];
  if (typeof onLoad === 'function') {
    host.triggerEvent?.('workspacerequest');
    onLoad.call(host, { groupId });
  }
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
