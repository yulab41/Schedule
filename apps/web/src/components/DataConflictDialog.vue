<script setup lang="ts">
defineProps<{
  readonly message: string;
  readonly summary: string | undefined;
  readonly visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [];
}>();
</script>

<template>
  <t-dialog
    :cancel-btn="{ content: '暂不刷新' }"
    :confirm-btn="{ content: '刷新并重新确认' }"
    :visible="visible"
    header="排班数据已更新"
    @cancel="emit('close')"
    @close="emit('close')"
    @confirm="emit('refresh')"
  >
    <p class="conflict-message">{{ message }}</p>
    <p v-if="summary !== undefined" class="conflict-summary">{{ summary }}</p>
    <p class="conflict-hint">刷新后请基于最新数据重新确认，不会自动重放旧操作。</p>
  </t-dialog>
</template>

<style scoped>
.conflict-message {
  margin: 0;
  color: #111827;
  font-size: 14px;
}

.conflict-summary {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.conflict-hint {
  margin: 8px 0 0;
  color: #92400e;
  font-size: 13px;
}
</style>
