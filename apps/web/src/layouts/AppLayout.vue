<script setup lang="ts">
import { LogoutIcon } from 'tdesign-icons-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import NotificationBell from '../features/notifications/NotificationBell.vue';
import OfflineBanner from '../pwa/OfflineBanner.vue';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const session = useSessionStore();
const realName = ref('');

async function signOut(): Promise<void> {
  try {
    await session.signOut();
  } catch {
    // Local session state is already cleared by the store, so continue navigation.
  } finally {
    await router.replace({ name: 'login' });
  }
}

async function saveProfile(): Promise<void> {
  try {
    await session.completeProfile(realName.value);
  } catch {
    // The session store preserves a retryable profile state and error message.
  }
}
</script>

<template>
  <t-layout class="app-layout">
    <a class="skip-link" href="#app-content">跳到主要内容</a>
    <t-header class="app-header">
      <RouterLink class="product-name" :to="{ name: 'home' }">
        <span class="product-mark" aria-hidden="true"><span /><span /></span>
        <span class="product-copy">
          <strong>医护排班</strong>
          <small>Medical Schedule</small>
        </span>
      </RouterLink>
      <div class="account-actions">
        <NotificationBell />
        <span v-if="session.profile !== undefined" class="account-chip">
          <span class="account-avatar" aria-hidden="true">{{
            session.profile.realName.slice(0, 1)
          }}</span>
          <span class="account-name">{{ session.profile.realName }}</span>
        </span>
        <t-button class="desktop-sign-out" variant="text" @click="signOut">
          <template #icon><LogoutIcon /></template>
          退出登录
        </t-button>
      </div>
    </t-header>
    <t-content id="app-content" class="app-content" tabindex="-1">
      <OfflineBanner />
      <section v-if="session.status === 'loading'" class="state-panel" aria-live="polite">
        <t-loading text="正在恢复登录状态" />
      </section>
      <section v-else-if="session.needsProfile" class="profile-panel">
        <t-card title="完善个人资料">
          <p>首次使用前，请确认您的真实姓名。</p>
          <form @submit.prevent="saveProfile">
            <t-form-item label="真实姓名" name="realName">
              <t-input
                v-model="realName"
                autocomplete="name"
                placeholder="请输入真实姓名"
                required
              />
            </t-form-item>
            <t-form-item>
              <t-button theme="primary" type="submit">保存并进入系统</t-button>
            </t-form-item>
          </form>
          <t-alert
            v-if="session.errorMessage !== undefined"
            theme="error"
            :message="session.errorMessage"
          />
        </t-card>
      </section>
      <RouterView v-else-if="session.isAuthenticated" v-slot="{ Component }">
        <component :is="Component" @sign-out="signOut" />
      </RouterView>
      <section v-else class="state-panel" aria-live="polite">
        <t-loading text="正在返回登录页" />
      </section>
    </t-content>
  </t-layout>
</template>
