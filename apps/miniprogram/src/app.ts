import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';

const clientCapabilityStore = createRuntimeClientCapabilityStore();

App({
  globalData: { clientCapabilityStore },

  onLaunch(): void {
    void clientCapabilityStore.refresh({ force: true });
  },

  onShow(): void {
    void clientCapabilityStore.refresh({ force: true });
  },
});
