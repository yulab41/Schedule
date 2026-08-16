<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  readonly groups: readonly GroupSummary[];
  readonly modelValue: string | undefined;
}>();

const emit = defineEmits<{
  'update:modelValue': [groupId: string];
}>();

const rootRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(0);
const menuId = 'group-switcher-menu';

const selectedGroup = computed(
  () => props.groups.find((group) => group.id === props.modelValue) ?? props.groups[0],
);

const groupOptions = computed(() =>
  props.groups.map((group) => ({
    label: group.name,
    role: roleLabel(group.role),
    value: group.id,
  })),
);

const selectedIndex = computed(() => {
  const index = groupOptions.value.findIndex((option) => option.value === selectedGroup.value?.id);
  return index >= 0 ? index : 0;
});

watch(selectedIndex, (index) => {
  highlightedIndex.value = index;
});

function roleLabel(role: GroupSummary['role'] | undefined): string {
  if (role === 'owner') {
    return '群主';
  }

  if (role === 'administrator') {
    return '管理员';
  }

  return role === 'guest' ? '访客' : '成员';
}

function optionId(index: number): string {
  return `${menuId}-option-${index}`;
}

function openMenu(): void {
  highlightedIndex.value = selectedIndex.value;
  isOpen.value = true;
}

function closeMenu(restoreFocus = false): void {
  isOpen.value = false;
  if (restoreFocus) {
    const trigger = rootRef.value?.querySelector<HTMLButtonElement>('.group-switcher-arrow-button');
    trigger?.focus();
  }
}

function toggleMenu(): void {
  if (isOpen.value) {
    closeMenu(true);
  } else {
    openMenu();
  }
}

function selectGroup(groupId: string): void {
  if (!props.groups.some((group) => group.id === groupId)) {
    return;
  }

  emit('update:modelValue', groupId);
  closeMenu(true);
}

function moveHighlight(step: number): void {
  const optionCount = groupOptions.value.length;
  if (optionCount === 0) {
    return;
  }

  highlightedIndex.value = (highlightedIndex.value + step + optionCount) % optionCount;
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (!isOpen.value) {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openMenu();
    }
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlight(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlight(-1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    highlightedIndex.value = 0;
  } else if (event.key === 'End') {
    event.preventDefault();
    highlightedIndex.value = Math.max(0, groupOptions.value.length - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const option = groupOptions.value[highlightedIndex.value];
    if (option !== undefined) {
      selectGroup(option.value);
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu(true);
  } else if (event.key === 'Tab') {
    closeMenu();
  }
}

function closeOnOutsidePointer(event: PointerEvent): void {
  const target = event.target;
  if (target instanceof Node && !rootRef.value?.contains(target)) {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer);
});
</script>

<template>
  <div v-if="groups.length > 0" ref="rootRef" class="group-switcher">
    <div class="group-switcher-trigger" :class="{ 'is-open': isOpen }">
      <span class="group-switcher-copy">
        {{ selectedGroup?.name }} · {{ roleLabel(selectedGroup?.role) }}
      </span>
      <button
        id="group-switcher-trigger"
        class="group-switcher-arrow-button"
        type="button"
        role="combobox"
        aria-label="展开排班群组列表"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        :aria-controls="menuId"
        :aria-activedescendant="isOpen ? optionId(highlightedIndex) : undefined"
        @click="toggleMenu"
        @keydown="handleTriggerKeydown"
      >
        <span class="group-switcher-arrow" :class="{ 'is-open': isOpen }" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="isOpen"
      :id="menuId"
      class="group-switcher-menu"
      role="listbox"
      aria-label="可用排班群组"
    >
      <button
        v-for="(option, index) in groupOptions"
        :id="optionId(index)"
        :key="option.value"
        class="group-switcher-option"
        :class="{ 'is-highlighted': index === highlightedIndex }"
        type="button"
        role="option"
        :aria-selected="option.value === selectedGroup?.id"
        @click="selectGroup(option.value)"
      >
        <span class="group-switcher-option-copy">
          <span class="group-switcher-option-name">{{ option.label }}</span>
          <span class="group-switcher-option-role">{{ option.role }}</span>
        </span>
        <span
          v-if="option.value === selectedGroup?.id"
          class="group-switcher-option-check"
          aria-hidden="true"
          >✓</span
        >
      </button>
    </div>
  </div>
</template>

<style scoped>
.group-switcher {
  position: relative;
  display: flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  align-items: center;
  flex: 0 1 auto;
}

.group-switcher-trigger {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  padding: 0 36px 0 0;
  align-items: center;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-medium);
  line-height: 1.35;
}

.group-switcher-copy {
  min-width: 0;
  overflow: hidden;
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-medium);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-switcher-arrow-button {
  position: absolute;
  top: 50%;
  right: 0;
  display: inline-flex;
  width: 36px;
  min-width: 36px;
  min-height: var(--ui-touch-target-minimum);
  padding: 0;
  align-items: center;
  justify-content: center;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  transform: translateY(-50%);
}

.group-switcher-arrow-button:hover,
.group-switcher-arrow-button:focus-visible,
.group-switcher.is-open .group-switcher-arrow-button {
  color: var(--ui-color-primary);
  background: transparent;
}

.group-switcher-arrow-button:focus-visible {
  outline: 2px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.group-switcher-arrow {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform var(--ui-duration-fast) ease;
}

.group-switcher-arrow.is-open {
  transform: translateY(2px) rotate(225deg);
}

.group-switcher-menu {
  position: absolute;
  display: grid;
  z-index: var(--ui-z-index-dialog);
  top: calc(100% + var(--ui-spacing-lg));
  left: 0;
  width: max(100%, 216px);
  max-width: min(320px, calc(100vw - var(--ui-spacing-xl)));
  padding: var(--ui-spacing-xxs);
  gap: var(--ui-spacing-xxs);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-elevated);
}

.group-switcher-option {
  display: flex;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  align-items: center;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.group-switcher-option:hover,
.group-switcher-option.is-highlighted {
  background: var(--ui-color-primary-light);
}

.group-switcher-option-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.group-switcher-option-name {
  overflow: hidden;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-switcher-option-role {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.group-switcher-option-check {
  margin-left: auto;
  color: var(--ui-color-primary);
  font-weight: var(--ui-font-weight-strong);
}

@media (prefers-reduced-motion: reduce) {
  .group-switcher-arrow {
    transition: none;
  }
}
</style>
