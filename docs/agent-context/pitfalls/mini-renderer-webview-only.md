# Mini Program renderer: WebView-only

## What went wrong

Two Xiaomi 14 devices on the *same* WeChat version and the *same* base library (3.17.3) rendered the
same build differently: one showed the two-column Grid lists aligned, the other was 8 px out. The
first diagnosis blamed the base library ("3.17.2 renders badly, 3.17.3 is fine") and produced a
`SDKVersion === '3.17.2'` compatibility layer: `.is-skyline-3172-ui` styles, a native-scroll wheel
twin, a native-scroll period pager twin, a hosted picker dialog and SVG spinner fallbacks.

The real difference was the **renderer**: the healthy device reported `Skyline 支持=不支持` (it ran
WebView) and the broken one reported `Skyline 支持=支持` (it ran Skyline). The compatibility layer
was keyed to a base-library version, so the 3.17.3 grey release walked straight past it and the whole
surface regressed at once.

Because the layer was patched *for Skyline*, every later fix had to reproduce WebView behaviour inside
Skyline (wheels, pager height, sheet scrim, locate animation). That cost many rounds and never matched.

## What the right diagnosis looks like

- Renderer decides layout; the base library only decides which APIs exist.
- `wx.getSkylineInfo().isSupported === false` (shown in 更多 → 测试工具 as `Skyline 支持`) means the
  page runs on WebView. Treat that, not `SDKVersion`, as the rendering fact.
- A/B the *same build* on two devices before blaming a version: same build + different renderer is the
  signature of this class of bug.

## Policy (2026-09-19, user-confirmed on trial `.171`)

- `src/app.json` requests `"renderer": "webview"` and declares no `rendererOptions`; page JSONs may
  only repeat `webview`. The build fails if `renderer` is anything else.
- No Skyline compatibility layer, no `skyline3172UiCompatibility` flag, no `'worklet'` directive, no
  `__MINIPROGRAM_RENDERER__` build switch: `apps/miniprogram/scripts/webview-only-policy.test.mjs`
  fails the suite if one reappears.
- Changing the renderer needs a new ADR plus a rerun of the device acceptance checklist; it is not a
  config tweak.
- The backend allowlist (`MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS`) still gates which trial builds run;
  that is an app-version control, unrelated to the renderer.

## Component-library / base-library follow-up

Base-library upgrades no longer change our rendering branch, but they can still change API availability
and real-device behaviour (`wx.getSkylineInfo`, `wx.getAppBaseInfo` fields, Grid and scroll internals).
Therefore:

- On every device acceptance round, record base library, `Skyline 支持`, `renderer` and the build label
  (`拍照`/copy from 更多 → 测试工具 and 我的 → build label) so a future regression can be attributed.
- When the base library moves (for example a new 3.17.x/3.18 rollout), rerun the main paths
  (workbench month/week/list, swap + leave sheets and their pickers, manual matrix) once on the new
  base library before assuming nothing changed.
- Do not add `wx.canIUse`-style or version-comparison UI branches; prefer capability detection or the
  server capability flags. If a future change genuinely needs version-specific code, write it as an
  ADR plus a guard next to this file, not as an inline `if (SDKVersion === ...)`.

## Evidence

- `docs/audit/webview-only-cleanup-20260919.md` (full inventory, package sizes, DevTools evidence).
- `apps/miniprogram/docs/decisions/ADR-0007-webview-renderer.md`.
- Commits `1f2dcf61` (request WebView), `ca673d0c` (delete the compatibility layer), `d201ab97`
  (delete the last Worklet probe), `566ceed5` (enforce the renderer in the build).
- Trials `.169`/`.170`/`.171`; Xiaomi 14 acceptance of `.171` passed with no findings.
