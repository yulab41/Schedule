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
  readonly properties: { readonly embedded: boolean; readonly groupId: string };
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
}

export function registerWorkflowPanel(createDefinition: (embedded: boolean) => unknown): void {
  const prototype = normalizeDefinition(createDefinition(true));
  const methods = Object.fromEntries(
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
      embedded: { type: Boolean, value: true },
      groupId: { type: String, value: '' },
    },
    data: { ...prototype.data, embedded: true },
    lifetimes: {
      attached(this: WorkflowPanelHost): void {
        this.__attached = true;
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
        clearInfoMessageTimer(this);
        if (typeof value !== 'string' || value === '') return;
        const expected = value;
        this.__infoMessageTimer = setTimeout(() => {
          this.__infoMessageTimer = undefined;
          if (this.__attached === true && this.data['infoMessage'] === expected) {
            this.setData({ infoMessage: '' });
          }
        }, 3_000);
      },
    },
    pageLifetimes: {
      show(this: WorkflowPanelHost): void {
        const onShow = this.__controller?.['onShow'];
        if (typeof onShow === 'function') onShow.call(this);
      },
    },
    methods,
  });
}

function clearInfoMessageTimer(host: WorkflowPanelHost): void {
  if (host.__infoMessageTimer === undefined) return;
  clearTimeout(host.__infoMessageTimer);
  host.__infoMessageTimer = undefined;
}

function startController(
  host: WorkflowPanelHost,
  createDefinition: (embedded: boolean) => unknown,
): void {
  const groupId = host.properties.groupId;
  if (groupId === '' || host.__loadedGroupId === groupId) return;
  const controller = normalizeDefinition(createDefinition(host.properties.embedded));
  host.__controller = controller;
  host.__loadedGroupId = groupId;
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) (host as unknown as Record<string, unknown>)[key] = value;
  }
  host.setData(controller.data);
  const onLoad = controller['onLoad'];
  if (typeof onLoad === 'function') onLoad.call(host, { groupId });
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
