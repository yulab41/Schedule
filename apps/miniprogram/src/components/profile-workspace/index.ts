import {
  createProfileWorkspaceControllerDefinition,
  type ProfileGroupInput,
} from '../profile-panel/controller.js';

const controller = createProfileWorkspaceControllerDefinition();
type ControllerInstance = ThisParameterType<typeof controller.onLoad>;
type ProfileWorkspaceInstance = Omit<ControllerInstance, 'setData'> & {
  __active: boolean;
  __attached: boolean;
  __groupSignature: string;
  __refreshRevision: number;
  readonly properties: {
    readonly active: boolean;
    readonly groupId: string;
    readonly groupIsDeveloperAdmin: boolean;
    readonly groupName: string;
    readonly groupRole: ProfileGroupInput['role'];
    readonly refreshRevision: number;
  };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent?(name: 'workspaceready' | 'workspacerequest'): void;
};

Component({
  properties: {
    active: { type: Boolean, value: false },
    groupId: { type: String, value: '' },
    groupIsDeveloperAdmin: { type: Boolean, value: false },
    groupName: { type: String, value: '' },
    groupRole: { type: String, value: 'member' },
    refreshRevision: { type: Number, value: 0 },
  },
  data: { ...controller.data, contentMounted: false, embedded: true },
  lifetimes: {
    created(this: ProfileWorkspaceInstance): void {
      this.__active = false;
      this.__attached = false;
      this.__groupSignature = '';
      this.__refreshRevision = 0;
      this.accountRequestSerial = 0;
      this.overviewRequestSerial = 0;
    },
    attached(this: ProfileWorkspaceInstance): void {
      this.__attached = true;
      this.setData({ embedded: true }, () => {
        this.triggerEvent?.('workspaceready');
        void Promise.resolve().then(() => initializeWorkspace(this));
      });
    },
    detached(this: ProfileWorkspaceInstance): void {
      this.__attached = false;
      this.accountRequestSerial += 1;
      this.overviewRequestSerial += 1;
    },
  },
  observers: {
    'active,groupId,groupName,groupRole,groupIsDeveloperAdmin,refreshRevision'(
      this: ProfileWorkspaceInstance,
    ): void {
      if (!this.__attached || typeof this.overviewRequestSerial !== 'number') return;
      syncWorkspace(this);
    },
  },
  methods: {
    handleAvatarRestore: controller.handleAvatarRestore,
    handleBack: controller.handleBack,
    handleCurrentPasswordInput: controller.handleCurrentPasswordInput,
    handleNewPasswordInput: controller.handleNewPasswordInput,
    handleOpenCalendar: controller.handleOpenCalendar,
    handleOpenStatistics: controller.handleOpenStatistics,
    handleOverviewRetry: controller.handleOverviewRetry,
    handlePasswordClose: controller.handlePasswordClose,
    handlePasswordConfirmInput: controller.handlePasswordConfirmInput,
    handlePasswordOpen: controller.handlePasswordOpen,
    handlePasswordSubmit: controller.handlePasswordSubmit,
    handleSignOut: controller.handleSignOut,
    handleUnbind: controller.handleUnbind,
  },
} as never);

function initializeWorkspace(instance: ProfileWorkspaceInstance): void {
  if (!instance.__attached) return;
  instance.__active = instance.properties.active;
  instance.__refreshRevision = instance.properties.refreshRevision;
  instance.triggerEvent?.('workspacerequest');
  controller.onLoad.call(instance);
  instance.setData({ contentMounted: true }, () => syncWorkspace(instance));
}

function syncWorkspace(instance: ProfileWorkspaceInstance): void {
  if (instance.properties.refreshRevision !== instance.__refreshRevision) {
    instance.__refreshRevision = instance.properties.refreshRevision;
    instance.triggerEvent?.('workspacerequest');
    controller.onShow.call(instance);
  }
  const group = readGroup(instance);
  const signature =
    group === undefined ? '' : `${group.id}:${group.role}:${group.isDeveloperAdmin}`;
  if (signature !== instance.__groupSignature) {
    instance.__groupSignature = signature;
    if (group !== undefined && group.role !== 'guest') {
      instance.triggerEvent?.('workspacerequest');
    }
    controller.handleGroupChange.call(instance, group);
  }
  instance.__active = instance.properties.active;
}

function readGroup(instance: ProfileWorkspaceInstance): ProfileGroupInput | undefined {
  if (instance.properties.groupId.length === 0) return undefined;
  return {
    id: instance.properties.groupId,
    isDeveloperAdmin: instance.properties.groupIsDeveloperAdmin,
    name: instance.properties.groupName,
    role: instance.properties.groupRole,
  };
}
