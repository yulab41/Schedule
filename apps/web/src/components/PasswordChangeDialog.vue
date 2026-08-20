<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  readonly defaultPasswordReminder: boolean;
  readonly errorMessage?: string;
  readonly saving: boolean;
  readonly visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  dismiss: [];
  submit: [input: { readonly currentPassword: string; readonly newPassword: string }];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const editorOpen = ref(false);
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const localError = ref<string>();
const previouslyFocused = ref<HTMLElement | null>(null);
const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const title = computed(() => (editorOpen.value ? '现在修改密码' : '当前使用的是初始密码'));
const displayedError = computed(() => localError.value ?? props.errorMessage);

watch(
  () => props.visible,
  (visible) => void syncVisibility(visible),
);

watch(
  () => props.defaultPasswordReminder,
  (isReminder) => {
    if (props.visible) reset(isReminder);
  },
);

onMounted(() => void syncVisibility(props.visible));

onBeforeUnmount(() => {
  if (dialog.value?.open === true) dialog.value.close();
  restoreFocus();
});

function getFocusableElements(element: HTMLDialogElement): readonly HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (candidate) => candidate.getClientRects().length > 0,
  );
}

async function syncVisibility(visible: boolean): Promise<void> {
  await nextTick();
  const element = dialog.value;
  if (element === null) return;
  if (visible && !element.open) {
    previouslyFocused.value =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    reset(props.defaultPasswordReminder);
    element.showModal();
    await nextTick();
    getFocusableElements(element)[0]?.focus();
  } else if (!visible && element.open) {
    element.close();
  }
}

function reset(isReminder: boolean): void {
  editorOpen.value = !isReminder;
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  localError.value = undefined;
}

function startEditor(): void {
  editorOpen.value = true;
  localError.value = undefined;
  void nextTick(() => getFocusableElements(dialog.value!)[1]?.focus());
}

function submit(): void {
  localError.value = undefined;
  if (
    currentPassword.value.length === 0 ||
    newPassword.value.length === 0 ||
    confirmPassword.value.length === 0
  ) {
    localError.value = '请完整填写当前密码、新密码和确认密码。';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    localError.value = '两次输入的新密码不一致。';
    return;
  }
  if (newPassword.value === currentPassword.value) {
    localError.value = '新密码不能与当前密码相同。';
    return;
  }
  emit('submit', {
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
  });
}

function close(): void {
  if (!props.saving) emit('close');
}

function closeFromBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close();
}

function onDialogClose(): void {
  restoreFocus();
  if (props.visible) emit('close');
}

function restoreFocus(): void {
  const target = previouslyFocused.value;
  previouslyFocused.value = null;
  if (target?.isConnected === true) target.focus();
}

function trapFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const element = dialog.value;
  if (element === null) return;
  const focusable = getFocusableElements(element);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="password-dialog"
    :aria-labelledby="'password-dialog-title'"
    @cancel.prevent="close"
    @click="closeFromBackdrop"
    @close="onDialogClose"
    @keydown="trapFocus"
  >
    <section class="password-dialog-panel">
      <button
        type="button"
        class="password-dialog-close"
        aria-label="关闭"
        :disabled="saving"
        @click="close"
      >
        ×
      </button>
      <div class="password-dialog-icon" aria-hidden="true"><span>!</span></div>
      <p class="password-dialog-eyebrow">账号安全提醒</p>
      <h2 id="password-dialog-title">{{ title }}</h2>

      <template v-if="!editorOpen">
        <p class="password-dialog-copy">
          当前密码仍为系统初始密码。为保护排班与联系方式数据，建议现在修改。
        </p>
        <div class="password-dialog-actions">
          <button type="button" class="secondary-button" @click="close">取消</button>
          <button type="button" class="primary-button" @click="startEditor">修改密码</button>
          <button type="button" class="quiet-button" @click="emit('dismiss')">
            本次登录不再提示
          </button>
        </div>
      </template>

      <form v-else class="password-form" @submit.prevent="submit">
        <label>
          当前密码
          <input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            :disabled="saving"
            required
          />
        </label>
        <label>
          新密码
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            :disabled="saving"
            required
          />
        </label>
        <label>
          确认新密码
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            :disabled="saving"
            required
          />
        </label>
        <p v-if="displayedError !== undefined" class="password-error" role="alert">
          {{ displayedError }}
        </p>
        <div class="password-dialog-actions editor-actions">
          <button
            v-if="defaultPasswordReminder"
            type="button"
            class="secondary-button"
            :disabled="saving"
            @click="editorOpen = false"
          >
            返回
          </button>
          <button v-else type="button" class="secondary-button" :disabled="saving" @click="close">
            取消
          </button>
          <button type="submit" class="primary-button" :disabled="saving">
            {{ saving ? '正在保存…' : '保存密码' }}
          </button>
        </div>
      </form>
      <p class="password-dialog-note">修改成功后，下次登录请使用新密码。</p>
    </section>
  </dialog>
