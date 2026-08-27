import { createProfilePanelControllerDefinition } from './controller.js';

const controller = createProfilePanelControllerDefinition(true);
type ProfilePanelInstance = ThisParameterType<typeof controller.onLoad> & {
  readonly properties: { readonly embedded: boolean };
};

Component({
  properties: {
    embedded: { type: Boolean, value: true },
  },
  data: controller.data,
  lifetimes: {
    attached(this: ProfilePanelInstance): void {
      this.setData({ embedded: this.properties.embedded });
      controller.onLoad.call(this);
    },
  },
  pageLifetimes: {
    show(this: ProfilePanelInstance): void {
      controller.onShow.call(this);
    },
  },
  methods: {
    handleBack: controller.handleBack,
    handleSignOut: controller.handleSignOut,
    handleSwitchLogin: controller.handleSwitchLogin,
    handleUnbind: controller.handleUnbind,
  },
} as never);
