<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  readonly title: string;
  readonly visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
}>();

const dialog = ref<HTMLDialogElement>();

async function syncVisibility(visible: boolean): Promise<void> {
  await nextTick();
  const element = dialog.value;
  if (element === undefined) return;

  if (visible && !element.open) {
    element.showModal();
  } else if (!visible && element.open) {
    element.close();
  }
}

function close(): void {
  emit('update:visible', false);
}

function closeFromBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close();
}

function onDialogClose(): void {
  if (props.visible) emit('update:visible', false);
}

watch(
  () => props.visible,
  (visible) => void syncVisibility(visible),
);

onMounted(() => void syncVisibility(props.visible));

onBeforeUnmount(() => {
  if (dialog.value?.open === true) dialog.value.close();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="responsive-sheet"
    :aria-label="title"
    @cancel.prevent="close"
    @click="closeFromBackdrop"
    @close="onDialogClose"
  >
    <section class="responsive-sheet-panel">
      <div class="sheet-handle" aria-hidden="true" />
      <header class="responsive-sheet-header">
        <h2>{{ title }}</h2>
        <button type="button" aria-label="关闭" @click="close">完成</button>
      </header>
      <div class="responsive-sheet-content">
        <slot />
      </div>
    </section>
  </dialog>
</template>

<style scoped>
.responsive-sheet {
  width: min(520px, calc(100% - 32px));
  max-height: min(720px, calc(100dvh - 48px));
  padding: 0;
  overflow: hidden;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 0;
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-elevated);
}

.responsive-sheet::backdrop {
  background: rgb(22 32 42 / 32%);
  backdrop-filter: blur(2px);
}

.responsive-sheet-panel {
  display: flex;
  max-height: inherit;
  flex-direction: column;
}

.sheet-handle {
  display: none;
}

.responsive-sheet-header {
  display: flex;
  min-height: 64px;
  padding: 8px 20px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--ui-color-border);
}

.responsive-sheet-header h2 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.responsive-sheet-header button {
  min-width: var(--ui-touch-target-minimum);
  min-height: var(--ui-touch-target-minimum);
  padding: 0 8px;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-weight: var(--ui-font-weight-semibold);
}

.responsive-sheet-header button:active {
  background: var(--ui-color-primary-light);
}

.responsive-sheet-content {
  padding: 8px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

@media (max-width: 640px) {
  .responsive-sheet {
    width: 100%;
    max-width: none;
    max-height: min(78dvh, 660px);
    margin: auto 0 0;
    border-radius: 22px 22px 0 0;
  }

  .responsive-sheet[open] {
    animation: sheet-enter var(--ui-duration-normal) ease-out;
  }

  .sheet-handle {
    display: block;
    width: 38px;
    height: 5px;
    margin: 8px auto 0;
    background: var(--ui-color-border-strong);
    border-radius: var(--ui-radius-pill);
  }

  .responsive-sheet-header {
    min-height: 56px;
    padding: 4px 16px;
    border-bottom: 0;
  }

  .responsive-sheet-content {
    padding: 0 16px calc(16px + env(safe-area-inset-bottom));
  }
}

@keyframes sheet-enter {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .responsive-sheet[open] {
    animation: none;
  }
}
</style>
