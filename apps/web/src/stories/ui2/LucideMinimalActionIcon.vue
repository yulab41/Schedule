<script setup lang="ts">
export type LucideMinimalActionIconName =
  'bell' | 'department' | 'export' | 'filter' | 'locate' | 'people' | 'phone' | 'profile';

withDefaults(
  defineProps<{
    readonly delay?: number;
    readonly forceMotion?: boolean;
    readonly looping?: boolean;
    readonly name: LucideMinimalActionIconName;
  }>(),
  { delay: 0, forceMotion: false, looping: true },
);
</script>

<template>
  <svg
    class="lucide-minimal-action-icon"
    :class="[{ 'force-motion': forceMotion, 'is-looping': looping }, `icon-${name}`]"
    :style="{ '--action-delay': `${delay}ms` }"
    data-source="lucide-animated-pqoqubbw"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="name === 'bell'">
      <g class="action-actor" data-part="bell">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </g>
    </template>

    <template v-else-if="name === 'profile'">
      <g class="action-actor" data-part="profile">
        <circle pathLength="1" cx="12" cy="7" r="4" />
        <path pathLength="1" d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </g>
    </template>

    <template v-else-if="name === 'export'">
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <g class="action-actor" data-part="export-arrow">
        <path d="m8 7 4-4 4 4" />
        <path d="M12 3v13" />
      </g>
    </template>

    <template v-else-if="name === 'filter'">
      <path
        class="action-actor"
        data-part="filter"
        pathLength="1"
        d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"
      />
    </template>

    <template v-else-if="name === 'locate'">
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle class="action-actor" data-part="locator-ring" pathLength="1" cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1" />
    </template>

    <template v-else-if="name === 'department'">
      <path d="M6 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17M4 22h16M10 22v-4h4v4" />
      <path class="action-actor" data-part="department-cross" pathLength="1" d="M12 7v6M9 10h6" />
    </template>

    <template v-else-if="name === 'people'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <g class="action-actor" data-part="second-person">
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </g>
    </template>

    <template v-else-if="name === 'phone'">
      <path
        class="action-actor"
        data-part="phone"
        pathLength="1"
        d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.8a2 2 0 0 1-.45 2.11L8.07 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.84.55 2.8.68A2 2 0 0 1 22 16.9Z"
      />
    </template>
  </svg>
</template>

<style scoped>
.lucide-minimal-action-icon {
  --action-delay: 0ms;
  --action-loop: 1800ms;
  display: block;
  width: 24px;
  height: 24px;
  overflow: visible;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.action-actor {
  transform-box: fill-box;
  transform-origin: center;
}

.is-looping.icon-bell [data-part='bell'] {
  transform-box: view-box;
  transform-origin: 12px 3px;
  animation: action-bell 1400ms ease-in-out var(--action-delay) infinite;
}

.is-looping.icon-profile [data-part='profile'] {
  stroke-dasharray: 1 1;
  animation: action-profile var(--action-loop) ease-in-out var(--action-delay) infinite;
}

.is-looping.icon-export [data-part='export-arrow'] {
  animation: action-export 1500ms cubic-bezier(0.2, 0, 0, 1) var(--action-delay) infinite;
}

.is-looping.icon-filter [data-part='filter'] {
  stroke-dasharray: 1 1;
  animation: action-filter var(--action-loop) ease-in-out var(--action-delay) infinite;
}

.is-looping.icon-locate [data-part='locator-ring'] {
  transform-box: view-box;
  transform-origin: 12px 12px;
  stroke-dasharray: 0.22 0.08;
  animation: action-locate 1500ms linear var(--action-delay) infinite;
}

.is-looping.icon-department [data-part='department-cross'] {
  stroke-dasharray: 1 1;
  animation: action-department 1500ms ease-in-out var(--action-delay) infinite;
}

.is-looping.icon-people [data-part='second-person'] {
  animation: action-people var(--action-loop) cubic-bezier(0.2, 0, 0, 1) var(--action-delay)
    infinite;
}

.is-looping.icon-phone [data-part='phone'] {
  stroke-dasharray: 1 1;
  animation: action-phone 1500ms ease-in-out var(--action-delay) infinite;
}

@keyframes action-bell {
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

@keyframes action-profile {
  0% {
    opacity: 0.72;
    stroke-dashoffset: 0.22;
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0.72;
    stroke-dashoffset: 0.22;
  }
}

@keyframes action-export {
  0% {
    opacity: 0.55;
    transform: translateY(1.5px);
  }
  50% {
    opacity: 1;
    transform: translateY(-1.5px);
  }
  100% {
    opacity: 0.55;
    transform: translateY(1.5px);
  }
}

@keyframes action-filter {
  0% {
    opacity: 0.72;
    stroke-dashoffset: 0.22;
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0.72;
    stroke-dashoffset: 0.22;
  }
}

@keyframes action-locate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes action-department {
  0% {
    opacity: 0.68;
    stroke-dashoffset: 0.2;
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0.68;
    stroke-dashoffset: 0.2;
  }
}

@keyframes action-people {
  0% {
    opacity: 0.4;
    transform: translateX(-2px);
  }
  50% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0.4;
    transform: translateX(-2px);
  }
}

@keyframes action-phone {
  0% {
    opacity: 0.72;
    stroke-dashoffset: 0.18;
    transform: rotate(-3deg);
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 0;
    transform: rotate(2deg);
  }
  100% {
    opacity: 0.72;
    stroke-dashoffset: 0.18;
    transform: rotate(-3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lucide-minimal-action-icon:not(.force-motion) .action-actor {
    animation: none;
  }
}
</style>
