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
  min-width: 18px;
  min-height: 18px;
  padding: 0 4px;
  place-items: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #fef3c7;
  color: #92400e;
}
</style>
