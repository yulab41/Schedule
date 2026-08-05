<script setup lang="ts">
import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  buildDialLink,
  formatShiftTimeRange,
  getAvailablePhoneOptions,
  getCalendarMarkerDescription,
  getDutyMemberName,
  type PhoneOption,
} from './calendar-logic.js';
import ChangeBadge from './ChangeBadge.vue';

const props = defineProps<{
  readonly assignment: CalendarDutyAssignment;
  readonly hideShiftBadge?: boolean;
  readonly markers?: readonly CalendarChangeMarker[];
  readonly member: CalendarDutyMember | undefined;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const isMenuOpen = ref(false);
const dutyName = computed(() => getDutyMemberName(props.assignment) ?? '待定');
const shiftTimeRange = computed(() => formatShiftTimeRange(props.assignment));
const phoneOptions = computed<readonly PhoneOption[]>(() => getAvailablePhoneOptions(props.member));
const visibleMarkers = computed(() => props.markers ?? props.assignment.changeMarkers);
const canCall = computed(() => phoneOptions.value.length > 0);
const nameTitle = computed(() => {
  const base = `${props.assignment.shiftTypeName}（${shiftTimeRange.value}）`;
  if (canCall.value) {
    return `${base} · 点击查看联系电话`;
  }
  return base;
});
const isCoarsePointer =
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

function toggleMenu(): void {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu(): void {
  isMenuOpen.value = false;
}

async function copyNumber(number: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(number);
  } finally {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>

<template>
  <div class="duty-cell">
    <button
      v-if="canCall"
      type="button"
      class="duty-name is-callable"
      :aria-expanded="isMenuOpen"
      :aria-label="`拨打${dutyName}电话`"
      :title="nameTitle"
      @click.stop="toggleMenu"
    >
      {{ dutyName }}
    </button>
    <span v-else class="duty-name" :title="nameTitle">{{ dutyName }}</span>
    <span
      v-if="!hideShiftBadge"
      class="shift-badge"
      :style="{ backgroundColor: assignment.shiftTypeColor, color: assignment.shiftTypeTextColor }"
      :title="assignment.shiftTypeName"
    >
      {{ assignment.shiftTypeAbbreviation }}
    </span>
    <button
      v-for="marker in visibleMarkers"
      :key="marker"
      type="button"
      class="change-marker-button"
      :title="`${getCalendarMarkerDescription(marker)}：查看事件记录`"
      :aria-label="`${getCalendarMarkerDescription(marker)}：查看事件记录`"
      @click.stop="emit('open-events', assignment)"
    >
      <ChangeBadge :marker="marker" />
    </button>
    <div v-if="isMenuOpen && canCall" class="phone-menu" @click.stop>
      <template v-if="isCoarsePointer">
        <a
          v-for="option in phoneOptions.filter((entry) => entry.isConfirmed)"
          :key="option.number"
          :href="buildDialLink(option.number)"
        >
          拨打{{ option.label }} {{ option.number }}
        </a>
        <button
          v-for="option in phoneOptions.filter((entry) => !entry.isConfirmed)"
          :key="option.number"
          type="button"
          @click="copyNumber(option.number)"
        >
          复制{{ option.label }}（未确认） {{ option.number }}
        </button>
      </template>
      <template v-else>
        <button
          v-for="option in phoneOptions"
          :key="option.number"
          type="button"
          @click="copyNumber(option.number)"
        >
          复制{{ option.label }}{{ option.isConfirmed ? '' : '（未确认）' }} {{ option.number }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.duty-cell {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
  align-items: center;
  min-height: 22px;
  font-size: 13px;
  line-height: 1.3;
}

.duty-name {
  color: #111827;
  font-weight: 600;
}

.duty-name.is-callable {
  padding: 0;
  color: #111827;
  background: none;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.duty-name.is-callable:hover {
  color: #1f5aa6;
  text-decoration: underline;
}

.shift-badge {
  display: inline-grid;
  min-width: 18px;
  min-height: 18px;
  padding: 0 4px;
  place-items: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.change-marker-button {
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
}

.change-marker-button:hover :deep(.change-marker) {
  outline: 2px solid #fbbf24;
  outline-offset: 1px;
}

.phone-menu {
  position: absolute;
  z-index: 10;
  top: 100%;
  left: 0;
  display: grid;
  gap: 2px;
  min-width: 150px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgb(17 24 39 / 12%);
}

.phone-menu a,
.phone-menu button {
  padding: 6px 8px;
  color: #1f2937;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
}

.phone-menu a:hover,
.phone-menu button:hover {
  background: #f3f4f6;
}
</style>
