<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

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
    <t-header class="app-header">
      <RouterLink class="product-name" :to="{ name: 'home' }">医护排班系统</RouterLink>
      <div class="account-actions">
        <span v-if="session.profile !== undefined" class="account-name">{{
          session.profile.realName
        }}</span>
        <t-button variant="text" @click="signOut">退出登录</t-button>
      </div>
    </t-header>
    <t-content class="app-content">
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
      <RouterView v-else-if="session.isAuthenticated" />
      <section v-else class="state-panel" aria-live="polite">
        <t-loading text="正在返回登录页" />
      </section>
    </t-content>
  </t-layout>
</template>
