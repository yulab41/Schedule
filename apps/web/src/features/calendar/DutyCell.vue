<script setup lang="ts">
import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import LucideMinimalActionIcon from '../../components/LucideMinimalActionIcon.vue';
import {
  buildDialLink,
  formatShiftTimeRange,
  getAvailablePhoneOptions,
  getCalendarMarkerDescription,
  getDutyMemberName,
  type PhoneOption,
} from './calendar-logic.js';
import { truncateCalendarBadgeLabel } from './calendar-views.js';
import ChangeBadge from './ChangeBadge.vue';

const props = defineProps<{
  readonly assignment: CalendarDutyAssignment;
  readonly compactShiftBadge?: boolean;
  readonly hideShiftBadge?: boolean;
  readonly markers?: readonly CalendarChangeMarker[];
  readonly member: CalendarDutyMember | undefined;
  readonly contactMode?: 'button' | 'hidden' | 'name';
  readonly markerMode?: 'button' | 'static';
  readonly showDetails?: boolean;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const isMenuOpen = ref(false);
const phoneMotionKey = ref(0);
const dutyName = computed(() => getDutyMemberName(props.assignment) ?? '待定');
const shiftTimeRange = computed(() => formatShiftTimeRange(props.assignment));
const phoneOptions = computed<readonly PhoneOption[]>(() => getAvailablePhoneOptions(props.member));
const visibleMarkers = computed(() => props.markers ?? props.assignment.changeMarkers);
const canCall = computed(() => phoneOptions.value.length > 0);
const contactMode = computed(() => props.contactMode ?? 'name');
const markerMode = computed(() => props.markerMode ?? 'button');
const shiftBadgeLabel = computed(() =>
  props.compactShiftBadge === true
    ? truncateCalendarBadgeLabel(props.assignment.shiftTypeAbbreviation)
    : props.assignment.shiftTypeAbbreviation,
);
const shiftDetailLabel = computed(() => {
  const abbreviation = props.assignment.shiftTypeAbbreviation.trim();
  return abbreviation.endsWith('班') ? abbreviation : `${abbreviation}班`;
});
const dutyDetails = computed(
  () =>
    `${shiftDetailLabel.value} · ${shiftTimeRange.value} · ${props.assignment.scheduleRoleName}`,
);
const nameTitle = computed(() => {
  const base = `${props.assignment.shiftTypeName}（${shiftTimeRange.value}）`;
  if (canCall.value && contactMode.value !== 'hidden') {
    return `${base} · 点击查看联系电话`;
  }
  return base;
});
function toggleMenu(): void {
  phoneMotionKey.value += 1;
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu(): void {
  isMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>

<template>
  <div
    class="duty-cell"
    :class="[
      `contact-${contactMode}`,
      { 'can-call': canCall, 'has-details': showDetails === true },
    ]"
  >
    <button
      v-if="canCall && contactMode === 'name'"
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
    <span v-if="showDetails" class="duty-details">{{ dutyDetails }}</span>
    <button
      v-if="canCall && contactMode === 'button'"
      type="button"
      class="duty-phone-button"
      :aria-expanded="isMenuOpen"
      :aria-label="`拨打${dutyName}电话`"
      :title="nameTitle"
      @click.stop="toggleMenu"
    >
      <LucideMinimalActionIcon
        class="phone-motion-icon"
        name="phone"
        :motion-key="phoneMotionKey"
      />
    </button>
    <span
      v-if="!hideShiftBadge"
      class="shift-badge"
      :style="{ backgroundColor: assignment.shiftTypeColor, color: assignment.shiftTypeTextColor }"
      :title="assignment.shiftTypeName"
    >
      {{ shiftBadgeLabel }}
    </span>
    <div v-if="visibleMarkers.length > 0" class="change-marker-list">
      <template v-for="marker in visibleMarkers" :key="marker">
        <button
          v-if="markerMode === 'button'"
          type="button"
          class="change-marker-button"
          :title="`${getCalendarMarkerDescription(marker)}：查看事件记录`"
          :aria-label="`${getCalendarMarkerDescription(marker)}：查看事件记录`"
          @click.stop="emit('open-events', assignment)"
        >
          <ChangeBadge :marker="marker" />
        </button>
        <span v-else class="change-marker-static">
          <ChangeBadge :marker="marker" />
        </span>
      </template>
    </div>
    <div v-if="isMenuOpen && canCall && contactMode !== 'hidden'" class="phone-menu" @click.stop>
      <a
        v-for="option in phoneOptions"
        :key="option.number"
        :href="buildDialLink(option.number)"
        @click="closeMenu"
      >
        拨打{{ option.label }}{{ option.isConfirmed ? '' : '（未确认）' }} {{ option.number }}
      </a>
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

.duty-details {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.duty-phone-button {
  display: inline-grid;
  width: 44px;
  height: 44px;
  margin-left: auto;
  padding: 0;
  place-items: center;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border: 0;
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
}

.duty-cell.contact-button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: center;
}

.duty-cell.contact-button .duty-name {
  grid-column: 1;
  grid-row: 1;
}

.duty-cell.contact-button .duty-phone-button {
  grid-column: 2;
  grid-row: 1 / span 2;
  margin-left: 0;
}

.duty-cell.contact-button .shift-badge {
  grid-row: 2;
}

.duty-cell.contact-button .change-marker-list {
  display: inline-flex;
  min-width: 0;
  grid-row: 2;
  align-items: center;
  gap: 2px;
}

.duty-cell.contact-button.has-details {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 6px;
}

.duty-cell.contact-button.has-details.can-call {
  grid-template-columns: minmax(0, 1fr) auto 44px;
}

.duty-cell.contact-button.has-details .duty-name {
  grid-column: 1;
  grid-row: 1;
}

.duty-cell.contact-button.has-details .duty-details {
  grid-column: 1 / -1;
  grid-row: 2;
}

.duty-cell.contact-button.has-details.can-call .duty-details {
  grid-column: 1 / 3;
}

.duty-cell.contact-button.has-details .change-marker-list {
  grid-column: 2;
  grid-row: 1;
}

.duty-cell.contact-button.has-details .duty-phone-button {
  grid-column: 3;
  grid-row: 1 / span 2;
}

.shift-badge {
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
  white-space: nowrap;
}

.change-marker-list {
  display: contents;
}

.change-marker-button {
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
}

.change-marker-static {
  display: inline-flex;
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
