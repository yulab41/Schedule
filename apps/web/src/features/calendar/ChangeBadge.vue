<script setup lang="ts">
import type { CalendarChangeMarker } from '@schedule/contracts';

import { getCalendarMarkerDescription, getCalendarMarkerLabel } from './calendar-logic.js';

defineProps<{
  readonly marker: CalendarChangeMarker;
}>();
</script>

<template>
  <span
    class="change-marker"
    :title="getCalendarMarkerDescription(marker)"
    :aria-label="getCalendarMarkerDescription(marker)"
  >
    {{ getCalendarMarkerLabel(marker) }}
  </span>
</template>

<style scoped>
.change-marker {
  display: inline-grid;
  box-sizing: border-box;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  place-items: center;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  background: #fef3c7;
  color: #92400e;
}
</style>
