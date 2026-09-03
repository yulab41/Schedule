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
  width: var(--action-motion-icon-size, 24px);
  height: var(--action-motion-icon-size, 24px);
  flex: 0 0 auto;
  place-items: center;
  color: inherit;
}

.source-svg {
  display: block;
  width: var(--action-motion-icon-size, 24px);
  height: var(--action-motion-icon-size, 24px);
  overflow: visible;
  stroke: currentColor;
  stroke-width: var(--action-motion-icon-stroke-width, 2);
}

.icon-bell .is-animating [data-part='bell'] {
  transform-box: view-box;
  transform-origin: 12px 3px;
  animation: click-bell 620ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-profile .is-animating [data-part='user'] {
  transform-box: view-box;
  transform-origin: center;
  animation: click-profile 480ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-export .is-animating [data-part='frame'] {
  transform-box: view-box;
  transform-origin: center;
  animation: click-export-frame 620ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.icon-export .is-animating [data-part='arrow'] {
  transform-box: view-box;
  transform-origin: center;
  animation: click-export-arrow 620ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.icon-filter .is-animating [data-part='filter-top'] {
  animation: click-filter-top 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-filter .is-animating [data-part='filter-middle'] {
  animation: click-filter-middle 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-filter .is-animating [data-part='filter-bottom'] {
  animation: click-filter-bottom 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-locate .is-animating [data-part='rotor'] {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: click-locate 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-department .is-animating [data-part='rotor'] {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: click-department 500ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-people .is-animating [data-part='primary'] {
  animation: click-people-primary 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-people .is-animating [data-part='secondary'] {
  animation: click-people-secondary 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-phone .is-animating [data-part='phone-body'] {
  transform-box: view-box;
  transform-origin: center;
  animation: click-phone 620ms cubic-bezier(0.2, 0, 0, 1);
}

@keyframes click-bell {
  0% {
    transform: rotate(0deg);
  }
  22% {
    transform: rotate(-9deg);
  }
  44% {
    transform: rotate(8deg);
  }
  64% {
    transform: rotate(-5deg);
  }
  82% {
    transform: rotate(3deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes click-profile {
  0% {
    transform: translateY(0);
  }
  42% {
    transform: translateY(-1.5px);
  }
  68% {
    transform: translateY(0.5px);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes click-export-arrow {
  0% {
    transform: translate(0);
  }
  40% {
    transform: translate(2.2px, -2.2px);
  }
  64% {
    transform: translate(-0.3px, 0.3px);
  }
  82% {
    transform: translate(0.16px, -0.16px);
  }
  100% {
    transform: translate(0);
  }
}

@keyframes click-export-frame {
  0% {
    transform: translate(0);
  }
  36% {
    transform: translate(-0.7px, 0.7px);
  }
  64% {
    transform: translate(0.2px, -0.2px);
  }
  82% {
    transform: translate(-0.08px, 0.08px);
  }
  100% {
    transform: translate(0);
  }
}

@keyframes click-filter-top {
  0% {
    transform: translateX(0);
  }
  46% {
    transform: translateX(2px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes click-filter-middle {
  0% {
    transform: translateX(0);
  }
  46% {
    transform: translateX(-2px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes click-filter-bottom {
  0% {
    transform: translateX(0);
  }
  46% {
    transform: translateX(1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes click-locate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(90deg);
  }
}

@keyframes click-department {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(90deg);
  }
}

@keyframes click-people-primary {
  0% {
    transform: translateX(0);
  }
  46% {
    transform: translateX(-0.75px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes click-people-secondary {
  0% {
    transform: translateX(0);
  }
  46% {
    transform: translateX(1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes click-phone {
  0% {
    transform: rotate(0deg);
  }
  26% {
    transform: rotate(-8deg);
  }
  52% {
    transform: rotate(7deg);
  }
  74% {
    transform: rotate(-3deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .static-motion-icon:not(.preview-motion) .is-animating [data-part] {
    animation: none !important;
  }
}
</style>
