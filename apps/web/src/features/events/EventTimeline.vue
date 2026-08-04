<script setup lang="ts">
import type { CalendarDutyAssignment, ScheduleEvent } from '@schedule/contracts';
import { computed } from 'vue';

import ChangeBadge from '../calendar/ChangeBadge.vue';
import {
  buildEventNarrative,
  buildEventTimelineItems,
  buildDutyAdjustmentChainSummary,
  buildSwapChainSummary,
  extractEventChanges,
  formatEventTime,
  formatJsonValue,
  getEventTypeLabel,
} from './event-timeline.js';

const props = withDefaults(
  defineProps<{
    readonly assignment?: CalendarDutyAssignment | undefined;
    readonly events: readonly ScheduleEvent[];
    readonly showRawData?: boolean;
  }>(),
  { assignment: undefined, showRawData: false },
);

const items = computed(() => buildEventTimelineItems(props.events));
const initiatedAtBySwapRequest = computed(() => {
  const map = new Map<string, string>();
  for (const event of props.events) {
    if (
      event.objectType === 'swap_request' &&
      event.eventType === 'swap_request_created' &&
      event.objectId !== undefined &&
      !map.has(event.objectId)
    ) {
      map.set(event.objectId, event.occurredAt);
    }
  }
  return map;
});
const narratives = computed(
  () =>
    new Map(
      items.value.map((item) => {
        const initiatedAt =
          item.event.objectId === undefined
            ? undefined
            : initiatedAtBySwapRequest.value.get(item.event.objectId);
        return [
          item.event.id,
          buildEventNarrative(item.event, props.assignment, {
            ...(initiatedAt === undefined ? {} : { initiatedAt }),
          }),
        ];
      }),
    ),
);
const swapChain = computed(() =>
  props.assignment === undefined
    ? undefined
    : buildSwapChainSummary(props.events, props.assignment.id),
);
const dutyChain = computed(() =>
  props.assignment === undefined
    ? undefined
    : buildDutyAdjustmentChainSummary(props.events, props.assignment.id),
);
</script>

<template>
  <ol class="event-timeline">
    <li v-for="item in items" :key="item.event.id" class="timeline-entry">
      <div class="entry-heading">
        <time class="entry-time">{{ formatEventTime(item.event.occurredAt) }}</time>
        <ChangeBadge v-if="item.marker !== undefined" :marker="item.marker" />
        <strong
          v-if="
            item.event.eventType !== 'swap_completed' &&
            item.event.eventType !== 'duty_adjustment_completed'
          "
          class="entry-type"
        >
          {{ getEventTypeLabel(item.event.eventType) }}
        </strong>
      </div>
      <p v-if="narratives.get(item.event.id) !== undefined" class="entry-narrative">
        {{ narratives.get(item.event.id) }}
      </p>
      <p v-if="item.event.reason !== undefined" class="entry-reason">
        原因：{{ item.event.reason }}
      </p>
      <ul
        v-if="
          extractEventChanges(item.event).length > 0 && narratives.get(item.event.id) === undefined
        "
        class="entry-changes"
      >
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
  <details v-if="swapChain !== undefined || dutyChain !== undefined" class="chain-details">
    <summary>人员变更链</summary>
    <div class="chain-content">
      <p v-if="swapChain !== undefined" class="chain-summary">{{ swapChain }}</p>
      <p v-if="dutyChain !== undefined" class="chain-summary">{{ dutyChain }}</p>
    </div>
  </details>
</template>

<style scoped>
.event-timeline {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chain-summary {
  margin: 0;
  padding: 10px 12px;
  color: #111827;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.chain-details {
  margin-top: 12px;
  color: #374151;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.chain-details summary {
  padding: 8px 12px;
  color: #1f5aa6;
  cursor: pointer;
  font-weight: 600;
}

.chain-content {
  display: grid;
  gap: 8px;
  padding: 0 12px 12px;
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

.entry-narrative {
  margin: 0;
  padding: 8px 10px;
  color: #111827;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
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
