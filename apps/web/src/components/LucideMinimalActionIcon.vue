<script setup lang="ts">
import { CallIcon, ExportIcon, UserIcon } from 'tdesign-icons-vue-next';
import { ref, toRefs, watch } from 'vue';

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
      <svg
        v-if="name === 'bell'"
        class="source-svg"
        data-static-source="notification-bell"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g data-part="bell">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </g>
      </svg>

      <UserIcon
        v-else-if="name === 'profile'"
        class="native-icon"
        data-static-source="tdesign-user"
      />

      <ExportIcon
        v-else-if="name === 'export'"
        class="native-icon"
        data-static-source="tdesign-export"
      />

      <svg
        v-else-if="name === 'filter'"
        class="source-svg"
        data-static-source="calendar-filter"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path class="filter-top" d="M4 6h16" />
        <path class="filter-middle" d="M7 12h10" />
        <path class="filter-bottom" d="M10 18h4" />
      </svg>

      <svg
        v-else-if="name === 'locate'"
        class="source-svg"
        data-static-source="calendar-locator"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g class="locate-rotor">
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="6" />
        </g>
        <circle class="locate-center" cx="12" cy="12" r="1.5" />
      </svg>

      <svg
        v-else-if="name === 'department'"
        class="source-svg"
        data-static-source="directory-department"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g class="department-rotor">
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </g>
      </svg>

      <svg
        v-else-if="name === 'people'"
        class="source-svg"
        data-static-source="directory-people"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g class="person-primary">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </g>
        <g class="person-secondary">
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </g>
      </svg>

      <CallIcon
        v-else-if="name === 'phone'"
        class="native-icon"
        data-static-source="tdesign-call"
      />
    </span>
  </span>
</template>

<style scoped>
.static-motion-icon,
.motion-glyph {
  display: inline-grid;
  width: var(--action-motion-icon-size, 24px);
  height: var(--action-motion-icon-size, 24px);
  flex: 0 0 auto;
  place-items: center;
  color: inherit;
}

.source-svg,
.native-icon {
  display: block;
  width: var(--action-motion-icon-size, 24px);
  height: var(--action-motion-icon-size, 24px);
  overflow: visible;
}

.source-svg {
  stroke: currentColor;
  stroke-width: var(--action-motion-icon-stroke-width, 2);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.native-icon,
.source-svg [data-part='bell'],
.filter-top,
.filter-middle,
.filter-bottom,
.locate-rotor,
.department-rotor,
.person-primary,
.person-secondary {
  transform-box: fill-box;
  transform-origin: center;
}

.locate-center {
  fill: currentColor;
  stroke: none;
}

.icon-bell .is-animating [data-part='bell'] {
  transform-box: view-box;
  transform-origin: 12px 3px;
  animation: click-bell 620ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-profile .is-animating [data-static-source='tdesign-user'] {
  animation: click-profile 480ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-export .is-animating [data-static-source='tdesign-export'] :deep(#stroke1) {
  transform-box: view-box;
  transform-origin: center;
  animation: click-export-frame 620ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.icon-export .is-animating [data-static-source='tdesign-export'] :deep(#stroke2) {
  transform-box: view-box;
  transform-origin: center;
  animation: click-export-arrow 620ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.icon-filter .is-animating .filter-top {
  animation: click-filter-top 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-filter .is-animating .filter-middle {
  animation: click-filter-middle 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-filter .is-animating .filter-bottom {
  animation: click-filter-bottom 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-locate .is-animating .locate-rotor {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: click-locate 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-department .is-animating .department-rotor {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: click-department 500ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-people .is-animating .person-primary {
  animation: click-people-primary 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-people .is-animating .person-secondary {
  animation: click-people-secondary 520ms cubic-bezier(0.2, 0, 0, 1);
}

.icon-phone .is-animating [data-static-source='tdesign-call'] {
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
  .static-motion-icon:not(.preview-motion) .is-animating .native-icon,
  .static-motion-icon:not(.preview-motion)
    .is-animating
    [data-static-source='tdesign-export']
    :deep(#stroke1),
  .static-motion-icon:not(.preview-motion)
    .is-animating
    [data-static-source='tdesign-export']
    :deep(#stroke2),
  .static-motion-icon:not(.preview-motion) .is-animating .source-svg * {
    animation: none !important;
  }
}
</style>
