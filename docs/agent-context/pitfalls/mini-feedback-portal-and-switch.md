# Mini feedback: portal variables and switch busy paint

Symptoms: a root-portal notification paints only text; changing one setting flashes other switches.

Root causes observed in MINI-FEEDBACK-REGRESSION-001:

- Shared generated WXSS declares variables on `page`. A detached top-level subtree must not assume
  that former ancestor supplies its colors, radius, shadow, type or z-index. Desktop fixtures using
  Web `tokens.css` on `:root` conceal that dependency. The old implementation reproduced transparent
  background, radius0, no shadow and invalid z-index when page inheritance was removed.
- Swap/duty bound both native switch disabled props to one `settingsBusy`. Saving one setting
  disabled/re-enabled both. The shared UiSwitch also originally treated loading as faded disabled.
  A normal settings write did not run the whole-page loading function.

Preserve these contracts:

1. Extend the existing Mini token build step; derive the portal selector from exactly the same
   generated WXSS. Do not hardcode a second theme, add a runtime dependency, or hand-edit dist.
2. Root content must explicitly obtain its variables within the portal. Keep fixed placement,
   pointer passthrough, safe offsets and the existing one-timer host contract.
3. Paint tests use page-scoped tokens and remove that ancestor. Assert opacity, background, border
   radius, shadow, contrast and z-index as well as geometry. A browser model is not native acceptance.
4. Reuse UiSwitch; loading blocks repeated input without global dim/restore. Permanent disabled
   retains its styling. Keep the existing settings write lock, authority and receiver bindings.
5. Update only the clicked value promptly, use the server result on success, and restore the previous
   value on failure. Old controller generations must never commit a late success or rollback.
6. Direct Pages register only leaf UiSwitch, never a full workflow panel. Tests must recognize both
   `bindchange` and `bind:change`; retain exact component inventories and the thin-page boundary.

Guards: `workflow-switch-feedback.test.mjs`, `foundation-simulate.test.mjs`, `build-tools.test.mjs`,
`ui-toast.test.mjs`, `workflow-direct-pages.test.mjs`, and `ui-toast-layout.mjs` under Mini scripts.
Read the current audit record before reusing earlier screenshot or device claims.
