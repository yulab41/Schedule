<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  iconCatalog,
  iconContextSpecs,
  iconMotionSpecs,
  iconParityMatrix,
  type IconKey,
} from '@schedule/ui-icons';

import SharedIcon from '../components/SharedIcon.vue';

const stateOptions = ['active', 'inactive', 'pressed', 'disabled'] as const;
type GalleryState = (typeof stateOptions)[number];

const catalogEntries = Object.values(iconCatalog);
const contextEntries = Object.values(iconContextSpecs);
const selectedState = ref<GalleryState>('active');
const motionRunning = ref(true);
const motionEpoch = ref(0);

const motionExamples = [
  { icon: 'bell', label: '顶部通知 · 一次性', loop: false, oneShot: true },
  { icon: 'people', label: '人员图标 · 多 part', loop: true, oneShot: false },
  { icon: 'more', label: '更多导航 · 循环', loop: true, oneShot: false },
] as const satisfies readonly { icon: IconKey; label: string; loop: boolean; oneShot: boolean }[];

const matrixBySource = computed(() => {
  const seen = new Set<string>();
  return iconParityMatrix.filter((entry) => {
    const key = `${entry.sourceKey}:${entry.contextKey}:${entry.semantic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const colorVariableByRole: Record<string, string> = {
  danger: '--ui-color-danger',
  directoryModeInactive: '--ui-color-directory-mode-inactive',
  favorite: '--ui-color-warning',
  muted: '--ui-color-text-muted',
  primary: '--ui-color-primary',
  secondary: '--ui-color-text-secondary',
  success: '--ui-color-success',
};

function partKeys(icon: (typeof catalogEntries)[number]) {
  const parts: string[] = [];
  function visit(nodes: typeof icon.nodes) {
    for (const node of nodes) {
      if (node.part !== undefined) parts.push(node.part);
      if (node.kind === 'group') visit(node.children);
    }
  }
  visit(icon.nodes);
  return parts;
}

function contextSample(contextKey: keyof typeof iconContextSpecs) {
  return (
    iconParityMatrix.find((entry) => entry.contextKey === contextKey)?.sourceKey ??
    ('user' as IconKey)
  );
}

function colorFor(entry: (typeof iconParityMatrix)[number], state: GalleryState) {
  const context = iconContextSpecs[entry.contextKey];
  const role =
    state === 'inactive' || state === 'disabled'
      ? context.inactiveColorRole
      : context.activeColorRole;
  return `var(${colorVariableByRole[role] ?? '--ui-color-text-primary'})`;
}

function coverageFor(entry: (typeof iconParityMatrix)[number], state: GalleryState) {
  return entry.states[state];
}

function toggleMotion() {
  motionRunning.value = !motionRunning.value;
}

function replayMotion() {
  motionRunning.value = false;
  motionEpoch.value += 1;
  requestAnimationFrame(() => {
    motionRunning.value = true;
  });
}
</script>

<template>
  <main class="icon-gallery">
    <header class="gallery-header">
      <div>
        <p class="eyebrow">Schedule · isolated parity surface</p>
        <h1>Web / Mini icon parity gallery</h1>
        <p class="lede">
          Canonical geometry, context, state and motion are rendered here without authentication,
          API calls or the administrator workbench.
        </p>
      </div>
      <div class="gallery-summary" aria-label="图标统计">
        <strong>{{ catalogEntries.length }}</strong>
        <span>canonical icons</span>
        <strong>{{ iconParityMatrix.length }}</strong>
        <span>Mini bindings</span>
      </div>
    </header>

    <section class="gallery-panel" aria-labelledby="state-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">C · D</p>
          <h2 id="state-heading">Context and state matrix</h2>
        </div>
        <div class="state-controls" role="group" aria-label="图标状态">
          <button
            v-for="state in stateOptions"
            :key="state"
            class="state-button"
            :class="{ 'is-selected': selectedState === state }"
            type="button"
            @click="selectedState = state"
          >
            {{ state }}
          </button>
        </div>
      </div>
      <div class="matrix-grid">
        <article v-for="entry in matrixBySource" :key="entry.fileKey" class="matrix-card">
          <div
            class="matrix-icon"
            :class="{ 'is-pressed': selectedState === 'pressed' }"
            :style="{ color: colorFor(entry, selectedState) }"
          >
            <SharedIcon :name="entry.sourceKey" />
          </div>
          <div class="matrix-copy">
            <strong>{{ entry.sourceKey }}</strong>
            <span>{{ entry.semantic }}</span>
            <small>{{ entry.contextKey }} · {{ coverageFor(entry, selectedState) }}</small>
          </div>
        </article>
      </div>
    </section>

    <section class="gallery-panel" aria-labelledby="context-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">C</p>
          <h2 id="context-heading">Shared contexts</h2>
        </div>
        <span class="panel-note">size · stroke · container · optical offset · origin</span>
      </div>
      <div class="context-grid">
        <article v-for="context in contextEntries" :key="context.key" class="context-card">
          <div
            class="context-icon"
            :style="{
              width: `${context.containerWidthPx}px`,
              height: `${context.containerHeightPx}px`,
              color: `var(${colorVariableByRole[context.activeColorRole]})`,
            }"
          >
            <SharedIcon :name="contextSample(context.key)" :stroke-width="context.strokeWidth" />
          </div>
          <strong>{{ context.key }}</strong>
          <small>
            {{ context.sizePx }}px · {{ context.strokeWidth }} ·
            {{ context.opticalOffset.join(', ') }} · {{ context.transformOrigin }}
          </small>
        </article>
      </div>
    </section>

    <section class="gallery-panel" aria-labelledby="motion-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">D</p>
          <h2 id="motion-heading">Motion lifecycle</h2>
        </div>
        <div class="motion-controls" role="group" aria-label="动效控制">
          <button type="button" @click="toggleMotion">
            {{ motionRunning ? '停止动效' : '启动动效' }}
          </button>
          <button type="button" @click="replayMotion">重新启动</button>
        </div>
      </div>
      <div :key="motionEpoch" class="motion-grid">
        <article v-for="motion in motionExamples" :key="motion.label" class="motion-card">
          <div
            class="motion-stage"
            :class="[`icon-${motion.icon}`, { 'is-looping': motion.loop && motionRunning }]"
          >
            <div :class="{ 'is-animating': motion.oneShot && motionRunning }">
              <SharedIcon :name="motion.icon" />
            </div>
          </div>
          <strong>{{ motion.label }}</strong>
          <small>{{ motion.loop ? 'active lifecycle loop' : 'click-like one-shot' }}</small>
        </article>
      </div>
      <p class="motion-note">
        {{ Object.keys(iconMotionSpecs).length }} motion specs · stop removes the animation class;
        navigation loops are not used by the top action.
      </p>
    </section>

    <section class="gallery-panel" aria-labelledby="catalog-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">A · B · E</p>
          <h2 id="catalog-heading">Canonical catalog and part boundaries</h2>
        </div>
        <span class="panel-note">all Web geometry comes from @schedule/ui-icons</span>
      </div>
      <div class="catalog-grid">
        <article v-for="icon in catalogEntries" :key="icon.key" class="catalog-card">
          <div class="catalog-icon"><SharedIcon :name="icon.key" /></div>
          <strong>{{ icon.key }}</strong>
          <code>{{ icon.sourceSha }}</code>
          <div v-if="partKeys(icon).length > 0" class="part-list" aria-label="parts">
            <span v-for="part in partKeys(icon)" :key="part">{{ part }}</span>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style>
:root {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button {
  font: inherit;
}

.icon-gallery {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 32px;
}

.gallery-header,
.panel-heading,
.motion-controls,
.state-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.gallery-header {
  padding: 8px 0 28px;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--ui-color-primary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: clamp(28px, 4vw, 46px);
  letter-spacing: -0.04em;
}

h2 {
  margin-bottom: 0;
  font-size: 20px;
}

.lede {
  max-width: 680px;
  margin-bottom: 0;
  color: var(--ui-color-text-secondary);
  line-height: 1.6;
}

.gallery-summary {
  display: grid;
  min-width: 150px;
  padding: 14px 16px;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  background: var(--ui-color-surface);
}

.gallery-summary strong {
  color: var(--ui-color-primary);
  font-size: 20px;
}

.gallery-summary span,
.panel-note,
.motion-note {
  color: var(--ui-color-text-secondary);
  font-size: 12px;
}

.gallery-panel {
  margin-bottom: 18px;
  padding: 20px;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-card);
}

.panel-heading {
  margin-bottom: 18px;
  align-items: flex-end;
}

.state-button,
.motion-controls button {
  padding: 7px 10px;
  color: var(--ui-color-text-secondary);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  background: var(--ui-color-surface);
  cursor: pointer;
}

.state-button.is-selected,
.motion-controls button:first-child {
  color: var(--ui-color-primary-dark);
  border-color: var(--ui-color-primary-border);
  background: var(--ui-color-primary-light);
}

.matrix-grid,
.context-grid,
.motion-grid,
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.matrix-card,
.context-card,
.motion-card,
.catalog-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  background: var(--ui-color-surface-muted);
}

.matrix-card {
  display: flex;
  min-height: 88px;
  align-items: center;
  gap: 12px;
}

.matrix-icon,
.context-icon,
.catalog-icon {
  display: grid;
  flex: none;
  place-items: center;
}

.matrix-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--ui-color-surface);
  transition: transform 140ms ease;
}

.matrix-icon.is-pressed {
  transform: scale(0.88);
}

.matrix-icon svg,
.catalog-icon svg,
.motion-stage svg {
  width: 24px;
  height: 24px;
}

.matrix-copy,
.context-card,
.motion-card,
.catalog-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.matrix-copy span,
.context-card small,
.motion-card small,
.catalog-card code {
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-card {
  align-items: flex-start;
}

.context-icon {
  min-width: 42px;
  min-height: 42px;
  margin-bottom: 4px;
}

.motion-card {
  min-height: 152px;
}

.motion-stage {
  display: grid;
  min-height: 94px;
  place-items: center;
  color: var(--ui-color-primary);
  border-radius: var(--ui-radius-small);
  background: var(--ui-color-surface);
}

.motion-stage > div {
  display: grid;
  place-items: center;
}

.motion-note {
  margin: 14px 0 0;
}

.catalog-card {
  min-height: 120px;
}

.catalog-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
  color: var(--ui-color-primary);
  border-radius: 12px;
  background: var(--ui-color-surface);
}

.part-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.part-list span {
  padding: 2px 5px;
  color: var(--ui-color-primary-dark);
  border-radius: 4px;
  background: var(--ui-color-primary-light);
  font-size: 10px;
}

@media (max-width: 720px) {
  .icon-gallery {
    padding: 20px 14px;
  }

  .gallery-header,
  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .gallery-summary {
    width: 100%;
  }

  .state-controls,
  .motion-controls {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
