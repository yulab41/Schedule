<script setup lang="ts">
import { type IconKey } from '@schedule/ui-icons';

import SharedIcon from '../../components/SharedIcon.vue';
import type { WorkbenchNavIconId } from './workbench-nav.js';

export type WorkbenchNavigationIconName = Extract<IconKey, WorkbenchNavIconId | 'logout' | 'more'>;
export type WorkbenchNavMotionStyle = 'adaptive' | 'android' | 'apple';

withDefaults(
  defineProps<{
    readonly active?: boolean;
    readonly forceMotion?: boolean;
    readonly looping?: boolean;
    readonly motionStyle?: WorkbenchNavMotionStyle;
    readonly name: WorkbenchNavigationIconName;
  }>(),
  { active: false, forceMotion: false, looping: false, motionStyle: 'adaptive' },
);
</script>

<template>
  <SharedIcon
    class="workbench-nav-icon lucide-minimal-icon"
    :class="[
      {
        'force-motion': forceMotion,
        'is-active': active,
        'is-looping': looping,
      },
      `icon-${name}`,
      `style-${motionStyle}`,
    ]"
    :name="name"
    data-source="lucide-animated-pqoqubbw"
  />
</template>

<style>
.workbench-nav-icon {
  display: block;
  overflow: visible;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
