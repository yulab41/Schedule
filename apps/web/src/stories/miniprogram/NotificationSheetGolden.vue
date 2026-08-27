<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { localAuth } from '../../auth/local-auth.js';
import HomeView from '../../views/HomeView.vue';
import { createNotificationSheetFixtureFetch } from './notification-sheet-golden-fixture.js';

const props = withDefaults(defineProps<{ readonly largeText?: boolean }>(), {
  largeText: false,
});

const originalFetch = globalThis.fetch;
const fixtureFetch = ref<typeof globalThis.fetch>();
const homeKey = ref(0);
const isStaged = ref(false);
const stageError = ref<string>();

function installFixture(): void {
  const nextFixtureFetch = createNotificationSheetFixtureFetch();
  fixtureFetch.value = nextFixtureFetch;
  globalThis.fetch = nextFixtureFetch;
  localAuth.setSession('notification-sheet-storybook-session');
}

async function stageStory(): Promise<void> {
  isStaged.value = false;
  stageError.value = undefined;
  try {
    const trigger = await waitForElement<HTMLButtonElement>('button[aria-label^="通知中心"]');
    trigger.click();
    const dialog = await waitForElement<HTMLDialogElement>(
      'dialog.responsive-sheet[open][aria-label="通知中心"]',
    );
    await waitForElement('.notification-list .notification-item');
    dialog.focus({ preventScroll: true });
    isStaged.value = true;
  } catch (error) {
    stageError.value = error instanceof Error ? error.message : '通知 Sheet 黄金状态装配失败。';
  }
}

function waitForElement<ElementType extends HTMLElement = HTMLElement>(
  selector: string,
): Promise<ElementType> {
  return waitFor(() => {
    const element = document.querySelector<ElementType>(selector);
    return element !== null && isVisible(element) ? element : undefined;
  });
}

async function waitFor<Value>(
  read: () => Value | undefined | false | null,
  timeoutMs = 8_000,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined && value !== false && value !== null) return value;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
  throw new Error('通知 Sheet Storybook 状态装配超时。');
}

function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return (
    element.getClientRects().length > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity) > 0
  );
}

watch(
  () => props.largeText,
  async () => {
    installFixture();
    homeKey.value += 1;
    await nextTick();
    void stageStory();
  },
);

installFixture();
onMounted(() => void stageStory());
onBeforeUnmount(() => {
  if (globalThis.fetch === fixtureFetch.value) globalThis.fetch = originalFetch;
  localAuth.clearDevIdentity();
});
</script>

<template>
  <div
    class="notification-sheet-golden"
    :class="{ 'is-large-text': largeText }"
    :data-notification-sheet-ready="isStaged ? 'true' : 'false'"
  >
    <HomeView :key="homeKey" />
    <p v-if="stageError !== undefined" class="notification-sheet-stage-error" role="alert">
      {{ stageError }}
    </p>
  </div>
</template>

<style scoped>
.notification-sheet-golden {
  min-height: 100dvh;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
}

.notification-sheet-golden :deep(.home-view) {
  min-height: 100dvh;
}

.notification-sheet-golden.is-large-text {
  --ui-font-size-xs: 14px;
  --ui-font-size-sm: 16px;
  --ui-font-size-md: 18px;
  --ui-font-size-lg: 22px;
  --ui-font-size-xl: 26px;
}

.notification-sheet-stage-error {
  position: fixed;
  z-index: 9999;
  right: 12px;
  bottom: 12px;
  left: 12px;
  padding: 12px;
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-danger);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-elevated);
  font-size: var(--ui-font-size-sm);
}
</style>
