<script setup lang="ts">
export type Ui2IconName =
  | 'adjustment'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'filter'
  | 'leave'
  | 'more'
  | 'phone'
  | 'plus'
  | 'swap'
  | 'user';

defineProps<{
  readonly name: Ui2IconName;
}>();
</script>

<template>
  <svg class="ui2-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <template v-if="name === 'calendar'">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4M17 3v4M3 10h18" />
      <path d="M7 14h2M12 14h2M17 14h.01M7 18h2M12 18h2" />
    </template>
    <template v-else-if="name === 'leave'">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h5M10 17h4" />
    </template>
    <template v-else-if="name === 'swap'">
      <path d="m7 7 3-3m-3 3 3 3M7 7h9a4 4 0 0 1 4 4" />
      <path d="m17 17-3 3m3-3-3-3m3 3H8a4 4 0 0 1-4-4" />
    </template>
    <template v-else-if="name === 'adjustment'">
      <path d="M12 5v14M5 12h14" />
      <circle cx="12" cy="12" r="9" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </template>
    <template v-else-if="name === 'chevron-left'">
      <path d="m15 18-6-6 6-6" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9 18 6-6-6-6" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </template>
    <template v-else-if="name === 'phone'">
      <path
        d="M8.2 4.5 10 8 8 9.5c1.2 2.7 3.3 4.8 6 6l1.5-2 3.5 1.8v3.2c0 .8-.7 1.5-1.5 1.5C10 19.5 4.5 14 4 6.5 4 5.7 4.7 5 5.5 5Z"
      />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </template>
  </svg>
</template>

<style scoped>
.ui2-icon {
  display: block;
  width: 1.35em;
  height: 1.35em;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
