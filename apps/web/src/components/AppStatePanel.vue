<script setup lang="ts">
import { ErrorCircleIcon, InfoCircleIcon, WifiOffIcon } from 'tdesign-icons-vue-next';

import type { AppStateTone } from '../pwa/app-state.js';

defineProps<{
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly tone: AppStateTone;
}>();
</script>

<template>
  <section
    class="app-state-panel"
    :class="`is-${tone}`"
    :role="tone === 'error' ? 'alert' : 'status'"
    :aria-live="tone === 'error' ? 'assertive' : 'polite'"
  >
    <span class="app-state-icon" aria-hidden="true">
      <ErrorCircleIcon v-if="tone === 'error'" />
      <WifiOffIcon v-else-if="tone === 'offline'" />
      <InfoCircleIcon v-else />
    </span>
    <div class="app-state-copy">
      <span class="app-state-eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="app-state-actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.app-state-panel {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-lg);
  align-items: center;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.app-state-panel.is-error {
  background: var(--ui-color-danger-light);
  border-color: var(--ui-color-danger);
}

.app-state-panel.is-offline {
  background: var(--ui-color-warning-light);
  border-color: var(--ui-color-warning);
}

.app-state-icon {
  display: grid;
  width: var(--ui-touch-target-comfortable);
  height: var(--ui-touch-target-comfortable);
  place-items: center;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-medium);
}

.app-state-panel.is-error .app-state-icon {
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
}

.app-state-panel.is-offline .app-state-icon {
  color: var(--ui-color-warning);
  background: var(--ui-color-surface);
}

.app-state-icon svg {
  width: 24px;
  height: 24px;
}

.app-state-copy {
  min-width: 0;
}

.app-state-eyebrow {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.app-state-copy h2,
.app-state-copy p {
  margin: 0;
}

.app-state-copy h2 {
  margin-top: 2px;
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.app-state-copy p {
  margin-top: var(--ui-spacing-xxs);
  color: var(--ui-color-text-secondary);
  line-height: var(--ui-line-height-body);
}

.app-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}

.app-state-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

@media (max-width: 640px) {
  .app-state-panel {
    grid-template-columns: auto minmax(0, 1fr);
    padding: var(--ui-spacing-md);
    align-items: start;
  }

  .app-state-actions {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .app-state-actions :deep(.t-button) {
    width: 100%;
  }
}
</style>
