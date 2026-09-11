<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import CalendarView from '../../views/calendar/CalendarView.vue';
defineProps<{ readonly group: GroupSummary }>();
</script>
<template>
  <section class="guest-calendar-panel"><CalendarView :group="group" /></section>
</template>
