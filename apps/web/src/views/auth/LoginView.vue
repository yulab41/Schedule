<script setup lang="ts">
import { LockOnIcon, UserIcon } from 'tdesign-icons-vue-next';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import SiteComplianceFooter from '../../components/SiteComplianceFooter.vue';
import { useSessionStore } from '../../stores/session.js';
import { toUserMessage } from '../../utils/user-message.js';

type AuthMode = 'login' | 'register';

const authMode = ref<AuthMode>('login');
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const submitError = ref<string | undefined>();
const submitting = ref(false);
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const devAuthEnabled =
  import.meta.env.MODE === 'development' && import.meta.env.VITE_AUTH_DEV_MODE === 'true';

function getRedirect(): string {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/';
}

function switchMode(nextMode: AuthMode): void {
  authMode.value = nextMode;
  submitError.value = undefined;
  password.value = '';
  confirmPassword.value = '';
}

async function submit(): Promise<void> {
  submitError.value = undefined;
  if (authMode.value === 'register' && password.value !== confirmPassword.value) {
    submitError.value = '两次输入的密码不一致。';
    return;
  }

  submitting.value = true;
  try {
    if (authMode.value === 'register') {
      await session.register({ password: password.value, username: username.value });
    } else {
      await session.signIn({ password: password.value, username: username.value });
    }
    await router.replace(getRedirect());
  } catch (error) {
    submitError.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    submitting.value = false;
  }
}

async function submitDev(uid: string): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;
  try {
    await session.signInDev(uid);
    await router.replace(getRedirect());
  } catch (error) {
    submitError.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-shell" aria-labelledby="auth-title">
      <div class="auth-brand-mark" aria-hidden="true"><span /><span /></div>
      <div class="auth-copy">
        <p class="auth-eyebrow">医护排班</p>
        <h1 id="auth-title">清楚掌握每一次值班</h1>
        <p>登录后查看所在群组的排班、请假和班次变更。</p>
      </div>

      <div class="auth-mode-switch" role="tablist" aria-label="登录或注册">
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'login'"
          :class="{ 'is-active': authMode === 'login' }"
          @click="switchMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'register'"
          :class="{ 'is-active': authMode === 'register' }"
          @click="switchMode('register')"
        >
          注册
        </button>
      </div>

      <section class="auth-card">
        <t-alert
          v-if="submitError !== undefined || session.errorMessage !== undefined"
          theme="error"
          :message="submitError ?? session.errorMessage ?? ''"
        />
        <form class="password-auth-form" @submit.prevent="submit">
          <label>
            <span>账号</span>
            <span class="auth-input-shell">
              <UserIcon aria-hidden="true" />
              <input
                v-model="username"
                autocomplete="username"
                maxlength="64"
                minlength="3"
                placeholder="3-64 位字母、数字或 ._-"
                required
              />
            </span>
          </label>
          <label>
            <span>密码</span>
            <span class="auth-input-shell">
              <LockOnIcon aria-hidden="true" />
              <input
                v-model="password"
                :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
                placeholder="请输入密码"
                required
                type="password"
              />
            </span>
          </label>
          <label v-if="authMode === 'register'">
            <span>确认密码</span>
            <span class="auth-input-shell">
              <LockOnIcon aria-hidden="true" />
              <input
                v-model="confirmPassword"
                autocomplete="new-password"
                placeholder="请再次输入密码"
                required
                type="password"
              />
            </span>
          </label>
          <t-button class="auth-submit" block :loading="submitting" theme="primary" type="submit">
            {{ authMode === 'login' ? '进入工作台' : '创建账号' }}
          </t-button>
        </form>

        <t-button
          class="guest-entry"
          block
          variant="outline"
          @click="router.push({ name: 'guest-schedule' })"
        >
          访客查看排班
        </t-button>

        <template v-if="devAuthEnabled">
          <t-divider>本地开发登录</t-divider>
          <div class="dev-auth-actions">
            <t-button
              block
              variant="outline"
              :loading="submitting"
              @click="submitDev('local-admin')"
            >
              本地管理员
            </t-button>
            <t-button
              block
              variant="outline"
              :loading="submitting"
              @click="submitDev('local-member')"
            >
              本地成员
            </t-button>
          </div>
        </template>
      </section>

      <p class="auth-privacy-note">账号只用于排班身份识别。联系信息仅对有权限的群组成员可见。</p>
    </section>
    <SiteComplianceFooter />
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100dvh;
  padding: max(32px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
  grid-template-rows: 1fr auto;
  gap: var(--ui-spacing-md);
  background:
    radial-gradient(circle at 86% 10%, rgb(10 102 213 / 12%), transparent 28%),
    var(--ui-color-background);
}

.auth-shell {
  width: min(100%, 420px);
}

.auth-brand-mark {
  position: relative;
  width: 52px;
  height: 52px;
  margin-bottom: 24px;
  background: var(--ui-color-primary);
  border-radius: 17px;
  box-shadow: 0 12px 30px rgb(10 102 213 / 24%);
}

.auth-brand-mark span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 25px;
  height: 7px;
  background: var(--ui-color-white);
  border-radius: var(--ui-radius-pill);
  transform: translate(-50%, -50%);
}

.auth-brand-mark span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.auth-eyebrow {
  margin: 0;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.auth-copy h1 {
  max-width: 330px;
  margin: 6px 0 10px;
  font-size: var(--ui-font-size-xxl);
  line-height: var(--ui-line-height-title);
  letter-spacing: -0.7px;
}

.auth-copy > p:last-child {
  max-width: 350px;
  margin: 0;
  color: var(--ui-color-text-secondary);
  line-height: var(--ui-line-height-normal);
}

.auth-mode-switch {
  display: grid;
  margin: 30px 0 14px;
  padding: 3px;
  grid-template-columns: repeat(2, 1fr);
  background: color-mix(in srgb, var(--ui-color-border) 72%, var(--ui-color-background));
  border-radius: var(--ui-radius-medium);
}

.auth-mode-switch button {
  min-height: var(--ui-touch-target-minimum);
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.auth-mode-switch button.is-active {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}

.auth-card {
  display: grid;
  gap: 16px;
  padding: 20px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.password-auth-form {
  gap: 16px;
}

.auth-input-shell {
  display: grid;
  min-height: var(--ui-touch-target-comfortable);
  padding: 0 14px;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 9px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.auth-input-shell:focus-within {
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-primary);
  box-shadow: var(--ui-shadow-focus);
}

.auth-input-shell svg {
  width: 20px;
  height: 20px;
}

.auth-input-shell input {
  min-width: 0;
  height: 48px;
  padding: 0;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: var(--ui-font-size-md);
}

.auth-submit,
.guest-entry,
.dev-auth-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-comfortable);
  border-radius: var(--ui-radius-medium);
}

.auth-submit {
  box-shadow: var(--ui-shadow-primary);
}

.dev-auth-actions {
  display: grid;
  gap: 8px;
}

.auth-privacy-note {
  margin: 15px 8px 0;
  color: var(--ui-color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

@media (max-width: 360px) {
  .auth-page {
    padding-right: 16px;
    padding-left: 16px;
  }

  .auth-card {
    padding: 16px;
  }
}
</style>
