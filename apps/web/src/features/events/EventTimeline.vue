<script setup lang="ts">
import type { ScheduleEvent } from '@schedule/contracts';
import { computed } from 'vue';

import ChangeBadge from '../calendar/ChangeBadge.vue';
import {
  buildEventTimelineItems,
  extractEventChanges,
  formatEventTime,
  formatJsonValue,
  getEventRelationLabel,
  getEventTypeLabel,
} from './event-timeline.js';

const props = withDefaults(
  defineProps<{
    readonly events: readonly ScheduleEvent[];
    readonly showRawData?: boolean;
  }>(),
  { showRawData: false },
);

const items = computed(() => buildEventTimelineItems(props.events));
</script>

<template>
  <ol class="event-timeline">
    <li v-for="item in items" :key="item.event.id" class="timeline-entry">
      <div class="entry-heading">
        <time class="entry-time">{{ formatEventTime(item.event.occurredAt) }}</time>
        <ChangeBadge v-if="item.marker !== undefined" :marker="item.marker" />
        <strong class="entry-type">{{ getEventTypeLabel(item.event.eventType) }}</strong>
        <span class="entry-relation" :class="{ correction: item.isCorrection }">
          {{ getEventRelationLabel(item.event) }}
        </span>
      </div>
      <p v-if="item.event.reason !== undefined" class="entry-reason">
        原因：{{ item.event.reason }}
      </p>
      <ul v-if="extractEventChanges(item.event).length > 0" class="entry-changes">
        <li v-for="change in extractEventChanges(item.event)" :key="change.label">
          <span class="change-label">{{ change.label }}</span>
          <span class="change-value"
            >{{ change.before ?? '未设置' }} → {{ change.after ?? '未设置' }}</span
          >
        </li>
      </ul>
      <details v-if="showRawData" class="entry-raw">
        <summary>查看原始数据</summary>
        <pre v-if="item.event.beforeData !== undefined || item.event.afterData !== undefined">
变更前：
{{ formatJsonValue(item.event.beforeData) }}
变更后：
{{ formatJsonValue(item.event.afterData) }}
        </pre>
        <pre v-else>无变更数据。</pre>
      </details>
    </li>
  </ol>
</template>

<style scoped>
.event-timeline {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline-entry {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.entry-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.entry-time {
  color: #6b7280;
  font-size: 12px;
}

.entry-type {
  color: #111827;
  font-size: 14px;
}

.entry-relation {
  padding: 1px 6px;
  color: #1f5aa6;
  background: #eff6ff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.entry-relation.correction {
  color: #b45309;
  background: #fef3c7;
}

.entry-reason {
  margin: 0;
  color: #374151;
  font-size: 13px;
}

.entry-changes {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry-changes li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
}

.change-label {
  color: #6b7280;
}

.change-value {
  color: #111827;
  font-weight: 600;
}

.entry-raw summary {
  color: #1f5aa6;
  cursor: pointer;
  font-size: 12px;
}

.entry-raw pre {
  margin: 6px 0 0;
  padding: 8px;
  overflow: auto;
  color: #374151;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
