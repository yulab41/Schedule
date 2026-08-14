<script setup lang="ts">
import type { CalendarDutyAssignment, ScheduleEvent } from '@schedule/contracts';
import { computed } from 'vue';

import ChangeBadge from '../calendar/ChangeBadge.vue';
import {
  buildEventNarrative,
  buildEventTimelineItems,
  buildChangeChainSummary,
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
const changeChain = computed(() =>
  props.assignment === undefined
    ? undefined
    : buildChangeChainSummary(props.events, props.assignment.id),
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
  <details v-if="changeChain !== undefined" class="chain-details">
    <summary>人员变更链</summary>
    <div class="chain-content">
      <p class="chain-summary">{{ changeChain }}</p>
    </div>
  </details>
</template>

<style scoped>
.event-timeline {
  display: grid;
  gap: var(--ui-spacing-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chain-summary {
  margin: 0;
  padding: var(--ui-spacing-sm);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-normal);
}

.chain-details {
  margin-top: var(--ui-spacing-md);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.chain-details summary {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px 12px;
  align-items: center;
  color: var(--ui-color-primary-dark);
  cursor: pointer;
  font-weight: var(--ui-font-weight-semibold);
}

.chain-content {
  display: grid;
  gap: var(--ui-spacing-xs);
  padding: 0 var(--ui-spacing-sm) var(--ui-spacing-sm);
}

.timeline-entry {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.entry-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  align-items: center;
}

.entry-time {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.entry-type {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
}

.entry-narrative {
  margin: 0;
  padding: 10px 12px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-medium);
  line-height: var(--ui-line-height-normal);
}

.entry-reason {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.entry-changes {
  display: grid;
  gap: var(--ui-spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry-changes li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  font-size: var(--ui-font-size-sm);
}

.change-label {
  color: var(--ui-color-text-secondary);
}

.change-value {
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.entry-raw summary {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  color: var(--ui-color-primary-dark);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.entry-raw pre {
  max-width: 100%;
  margin: var(--ui-spacing-xs) 0 0;
  padding: var(--ui-spacing-sm);
  overflow: auto;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (prefers-reduced-motion: reduce) {
  .event-timeline *,
  .event-timeline *::before,
  .event-timeline *::after {
    scroll-behavior: auto !important;
  }
}
</style>
