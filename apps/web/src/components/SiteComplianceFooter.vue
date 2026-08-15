<template>
  <footer class="site-compliance-footer">
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
  background: transparent;
  border: 0;
  font-size: 12px;
  text-align: center;
}

.site-compliance-footer a {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 0 var(--ui-spacing-sm);
  align-items: center;
  color: inherit;
  border-radius: var(--ui-radius-pill);
  text-decoration: none;
  transition:
    color var(--ui-duration-fast) ease,
    background var(--ui-duration-fast) ease;
}

.site-compliance-footer a:hover,
.site-compliance-footer a:active,
.site-compliance-footer a:focus-visible {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
}

@media (prefers-reduced-motion: reduce) {
  .site-compliance-footer a {
    transition: none;
  }
}
</style>
