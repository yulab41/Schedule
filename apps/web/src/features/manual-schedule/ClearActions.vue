<script setup lang="ts">
defineProps<{
  readonly canClearCell: boolean;
  readonly canUndo: boolean;
}>();

const emit = defineEmits<{
  clearCell: [];
  clearColumn: [];
  clearRow: [];
  undo: [];
}>();
</script>

<template>
  <section class="clear-actions" aria-label="清空操作">
    <t-button variant="outline" :disabled="!canClearCell" @click="emit('clearCell')">
      清空此格
    </t-button>
    <t-button variant="outline" @click="emit('clearRow')">清空此行</t-button>
    <t-button variant="outline" @click="emit('clearColumn')">清空此列</t-button>
    <t-button variant="text" :disabled="!canUndo" @click="emit('undo')">撤销</t-button>
    <span class="clear-hint">清空整行或整列需要二次确认。</span>
  </section>
</template>

<style scoped>
.clear-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.clear-hint {
  color: #6b7280;
  font-size: 12px;
}
</style>
