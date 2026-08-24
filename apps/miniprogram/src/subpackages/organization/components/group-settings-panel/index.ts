import { createGroupSettingsPanelControllerDefinition } from './controller.js';

type ControllerMethod = (this: GroupSettingsPanelHost, ...arguments_: unknown[]) => unknown;

interface ControllerDefinition {
  readonly data: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

interface GroupSettingsPanelHost {
  __attached?: boolean;
  __controller: ControllerDefinition | undefined;
  __loadedGroupId?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly properties: { readonly embedded: boolean; readonly groupId: string };
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
}

const prototype = normalizeDefinition(createGroupSettingsPanelControllerDefinition(true));
const methods = Object.fromEntries(
  Object.entries(prototype).flatMap(([key, value]) =>
    isControllerMethod(key, value)
      ? [
          [
            key,
            function (this: GroupSettingsPanelHost, ...arguments_: unknown[]) {
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
    attached(this: GroupSettingsPanelHost): void {
      this.__attached = true;
      startController(this);
    },
    detached(this: GroupSettingsPanelHost): void {
      this.__attached = false;
      this.__controller = undefined;
      this.__loadedGroupId = '';
    },
  },
  observers: {
    groupId(this: GroupSettingsPanelHost): void {
      if (this.__attached === true) startController(this);
    },
  },
  pageLifetimes: {
    show(this: GroupSettingsPanelHost): void {
      const onShow = this.__controller?.['onShow'];
      if (typeof onShow === 'function') onShow.call(this);
    },
  },
  methods,
});

function startController(host: GroupSettingsPanelHost): void {
  const groupId = host.properties.groupId;
  if (groupId === '' || host.__loadedGroupId === groupId) return;
  const controller = normalizeDefinition(
    createGroupSettingsPanelControllerDefinition(host.properties.embedded),
  );
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
    throw new Error('Group settings panel controller definition is invalid.');
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
