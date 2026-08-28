import { createProfilePanelControllerDefinition, type ProfileGroupInput } from './controller.js';

const controller = createProfilePanelControllerDefinition(true);
type ProfilePanelControllerInstance = ThisParameterType<typeof controller.onLoad>;
type ProfilePanelInstance = Omit<ProfilePanelControllerInstance, 'setData'> & {
  readonly properties: {
    readonly embedded: boolean;
    readonly groupId: string;
    readonly groupIsDeveloperAdmin: boolean;
    readonly groupName: string;
    readonly groupRole: ProfileGroupInput['role'];
  };
  setData(
    patch: Parameters<ProfilePanelControllerInstance['setData']>[0],
    callback?: () => void,
  ): void;
};

Component({
  properties: {
    embedded: { type: Boolean, value: true },
    groupId: { type: String, value: '' },
    groupIsDeveloperAdmin: { type: Boolean, value: false },
    groupName: { type: String, value: '' },
    groupRole: { type: String, value: 'member' },
  },
  data: controller.data,
  observers: {
    'groupId,groupName,groupRole,groupIsDeveloperAdmin'(this: ProfilePanelInstance): void {
      if (typeof this.overviewRequestSerial !== 'number') return;
      controller.handleGroupChange.call(this, readGroup(this));
    },
  },
  lifetimes: {
    attached(this: ProfilePanelInstance): void {
      this.setData({ embedded: this.properties.embedded }, () => this.triggerEvent?.('panelready'));
      controller.onLoad.call(this);
      controller.handleGroupChange.call(this, readGroup(this));
    },
  },
  pageLifetimes: {
    show(this: ProfilePanelInstance): void {
      controller.onShow.call(this);
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

function readGroup(instance: ProfilePanelInstance): ProfileGroupInput | undefined {
  if (instance.properties.groupId.length === 0) return undefined;
  return {
    id: instance.properties.groupId,
    isDeveloperAdmin: instance.properties.groupIsDeveloperAdmin,
    name: instance.properties.groupName,
    role: instance.properties.groupRole,
  };
}
