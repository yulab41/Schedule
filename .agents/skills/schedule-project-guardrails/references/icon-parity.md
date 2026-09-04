# Icon parity routing

Read this reference for any Web/Mini icon migration, icon cleanup, visual parity claim, generated asset
change, or icon motion change. The fast gate is the single repository checker:

```powershell
pnpm icon:parity
```

After the affected producers have already been built, the non-building form is:

```powershell
pnpm icon:parity:check
```

`icon:parity` builds `@schedule/ui-icons`, checks the generated Mini SVGs and Web/Mini motion adapters,
runs the generator twice, and runs `scripts/icon-parity.mjs`. The checker is intentionally independent of
authentication, API availability, and the full administrator workbench.

## Five-layer contract

Every production icon must be traceable through `packages/ui-icons/src/catalog.ts`,
`context.ts`, `motion.ts`, `platform-bindings.ts`, and `parity.ts`:

- Semantic: the page/position/state maps to one canonical icon key and an explicit semantic/context row.
  Similar shapes such as top profile, bottom profile, people, department, calendar, filter, and locate
  must not be silently reused across business meanings.
- Geometry: viewBox, path/shape data, group order, part names, fill/clip rules, line cap, and line join
  are shared. Multi-part icons keep independently addressable parts on both platforms.
- Context: size, container dimensions, stroke width, color roles, optical offset, alignment, and motion
  origin are defined once. A 23px Web/Mini bottom-navigation context cannot drift to 24px in a page.
- State/motion: active/inactive/pressed/disabled coverage is explicit; external Mini SVGs use generated
  color variants where Web `currentColor` is unavailable. Web CSS and Mini WXSS are generated from the
  same motion spec, including duration, easing, delay, iteration, direction, and origin. Active workspace
  loops follow `activeWorkspace`; click transient feedback is not an active lifecycle substitute.
- Build/delivery: every production WXML/WXSS/TS reference resolves to a real generated file; the
  generator manifest and directory close in both directions; normalized SVG geometry/part hashes agree;
  the candidate SHA, profile, manifest, and uploaded version are recorded together.

## Required checks and evidence

The checker must fail on legacy `web-*.svg` references, missing/deleted asset references, missing generator
entries, unreferenced generated assets, missing or mismatched markers, geometry or context drift, incomplete
semantic/state rows, direct production upstream-icon imports, private hand-drawn SVGs without an allowlist
reason, orphan Web/Mini motion keyframes, or an unconditional Mini bottom-nav loop. It reports the complete
Mini reference inventory, catalog/asset counts, context/state counts, motion liveness, and legacy counts.

`apps/web/icon-parity.html` is the isolated gallery. It must remain a Vite multi-page entry that mounts only
the gallery app; it must not import the authenticated app shell, call `/api`, or require a server session.
The gallery shows all catalog definitions, contexts, state coverage, start/stop/replay controls, looping
navigation samples, one-shot top-action motion, and visible multi-part labels.

Do not describe static SVG, Vitest, miniprogram-simulate, or a browser gallery as Xiaomi 14 native visual
acceptance. Native acceptance requires user-provided evidence matching the exact trial SHA/toolchain.
