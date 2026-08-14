<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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
    <t-card class="auth-card" :title="authMode === 'login' ? '账号登录' : '注册账号'">
      <t-space direction="vertical" size="large" style="width: 100%">
        <t-alert
          v-if="submitError !== undefined || session.errorMessage !== undefined"
          theme="error"
          :message="submitError ?? session.errorMessage ?? ''"
        />
        <t-alert
          theme="info"
          message="首次使用请先注册账号。密码只用于本网站登录，不需要填写微信 AppID 或 AppSecret。"
        />

        <div class="auth-mode-switch" role="tablist" aria-label="登录方式">
          <t-button
            :theme="authMode === 'login' ? 'primary' : 'default'"
            :variant="authMode === 'login' ? 'base' : 'outline'"
            @click="switchMode('login')"
          >
            登录
          </t-button>
          <t-button
            :theme="authMode === 'register' ? 'primary' : 'default'"
            :variant="authMode === 'register' ? 'base' : 'outline'"
            @click="switchMode('register')"
          >
            注册
          </t-button>
        </div>

        <form class="password-auth-form" @submit.prevent="submit">
          <label>
            <span>账号</span>
            <input
              v-model="username"
              autocomplete="username"
              maxlength="64"
              minlength="3"
              placeholder="3-64 位字母、数字或 ._-"
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              v-model="password"
              autocomplete="new-password"
              minlength="8"
              placeholder="至少 8 位"
              required
              type="password"
            />
          </label>
          <label v-if="authMode === 'register'">
            <span>确认密码</span>
            <input
              v-model="confirmPassword"
              autocomplete="new-password"
              minlength="8"
              required
              type="password"
            />
          </label>
          <t-button block :loading="submitting" theme="primary" type="submit">
            {{ authMode === 'login' ? '登录' : '注册并登录' }}
          </t-button>
        </form>

        <t-button block variant="outline" @click="router.push({ name: 'guest-schedule' })">
          访客查看排班
        </t-button>

        <template v-if="devAuthEnabled">
          <t-divider>本地开发登录</t-divider>
          <t-space direction="vertical" size="small" style="width: 100%">
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
          </t-space>
        </template>
      </t-space>
    </t-card>
  </main>
</template>
