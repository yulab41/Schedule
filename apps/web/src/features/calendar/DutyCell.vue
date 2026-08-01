<script setup lang="ts">
import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  buildDialLink,
  formatShiftTimeRange,
  getAvailablePhoneOptions,
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getDutyMemberName,
  type PhoneOption,
} from './calendar-logic.js';

const props = defineProps<{
  readonly assignment: CalendarDutyAssignment;
  readonly member: CalendarDutyMember | undefined;
}>();

const isMenuOpen = ref(false);
const dutyName = computed(() => getDutyMemberName(props.assignment) ?? '待定');
const shiftTimeRange = computed(() => formatShiftTimeRange(props.assignment));
const phoneOptions = computed<readonly PhoneOption[]>(() => getAvailablePhoneOptions(props.member));
const hasUnconfirmedPhone = computed(
  () =>
    props.member !== undefined &&
    !props.member.isConfirmed &&
    (props.member.mobilePhone !== undefined || props.member.shortPhone !== undefined),
);
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
    <span class="duty-name" :title="`${assignment.shiftTypeName}（${shiftTimeRange}）`">
      {{ dutyName }}
    </span>
    <span
      class="shift-badge"
      :style="{ backgroundColor: assignment.shiftTypeColor, color: assignment.shiftTypeTextColor }"
      :title="assignment.shiftTypeName"
    >
      {{ assignment.shiftTypeAbbreviation }}
    </span>
    <span
      v-for="marker in assignment.changeMarkers"
      :key="marker"
      class="change-marker"
      :title="getCalendarMarkerDescription(marker)"
    >
      {{ getCalendarMarkerLabel(marker) }}
    </span>
    <span v-if="phoneOptions.length > 0" class="phone-action">
      <button
        type="button"
        class="phone-button"
        :aria-label="`拨打${dutyName}电话`"
        :aria-expanded="isMenuOpen"
        @click.stop="toggleMenu"
      >
        📞
      </button>
      <div v-if="isMenuOpen" class="phone-menu" @click.stop>
        <template v-if="isCoarsePointer">
          <a
            v-for="option in phoneOptions"
            :key="option.number"
            :href="buildDialLink(option.number)"
          >
            拨打{{ option.label }} {{ option.number }}
          </a>
        </template>
        <template v-else>
          <button
            v-for="option in phoneOptions"
            :key="option.number"
            type="button"
            @click="copyNumber(option.number)"
          >
            复制{{ option.label }} {{ option.number }}
          </button>
        </template>
      </div>
    </span>
    <span
      v-else-if="hasUnconfirmedPhone"
      class="phone-unavailable"
      title="号码未确认，无法拨号"
      aria-label="号码未确认，无法拨号"
    >
      📞
    </span>
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

.shift-badge,
.change-marker {
  display: inline-grid;
  min-width: 18px;
  min-height: 18px;
  padding: 0 4px;
  place-items: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.change-marker {
  background: #fef3c7;
  color: #92400e;
}

.phone-button {
  padding: 0 2px;
  background: none;
  border: 0;
  cursor: pointer;
  font-size: 12px;
}

.phone-unavailable {
  font-size: 12px;
  opacity: 0.45;
}

.phone-menu {
  position: absolute;
  z-index: 10;
  top: 100%;
  left: 0;
  display: grid;
  gap: 2px;
  min-width: 132px;
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
