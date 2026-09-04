<script setup lang="ts">
import { computed } from 'vue';

import { iconCatalog, type IconKey } from '@schedule/ui-icons';

import SharedIconPart from './SharedIconPart.vue';

const props = defineProps<{
  readonly name: IconKey;
  readonly strokeWidth?: number;
}>();

const definition = computed(() => iconCatalog[props.name]);
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth ?? definition.strokeWidth"
    :stroke-linecap="definition.lineCap"
    :stroke-linejoin="definition.lineJoin"
    aria-hidden="true"
  >
    <SharedIconPart v-for="node in definition.nodes" :key="node.key" :node="node" />
  </svg>
</template>
