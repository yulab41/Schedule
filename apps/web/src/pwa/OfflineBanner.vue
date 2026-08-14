<script setup lang="ts">
import { WifiOffIcon } from 'tdesign-icons-vue-next';

import { getAppStatePresentation } from './app-state.js';
import { useOnlineState } from './online-state.js';

const isOnline = useOnlineState();
const offlineState = getAppStatePresentation('offline');
</script>

<template>
  <div v-if="!isOnline" class="offline-banner" role="status" aria-live="polite">
    <span class="offline-icon" aria-hidden="true"><WifiOffIcon /></span>
    <div>
      <span>{{ offlineState.eyebrow }}</span>
      <strong>{{ offlineState.title }}</strong>
    </div>
    <p>{{ offlineState.description }}</p>
  </div>
</template>

<style scoped>
.offline-banner {
  display: grid;
  min-height: var(--ui-touch-target-comfortable);
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: var(--ui-spacing-xs) var(--ui-spacing-sm);
  align-items: center;
  margin-bottom: var(--ui-spacing-md);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border: 1px solid var(--ui-color-warning);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.offline-icon {
  display: grid;
  width: var(--ui-touch-target-minimum);
  height: var(--ui-touch-target-minimum);
  place-items: center;
  color: var(--ui-color-warning);
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-small);
}

.offline-icon svg {
  width: 22px;
  height: 22px;
}

.offline-banner > div {
  display: grid;
  gap: 1px;
}

.offline-banner > div span {
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.offline-banner strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.offline-banner p {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

@media (max-width: 640px) {
  .offline-banner {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .offline-banner p {
    grid-column: 1 / -1;
  }
}
</style>