</template>

<style scoped>
.password-dialog {
  width: min(392px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  overflow: visible;
}

.password-dialog::backdrop {
  background: rgb(8 21 37 / 43%);
  backdrop-filter: blur(6px);
}

.password-dialog-panel {
  position: relative;
  padding: 30px 30px 24px;
  overflow-y: auto;
  background: var(--ui-color-surface);
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 24px;
  box-shadow: 0 28px 70px rgb(6 24 46 / 24%);
  text-align: center;
}

.password-dialog-close {
  position: absolute;
  top: 13px;
  right: 15px;
  display: grid;
  width: var(--ui-touch-target-minimum);
  height: var(--ui-touch-target-minimum);
  padding: 0;
  place-items: center;
  color: #66758a;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
}

.password-dialog-close:hover,
.password-dialog-close:focus-visible {
  background: #f3f6fa;
}

.password-dialog-icon {
  display: grid;
  width: 50px;
  height: 50px;
  margin: 0 auto 16px;
  place-items: center;
  color: #9a5b12;
  background: #fff3de;
  border: 7px solid #fff8ee;
  border-radius: 17px;
}

.password-dialog-icon span {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 2px solid currentColor;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
}

.password-dialog-eyebrow {
  margin: 0 0 6px;
  color: #9a5b12;
  font-size: 11px;
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.08em;
}

.password-dialog h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.035em;
}

.password-dialog-copy {
  margin: 12px auto 0;
  color: var(--ui-color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.password-dialog-actions {
  display: grid;
  margin-top: 24px;
  grid-template-columns: 1fr 1.35fr;
  gap: 9px;
}

.password-dialog-actions button {
  min-height: var(--ui-touch-target-minimum);
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: var(--ui-font-weight-bold);
}

.secondary-button {
  color: #536278;
  background: #f7f9fb;
  border: 1px solid #dfe5ec;
}

.primary-button {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
  box-shadow: 0 6px 13px rgb(10 102 213 / 19%);
}

.quiet-button {
  grid-column: 1 / -1;
  color: #69778a;
  background: transparent;
  border: 0;
  font-size: 11px !important;
}

.password-dialog-note {
  margin: 20px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: 10px;
}

.password-form {
  margin-top: 18px;
  text-align: left;
}

.password-form label {
  display: grid;
  margin-bottom: 12px;
  color: #536176;
  font-size: 11px;
  font-weight: var(--ui-font-weight-bold);
  gap: 6px;
}

.password-form input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  color: var(--ui-color-text-primary);
  background: #f8fafc;
  border: 1px solid #d7dee7;
  border-radius: 10px;
  outline: 0;
  font: inherit;
  font-size: 13px;
}

.password-form input:focus {
  border-color: #72aae8;
  box-shadow: 0 0 0 3px rgb(10 102 213 / 11%);
}

.password-error {
  margin: 4px 0 0;
  color: var(--ui-color-danger);
  font-size: 12px;
  line-height: 1.5;
}

.editor-actions {
  margin-top: 18px;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(10 102 213 / 30%);
  outline-offset: 2px;
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 420px) {
  .password-dialog-panel {
    padding: 28px 22px 22px;
    border-radius: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .password-dialog,
  .password-dialog::backdrop {
    scroll-behavior: auto;
  }
}
</style>
