<script setup lang="ts">
import { useOnlineState } from './online-state.js';

const isOnline = useOnlineState();
</script>

<template>
  <div v-if="!isOnline" class="offline-banner" role="status" aria-live="polite">
    <strong>当前离线</strong>
    <span>可以查看已缓存的排班，但提交已暂停；恢复网络后请重新操作。</span>
  </div>
</template>

<style scoped>
.offline-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  padding: 10px 14px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border: 1px solid #fcd34d;
  border-radius: 6px;
  font-size: var(--ui-font-size-md);
}

.offline-banner strong {
  font-weight: 600;
}
</style>
