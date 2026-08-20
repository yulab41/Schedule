<script setup lang="ts">
import type { WorkbenchNavIconId } from './workbench-nav.js';

export type WorkbenchNavigationIconName = WorkbenchNavIconId | 'logout' | 'more';
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
  <svg
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
    data-source="lucide-animated-pqoqubbw"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="name === 'calendar'">
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path class="minimal-actor" data-part="check" pathLength="1" d="m9 16 2 2 4-4" />
    </template>

    <template v-else-if="name === 'directory'">
      <path d="M8 2v2M16 2v2" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <g class="minimal-actor" data-part="contact-person">
        <circle cx="12" cy="11" r="3" />
        <path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      </g>
    </template>

    <template v-else-if="name === 'groups'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <g class="minimal-actor" data-part="second-person">
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </g>
    </template>

    <template v-else-if="name === 'manual'">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M21 9H3M21 15H3" />
      <path class="minimal-actor" data-part="column" d="M15 3v18" />
    </template>

    <template v-else-if="name === 'backfill'">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
      <g class="minimal-actor" data-part="clock-hands">
        <path d="M12 12V7" />
        <path d="m12 12 4 2" />
      </g>
    </template>

    <template v-else-if="name === 'leave'">
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5" />
      <path class="minimal-actor" data-part="minus" pathLength="1" d="M16 19h6" />
    </template>

    <template v-else-if="name === 'swap'">
      <g class="minimal-actor" data-part="arrow-left">
        <path d="M8 3 4 7l4 4" />
        <path d="M4 7h16" />
      </g>
      <g class="minimal-actor minimal-actor-secondary" data-part="arrow-right">
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </g>
    </template>

    <template v-else-if="name === 'duty'">
      <g class="minimal-actor" data-part="plus-minus">
        <path d="M12 3v14M5 10h14M5 21h14" />
      </g>
    </template>

    <template v-else-if="name === 'events'">
      <path d="M8 5h13M8 12h13M8 19h13" />
      <g class="minimal-actor" data-part="event-dots">
        <path d="M3 5h.01M3 12h.01M3 19h.01" />
      </g>
    </template>

    <template v-else-if="name === 'notifications'">
      <g class="minimal-actor" data-part="bell">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </g>
    </template>

    <template v-else-if="name === 'statistics'">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path class="minimal-actor" data-part="trend" pathLength="1" d="m7 13 3-3 4 4 5-5" />
    </template>

    <template v-else-if="name === 'members'">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <g class="minimal-actor" data-part="member-card-content">
        <circle cx="9" cy="11" r="2" />
        <path d="M6.17 15a3 3 0 0 1 5.66 0M16 10h2M16 14h2" />
      </g>
    </template>

    <template v-else-if="name === 'profile'">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle class="minimal-actor" data-part="portrait" cx="12" cy="7" r="4" />
    </template>

    <template v-else-if="name === 'config'">
      <g class="minimal-actor" data-part="gear">
        <path
          d="M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.03 2.34 2.34 0 0 0 0 3.84 2.34 2.34 0 0 1-2.33 4.03 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.03 2.34 2.34 0 0 0 0-3.84 2.34 2.34 0 0 1 2.33-4.03 2.34 2.34 0 0 0 3.32-1.91"
        />
        <circle cx="12" cy="12" r="3" />
      </g>
    </template>

    <template v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <g class="minimal-actor" data-part="logout-arrow">
        <path d="M21 12H9" />
        <path d="m16 17 5-5-5-5" />
      </g>
    </template>

    <template v-else-if="name === 'more'">
      <circle class="minimal-actor" data-part="dot-one" cx="5" cy="12" r="1" />
      <circle
        class="minimal-actor minimal-actor-secondary"
        data-part="dot-two"
        cx="12"
        cy="12"
        r="1"
      />
      <circle
        class="minimal-actor minimal-actor-tertiary"
        data-part="dot-three"
        cx="19"
        cy="12"
        r="1"
      />
    </template>
  </svg>
</template>

<style scoped>
.lucide-minimal-icon {
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

.minimal-actor {
  transform-box: fill-box;
  transform-origin: center;
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

.is-looping.icon-more .minimal-actor-secondary {
  animation-delay: calc(var(--minimal-delay) + 100ms);
}

.is-looping.icon-more .minimal-actor-tertiary {
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
  .lucide-minimal-icon:not(.force-motion) .minimal-actor {
    animation: none;
  }
}
</style>
