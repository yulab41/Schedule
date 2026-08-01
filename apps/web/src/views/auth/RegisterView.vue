<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { getErrorMessage, useSessionStore } from '../../stores/session.js';

const email = ref('');
const emailCode = ref('');
const password = ref('');
const realName = ref('');
const submitError = ref<string | undefined>();
const submitting = ref(false);
const username = ref('');
const router = useRouter();
const session = useSessionStore();

async function submitRegistration(): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;

  try {
    await session.beginRegistration({
      email: email.value,
      password: password.value,
      realName: realName.value,
      username: username.value,
    });
    password.value = '';
  } catch (error) {
    submitError.value = getErrorMessage(error);
  } finally {
    submitting.value = false;
  }
}

async function verifyEmailCode(): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;

  try {
    await session.completeRegistration(emailCode.value);
    await router.replace({ name: 'home' });
  } catch (error) {
    if (session.needsProfile) {
      await router.replace({ name: 'home' });
      return;
    }

    submitError.value = getErrorMessage(error);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <t-card v-if="!session.hasPendingRegistration" class="auth-card" title="注册账户">
      <form @submit.prevent="submitRegistration">
        <t-space direction="vertical" size="large" style="width: 100%">
          <t-alert
            v-if="submitError !== undefined || session.errorMessage !== undefined"
            theme="error"
            :message="submitError ?? session.errorMessage ?? ''"
          />
          <t-form-item label="真实姓名">
            <t-input v-model="realName" autocomplete="name" placeholder="请输入真实姓名" required />
          </t-form-item>
          <t-form-item label="用户名">
            <t-input
              v-model="username"
              autocomplete="username"
              placeholder="6 至 32 位用户名"
              required
            />
          </t-form-item>
          <t-form-item label="邮箱">
            <t-input
              v-model="email"
              autocomplete="email"
              placeholder="name@example.com"
              required
              type="email"
            />
          </t-form-item>
          <t-form-item label="密码">
            <t-input
              v-model="password"
              autocomplete="new-password"
              placeholder="请设置密码"
              required
              type="password"
            />
          </t-form-item>
          <t-button block :loading="submitting" theme="primary" type="submit"
            >发送邮箱验证码</t-button
          >
          <RouterLink :to="{ name: 'login' }">已有账户？登录</RouterLink>
        </t-space>
      </form>
    </t-card>

    <t-card v-else class="auth-card" title="验证邮箱">
      <form @submit.prevent="verifyEmailCode">
        <t-space direction="vertical" size="large" style="width: 100%">
          <t-alert
            v-if="submitError !== undefined || session.errorMessage !== undefined"
            theme="error"
            :message="submitError ?? session.errorMessage ?? ''"
          />
          <p>验证码已发送至 {{ email }}。</p>
          <t-form-item label="邮箱验证码">
            <t-input
              v-model="emailCode"
              autocomplete="one-time-code"
              placeholder="请输入验证码"
              required
            />
          </t-form-item>
          <t-button block :loading="submitting" theme="primary" type="submit"
            >验证并进入系统</t-button
          >
          <t-button variant="text" @click="session.discardPendingRegistration"
            >重新填写资料</t-button
          >
        </t-space>
      </form>
    </t-card>
  </main>
</template>
