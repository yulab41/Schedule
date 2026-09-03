<script setup lang="ts">
import { type IconKey } from '@schedule/ui-icons';

import SharedIcon from '../../components/SharedIcon.vue';
import type { WorkbenchNavIconId } from './workbench-nav.js';

export type WorkbenchNavigationIconName = Extract<IconKey, WorkbenchNavIconId | 'logout' | 'more'>;
export type WorkbenchNavMotionStyle = 'adaptive' | 'android' | 'apple';

withDefaults(
  defineProps<{
    readonly active?: boolean;
    readonly forceMotion?: boolean;
    readonly looping?: boolean;
    readonly motionStyle?: WorkbenchNavMotionStyle;
    readonly name: WorkbenchNavigationIconName;
  }>(),
  { active: false, forceMotion: false, looping: false, motionStyle: 'adaptive' },
);
</script>

<template>
  <SharedIcon
    class="workbench-nav-icon lucide-minimal-icon"
    :class="[
      {
        'force-motion': forceMotion,
        'is-active': active,
        'is-looping': looping,
      },
      `icon-${name}`,
      `style-${motionStyle}`,
    ]"
    :name="name"
    data-source="lucide-animated-pqoqubbw"
  />
</template>

<style>
.workbench-nav-icon {
  --minimal-loop: 1800ms;
  --minimal-delay: 0ms;
  display: block;
  width: 24px;
  height: 24px;
  overflow: visible;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.style-apple {
  --minimal-loop: 2000ms;
}

.style-android {
  --minimal-loop: 1500ms;
}

.is-looping.icon-calendar [data-part='check'],
.is-looping.icon-leave [data-part='minus'],
.is-looping.icon-statistics [data-part='trend'] {
  stroke-dasharray: 1 1;
  animation: minimal-draw var(--minimal-loop) ease-in-out var(--minimal-delay) infinite;
}

.is-looping.icon-directory [data-part='contact-person'],
.is-looping.icon-groups [data-part='second-person'],
.is-looping.icon-members [data-part='member-card-content'] {
  animation: minimal-enter var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-manual [data-part='column'] {
  animation: minimal-column var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-backfill [data-part='clock-hands'] {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: minimal-rewind var(--minimal-loop) linear var(--minimal-delay) infinite;
}

.is-looping.icon-swap [data-part='arrow-left'] {
  animation: minimal-swap-left var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-swap [data-part='arrow-right'] {
  animation: minimal-swap-right var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-duty [data-part='plus-minus'] {
  animation: minimal-duty var(--minimal-loop) ease-in-out var(--minimal-delay) infinite;
}

.is-looping.icon-events [data-part='event-dots'] {
  animation: minimal-event-step var(--minimal-loop) ease-in-out var(--minimal-delay) infinite;
}

.is-looping.icon-notifications [data-part='bell'] {
  transform-box: view-box;
  transform-origin: 12px 3px;
  animation: minimal-bell var(--minimal-loop) ease-in-out var(--minimal-delay) infinite;
}

.is-looping.icon-profile [data-part='portrait'] {
  animation: minimal-profile var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-config [data-part='gear'] {
  transform-box: view-box;
  transform-origin: 12px 12px;
  animation: minimal-gear var(--minimal-loop) linear var(--minimal-delay) infinite;
}

.is-looping.icon-more [data-part^='dot-'] {
  animation: minimal-dot var(--minimal-loop) ease-in-out var(--minimal-delay) infinite;
}

.is-looping.icon-logout [data-part='logout-arrow'] {
  animation: minimal-logout var(--minimal-loop) cubic-bezier(0.2, 0, 0, 1) var(--minimal-delay)
    infinite;
}

.is-looping.icon-more [data-part='dot-two'] {
  animation-delay: calc(var(--minimal-delay) + 100ms);
}

.is-looping.icon-more [data-part='dot-three'] {
  animation-delay: calc(var(--minimal-delay) + 200ms);
}

@keyframes minimal-draw {
  0% {
    opacity: 0.3;
    stroke-dashoffset: 1;
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0.3;
    stroke-dashoffset: 1;
  }
}

@keyframes minimal-enter {
  0% {
    opacity: 0.45;
    transform: translateX(-2px);
  }
  50% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0.45;
    transform: translateX(-2px);
  }
}

@keyframes minimal-column {
  0% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-3px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes minimal-rewind {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(-360deg);
  }
}

@keyframes minimal-swap-left {
  0% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  50% {
    transform: translateX(0);
  }
  75% {
    transform: translateX(1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes minimal-swap-right {
  0% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(2px);
  }
  50% {
    transform: translateX(0);
  }
  75% {
    transform: translateX(-1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes minimal-duty {
  0% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.55;
  }
}

@keyframes minimal-event-step {
  0% {
    transform: translateY(-7px);
  }
  50% {
    transform: translateY(7px);
  }
  100% {
    transform: translateY(-7px);
  }
}

@keyframes minimal-bell {
  0% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-8deg);
  }
  40% {
    transform: rotate(7deg);
  }
  60% {
    transform: rotate(-4deg);
  }
  80% {
    transform: rotate(2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes minimal-profile {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1.5px);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes minimal-gear {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes minimal-dot {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes minimal-logout {
  0% {
    opacity: 0.55;
    transform: translateX(0);
  }
  50% {
    opacity: 1;
    transform: translateX(3px);
  }
  100% {
    opacity: 0.55;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workbench-nav-icon:not(.force-motion) [data-part] {
    animation: none;
  }
}
</style>
