<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue';

import { type IconKey } from '@schedule/ui-icons';

import SharedIcon from './SharedIcon.vue';

export type LucideMinimalActionIconName =
  'bell' | 'department' | 'export' | 'filter' | 'locate' | 'people' | 'phone' | 'profile';

const props = withDefaults(
  defineProps<{
    readonly motionKey?: number;
    readonly name: LucideMinimalActionIconName;
    readonly previewMotion?: boolean;
  }>(),
  { motionKey: 0, previewMotion: false },
);
const { motionKey, name, previewMotion } = toRefs(props);
const isAnimating = ref(false);
const sharedIconName = computed<IconKey>(() => (name.value === 'profile' ? 'user' : name.value));
const sourceName = computed(() => {
  if (name.value === 'profile') return 'tdesign-user';
  if (name.value === 'phone') return 'tdesign-call';
  if (name.value === 'export') return 'tdesign-export';
  return `shared-${name.value}`;
});

watch(
  () => props.motionKey,
  (currentMotionKey, previousMotionKey) => {
    if (currentMotionKey === previousMotionKey) return;
    isAnimating.value = true;
  },
  { flush: 'sync' },
);
</script>

<template>
  <span
    class="static-motion-icon"
    :class="[`icon-${name}`, { 'preview-motion': previewMotion }]"
    :data-motion-key="motionKey"
    aria-hidden="true"
  >
    <span
      :key="`${name}-${motionKey}`"
      class="motion-glyph"
      :class="{ 'is-animating': isAnimating }"
    >
      <SharedIcon class="source-svg" :data-static-source="sourceName" :name="sharedIconName" />
    </span>
  </span>
</template>

<style>
.static-motion-icon,
.motion-glyph {
  display: inline-grid;
  width: var(--action-motion-icon-size, 20px);
  height: var(--action-motion-icon-size, 20px);
  flex: 0 0 auto;
  place-items: center;
  color: inherit;
  transform: translate(
    var(--action-motion-icon-optical-offset-x, 0px),
    var(--action-motion-icon-optical-offset-y, 0px)
  );
  transform-origin: var(--action-motion-icon-transform-origin, center);
}

.source-svg {
  display: block;
  width: var(--action-motion-icon-size, 20px);
  height: var(--action-motion-icon-size, 20px);
  overflow: visible;
  stroke: currentColor;
  stroke-width: var(--action-motion-icon-stroke-width, 2);
  transform-origin: var(--action-motion-icon-transform-origin, center);
}
</style>
