<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { startWechatWebLogin } from '../../auth/wechat-web-auth.js';
import { useSessionStore } from '../../stores/session.js';
import { toUserMessage } from '../../utils/user-message.js';

const WECHAT_STATE_STORAGE_KEY = 'schedule.wechat.login.state';

const submitError = ref<string | undefined>();
const submitting = ref(false);
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const devAuthEnabled =
  import.meta.env.MODE === 'development' && import.meta.env.VITE_AUTH_DEV_MODE === 'true';
let loginPopup: Window | null = null;
let loginPoller: number | undefined;
let loginTimeout: number | undefined;

function getRedirect(): string {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/';
}

async function signInWithWechat(): Promise<void> {
  submitError.value = undefined;
  submitting.value = true;

  try {
    const clientState = crypto.randomUUID();
    const result = await startWechatWebLogin(clientState);
    sessionStorage.setItem(WECHAT_STATE_STORAGE_KEY, result.state);
    const popup = window.open(
      result.authorizeUrl,
      'schedule-wechat-login',
      'popup=yes,width=520,height=680,resizable=yes,scrollbars=yes',
    );
    if (popup === null) {
      sessionStorage.removeItem(WECHAT_STATE_STORAGE_KEY);
      throw new Error('扫码窗口被浏览器拦截，请允许本站打开登录窗口后重试。');
    }
    loginPopup = popup;
    loginPoller = window.setInterval(() => {
      if (loginPopup?.closed === true) {
        stopWechatLoginWait();
        submitError.value = '扫码窗口已关闭，如需登录请重新扫码。';
        submitting.value = false;
      }
    }, 500);
    loginTimeout = window.setTimeout(() => {
      stopWechatLoginWait();
      sessionStorage.removeItem(WECHAT_STATE_STORAGE_KEY);
      submitError.value = '微信扫码登录已超时，请重新尝试。';
      submitting.value = false;
    }, 120_000);
  } catch (error) {
    submitError.value = toUserMessage(error, '微信登录暂时不可用，请稍后重试。');
    submitting.value = false;
  }
}

async function handleWechatMessage(event: MessageEvent<unknown>): Promise<void> {
  if (
    event.origin !== window.location.origin ||
    typeof event.data !== 'object' ||
    event.data === null
  ) {
    return;
  }
  const message = event.data as {
    readonly state?: unknown;
    readonly token?: unknown;
    readonly type?: unknown;
    readonly error?: unknown;
  };
  if (message.type !== 'schedule.wechat.login') {
    return;
  }
  const expectedState = sessionStorage.getItem(WECHAT_STATE_STORAGE_KEY);
  if (typeof message.state !== 'string' || message.state !== expectedState) {
    submitError.value = '微信登录状态不匹配，请重新扫码登录。';
    submitting.value = false;
    return;
  }
  stopWechatLoginWait();
  sessionStorage.removeItem(WECHAT_STATE_STORAGE_KEY);
  if (typeof message.error === 'string') {
    submitError.value = message.error;
    submitting.value = false;
    return;
  }
  if (typeof message.token !== 'string') {
    submitError.value = '微信登录没有返回有效会话，请重新扫码登录。';
    submitting.value = false;
    return;
  }

  try {
    await session.signInToken(message.token);
    await router.replace(getRedirect());
  } catch (error) {
    submitError.value = toUserMessage(error, '微信登录未完成，请稍后重试。');
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

onMounted(() => window.addEventListener('message', handleWechatMessage));
onUnmounted(() => {
  stopWechatLoginWait();
  window.removeEventListener('message', handleWechatMessage);
});

function stopWechatLoginWait(): void {
  if (loginPoller !== undefined) {
    window.clearInterval(loginPoller);
    loginPoller = undefined;
  }
  if (loginTimeout !== undefined) {
    window.clearTimeout(loginTimeout);
    loginTimeout = undefined;
  }
  loginPopup = null;
}
</script>

<template>
  <main class="auth-page">
    <t-card class="auth-card" title="登录">
      <t-space direction="vertical" size="large" style="width: 100%">
        <t-alert
          v-if="submitError !== undefined || session.errorMessage !== undefined"
          theme="error"
          :message="submitError ?? session.errorMessage ?? ''"
        />
        <t-alert theme="info" message="请使用微信扫描登录二维码，首次登录后需要补全资料。" />
        <t-button block :loading="submitting" theme="primary" @click="signInWithWechat">
          微信扫码登录
        </t-button>
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
