<script setup lang="ts">
import { useSessionStore } from './stores/session.js';

const session = useSessionStore();
</script>

<template>
  <main v-if="session.status === 'loading'" class="state-panel" aria-live="polite">
    <t-loading text="正在确认登录状态" />
  </main>
  <RouterView v-else />
</template>
