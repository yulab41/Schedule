<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { exchangeWechatWebLogin } from '../../auth/wechat-web-auth.js';

const message = ref('正在完成微信登录，请稍候……');

onMounted(() => {
  void completeLogin();
});

async function completeLogin(): Promise<void> {
  const query = new URLSearchParams(window.location.search);
  const state = query.get('state');
  const code = query.get('code');
  const error = query.get('errmsg') ?? query.get('error');

  if (state === null) {
    reportError('微信登录缺少状态参数，请关闭窗口后重新扫码。');
    return;
  }
  if (error !== null || code === null) {
    reportError(error === null ? '微信未返回授权码，请重新扫码登录。' : `微信登录未完成：${error}`);
    return;
  }

  try {
    const result = await exchangeWechatWebLogin(code, state);
    window.opener?.postMessage(
      { state, token: result.token, type: 'schedule.wechat.login' },
      window.location.origin,
    );
    message.value = '登录成功，可以关闭此窗口。';
    window.setTimeout(() => window.close(), 300);
  } catch (loginError) {
    reportError(
      loginError instanceof Error ? loginError.message : '微信登录失败，请关闭窗口后重试。',
    );
  }
}

function reportError(errorMessage: string): void {
  const state = new URLSearchParams(window.location.search).get('state');
  if (state !== null) {
    window.opener?.postMessage(
      { error: errorMessage, state, type: 'schedule.wechat.login' },
      window.location.origin,
    );
  }
  message.value = errorMessage;
}

function closeWindow(): void {
  window.close();
}
</script>

<template>
  <main class="auth-page">
    <t-card class="auth-card" title="微信登录">
      <t-alert theme="info" :message="message" />
      <t-button block variant="outline" @click="closeWindow">关闭窗口</t-button>
    </t-card>
  </main>
</template>
