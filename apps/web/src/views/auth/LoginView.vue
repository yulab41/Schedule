<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getErrorMessage, useSessionStore } from '../../stores/session.js';

const password = ref('');
const submitError = ref<string | undefined>();
const submitting = ref(false);
const username = ref('');
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const devAuthEnabled = import.meta.env.VITE_AUTH_DEV_MODE === 'true';

async function submit(): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;

  try {
    await session.signIn({ password: password.value, username: username.value });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (error) {
    submitError.value = getErrorMessage(error);
  } finally {
    password.value = '';
    submitting.value = false;
  }
}

async function submitDev(uid: string): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;

  try {
    await session.signInDev(uid);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (error) {
    submitError.value = getErrorMessage(error);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <t-card class="auth-card" title="登录">
      <form @submit.prevent="submit">
        <t-space direction="vertical" size="large" style="width: 100%">
          <t-alert
            v-if="submitError !== undefined || session.errorMessage !== undefined"
            theme="error"
            :message="submitError ?? session.errorMessage ?? ''"
          />
          <t-form-item label="登录账号">
            <t-input
              v-model="username"
              autocomplete="username"
              placeholder="请输入登录账号"
              required
            />
          </t-form-item>
          <t-form-item label="密码">
            <t-input
              v-model="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              required
              type="password"
            />
          </t-form-item>
          <t-button block :loading="submitting" theme="primary" type="submit">登录</t-button>
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
      </form>
    </t-card>
  </main>
</template>
