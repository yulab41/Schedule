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
          <t-form-item label="用户名">
            <t-input
              v-model="username"
              autocomplete="username"
              placeholder="请输入用户名"
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
          <RouterLink :to="{ name: 'register' }">还没有账户？注册</RouterLink>
        </t-space>
      </form>
    </t-card>
  </main>
</template>
