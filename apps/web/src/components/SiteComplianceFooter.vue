<script setup lang="ts">
withDefaults(
  defineProps<{
    readonly withMobileNavigation?: boolean;
  }>(),
  {
    withMobileNavigation: false,
  },
);
</script>

<template>
  <footer
    class="site-compliance-footer"
    :class="{ 'with-mobile-navigation': withMobileNavigation }"
  >
    <a href="https://beian.miit.gov.cn/" rel="noopener noreferrer" target="_blank"
      >粤ICP备2026116116号-1</a
    >
  </footer>
</template>

<style scoped>
.site-compliance-footer {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  margin-top: auto;
  padding: var(--ui-spacing-xxs) var(--ui-spacing-md)
    calc(var(--ui-spacing-xxs) + env(safe-area-inset-bottom));
  align-items: center;
  justify-content: center;
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface);
  border-top: 1px solid var(--ui-color-border);
  font-size: 12px;
  text-align: center;
}

.site-compliance-footer a {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  color: inherit;
  text-decoration: none;
}

.site-compliance-footer a:hover {
  color: var(--ui-color-primary);
  text-decoration: underline;
}

@media (max-width: 640px) {
  .site-compliance-footer.with-mobile-navigation {
    padding-bottom: calc(
      var(--ui-layout-bottom-nav-height) + env(safe-area-inset-bottom) + var(--ui-spacing-xs)
    );
  }
}
</style>
