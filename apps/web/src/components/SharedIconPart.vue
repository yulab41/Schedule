<script setup lang="ts">
import type { IconNode } from '@schedule/ui-icons';

defineProps<{
  readonly node: IconNode;
}>();
</script>

<template>
  <g v-if="node.kind === 'group'" :data-part="node.part">
    <SharedIconPart v-for="child in node.children" :key="child.key" :node="child" />
  </g>
  <path
    v-else-if="node.kind === 'path'"
    :data-part="node.part"
    :d="node.d"
    :fill="node.fill"
    :stroke="node.stroke"
    :fill-rule="node.fillRule"
    :clip-rule="node.clipRule"
    :path-length="node.pathLength"
  />
  <circle
    v-else-if="node.kind === 'circle'"
    :data-part="node.part"
    :cx="node.cx"
    :cy="node.cy"
    :r="node.r"
    :fill="node.fill"
    :stroke="node.stroke"
  />
  <rect
    v-else
    :data-part="node.part"
    :x="node.x"
    :y="node.y"
    :width="node.width"
    :height="node.height"
    :rx="node.rx"
    :fill="node.fill"
    :stroke="node.stroke"
  />
</template>
