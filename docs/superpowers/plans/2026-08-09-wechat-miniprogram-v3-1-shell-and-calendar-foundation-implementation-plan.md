# WeChat Mini Program V3-1 Shell And Calendar Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V3 mini-program manifest and native shell, restore the existing WeChat-backed session and role entry flow, and introduce a typed, tested `CalendarMonthViewModel` without adding APIs, contract fields, permissions, or backend rules.

**Architecture:** Keep V3-1 split into three independent checkpoints. Task 3 creates only the platform shell and a page-level Skyline calendar shell over reusable local scrolling; Task 4 wires existing authentication, profile, invite, group-role, contact, and platform-admin endpoints through an injectable session state machine; Task 5 ports current Web date/filter/sort semantics into pure TypeScript and builds a renderer-neutral calendar view model. WXML consumes shell state or view-model fields, while API objects, authorization decisions, persistence, and business rules remain outside components.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, Vitest 3, WeChat Mini Program base library 3.16.2, WeChat DevTools, Skyline/`glass-easel` for the calendar shell only, native `scroll-view` and tabBar, TDesign Mini Program 1.16.0 installed but not rendered in V3-1.

---

## Scope And Authority

Read these files completely before executing any checkbox:

- `AGENTS.md`
- `docs/project-status.md`
- `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`
- `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`
- `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-0-5-foundation-implementation-plan.md`
- `apps/miniprogram/api/client.ts`
- `apps/miniprogram/api/client.test.ts`
- `apps/miniprogram/api/endpoints.ts`
- `apps/miniprogram/config/index.ts`
- `apps/miniprogram/store/session.ts`
- `packages/contracts/src/calendar.ts`
- `packages/contracts/src/groups.ts`
- `packages/contracts/src/holidays.ts`
- `packages/contracts/src/users.ts`
- `packages/contracts/src/wechat.ts`
- `apps/web/src/features/layout/workbench-nav.ts`
- `apps/web/src/features/calendar/calendar-logic.ts`
- `apps/web/src/features/calendar/calendar-views.ts`
- `apps/web/src/features/calendar/current-month-calendar.spec.ts`
- `apps/web/src/features/calendar/calendar-views.spec.ts`

This plan contains exactly V3-1 Tasks 3–5. Execute each task in a separate implementation conversation because Task 3 has an external DevTools/simulator gate, Task 4 changes authentication and account association behavior, and Task 5 is a semantic Web-to-mini-program port. Stop after each task checkpoint. Do not begin the next task merely because time or context remains.

Do not restore, copy, inspect for behavior, or derive implementation from V1/V2 pages, components, manifests, display adapters, custom tab bars, deleted tests, or stashed UI files. Git history may be used only for the retained `api/**`, `store/session.ts`, current Web code, current contracts, and the regression introduction commands explicitly listed below.

Do not add or modify an API route, request field, response field, marker type, role, permission, storage-backed write queue, database rule, or backend behavior. In particular:

- `CalendarChangeMarker` remains exactly `'swap' | 'leave-cover' | 'overtime'`; V3-1 does not add `deduction`.
- `CalendarDutyAssignment.changeMarkers` has no event ID. The view model may generate a client action ID from the assignment ID, marker, and marker index, but must not claim that value is a server event ID.
- `WechatLoginResponse.profile === undefined`, not `isNewUser`, determines whether profile completion is needed; repeated login can return `isNewUser: false` with no profile.
- `AcceptInviteResponse.token` is the only existing account-merge token override. If present, persist it before clearing the pending invite token.
- Profile completion uses existing `POST /users` through `createUserProfile(realName)`. V3-1 does not use the existing incomplete `updateProfile(realName)` client wrapper and does not implement profile editing.
- Role entry visibility mirrors current Web `workbenchNavItems`; server endpoints remain the authorization authority.

The V3-0.5 prerequisite is satisfied by these synchronized checkpoints:

| Evidence                                                           | Verified checkpoint                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Task 1 tracked configuration, audit, and artifact cleanup          | `6d2c5fe chore(miniprogram): establish V3 clean build baseline`                                 |
| Task 2 injectable 401 handling and main/subpackage smoke discovery | `2c93859 fix(miniprogram): inject auth expiry and cover subpackages`                            |
| Git state before this plan                                         | `main`, `HEAD == origin/main == 2c93859`, clean worktree                                        |
| Focused verification                                               | `3` files / `9` tests passed; config audit, mini-program typecheck, and core-smoke guard passed |
| Runtime boundary                                                   | `apps/miniprogram/app.json` is absent; no V3 page runtime claim exists yet                      |

If any of those statements is false at execution time, stop and regenerate this plan from the new checkpoint instead of adapting paths or signatures from memory.

## File Responsibility Map

Every created or modified file has one primary responsibility. Files marked “read only” are explicit non-change boundaries.

| Path                                                                  | Task/action                    | Single responsibility                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/miniprogram-tab-icons.mjs`                                   | Task 3 create                  | Deterministically generate the eight native tabBar PNG assets without adding an image dependency.                                                    |
| `scripts/miniprogram-app-shell.test.mjs`                              | Task 3 create; Task 4 modify   | Audit the real manifest, tabBar assets, renderer split, page-local scrolling, and registered routes.                                                 |
| `scripts/miniprogram-calendar-boundary.test.mjs`                      | Task 5 create                  | Prove calendar WXML consumes VM fields only and that no unsupported marker/event/TDesign field crosses the boundary.                                 |
| `scripts/miniprogram-manifest.mjs`                                    | Read only                      | Continue normalizing and validating main-package and subpackage routes.                                                                              |
| `scripts/miniprogram-manifest.test.mjs`                               | Read only                      | Preserve the V3-0.5 pure manifest-helper regression suite.                                                                                           |
| `scripts/miniprogram-smoke.mjs`                                       | Read only                      | Continue visiting every registered route with native `switchTab` for tab pages and `reLaunch` for other pages.                                       |
| `apps/miniprogram/app.json`                                           | Tasks 3–4 create/modify        | Declare only V3 pages, page-level renderer choices, lazy loading, and the four-item native tabBar.                                                   |
| `apps/miniprogram/app.ts`                                             | Task 3 create; Task 4 modify   | Remain a thin App lifecycle composition root for session restore and auth navigation.                                                                |
| `apps/miniprogram/app.wxss`                                           | Task 3 create                  | Import global V3 tokens and establish the page viewport baseline.                                                                                    |
| `apps/miniprogram/sitemap.json`                                       | Task 3 create                  | Disable indexing for authenticated V3 shell routes.                                                                                                  |
| `apps/miniprogram/tokens/index.wxss`                                  | Task 3 create                  | Hold the accepted Web colors plus V3 spacing, touch, and motion tokens used by shell components.                                                     |
| `apps/miniprogram/assets/tab-bar/workbench.png`                       | Task 3 generate                | Inactive native workbench tab icon, 81×81 PNG under 40 KB.                                                                                           |
| `apps/miniprogram/assets/tab-bar/workbench-active.png`                | Task 3 generate                | Selected native workbench tab icon, 81×81 PNG under 40 KB.                                                                                           |
| `apps/miniprogram/assets/tab-bar/calendar.png`                        | Task 3 generate                | Inactive native calendar tab icon, 81×81 PNG under 40 KB.                                                                                            |
| `apps/miniprogram/assets/tab-bar/calendar-active.png`                 | Task 3 generate                | Selected native calendar tab icon, 81×81 PNG under 40 KB.                                                                                            |
| `apps/miniprogram/assets/tab-bar/notifications.png`                   | Task 3 generate                | Inactive native notifications tab icon, 81×81 PNG under 40 KB.                                                                                       |
| `apps/miniprogram/assets/tab-bar/notifications-active.png`            | Task 3 generate                | Selected native notifications tab icon, 81×81 PNG under 40 KB.                                                                                       |
| `apps/miniprogram/assets/tab-bar/profile.png`                         | Task 3 generate                | Inactive native profile tab icon, 81×81 PNG under 40 KB.                                                                                             |
| `apps/miniprogram/assets/tab-bar/profile-active.png`                  | Task 3 generate                | Selected native profile tab icon, 81×81 PNG under 40 KB.                                                                                             |
| `apps/miniprogram/components/page-shell/index.json`                   | Task 3 create                  | Register the reusable shell as a component.                                                                                                          |
| `apps/miniprogram/components/page-shell/index.ts`                     | Task 3 create                  | Expose shell title/back properties and keep `wx.navigateBack` receiver-bound.                                                                        |
| `apps/miniprogram/components/page-shell/index.wxml`                   | Task 3 create                  | Render a fixed custom navigation header and the page’s only vertical `scroll-view`.                                                                  |
| `apps/miniprogram/components/page-shell/index.wxss`                   | Task 3 create                  | Give `scroll-view` a definite height and stable safe-area/touch sizing.                                                                              |
| `apps/miniprogram/components/shell-state/index.{json,ts,wxml,wxss}`   | Task 3 create                  | Render stable loading, empty, error, forbidden, and conflict shell messages without service objects.                                                 |
| `apps/miniprogram/pages/auth/login/index.json`                        | Task 3 create                  | Register the WebView login page with the shared local-scroll components.                                                                             |
| `apps/miniprogram/pages/auth/login/index.{ts,wxml,wxss}`              | Task 3 create; Task 4 modify   | Render the login shell, then call the existing WeChat login/session flow.                                                                            |
| `apps/miniprogram/pages/workbench/index.json`                         | Task 3 create                  | Register the WebView native-tab workbench page.                                                                                                      |
| `apps/miniprogram/pages/workbench/index.{ts,wxml,wxss}`               | Task 3 create; Task 4 modify   | Render role-filtered, group-scoped workbench entries.                                                                                                |
| `apps/miniprogram/pages/calendar/index.json`                          | Task 3 create                  | Keep the calendar’s page-level Skyline/`glass-easel` and local-scroll declarations.                                                                  |
| `apps/miniprogram/pages/calendar/index.{ts,wxml,wxss}`                | Task 3 create; Task 5 modify   | Host the calendar foundation and consume only typed VM fields.                                                                                       |
| `apps/miniprogram/pages/notifications/index.{json,ts,wxml,wxss}`      | Task 3 create                  | Keep the native notifications tab route valid; notification data remains V3-3.                                                                       |
| `apps/miniprogram/pages/profile/index.json`                           | Task 3 create                  | Register the WebView native-tab profile page.                                                                                                        |
| `apps/miniprogram/pages/profile/index.{ts,wxml,wxss}`                 | Task 3 create; Task 4 modify   | Show current profile, role, contact-confirmation summaries, and logout.                                                                              |
| `apps/miniprogram/pages/auth/profile-setup/index.{json,ts,wxml,wxss}` | Task 4 create                  | Complete the existing real-name profile; this is not self-registration or WeChat avatar/nickname collection.                                         |
| `apps/miniprogram/pages/invite/invite.{json,ts,wxml,wxss}`            | Task 4 create                  | Preserve the server’s existing `pages/invite/invite?t=...` share path with a new V3 invite bridge.                                                   |
| `apps/miniprogram/features/auth/auth-flow.ts`                         | Task 4 create                  | Wrap one callback-style `wx.login`, parse invite query `t`, and calculate auth landing targets.                                                      |
| `apps/miniprogram/features/auth/auth-flow.test.ts`                    | Task 4 create                  | Lock receiver binding, empty/failing login codes, invite parsing, and duplicate-401 navigation.                                                      |
| `apps/miniprogram/features/auth/auth-runtime.ts`                      | Task 4 create                  | Compose `wx` navigation, the injected 401 callback, and the session singleton without making pages import the `App()` entry module.                  |
| `apps/miniprogram/features/auth/auth-runtime.test.ts`                 | Task 4 create                  | Prove one protected-401 transition clears in-memory auth and coalesces login navigation without a second storage deletion.                           |
| `apps/miniprogram/store/session.ts`                                   | Task 4 replace                 | Own injectable session restoration, WeChat sign-in, profile completion, role context, selected group, and pending-invite consumption.                |
| `apps/miniprogram/store/session.test.ts`                              | Task 4 create                  | Lock single-flight Promise behavior, generation invalidation, error states, nullish profile semantics, token override order, and side-effect counts. |
| `apps/miniprogram/features/navigation/workbench-navigation.ts`        | Task 4 create                  | Mirror the current Web workbench entry order and group-role/platform filtering without granting permission.                                          |
| `apps/miniprogram/features/navigation/workbench-navigation.test.ts`   | Task 4 create                  | Prove owner/administrator/member/guest and platform-admin entry matrices.                                                                            |
| `apps/miniprogram/features/profile/profile-logic.ts`                  | Task 4 create                  | Join the current user membership to contact data by membership ID, never by real name.                                                               |
| `apps/miniprogram/features/profile/profile-logic.test.ts`             | Task 4 create                  | Prove ID-based joins, guest skipping, missing contact state, and API call counts.                                                                    |
| `apps/miniprogram/features/calendar/calendar-logic.ts`                | Task 5 create                  | Port business date, month grid, filtering, stable sorting, member fallback, marker, holiday, phone, and CST display logic.                           |
| `apps/miniprogram/features/calendar/calendar-logic.test.ts`           | Task 5 create                  | Prove the port against dense, multi-assignment, cross-year, nullish, and no-mutation cases.                                                          |
| `apps/miniprogram/features/calendar/calendar-view-model.ts`           | Task 5 create                  | Convert existing calendar/holiday contracts into the complete renderer-neutral `CalendarMonthViewModel`.                                             |
| `apps/miniprogram/features/calendar/calendar-view-model.test.ts`      | Task 5 create                  | Prove ready/cached/refreshing/loading/error/forbidden/conflict states and dense-day mapping.                                                         |
| `apps/miniprogram/features/calendar/calendar-page-controller.ts`      | Task 5 create                  | Own injected owner/guest calendar loading, request generations, in-flight de-duplication, local VM rebuilds, and typed phone effects.                |
| `apps/miniprogram/features/calendar/calendar-page-controller.test.ts` | Task 5 create                  | Prove endpoint selection/call counts, stale-result suppression, local-only filtering, errors, and one-shot dial/copy behavior.                       |
| `apps/miniprogram/api/endpoints.ts`                                   | Read only                      | Supply the already-existing login, profile, invite, groups, contacts, platform, calendar, and holiday calls.                                         |
| `packages/contracts/src/**`                                           | Read only                      | Remain the only shared data contracts; V3-1 must not add fields or marker types.                                                                     |
| `apps/web/src/features/layout/workbench-nav.ts`                       | Read only                      | Remain the current navigation semantics source.                                                                                                      |
| `apps/web/src/features/calendar/calendar-logic.ts`                    | Read only                      | Remain the current filter/member/marker/holiday semantics source.                                                                                    |
| `apps/web/src/features/calendar/calendar-views.ts`                    | Read only                      | Remain the current date/week/sort semantics source.                                                                                                  |
| `docs/project-status.md`                                              | Modify at each task checkpoint | Record exact outcome, validation, commit/push, external state, next one-task batch, and three-state completion status.                               |
| `docs/debug/debug-feedback-log.md`                                    | Modify at each task checkpoint | Record introduction evidence, behavior audit, browser/core smoke, DevTools/simulator evidence, and unresolved external state.                        |

## Current Official Capability Gate

The implementation must re-open the linked official pages at execution time. The following conclusions are current planning constraints, not runtime proof:

| Capability               | Current official basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | V3-1 decision                                                                                                                                                                               | Required actual verification                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skyline                  | [Skyline migration](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/) currently lists Android/iOS WeChat 8.0.40+, base library 3.0.2+, Stable DevTools 1.06.2307260+, and OHOS WeChat 1.0.10+/base 3.11.3+; it documents page-level `renderer: "skyline"` and renderer inspection.                                                                                                                                                                                                                                                     | Only `pages/calendar/index` declares Skyline. No global renderer and no speculative `rendererOptions` fields.                                                                               | Record current DevTools and debug base-library versions; perform a full compile; confirm the simulator renderer indicator and page `this.renderer === "skyline"`; separately record forced-WebView compatibility.                                  |
| `glass-easel`            | [Official migration guide](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html) currently requires DevTools 1.06.2308142+ for debugging, requires component compatibility, and recommends instance-bound `this.createSelectorQuery()` over the compatibility path.                                                                                                                                                                                                                                                       | Calendar page declares `componentFramework: "glass-easel"`; shared shell uses only `wx:if`, `wx:for`, slots, properties, `this.setData`, and receiver-bound APIs.                           | Require the stricter 1.06.2308142+ tool gate; perform a full compile because current Skyline tooling does not support hot reload as acceptance evidence; inspect warnings and record the actual component framework in Skyline and forced WebView. |
| Worklet                  | [Worklet guide](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html) limits Worklet APIs to Skyline and defines `runOnJS`/shared-value boundaries.                                                                                                                                                                                                                                                                                                                                                                                      | No Worklet function, shared value, `runOnJS`, or per-frame mutation is added in V3-1. Existing `compileWorklet: true` is only a compiler baseline.                                          | Record `Worklet: N/A in V3-1`; a successful compile does not establish Worklet runtime compatibility.                                                                                                                                              |
| Native tabBar            | [Global app configuration](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html) limits native tabBar to 2–5 registered pages and local image assets; [switchTab](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.switchTab.html) forbids query parameters.                                                                                                                                                                                                                                                                      | Four native items, no `custom-tab-bar`, no TDesign tab bar, and 81×81 local PNGs under 40 KB.                                                                                               | Click and programmatically switch through all four tabs; verify selected icons/text, no query dependency, fixed platform tabBar, and non-tab stack closing.                                                                                        |
| Local scrolling          | [Page config](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/page.html) places `disableScroll` in page JSON; [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html) requires a definite height.                                                                                                                                                                                                                                                                                                               | Every V3-1 page has `disableScroll: true`; `page-shell` owns one definite-height vertical `scroll-view`.                                                                                    | For every page, prove the header and tabBar stay fixed, only `scrollTop` changes, and first/last content remain reachable. Do not claim page-level pull-down refresh.                                                                              |
| Native calendar controls | Official [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html), [picker](https://developers.weixin.qq.com/miniprogram/dev/component/picker.html), and [switch](https://developers.weixin.qq.com/miniprogram/dev/component/switch.html) pages list Skyline/WebView support and advise current Nightly debugging.                                                                                                                                                                                                                                  | Use only native controls in Task 5; no renderer support is inferred from the minimum base library.                                                                                          | Verify each control in the tracked Stable DevTools run; if it cannot reproduce, stop the runtime gate and retest with the current Nightly, recording both results rather than claiming support.                                                    |
| WeChat login             | [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) is callback-style and produces a short-lived, single-use code; [login flow](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html) keeps `code2Session` and secrets server-side.                                                                                                                                                                                                                                                                 | Wrap exactly one `wx.login` per single-flight sign-in and pass its code to existing `wechatLogin`; do not call `wx.checkSession` as a bearer-token validator or collect new profile fields. | Unit-test receiver, success/empty/fail, concurrency, and backend rejection; simulator-test one login against the configured existing API.                                                                                                          |
| TDesign 1.16.0           | [Official release](https://github.com/Tencent/tdesign-miniprogram/releases/tag/tdesign-miniprogram%401.16.0), [README](https://github.com/Tencent/tdesign-miniprogram/blob/tdesign-miniprogram%401.16.0/README.md), [Button support](https://github.com/Tencent/tdesign-miniprogram/blob/tdesign-miniprogram%401.16.0/packages/components/button/README.md), and [Calendar support](https://github.com/Tencent/tdesign-miniprogram/blob/tdesign-miniprogram%401.16.0/packages/components/calendar/README.md) show per-component renderer support; Calendar is WebView-only. | Keep installed version `1.16.0`, build npm output, but render no TDesign component in V3-1 and never use `t-calendar`.                                                                      | `build-npm` proves packaging only. A future component must have a version-specific official renderer statement plus Skyline/WebView simulator and device evidence.                                                                                 |

Do not reuse the historical DevTools version recorded for V2. Before Task 3 compile, record the version shown by the currently installed DevTools and the active debug base library; the version must satisfy the stricter `glass-easel` debugging threshold `1.06.2308142+`. A missing version record, an unobserved automatic fallback, hot-reload-only result, or typecheck-only result is not renderer evidence. A forced-WebView run proves compatibility only, never automatic fallback.

## Design Coverage

| V3 design requirement                             | V3-1 coverage                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sections 1–2 authority and clean boundary         | Scope gate, V3-0.5 evidence, no V1/V2 paths, no generated/private state committed.                                            |
| Section 3 mobile adaptation                       | Task 3 custom navigation, native tabBar, fixed local scrolling, and stable shell states.                                      |
| Section 4 native/Skyline/Worklet/TDesign boundary | Official capability gate and Task 3 compile/forced-WebView compatibility matrix; no Worklet or TDesign rendering.             |
| Section 5 app-shell and pure-logic boundaries     | Tasks 3–5 file decomposition and thin page composition.                                                                       |
| Section 6 calendar data/visual model              | Task 5 `CalendarMonthViewModel`, all assignments, names, roles, shifts, holidays, marker action IDs, and phone actions.       |
| Section 6.1 marker semantics                      | Only current contract markers; no `deduction`, no fabricated event ID.                                                        |
| Section 9 navigation/roles/platform               | Task 4 exact Web role matrix plus existing `GET /platform/me`; client filtering does not grant permission.                    |
| Section 10 401/cache/security                     | Task 4 one-shot navigation and session clear; Task 5 cache is only a display state, not persistence.                          |
| Sections 11–12 performance/testing                | Definite local scroll, three-month rendering deferred, TDD, DevTools compile, simulator route smoke, browser/core conditions. |
| Sections 13–15 phase/agent rules                  | Three independent commits, one task per conversation, stop-on-different-failure, and V3-2 prohibition.                        |

Known design-to-contract limitation: the current calendar contract does not contain a marker-specific event ID, marker permission object, or `deduction` marker. Task 5 therefore emits a typed client `actionId` and the existing assignment ID/marker only. V3-2 may query the existing events endpoint by assignment/shift context, but no V3-1 task may change the contract to make the design appear more complete.

### Task 3: Establish The V3 Manifest, Local-Scroll Shell, And Native TabBar

**Files:**

- Create: `scripts/miniprogram-tab-icons.mjs`
- Create: `scripts/miniprogram-app-shell.test.mjs`
- Create: `apps/miniprogram/app.json`
- Create: `apps/miniprogram/app.ts`
- Create: `apps/miniprogram/app.wxss`
- Create: `apps/miniprogram/sitemap.json`
- Create: `apps/miniprogram/tokens/index.wxss`
- Generate: `apps/miniprogram/assets/tab-bar/workbench.png`
- Generate: `apps/miniprogram/assets/tab-bar/workbench-active.png`
- Generate: `apps/miniprogram/assets/tab-bar/calendar.png`
- Generate: `apps/miniprogram/assets/tab-bar/calendar-active.png`
- Generate: `apps/miniprogram/assets/tab-bar/notifications.png`
- Generate: `apps/miniprogram/assets/tab-bar/notifications-active.png`
- Generate: `apps/miniprogram/assets/tab-bar/profile.png`
- Generate: `apps/miniprogram/assets/tab-bar/profile-active.png`
- Create: `apps/miniprogram/components/page-shell/index.json`
- Create: `apps/miniprogram/components/page-shell/index.ts`
- Create: `apps/miniprogram/components/page-shell/index.wxml`
- Create: `apps/miniprogram/components/page-shell/index.wxss`
- Create: `apps/miniprogram/components/shell-state/index.json`
- Create: `apps/miniprogram/components/shell-state/index.ts`
- Create: `apps/miniprogram/components/shell-state/index.wxml`
- Create: `apps/miniprogram/components/shell-state/index.wxss`
- Create: `apps/miniprogram/pages/auth/login/index.{json,ts,wxml,wxss}`
- Create: `apps/miniprogram/pages/workbench/index.{json,ts,wxml,wxss}`
- Create: `apps/miniprogram/pages/calendar/index.{json,ts,wxml,wxss}`
- Create: `apps/miniprogram/pages/notifications/index.{json,ts,wxml,wxss}`
- Create: `apps/miniprogram/pages/profile/index.{json,ts,wxml,wxss}`
- Modify before commit: `docs/project-status.md`
- Modify before commit: `docs/debug/debug-feedback-log.md`

- [ ] **Step 1: Reconfirm the exact V3-0.5 checkpoint and private-state boundary**

Run from `E:\AItools\Schedule`:

```powershell
git status --short --branch
git branch --show-current
git log -5 --oneline --decorate
git remote -v
git rev-parse HEAD
git rev-parse origin/main
git check-ignore -v apps/miniprogram/project.private.config.json
git ls-files --error-unmatch apps/miniprogram/project.private.config.json 2>$null
if ($LASTEXITCODE -eq 0) { throw 'private config must not be tracked' }
if (Test-Path -LiteralPath 'apps/miniprogram/app.json') { throw 'V3 app manifest already exists; regenerate the plan' }
```

Expected: branch/upstream are unchanged unless the user explicitly selected another branch; `HEAD` and `origin/main` are `2c93859`; the worktree has no unowned task-file change; private config is ignored/untracked; `app.json` is absent. If any task path already exists or differs, stop instead of overwriting it.

- [ ] **Step 2: Write the failing manifest, renderer, local-scroll, and icon tests**

Create `scripts/miniprogram-app-shell.test.mjs` with this complete content:

```js
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { listRegisteredPages } from './miniprogram-manifest.mjs';
import { generateTabIcons, tabIconNames } from './miniprogram-tab-icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');
const temporaryDirectories = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(miniprogramRoot, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('V3 app shell', () => {
  it('generates eight deterministic 81px PNG tab icons below the platform size limit', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'schedule-tab-icons-'));
    temporaryDirectories.push(directory);

    const generated = generateTabIcons(directory);

    expect(generated.map((file) => path.basename(file))).toEqual(
      tabIconNames.flatMap((name) => [`${name}.png`, `${name}-active.png`]),
    );
    for (const file of generated) {
      const png = readFileSync(file);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(png.readUInt32BE(16)).toBe(81);
      expect(png.readUInt32BE(20)).toBe(81);
      expect(png.byteLength).toBeLessThan(40 * 1024);
    }
  });

  it('registers only the V3 login shell and four native tab pages in order', () => {
    const appJson = readJson('app.json');
    expect(listRegisteredPages(appJson)).toEqual([
      'pages/auth/login/index',
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/notifications/index',
      'pages/profile/index',
    ]);
    expect(appJson.tabBar?.custom).not.toBe(true);
    expect(appJson.tabBar?.list).toEqual([
      {
        iconPath: 'assets/tab-bar/workbench.png',
        pagePath: 'pages/workbench/index',
        selectedIconPath: 'assets/tab-bar/workbench-active.png',
        text: '工作台',
      },
      {
        iconPath: 'assets/tab-bar/calendar.png',
        pagePath: 'pages/calendar/index',
        selectedIconPath: 'assets/tab-bar/calendar-active.png',
        text: '日历',
      },
      {
        iconPath: 'assets/tab-bar/notifications.png',
        pagePath: 'pages/notifications/index',
        selectedIconPath: 'assets/tab-bar/notifications-active.png',
        text: '通知',
      },
      {
        iconPath: 'assets/tab-bar/profile.png',
        pagePath: 'pages/profile/index',
        selectedIconPath: 'assets/tab-bar/profile-active.png',
        text: '我的',
      },
    ]);
    expect(appJson.lazyCodeLoading).toBe('requiredComponents');
    expect(appJson.rendererOptions).toBeUndefined();
  });

  it('keeps Skyline page-level and leaves every non-calendar page on WebView', () => {
    const routes = listRegisteredPages(readJson('app.json'));
    for (const route of routes) {
      const pageJson = readJson(`${route}.json`);
      expect(pageJson.disableScroll).toBe(true);
      expect(pageJson.navigationStyle).toBe('custom');
      expect(pageJson.usingComponents?.['page-shell']).toBe('/components/page-shell/index');
      expect(pageJson.usingComponents?.['shell-state']).toBe('/components/shell-state/index');
      if (route === 'pages/calendar/index') {
        expect(pageJson.renderer).toBe('skyline');
        expect(pageJson.componentFramework).toBe('glass-easel');
      } else {
        expect(pageJson.renderer).toBeUndefined();
        expect(pageJson.componentFramework).toBeUndefined();
      }
    }
  });

  it('uses one definite-height local scroll container and no page-level scrolling', () => {
    const shellWxml = readText('components/page-shell/index.wxml');
    const shellWxss = readText('components/page-shell/index.wxss');
    expect(shellWxml.match(/<scroll-view\b/gu)).toHaveLength(1);
    expect(shellWxml).toContain('scroll-y="{{true}}"');
    expect(shellWxml).not.toContain('enhanced=');
    expect(shellWxml).not.toContain('show-scrollbar=');
    expect(shellWxss).toMatch(/height:\s*calc\(100vh/gu);
    expect(shellWxss).toMatch(/\.page-shell\s*\{[^}]*display:\s*flex/su);
    expect(shellWxss).toMatch(/flex-direction:\s*column/gu);
    expect(shellWxss).not.toMatch(/constant\(|display:\s*grid|place-items/gu);

    for (const route of listRegisteredPages(readJson('app.json'))) {
      expect(readText(`${route}.wxml`)).toContain('<page-shell');
    }
  });

  it('contains no custom tab bar, V1/V2 route, or speculative renderer option', () => {
    const appJsonText = readText('app.json');
    expect(appJsonText).not.toContain('custom-tab-bar');
    expect(appJsonText).not.toContain('rendererOptions');
    expect(appJsonText).not.toContain('pages/login/login');
    expect(appJsonText).not.toContain('pages/test');
  });
});
```

- [ ] **Step 3: Run the shell test and observe the first planned failure**

Run:

```powershell
pnpm vitest run scripts/miniprogram-app-shell.test.mjs
```

Expected: FAIL before test collection because `scripts/miniprogram-tab-icons.mjs` does not exist. If the first failure is a syntax, import-resolution, or Vitest setup error in the test itself, fix the test and rerun before creating production files.

- [ ] **Step 4: Implement the deterministic tab-icon generator**

Create `scripts/miniprogram-tab-icons.mjs` with this complete content:

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const size = 81;
const inactiveColor = '#6B7280';
const activeColor = '#1F5AA6';
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const tabIconNames = ['workbench', 'calendar', 'notifications', 'profile'];

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function parseColor(value) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    255,
  ];
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const offset = (y * size + x) * 4;
  pixels.set(color, offset);
}

function fillCircle(pixels, centerX, centerY, radius, color) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        setPixel(pixels, x, y, color);
      }
    }
  }
}

function drawLine(pixels, fromX, fromY, toX, toY, width, color) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step += 1) {
    const progress = steps === 0 ? 0 : step / steps;
    fillCircle(
      pixels,
      Math.round(fromX + (toX - fromX) * progress),
      Math.round(fromY + (toY - fromY) * progress),
      Math.floor(width / 2),
      color,
    );
  }
}

function drawRectangle(pixels, left, top, right, bottom, width, color) {
  drawLine(pixels, left, top, right, top, width, color);
  drawLine(pixels, right, top, right, bottom, width, color);
  drawLine(pixels, right, bottom, left, bottom, width, color);
  drawLine(pixels, left, bottom, left, top, width, color);
}

function drawWorkbench(pixels, color) {
  for (const [left, top] of [
    [19, 19],
    [45, 19],
    [19, 45],
    [45, 45],
  ]) {
    drawRectangle(pixels, left, top, left + 16, top + 16, 4, color);
  }
}

function drawCalendar(pixels, color) {
  drawRectangle(pixels, 17, 20, 64, 64, 4, color);
  drawLine(pixels, 17, 32, 64, 32, 4, color);
  drawLine(pixels, 29, 15, 29, 25, 4, color);
  drawLine(pixels, 52, 15, 52, 25, 4, color);
  for (const y of [42, 53]) {
    for (const x of [29, 41, 53]) {
      fillCircle(pixels, x, y, 2, color);
    }
  }
}

function drawNotifications(pixels, color) {
  drawLine(pixels, 24, 55, 57, 55, 4, color);
  drawLine(pixels, 24, 55, 29, 48, 4, color);
  drawLine(pixels, 57, 55, 52, 48, 4, color);
  drawLine(pixels, 29, 48, 29, 36, 4, color);
  drawLine(pixels, 52, 48, 52, 36, 4, color);
  drawLine(pixels, 29, 36, 35, 28, 4, color);
  drawLine(pixels, 52, 36, 46, 28, 4, color);
  drawLine(pixels, 35, 28, 46, 28, 4, color);
  fillCircle(pixels, 40, 62, 3, color);
}

function drawProfile(pixels, color) {
  fillCircle(pixels, 40, 28, 10, color);
  fillCircle(pixels, 40, 28, 5, [0, 0, 0, 0]);
  drawLine(pixels, 20, 62, 24, 49, 4, color);
  drawLine(pixels, 24, 49, 32, 44, 4, color);
  drawLine(pixels, 32, 44, 48, 44, 4, color);
  drawLine(pixels, 48, 44, 56, 49, 4, color);
  drawLine(pixels, 56, 49, 60, 62, 4, color);
  drawLine(pixels, 20, 62, 60, 62, 4, color);
}

const drawIcon = {
  calendar: drawCalendar,
  notifications: drawNotifications,
  profile: drawProfile,
  workbench: drawWorkbench,
};

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row += 1) {
    const targetOffset = row * (size * 4 + 1);
    scanlines[targetOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + row * size * 4, size * 4).copy(
      scanlines,
      targetOffset + 1,
    );
  }

  return Buffer.concat([
    pngSignature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function generateTabIcons(outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  const generated = [];
  for (const name of tabIconNames) {
    for (const active of [false, true]) {
      const pixels = new Uint8Array(size * size * 4);
      drawIcon[name](pixels, parseColor(active ? activeColor : inactiveColor));
      const file = path.join(outputDirectory, `${name}${active ? '-active' : ''}.png`);
      writeFileSync(file, encodePng(pixels));
      generated.push(file);
    }
  }
  return generated;
}

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedUrl === import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = path.join(root, 'apps', 'miniprogram', 'assets', 'tab-bar');
  const generated = generateTabIcons(outputDirectory);
  console.log(`[miniprogram-tab-icons] generated ${generated.length} icons`);
}
```

- [ ] **Step 5: Run the test and observe the second planned failure**

Run:

```powershell
pnpm vitest run scripts/miniprogram-app-shell.test.mjs
```

Expected: the icon-generation test passes, then the suite FAILS with `ENOENT` for `apps/miniprogram/app.json`. If the generator test fails, fix only the generator before creating the manifest.

- [ ] **Step 6: Create the manifest, app entry, sitemap, and V3 tokens**

Create `apps/miniprogram/app.json` with this complete content:

```json
{
  "pages": [
    "pages/auth/login/index",
    "pages/workbench/index",
    "pages/calendar/index",
    "pages/notifications/index",
    "pages/profile/index"
  ],
  "window": {
    "backgroundColor": "#F5F7FA",
    "backgroundTextStyle": "light",
    "navigationStyle": "custom"
  },
  "tabBar": {
    "backgroundColor": "#FFFFFF",
    "borderStyle": "black",
    "color": "#6B7280",
    "selectedColor": "#1F5AA6",
    "list": [
      {
        "iconPath": "assets/tab-bar/workbench.png",
        "pagePath": "pages/workbench/index",
        "selectedIconPath": "assets/tab-bar/workbench-active.png",
        "text": "工作台"
      },
      {
        "iconPath": "assets/tab-bar/calendar.png",
        "pagePath": "pages/calendar/index",
        "selectedIconPath": "assets/tab-bar/calendar-active.png",
        "text": "日历"
      },
      {
        "iconPath": "assets/tab-bar/notifications.png",
        "pagePath": "pages/notifications/index",
        "selectedIconPath": "assets/tab-bar/notifications-active.png",
        "text": "通知"
      },
      {
        "iconPath": "assets/tab-bar/profile.png",
        "pagePath": "pages/profile/index",
        "selectedIconPath": "assets/tab-bar/profile-active.png",
        "text": "我的"
      }
    ]
  },
  "lazyCodeLoading": "requiredComponents",
  "sitemapLocation": "sitemap.json",
  "style": "v2"
}
```

Do not add `rendererOptions`; the current phase has no verified need for any candidate field. Create `apps/miniprogram/app.ts`:

```ts
App({});
```

Create `apps/miniprogram/sitemap.json`:

```json
{
  "desc": "Authenticated V3 shell routes are not indexed.",
  "rules": [{ "action": "disallow", "page": "*" }]
}
```

Create `apps/miniprogram/tokens/index.wxss`:

```css
page {
  --v3-color-background: #f5f7fa;
  --v3-color-border: #e5e7eb;
  --v3-color-border-strong: #dbe3ea;
  --v3-color-danger: #dc2626;
  --v3-color-danger-light: #fef2f2;
  --v3-color-focus: #1f5aa6;
  --v3-color-primary: #1f5aa6;
  --v3-color-primary-border: #bfdbfe;
  --v3-color-primary-light: #eff6ff;
  --v3-color-surface: #ffffff;
  --v3-color-text: #111827;
  --v3-color-text-muted: #6b7280;
  --v3-color-warning: #b45309;
  --v3-color-warning-light: #fef3c7;
  --v3-color-weekend: #e03131;
  --v3-font-size-xs: 22rpx;
  --v3-font-size-sm: 26rpx;
  --v3-font-size-md: 28rpx;
  --v3-font-size-lg: 32rpx;
  --v3-font-size-xl: 36rpx;
  --v3-radius-sm: 8rpx;
  --v3-radius-md: 12rpx;
  --v3-radius-lg: 20rpx;
  --v3-space-xxs: 8rpx;
  --v3-space-xs: 16rpx;
  --v3-space-sm: 24rpx;
  --v3-space-md: 32rpx;
  --v3-space-lg: 48rpx;
  --v3-touch-min: 88rpx;
  --v3-navigation-height: 88rpx;
  --v3-duration-press: 200ms;
  --v3-duration-month: 240ms;
  --v3-duration-sheet: 280ms;
  --v3-easing-standard: ease-out;
}
```

Create `apps/miniprogram/app.wxss`:

```css
@import './tokens/index.wxss';

page {
  display: block;
  box-sizing: border-box;
  min-height: 100%;
  color: var(--v3-color-text);
  background: var(--v3-color-background);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

button,
input,
scroll-view,
text,
view {
  box-sizing: border-box;
}
```

- [ ] **Step 7: Generate the eight native tabBar PNGs**

Run:

```powershell
node scripts/miniprogram-tab-icons.mjs
```

Expected: `[miniprogram-tab-icons] generated 8 icons`. Confirm all eight exact paths from the File Responsibility Map exist. Do not hand-edit the generated binaries.

- [ ] **Step 8: Create the reusable page shell and stable state component**

Create `apps/miniprogram/components/page-shell/index.json`:

```json
{ "component": true }
```

Create `apps/miniprogram/components/page-shell/index.ts`:

```ts
Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    showBack: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '',
    },
  },
  methods: {
    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },
  },
});
```

Create `apps/miniprogram/components/page-shell/index.wxml`:

```xml
<view class="page-shell">
  <view class="page-shell__navigation">
    <view class="page-shell__navigation-row">
      <button
        wx:if="{{showBack}}"
        class="page-shell__back"
        aria-label="返回上一页"
        bindtap="handleBack"
      >
        ‹
      </button>
      <text class="page-shell__title">{{title}}</text>
    </view>
  </view>
  <scroll-view
    class="page-shell__scroll"
    scroll-y="{{true}}"
    enable-back-to-top="{{true}}"
  >
    <view class="page-shell__content"><slot /></view>
  </scroll-view>
</view>
```

Create `apps/miniprogram/components/page-shell/index.wxss`:

```css
@import '../../tokens/index.wxss';

.page-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  color: var(--v3-color-text);
  background: var(--v3-color-background);
  flex-direction: column;
}

.page-shell__navigation {
  display: block;
  padding-top: env(safe-area-inset-top);
  background: var(--v3-color-surface);
  border-bottom: 1rpx solid var(--v3-color-border);
  flex: none;
}

.page-shell__navigation-row {
  position: relative;
  display: flex;
  min-height: var(--v3-navigation-height);
  align-items: center;
  justify-content: center;
  padding: 0 104rpx;
}

.page-shell__back {
  position: absolute;
  left: var(--v3-space-xs);
  display: flex;
  width: var(--v3-touch-min);
  min-width: var(--v3-touch-min);
  height: var(--v3-touch-min);
  min-height: var(--v3-touch-min);
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--v3-color-text);
  background: transparent;
  border: 0;
  font-size: 52rpx;
  line-height: 1;
}

.page-shell__back::after {
  border: 0;
}

.page-shell__title {
  overflow: hidden;
  font-size: var(--v3-font-size-lg);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-shell__scroll {
  width: 100%;
  height: calc(100vh - var(--v3-navigation-height) - env(safe-area-inset-top));
  flex: 1;
}

.page-shell__content {
  display: block;
  min-height: 100%;
  padding: var(--v3-space-md);
  padding-bottom: calc(var(--v3-space-lg) + env(safe-area-inset-bottom));
}
```

Create `apps/miniprogram/components/shell-state/index.json`:

```json
{ "component": true }
```

Create `apps/miniprogram/components/shell-state/index.ts`:

```ts
Component({
  properties: {
    description: {
      type: String,
      value: '',
    },
    kind: {
      type: String,
      value: 'empty',
    },
    title: {
      type: String,
      value: '',
    },
  },
});
```

Create `apps/miniprogram/components/shell-state/index.wxml`:

```xml
<view class="shell-state shell-state--{{kind}}" role="status">
  <view class="shell-state__indicator" aria-hidden="true"></view>
  <text class="shell-state__title">{{title}}</text>
  <text wx:if="{{description}}" class="shell-state__description">{{description}}</text>
  <slot />
</view>
```

Create `apps/miniprogram/components/shell-state/index.wxss`:

```css
@import '../../tokens/index.wxss';

.shell-state {
  display: flex;
  min-height: 360rpx;
  padding: var(--v3-space-lg) var(--v3-space-md);
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--v3-color-border);
  border-radius: var(--v3-radius-lg);
  background: var(--v3-color-surface);
  text-align: center;
  flex-direction: column;
}

.shell-state__indicator {
  width: 20rpx;
  height: 20rpx;
  margin-bottom: var(--v3-space-sm);
  background: var(--v3-color-primary);
  border-radius: 50%;
}

.shell-state--error .shell-state__indicator,
.shell-state--forbidden .shell-state__indicator {
  background: var(--v3-color-danger);
}

.shell-state--conflict .shell-state__indicator {
  background: var(--v3-color-warning);
}

.shell-state__title {
  color: var(--v3-color-text);
  font-size: var(--v3-font-size-lg);
  font-weight: 700;
}

.shell-state__description {
  max-width: 560rpx;
  margin-top: var(--v3-space-xs);
  color: var(--v3-color-text-muted);
  font-size: var(--v3-font-size-md);
  line-height: 1.6;
}
```

- [ ] **Step 9: Create the five V3 shell pages**

For each page, create the exact JSON shown below. Use this shared WebView JSON for `pages/auth/login/index.json`, `pages/workbench/index.json`, `pages/notifications/index.json`, and `pages/profile/index.json`:

```json
{
  "disableScroll": true,
  "navigationStyle": "custom",
  "usingComponents": {
    "page-shell": "/components/page-shell/index",
    "shell-state": "/components/shell-state/index"
  }
}
```

Create `apps/miniprogram/pages/calendar/index.json` with the page-level renderer declarations and no other Skyline option:

```json
{
  "componentFramework": "glass-easel",
  "disableScroll": true,
  "navigationStyle": "custom",
  "renderer": "skyline",
  "usingComponents": {
    "page-shell": "/components/page-shell/index",
    "shell-state": "/components/shell-state/index"
  }
}
```

Create `apps/miniprogram/pages/auth/login/index.ts`:

```ts
Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
});
```

Create `apps/miniprogram/pages/auth/login/index.wxml`:

```xml
<page-shell title="微信登录">
  <shell-state
    kind="loading"
    title="正在准备登录"
    description="登录能力将在会话检查完成后启用。"
  />
</page-shell>
```

Create `apps/miniprogram/pages/auth/login/index.wxss`:

```css
@import '../../../tokens/index.wxss';
```

Create `apps/miniprogram/pages/workbench/index.ts`:

```ts
Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
});
```

Create `apps/miniprogram/pages/workbench/index.wxml`:

```xml
<page-shell title="工作台">
  <shell-state kind="empty" title="暂无可用入口" description="完成身份恢复后显示角色入口。" />
</page-shell>
```

Create `apps/miniprogram/pages/workbench/index.wxss`:

```css
@import '../../tokens/index.wxss';
```

Create `apps/miniprogram/pages/calendar/index.ts`:

```ts
Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
});
```

Create `apps/miniprogram/pages/calendar/index.wxml`:

```xml
<page-shell title="排班日历">
  <shell-state kind="empty" title="暂无排班数据" description="日历数据模型将在纯逻辑检查点接入。" />
</page-shell>
```

Create `apps/miniprogram/pages/calendar/index.wxss`:

```css
@import '../../tokens/index.wxss';
```

Create `apps/miniprogram/pages/notifications/index.ts`:

```ts
Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
});
```

Create `apps/miniprogram/pages/notifications/index.wxml`:

```xml
<page-shell title="通知">
  <shell-state kind="empty" title="暂无通知" description="通知数据将在后续业务流程阶段接入。" />
</page-shell>
```

Create `apps/miniprogram/pages/notifications/index.wxss`:

```css
@import '../../tokens/index.wxss';
```

Create `apps/miniprogram/pages/profile/index.ts`:

```ts
Page({
  data: {
    renderer: 'unknown',
  },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
});
```

Create `apps/miniprogram/pages/profile/index.wxml`:

```xml
<page-shell title="我的">
  <shell-state kind="empty" title="尚未恢复资料" description="登录后显示账号和群组联系方式状态。" />
</page-shell>
```

Create `apps/miniprogram/pages/profile/index.wxss`:

```css
@import '../../tokens/index.wxss';
```

The shell copy is a valid loading/empty state, not permission or backend behavior. Task 3 must not import `sessionStore`, call an endpoint, or add an auth decision.

- [ ] **Step 10: Run focused tests and static validation**

Run:

```powershell
pnpm vitest run scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/app.json apps/miniprogram/sitemap.json apps/miniprogram/app.ts apps/miniprogram/components/page-shell/index.json apps/miniprogram/components/page-shell/index.ts apps/miniprogram/components/shell-state/index.json apps/miniprogram/components/shell-state/index.ts apps/miniprogram/pages/auth/login/index.json apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/workbench/index.json apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/calendar/index.json apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/notifications/index.json apps/miniprogram/pages/notifications/index.ts apps/miniprogram/pages/profile/index.json apps/miniprogram/pages/profile/index.ts scripts/miniprogram-tab-icons.mjs scripts/miniprogram-app-shell.test.mjs
git diff --check
```

Expected:

- Vitest reports `2` files and `8` tests passed.
- Config audit, mini-program typecheck, lint, Prettier, and `git diff --check` exit `0`.
- No test or command reads `project.private.config.json` as a team baseline.

- [ ] **Step 11: Back up but do not edit the ignored private DevTools state**

Run these exact PowerShell commands:

```powershell
$source = 'E:\AItools\Schedule\apps\miniprogram\project.private.config.json'
$backupDirectory = 'E:\AItools\Schedule\.tmp-miniprogram-preview\v3-1-private-config'
if (Test-Path -LiteralPath $source) {
  New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
  Copy-Item -LiteralPath $source -Destination (Join-Path $backupDirectory 'project.private.config.before-task-3.json') -Force
}
git check-ignore -v apps/miniprogram/project.private.config.json
git status --short
```

Expected: an ignored backup exists under `.tmp-miniprogram-preview` if the private file existed; neither source nor backup is tracked or staged. Do not delete, rewrite, or normalize the user’s private configuration from the shell. Open DevTools and let its current UI manage local renderer/debug switches.

- [ ] **Step 12: Record the current tool versions and perform a full DevTools build**

In the current WeChat DevTools UI, record in `docs/debug/debug-feedback-log.md`:

Record four literal lines: the version shown by the current About dialog, which must be `>= 1.06.2308142` or stop; the actually selected debug base library, which must equal the tracked `3.16.2` or stop; `Skyline debug switch: enabled for the calendar verification run`; and the exact current UI label plus state for the Worklet/ES5 compilation option. The official simulator minimum is 3.0.0, while 3.16.2 is this repository’s stricter tracked baseline. Do not continue with a missing, guessed, mismatched, or below-threshold value. Then run:

```powershell
pnpm miniprogram:devtools:build-npm
pnpm miniprogram:devtools:preview
```

Expected: both commands exit `0`; npm output is generated under ignored `apps/miniprogram/miniprogram_npm`; `.tmp-miniprogram-preview/preview.png` is created; no compiler warning reports an unsupported `renderer`, `componentFramework`, WXML directive, component, or WXSS rule. Use a full compile because current Skyline tooling does not support hot reload as acceptance evidence. A warning-free compile is necessary but insufficient: Step 13 must visually prove vertical shell layout, centered back control, and local scrolling.

- [ ] **Step 13: Run simulator smoke and the renderer/local-scroll matrix**

With DevTools open, trusted, and its service port enabled, run:

```powershell
pnpm miniprogram:smoke
```

Expected: five routes open successfully, the four tab pages use `switchTab`, the login page uses `reLaunch`, screenshots are created, and the summary reports no script-level error.

Then perform and record these exact simulator checks:

1. Open each tab by touch and separately call `wx.switchTab` with `/pages/workbench/index`, `/pages/calendar/index`, `/pages/notifications/index`, and `/pages/profile/index`; selected icon/text and route must match, and no URL uses a query. From the Task 3 login route, switch to a tab and verify `getCurrentPages()` retains only that target tab page; Task 4 repeats this for its two new non-tab routes.
2. On every page, scroll enough content to prove only the inner `scroll-view` changes; custom navigation and native tabBar remain fixed.
3. On `pages/calendar/index`, confirm the simulator renderer indicator and page instance report `skyline` under the Skyline run; record the vConsole route log’s actual component framework as `glass-easel`.
4. Create a development/preview build and record the phone platform, WeChat client version, base-library version, and device renderer/framework observations. Use the official device menu path `小程序菜单 → 开发调试 → Switch Render → Skyline`, then `... → WebView`, and prove the same shell, local scroll, and navigation remain usable in each forced mode. The forced-WebView result proves compatibility only; it does not prove automatic fallback. Finally restore `小程序菜单 → 开发调试 → Switch Render → Auto`, record that restoration, and record `automatic fallback: unverified` unless a genuinely unsupported Skyline client/base library was observed. DevTools has a Skyline debug toggle/renderer indicator, but it is not the official device `Switch Render` control.
5. Confirm non-calendar pages report WebView and no page imports a TDesign component.

If DevTools falls back silently, compilation is blocked, the service port is unavailable, or the smoke runner cannot attach, set status to `已实现待开发者工具/模拟器复核`, record the exact external blocker, do not claim Task 3 complete, and do not create the Task 3 commit.

- [ ] **Step 14: Run mandatory Web/core smoke for the manifest and routing checkpoint**

Run:

```powershell
pnpm smoke:browser
```

Expected: exit `0` with the existing Web authentication, administrator, member, guest, and workbench scenarios passing. Although Task 3 does not edit Web code, it establishes the mini-program app/router/build entry and this project’s V3 design treats that as a core-chain checkpoint.

Append the exact record `运行/浏览器验证：pnpm smoke:browser 通过。` to `docs/debug/debug-feedback-log.md`, then run:

```powershell
pnpm smoke:check-core
```

Expected: exit `0` and confirm the required browser-smoke record exists.

- [ ] **Step 15: Perform the Task 3 semantic and behavior audit**

Review every changed line and record this exact checklist with real pass/fail evidence:

```text
1. Receiver binding: wx.navigateBack remains a member call; Page onLoad calls this.setData and reads this.renderer through the page receiver.
2. Promise/error paths: Task 3 adds no Promise, endpoint, auth callback, or swallowed error.
3. Nullish semantics: no service object or optional identity field is interpreted in the shell.
4. Type narrowing: renderer is read from the typed Page instance; no cast weakens API or contract types.
5. Side effects/call counts: icon generation writes exactly eight declared files; each route appears once; each page owns one vertical scroll-view through page-shell.
6. Rendering scope: only calendar declares Skyline/glass-easel; other pages omit renderer fields; no rendererOptions field is added.
7. Navigation scope: native tabBar has four registered pages, custom is not enabled, and switchTab never needs query state.
8. Private/generated state: project.private.config.json, keys, miniprogram_npm, screenshots, preview output, and private backup remain untracked.
9. V1/V2 boundary: no old route, component, custom tab bar, manifest fragment, or stashed UI is restored or referenced.
10. Capability claims: Worklet and TDesign runtime remain N/A; Skyline claim is limited to the recorded calendar shell run, forced-WebView compatibility result, and separately recorded automatic-fallback evidence or unverified status.
```

Run:

```powershell
git diff -- apps/miniprogram scripts/miniprogram-tab-icons.mjs scripts/miniprogram-app-shell.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git status --short
git check-ignore -q apps/miniprogram/miniprogram_npm
if ($LASTEXITCODE -ne 0) { throw 'miniprogram_npm must remain ignored' }
git check-ignore -q .tmp-miniprogram-preview
if ($LASTEXITCODE -ne 0) { throw 'preview output must remain ignored' }
```

Expected: only Task 3 source/tests/docs are tracked changes; generated runtime output is ignored. Any unrelated change must be separated or left untouched.

- [ ] **Step 16: Update checkpoint documentation, validate, commit, and push Task 3**

Update `docs/project-status.md` with:

- Task 3 outcome and the exact focused/static/DevTools/simulator/browser/core results.
- Current DevTools version, debug library, calendar Skyline result, forced-WebView compatibility result, automatic-fallback evidence or explicit unverified state, device renderer/framework observations, and any private-config external state without committing the private file.
- Status `已完成` only if full compile and simulator matrix passed; otherwise `已实现待开发者工具/模拟器复核` and no commit.
- Exact next active batch: user/new conversation executes only Task 4; stop after its authentication checkpoint.
- Planned commit `feat(miniprogram): add V3 app shell and native navigation` until the hash is known.

Append the Task 3 behavior audit and runtime evidence to `docs/debug/debug-feedback-log.md`. Then run:

```powershell
pnpm vitest run scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm smoke:check-core
pnpm exec prettier --check apps/miniprogram/app.json apps/miniprogram/sitemap.json apps/miniprogram/app.ts apps/miniprogram/components/page-shell/index.json apps/miniprogram/components/page-shell/index.ts apps/miniprogram/components/shell-state/index.json apps/miniprogram/components/shell-state/index.ts apps/miniprogram/pages/auth/login/index.json apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/workbench/index.json apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/calendar/index.json apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/notifications/index.json apps/miniprogram/pages/notifications/index.ts apps/miniprogram/pages/profile/index.json apps/miniprogram/pages/profile/index.ts scripts/miniprogram-tab-icons.mjs scripts/miniprogram-app-shell.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git diff --check
```

Expected: all commands exit `0`; focused Vitest remains `2` files / `8` tests. Review and stage only exact Task 3 paths:

```powershell
git diff
git add scripts/miniprogram-tab-icons.mjs scripts/miniprogram-app-shell.test.mjs apps/miniprogram/app.json apps/miniprogram/app.ts apps/miniprogram/app.wxss apps/miniprogram/sitemap.json apps/miniprogram/tokens/index.wxss apps/miniprogram/assets/tab-bar/workbench.png apps/miniprogram/assets/tab-bar/workbench-active.png apps/miniprogram/assets/tab-bar/calendar.png apps/miniprogram/assets/tab-bar/calendar-active.png apps/miniprogram/assets/tab-bar/notifications.png apps/miniprogram/assets/tab-bar/notifications-active.png apps/miniprogram/assets/tab-bar/profile.png apps/miniprogram/assets/tab-bar/profile-active.png apps/miniprogram/components/page-shell/index.json apps/miniprogram/components/page-shell/index.ts apps/miniprogram/components/page-shell/index.wxml apps/miniprogram/components/page-shell/index.wxss apps/miniprogram/components/shell-state/index.json apps/miniprogram/components/shell-state/index.ts apps/miniprogram/components/shell-state/index.wxml apps/miniprogram/components/shell-state/index.wxss apps/miniprogram/pages/auth/login/index.json apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/auth/login/index.wxml apps/miniprogram/pages/auth/login/index.wxss apps/miniprogram/pages/workbench/index.json apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/workbench/index.wxml apps/miniprogram/pages/workbench/index.wxss apps/miniprogram/pages/calendar/index.json apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/calendar/index.wxml apps/miniprogram/pages/calendar/index.wxss apps/miniprogram/pages/notifications/index.json apps/miniprogram/pages/notifications/index.ts apps/miniprogram/pages/notifications/index.wxml apps/miniprogram/pages/notifications/index.wxss apps/miniprogram/pages/profile/index.json apps/miniprogram/pages/profile/index.ts apps/miniprogram/pages/profile/index.wxml apps/miniprogram/pages/profile/index.wxss docs/project-status.md docs/debug/debug-feedback-log.md
git diff --cached --check
git diff --cached
git commit -m "feat(miniprogram): add V3 app shell and native navigation"
git push
```

Expected: the staged diff contains only Task 3 files and checkpoint docs; commit succeeds; push is a normal fast-forward to the configured upstream. If push fails, keep the local commit unchanged, record the exact failure in the next checkpoint, and never force-push.

**Task 3 stop condition:** stop immediately after the checkpoint/push attempt. Do not start session logic, profile completion, invite consumption, role entries, or calendar VM work in the same conversation.

### Task 4: Restore Sessions, Sign In With WeChat, Complete Profiles, And Expose Role Entries

**Task boundary:** Execute Task 4 only after Task 3 has its own successful checkpoint and the recorded DevTools/simulator shell gate is complete. This task may compose the existing API functions, but it must not add or modify an API route, request field, response field, permission, backend rule, contract schema, or profile-edit flow. In particular, do not call or modify the currently incomplete `updateProfile(realName)` helper; V3-1 creates a missing profile only through the existing `POST /users` contract.

- [ ] **Step 1: Reconfirm the Task 3 checkpoint and inspect auth introduction history**

Run before editing:

```powershell
git status --short --branch
git branch --show-current
git log -8 --oneline --decorate
git rev-list --left-right --count 'HEAD...@{upstream}'
git log -S 'setUnauthorizedHandler' -- apps/miniprogram/api/client.ts
git blame -L 1,180 -- apps/miniprogram/api/client.ts
git log -S 'pendingInviteStorageKey' -- apps/miniprogram/store/session.ts
git blame -L 1,180 -- apps/miniprogram/store/session.ts
```

Expected: the worktree is clean; Task 3 is the current pushed checkpoint; `app.json` contains the five Task 3 routes; the existing client’s protected-401 behavior and pending-invite storage are attributed to their actual introducing commits. Record those hashes in `docs/debug/debug-feedback-log.md`. If Task 3 is absent, uncommitted, unpushed for a non-network reason, or lacks its runtime gate, stop without implementing Task 4.

- [ ] **Step 2: Write the auth-flow tests before production logic**

Create `apps/miniprogram/features/auth/auth-flow.test.ts`. The complete test file must use injected ports rather than a global `wx` mock and cover these exact cases:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  createUnauthorizedNavigator,
  getSessionLandingTarget,
  readInviteToken,
  requestWechatLoginCode,
  type ReLaunchPort,
  type WechatLoginPort,
} from './auth-flow.js';

type LoginOptions = Parameters<WechatLoginPort['login']>[0];
type ReLaunchOptions = Parameters<ReLaunchPort['reLaunch']>[0];

describe('requestWechatLoginCode', () => {
  it('calls the injected member exactly once and resolves its non-empty code', async () => {
    const port = {
      calls: 0,
      login({ success }: LoginOptions) {
        this.calls += 1;
        success({ code: 'wx-code' });
      },
    };

    await expect(requestWechatLoginCode(port)).resolves.toBe('wx-code');
    expect(port.calls).toBe(1);
  });

  it('rejects an empty code and a platform failure without retrying', async () => {
    const emptyLogin = vi.fn(({ success }: LoginOptions) => success({ code: '' }));
    const failedLogin = vi.fn(({ fail }: LoginOptions) => fail({ errMsg: 'login:fail denied' }));

    await expect(requestWechatLoginCode({ login: emptyLogin })).rejects.toMatchObject({
      name: 'WechatLoginError',
    });
    await expect(requestWechatLoginCode({ login: failedLogin })).rejects.toMatchObject({
      name: 'WechatLoginError',
    });
    expect(emptyLogin).toHaveBeenCalledTimes(1);
    expect(failedLogin).toHaveBeenCalledTimes(1);
  });
});

describe('auth landing', () => {
  it.each([
    ['anonymous', false, { kind: 'reLaunch', url: '/pages/auth/login/index' }],
    ['needs-profile', false, { kind: 'reLaunch', url: '/pages/auth/profile-setup/index' }],
    ['authenticated', true, { kind: 'reLaunch', url: '/pages/invite/invite' }],
    ['authenticated', false, { kind: 'switchTab', url: '/pages/workbench/index' }],
    ['loading', false, { kind: 'none' }],
    ['error', false, { kind: 'none' }],
  ] as const)('maps %s and pending=%s', (status, hasPendingInvite, expected) => {
    expect(getSessionLandingTarget(status, hasPendingInvite)).toEqual(expected);
  });

  it('accepts only a non-empty t query value', () => {
    expect(readInviteToken({ t: 'invite-token' })).toBe('invite-token');
    expect(readInviteToken({ t: '' })).toBeUndefined();
    expect(readInviteToken({})).toBeUndefined();
  });
});

describe('unauthorized navigation', () => {
  it('coalesces repeated protected 401 callbacks into one reLaunch', () => {
    const port = {
      calls: [] as ReLaunchOptions[],
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch(options: ReLaunchOptions) {
        this.calls.push(options);
      },
    };
    const navigator = createUnauthorizedNavigator(port);

    navigator.redirectToLogin();
    navigator.redirectToLogin();

    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]).toEqual(expect.objectContaining({ url: '/pages/auth/login/index' }));
  });

  it('does not redirect from login and unlocks after a failed navigation or reset', () => {
    const reLaunch = vi.fn(({ fail }: ReLaunchOptions) => fail?.());
    const navigator = createUnauthorizedNavigator({
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch,
    });
    navigator.redirectToLogin();
    navigator.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(2);

    const onLogin = createUnauthorizedNavigator({
      getCurrentRoute: () => 'pages/auth/login/index',
      reLaunch,
    });
    onLogin.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(2);

    navigator.reset();
    navigator.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(3);
  });

  it('unlocks and rethrows a synchronous reLaunch failure to its caller boundary', () => {
    const port = {
      calls: 0,
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch(_options: ReLaunchOptions) {
        this.calls += 1;
        if (this.calls === 1) throw new Error('sync navigation failure');
      },
    };
    const navigator = createUnauthorizedNavigator(port);
    expect(() => navigator.redirectToLogin()).toThrow('sync navigation failure');
    navigator.redirectToLogin();
    expect(port.calls).toBe(2);
  });
});
```

The injected `login` function in this test is deliberately invoked as `port.login(...)` by production code. Do not destructure it into a bare function; the real `wx.login` receiver/call-count semantics must remain explicit.

- [ ] **Step 3: Run the auth-flow test and observe the planned failure**

Run:

```powershell
pnpm vitest run apps/miniprogram/features/auth/auth-flow.test.ts
```

Expected: FAIL because `apps/miniprogram/features/auth/auth-flow.ts` does not exist. A collection/configuration error unrelated to the missing production module is not the expected red state and must be corrected before implementation.

- [ ] **Step 4: Implement callback wrapping, invite parsing, landing decisions, and one-shot 401 navigation**

Create `apps/miniprogram/features/auth/auth-flow.ts` with this complete content:

```ts
export const loginRoute = '/pages/auth/login/index';
export const profileSetupRoute = '/pages/auth/profile-setup/index';
export const inviteRoute = '/pages/invite/invite';
export const workbenchRoute = '/pages/workbench/index';

export type AuthLandingStatus =
  'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export type SessionLandingTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'reLaunch'; readonly url: string }
  | { readonly kind: 'switchTab'; readonly url: string };

export interface WechatLoginPort {
  login(options: {
    readonly fail: (error: { readonly errMsg: string }) => void;
    readonly success: (result: { readonly code: string }) => void;
  }): void;
}

export class WechatLoginError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WechatLoginError';
  }
}

export function requestWechatLoginCode(port: WechatLoginPort): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    port.login({
      fail: () => reject(new WechatLoginError('微信登录失败，请重试。')),
      success: (result) => {
        if (result.code.length === 0) {
          reject(new WechatLoginError('微信未返回登录凭证，请重试。'));
          return;
        }
        resolve(result.code);
      },
    });
  });
}

export function readInviteToken(
  query: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const token = query.t;
  return token === undefined || token.length === 0 ? undefined : token;
}

export function getSessionLandingTarget(
  status: AuthLandingStatus,
  hasPendingInvite: boolean,
): SessionLandingTarget {
  if (status === 'anonymous') {
    return { kind: 'reLaunch', url: loginRoute };
  }
  if (status === 'needs-profile') {
    return { kind: 'reLaunch', url: profileSetupRoute };
  }
  if (status === 'authenticated') {
    return hasPendingInvite
      ? { kind: 'reLaunch', url: inviteRoute }
      : { kind: 'switchTab', url: workbenchRoute };
  }
  return { kind: 'none' };
}

export interface ReLaunchPort {
  getCurrentRoute(): string | undefined;
  reLaunch(options: {
    readonly fail?: () => void;
    readonly success?: () => void;
    readonly url: string;
  }): void;
}

export interface UnauthorizedNavigator {
  readonly redirectToLogin: () => void;
  readonly reset: () => void;
}

export function createUnauthorizedNavigator(port: ReLaunchPort): UnauthorizedNavigator {
  let redirecting = false;

  return {
    redirectToLogin: () => {
      if (redirecting || port.getCurrentRoute() === loginRoute.slice(1)) {
        return;
      }
      redirecting = true;
      try {
        port.reLaunch({
          fail: () => {
            redirecting = false;
          },
          url: loginRoute,
        });
      } catch (error) {
        redirecting = false;
        throw error;
      }
    },
    reset: () => {
      redirecting = false;
    },
  };
}
```

Run the focused test again. Expected: `1` file and `12` tests pass (`it.each` contributes six landing cases). The closure-based arrow functions are intentional: the runtime may safely call `unauthorizedNavigator.redirectToLogin()` after its memory-state transition because the navigator method does not depend on `this`; `port.login` and `port.reLaunch` remain member calls. A synchronous `reLaunch` throw resets the latch before propagating to the existing caller/client error boundary.

- [ ] **Step 5: Write session-store state-machine tests before replacing the current store**

Create `apps/miniprogram/store/session.test.ts`. Use a `createDependencies()` factory whose `vi.fn` defaults return a complete `UserProfile`, `GroupSummary[]`, `{ isPlatformAdmin: false }`, and `WechatLoginResponse`. Add these exact tests and assertions:

```ts
it('restores no-token state without making a request', async () => {
  const dependencies = createDependencies({ readStoredToken: () => undefined });
  const store = createSessionStore(dependencies);
  await store.restore();
  expect(store.state.status).toBe('anonymous');
  expect(dependencies.getCurrentProfile).not.toHaveBeenCalled();
});

it('coalesces duplicate restore calls and loads profile, groups, and platform status once', async () => {
  const profileDeferred = createDeferred<UserProfile>();
  const dependencies = createDependencies({
    getCurrentProfile: vi.fn(() => profileDeferred.promise),
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  const first = store.restore();
  const second = store.restore();
  expect(first).toBe(second);
  profileDeferred.resolve(profile);
  await first;
  expect(dependencies.getCurrentProfile).toHaveBeenCalledTimes(1);
  expect(dependencies.listGroups).toHaveBeenCalledTimes(1);
  expect(dependencies.getPlatformMe).toHaveBeenCalledTimes(1);
  expect(store.state).toMatchObject({ status: 'authenticated', token: 'stored-token' });
});

it('treats profile NOT_FOUND as needs-profile and protected 401 as anonymous', async () => {
  const missing = createDependencies({
    getCurrentProfile: vi.fn(() =>
      Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
    ),
    readStoredToken: () => 'stored-token',
  });
  const missingStore = createSessionStore(missing);
  await missingStore.restore();
  expect(missingStore.state).toMatchObject({ status: 'needs-profile', token: 'stored-token' });
  expect(missing.writeStoredToken).not.toHaveBeenCalled();

  const expired = createDependencies({
    getCurrentProfile: vi.fn(() =>
      Promise.reject(
        new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
      ),
    ),
    readStoredToken: () => 'stored-token',
  });
  const expiredStore = createSessionStore(expired);
  await expiredStore.restore();
  expect(expiredStore.state.status).toBe('anonymous');
  expect(expired.writeStoredToken).not.toHaveBeenCalled();
});

it('uses profile presence rather than isNewUser and single-flights repeated sign-in', async () => {
  const loginDeferred = createDeferred<WechatLoginResponse>();
  const dependencies = createDependencies({
    requestLoginCode: vi.fn(() => Promise.resolve('wx-code')),
    wechatLogin: vi.fn(() => loginDeferred.promise),
  });
  const store = createSessionStore(dependencies);
  const first = store.signInWithWechat();
  const second = store.signInWithWechat();
  expect(first).toBe(second);
  loginDeferred.resolve({ isNewUser: false, token: 'new-token' });
  await first;
  expect(dependencies.requestLoginCode).toHaveBeenCalledTimes(1);
  expect(dependencies.wechatLogin).toHaveBeenCalledTimes(1);
  expect(dependencies.wechatLogin).toHaveBeenCalledWith('wx-code');
  expect(dependencies.writeStoredToken).toHaveBeenCalledWith('new-token');
  expect(store.state.status).toBe('needs-profile');
});

it('authenticates when a profile exists even if isNewUser is true', async () => {
  const dependencies = createDependencies({
    wechatLogin: vi.fn(() =>
      Promise.resolve({ isNewUser: true, profile, token: 'existing-profile-token' }),
    ),
  });
  const store = createSessionStore(dependencies);
  await store.signInWithWechat();
  expect(store.state).toMatchObject({ profile, status: 'authenticated' });
  expect(dependencies.listGroups).toHaveBeenCalledTimes(1);
});

it('trims and creates a missing profile once, then loads role context', async () => {
  const profileDeferred = createDeferred<UserProfile>();
  const dependencies = createDependencies({
    createUserProfile: vi.fn(() => profileDeferred.promise),
    getCurrentProfile: vi.fn(() =>
      Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
    ),
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  const first = store.completeProfile('  张医生  ');
  const second = store.completeProfile('  张医生  ');
  expect(first).toBe(second);
  profileDeferred.resolve(profile);
  await expect(first).resolves.toBeUndefined();
  expect(dependencies.createUserProfile).toHaveBeenCalledWith('张医生');
  expect(dependencies.createUserProfile).toHaveBeenCalledTimes(1);
  expect(store.state.status).toBe('authenticated');
});

it('does not POST a second profile when role-context loading failed after creation', async () => {
  const listGroups = vi
    .fn<SessionDependencies['listGroups']>()
    .mockRejectedValueOnce(new Error('groups unavailable'))
    .mockResolvedValueOnce([group]);
  const dependencies = createDependencies({
    getCurrentProfile: vi.fn(() =>
      Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
    ),
    listGroups,
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  await expect(store.completeProfile('张医生')).rejects.toThrow('groups unavailable');
  expect(store.state).toMatchObject({ profile, status: 'error', token: 'stored-token' });
  await expect(store.completeProfile('张医生')).resolves.toBeUndefined();
  expect(dependencies.createUserProfile).toHaveBeenCalledTimes(1);
  expect(store.state.status).toBe('authenticated');
});

it('marks protected unauthorized state in memory without deleting storage a second time', async () => {
  const dependencies = createDependencies({ readStoredToken: () => 'stored-token' });
  const store = createSessionStore(dependencies);
  await store.restore();
  store.markUnauthorized();
  expect(store.state.status).toBe('anonymous');
  expect(dependencies.writeStoredToken).not.toHaveBeenCalled();
});

it('does not resurrect a late sign-in after an unauthorized transition', async () => {
  const loginDeferred = createDeferred<WechatLoginResponse>();
  const dependencies = createDependencies({
    requestLoginCode: vi.fn(() => Promise.resolve('wx-code')),
    wechatLogin: vi.fn(() => loginDeferred.promise),
  });
  const store = createSessionStore(dependencies);
  const pending = store.signInWithWechat();
  await vi.waitFor(() => expect(dependencies.wechatLogin).toHaveBeenCalledTimes(1));
  store.markUnauthorized();
  loginDeferred.resolve({ isNewUser: false, profile, token: 'late-token' });
  await pending;
  expect(store.state.status).toBe('anonymous');
  expect(dependencies.writeStoredToken).not.toHaveBeenCalled();
});

it('lets a new sign-in supersede a deferred stored-token restore', async () => {
  const restoreDeferred = createDeferred<UserProfile>();
  const dependencies = createDependencies({
    getCurrentProfile: vi.fn(() => restoreDeferred.promise),
    readStoredToken: () => 'stored-token',
    wechatLogin: vi.fn(() => Promise.resolve({ isNewUser: false, profile, token: 'new-token' })),
  });
  const store = createSessionStore(dependencies);
  const restoring = store.restore();
  await vi.waitFor(() => expect(dependencies.getCurrentProfile).toHaveBeenCalledTimes(1));
  await store.signInWithWechat();
  restoreDeferred.resolve(profile);
  await restoring;
  expect(store.state).toMatchObject({ profile, status: 'authenticated', token: 'new-token' });
  expect(dependencies.writeStoredToken).toHaveBeenCalledTimes(1);
  expect(dependencies.writeStoredToken).toHaveBeenCalledWith('new-token');
});

it('does not publish late profile context after clear invalidates the operation', async () => {
  const groupsDeferred = createDeferred<GroupSummary[]>();
  const dependencies = createDependencies({
    getCurrentProfile: vi.fn(() =>
      Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
    ),
    listGroups: vi.fn(() => groupsDeferred.promise),
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  const pending = store.completeProfile('张医生');
  await vi.waitFor(() => expect(dependencies.listGroups).toHaveBeenCalledTimes(1));
  store.clear();
  groupsDeferred.resolve([group]);
  await pending;
  expect(store.state).toMatchObject({ status: 'anonymous' });
  expect(store.state).not.toHaveProperty('profile');
  expect(dependencies.writeStoredToken).toHaveBeenCalledTimes(1);
  expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
});

it('persists an invite token override before clearing pending state and never clears on failure', async () => {
  const calls: string[] = [];
  const dependencies = createDependencies({
    acceptInvite: vi.fn(async () => {
      calls.push('accept');
      return { group, token: 'merged-token' };
    }),
    readPendingInviteToken: () => 'invite-token',
    readStoredToken: () => 'stored-token',
    writePendingInviteToken: vi.fn((token) => calls.push(`pending:${String(token)}`)),
    writeStoredToken: vi.fn((token) => calls.push(`session:${String(token)}`)),
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  await store.consumePendingInvite();
  expect(dependencies.acceptInvite).toHaveBeenCalledWith('invite-token', profile.realName);
  expect(calls).toEqual(['accept', 'session:merged-token', 'pending:undefined']);
  expect(store.state.token).toBe('merged-token');

  const rejected = createDependencies({
    acceptInvite: vi.fn(() => Promise.reject(new Error('invite rejected'))),
    readPendingInviteToken: () => 'invite-token',
    readStoredToken: () => 'stored-token',
  });
  const rejectedStore = createSessionStore(rejected);
  await rejectedStore.restore();
  await expect(rejectedStore.consumePendingInvite()).rejects.toThrow('invite rejected');
  expect(rejected.writePendingInviteToken).not.toHaveBeenCalled();
});

it('single-flights duplicate pending-invite consumption', async () => {
  const acceptDeferred = createDeferred<AcceptInviteResponse>();
  const dependencies = createDependencies({
    acceptInvite: vi.fn(() => acceptDeferred.promise),
    readPendingInviteToken: () => 'invite-token',
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  const first = store.consumePendingInvite();
  const second = store.consumePendingInvite();
  expect(first).toBe(second);
  acceptDeferred.resolve({ group });
  await first;
  expect(dependencies.acceptInvite).toHaveBeenCalledTimes(1);
});

it('changes active group only to an existing group and logout preserves the pending invite', async () => {
  const dependencies = createDependencies({
    readPendingInviteToken: () => 'invite-token',
    readStoredToken: () => 'stored-token',
  });
  const store = createSessionStore(dependencies);
  await store.restore();
  expect(store.setActiveGroupId(group.id)).toBe(true);
  expect(store.setActiveGroupId(group.id)).toBe(true);
  expect(store.setActiveGroupId('unknown')).toBe(false);
  store.clear();
  expect(store.state.status).toBe('anonymous');
  expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
  expect(dependencies.writePendingInviteToken).not.toHaveBeenCalled();
});

it('writes the same pending invite token only once across App and invite onLoad capture', () => {
  let pendingToken: string | undefined;
  const dependencies = createDependencies({
    readPendingInviteToken: () => pendingToken,
    writePendingInviteToken: vi.fn((token) => {
      pendingToken = token;
    }),
  });
  const store = createSessionStore(dependencies);
  store.setPendingInviteToken('invite-token');
  store.setPendingInviteToken('invite-token');
  expect(dependencies.writePendingInviteToken).toHaveBeenCalledTimes(1);
});
```

At the top of the test file, import `ApiClientError`, contract types, and `createSessionStore`; define literal fixtures that satisfy the current contracts; define `createDeferred<T>()` with one Promise, resolve, and reject; and make every dependency a `vi.fn`. Do not loosen a fixture with `as any`. The factory override type is `Partial<SessionDependencies>` so every production dependency remains visible to TypeScript.

- [ ] **Step 6: Run session tests and observe the planned red state**

Run:

```powershell
pnpm vitest run apps/miniprogram/store/session.test.ts
```

Expected: FAIL because the existing `SessionStore` exports neither `createSessionStore` nor the required state-machine methods. Preserve the existing client token key and pending-invite key in the implementation; changing storage identity is outside scope.

- [ ] **Step 7: Replace the session store with an injectable, single-flight state machine**

Replace `apps/miniprogram/store/session.ts` completely. The implementation must export these exact types and methods:

```ts
import type {
  AcceptInviteResponse,
  GroupSummary,
  UserProfile,
  WechatLoginResponse,
} from '@schedule/contracts';

import { ApiClientError, getStoredToken, storeToken } from '../api/client.js';
import {
  acceptInvite,
  createUserProfile,
  getCurrentProfile,
  getPlatformMe,
  listGroups,
  wechatLogin,
} from '../api/endpoints.js';
import { requestWechatLoginCode } from '../features/auth/auth-flow.js';

const pendingInviteStorageKey = 'schedule.pendingInviteToken';

export type SessionStatus = 'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export interface SessionState {
  readonly activeGroupId?: string;
  readonly errorMessage?: string;
  readonly groups: readonly GroupSummary[];
  readonly isPlatformAdmin: boolean;
  readonly profile?: UserProfile;
  readonly status: SessionStatus;
  readonly token?: string;
}

export interface SessionDependencies {
  readonly acceptInvite: (token: string, confirmRealName: string) => Promise<AcceptInviteResponse>;
  readonly createUserProfile: (realName: string) => Promise<UserProfile>;
  readonly getCurrentProfile: () => Promise<UserProfile>;
  readonly getPlatformMe: () => Promise<{ readonly isPlatformAdmin: boolean }>;
  readonly listGroups: () => Promise<GroupSummary[]>;
  readonly readPendingInviteToken: () => string | undefined;
  readonly readStoredToken: () => string | undefined;
  readonly requestLoginCode: () => Promise<string>;
  readonly wechatLogin: (code: string) => Promise<WechatLoginResponse>;
  readonly writePendingInviteToken: (token: string | undefined) => void;
  readonly writeStoredToken: (token: string | undefined) => void;
}

export interface SessionStore {
  readonly state: SessionState;
  clear(): void;
  completeProfile(realName: string): Promise<void>;
  consumePendingInvite(): Promise<void>;
  getPendingInviteToken(): string | undefined;
  markUnauthorized(): void;
  restore(): Promise<void>;
  setActiveGroupId(groupId: string): boolean;
  setPendingInviteToken(token: string | undefined): void;
  signInWithWechat(): Promise<void>;
}
```

Implement `createSessionStore(dependencies: SessionDependencies): SessionStore` with one immutable `state` object, one numeric `generation`, and four independent `Promise<void> | undefined` slots named `restorePromise`, `signInPromise`, `profilePromise`, and `invitePromise`. Each public async method must capture an operation generation, assign its Promise synchronously, return that same object to duplicate callers, and clear only its own slot in `.finally()` when the slot still refers to that exact Promise. Do not use an `async` public wrapper, because an `async` wrapper would return an assimilated Promise rather than the exact same Promise object asserted by the test.

Use this exact invalidation pattern; every state publication and storage write after an `await`, including every `catch` branch, must first pass the same-generation guard:

```ts
let generation = 0;
let restorePromise: Promise<void> | undefined;
let signInPromise: Promise<void> | undefined;
let profilePromise: Promise<void> | undefined;
let invitePromise: Promise<void> | undefined;

function isCurrent(operationGeneration: number): boolean {
  return operationGeneration === generation;
}

function invalidateInFlight(): void {
  generation += 1;
  restorePromise = undefined;
  signInPromise = undefined;
  profilePromise = undefined;
  invitePromise = undefined;
}

function beginSupersedingOperation(): number {
  invalidateInFlight();
  return generation;
}
```

All state-changing user operations are one session epoch: after the duplicate-slot check, `signInWithWechat`, `completeProfile`, and `consumePendingInvite` each call `beginSupersedingOperation()` before creating their own Promise. `restore` does the same only for a cold start; if a user-operation slot already exists, it returns `Promise.resolve()` and cannot replace that user action. An invalidated operation settles its own returned Promise normally but becomes side-effect-free: it must not publish loading/error/authenticated/profile state, persist a newly returned session token, clear a pending invite, or reload role context. `clear()` and `markUnauthorized()` call `invalidateInFlight()` before publishing anonymous state. This permits a new user-initiated sign-in immediately while a stale request is still settling. The old Promise's `.finally()` must not erase the newer slot.

Use these exact transition rules:

```ts
const emptyContext = { groups: [] as readonly GroupSummary[], isPlatformAdmin: false };

async function loadRoleContext(): Promise<{
  readonly groups: readonly GroupSummary[];
  readonly isPlatformAdmin: boolean;
}> {
  const [groups, platform] = await Promise.all([
    dependencies.listGroups(),
    dependencies.getPlatformMe(),
  ]);
  return { groups, isPlatformAdmin: platform.isPlatformAdmin };
}

async function becomeAuthenticated(
  profile: UserProfile,
  token: string,
  operationGeneration: number,
): Promise<boolean> {
  const context = await loadRoleContext();
  if (!isCurrent(operationGeneration)) {
    return false;
  }
  const retainedGroupId = context.groups.some((group) => group.id === state.activeGroupId)
    ? state.activeGroupId
    : context.groups[0]?.id;
  state = {
    activeGroupId: retainedGroupId,
    groups: context.groups,
    isPlatformAdmin: context.isPlatformAdmin,
    profile,
    status: 'authenticated',
    token,
  };
  return true;
}
```

Every `restore`, `signInWithWechat`, `completeProfile`, and `consumePendingInvite` call to this helper must pass its captured `operationGeneration`. A `false` result is a stale, already-invalidated completion and must return immediately without another state/storage mutation. The helper's post-`await` guard is mandatory; callers must not rely only on a guard before entering it.

- `restore`: if a non-restore user-operation slot is already active, resolve immediately without reading storage or changing state; otherwise begin the cold-start generation and read storage exactly once. With no token, set `{ ...emptyContext, status: 'anonymous' }` and call no endpoint. With a token, set loading and call `getCurrentProfile` once. `ApiClientError` status `404` or code `NOT_FOUND` becomes `needs-profile` while retaining the token. Status `401` or code `AUTHENTICATION_REQUIRED` calls the memory-only unauthorized transition and becomes anonymous without another storage write because `api/client.ts` already deletes the protected-request token before rejecting. Any other rejection becomes `error`, retains the token, uses the existing error message, and resolves rather than rejecting so `App.onLaunch` never creates an unhandled rejection. A generation invalidated by a later user action or runtime 401 callback must make the later restore `catch` a no-op, preventing a second transition.
- `signInWithWechat`: call `requestLoginCode` once, then `wechatLogin(code)` once. Persist the returned token before publishing it in state. Branch on `response.profile === undefined`, never on `isNewUser`: missing profile becomes `needs-profile`; present profile calls `becomeAuthenticated`. On rejection, set `error` with the best available message and rethrow the same error so the page owns user feedback.
- `completeProfile`: require an existing token; trim `realName` and reject an empty value before any endpoint call. If state already retains a successfully created `profile`, skip `createUserProfile`; otherwise call it once and immediately retain the returned profile in loading state before calling `becomeAuthenticated`. If group/platform context loading fails after the POST, publish `error` while retaining that profile and token; a retry loads context only and must not POST `/users` again. Do not call `updateProfile` and do not synthesize `version`.
- `consumePendingInvite`: require a pending token, authenticated profile, and session token. Call `acceptInvite(pending, profile.realName)` exactly once. If `result.token !== undefined`, call `writeStoredToken(result.token)` and update in-memory token first. Then call `writePendingInviteToken(undefined)`. Only after these two ordered side effects call `getCurrentProfile` and `becomeAuthenticated` so an account-merge token reloads identity and group roles. A failed accept must leave the pending token untouched; a post-accept refresh failure must not restore an already-consumed token.
- `setActiveGroupId`: update only when the ID exists in `state.groups`; return `true` for any existing ID even when it is already active, and `false` for an unknown ID; make no API or storage call.
- `clear`: invalidate all in-flight operations, write the session token as `undefined` exactly once, and reset auth/profile/group/platform/error state, but do not remove the pending invite.
- `markUnauthorized`: invalidate all in-flight operations and clear token/profile/group/platform/error state in memory only. It must not call `writeStoredToken`, because the protected-request client already performed that storage side effect. Repeated calls while already anonymous remain storage-free.
- `setPendingInviteToken`: compare against `readPendingInviteToken()` first; identical values are a no-op so App launch and invite-page `onLoad` capture one deep link only once. Remove storage for `undefined` or `''`; otherwise preserve the exact token string. No trimming, decoding, or validation rule may be invented.

Create the singleton with a dependency object whose wrappers keep receiver binding explicit:

```ts
export const sessionStore = createSessionStore({
  acceptInvite,
  createUserProfile,
  getCurrentProfile,
  getPlatformMe,
  listGroups,
  readPendingInviteToken: () => {
    const value = wx.getStorageSync<string>(pendingInviteStorageKey);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  },
  readStoredToken: getStoredToken,
  requestLoginCode: () => requestWechatLoginCode({ login: (options) => wx.login(options) }),
  wechatLogin,
  writePendingInviteToken: (token) => {
    if (token === undefined || token.length === 0) {
      wx.removeStorageSync(pendingInviteStorageKey);
    } else {
      wx.setStorageSync(pendingInviteStorageKey, token);
    }
  },
  writeStoredToken: storeToken,
});
```

Run the session test. Expected: `1` file and `15` tests pass. Then run `pnpm miniprogram:typecheck`; no `any`, non-null assertion, or widened string status may be introduced.

- [ ] **Step 8: Write role-navigation and current-user contact tests first**

Create `apps/miniprogram/features/navigation/workbench-navigation.test.ts` and `apps/miniprogram/features/profile/profile-logic.test.ts`. Use table tests with these exact expectations:

```ts
expect(getVisibleWorkbenchEntries('owner').map(({ id }) => id)).toEqual([
  'calendar',
  'groups',
  'manual',
  'backfill',
  'leave',
  'swap',
  'duty',
  'events',
  'notifications',
  'statistics',
  'members',
  'config',
]);
expect(getVisibleWorkbenchEntries('administrator').map(({ id }) => id)).toEqual(
  getVisibleWorkbenchEntries('owner').map(({ id }) => id),
);
expect(getVisibleWorkbenchEntries('member').map(({ id }) => id)).toEqual([
  'calendar',
  'groups',
  'leave',
  'swap',
  'duty',
  'notifications',
  'statistics',
  'members',
]);
expect(getVisibleWorkbenchEntries('guest').map(({ id }) => id)).toEqual(['calendar', 'groups']);
expect(buildWorkbenchSections(groups, false).some(({ id }) => id === 'platform')).toBe(false);
expect(buildWorkbenchSections(groups, true).at(-1)).toMatchObject({ id: 'platform' });
```

The profile tests must create one owner group, one member group, and one guest group. They must assert: `listGroupMembers` and `listGroupContacts` are each called twice, never for the guest; the current member is found only by `isCurrentUser === true`; its contact is joined only by `membershipId`; a same-name/different-ID contact is ignored; a missing current member produces `unavailable`; a current member with no matching contact produces `missing`; guest produces `not-applicable`. No test or production helper may join on `realName`.

Run:

```powershell
pnpm vitest run apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.test.ts
```

Expected: both suites FAIL because their production modules do not exist.

- [ ] **Step 9: Implement the exact role matrix and ID-based contact summaries**

Create `apps/miniprogram/features/navigation/workbench-navigation.ts`. Define the exact IDs/order copied from the current Web implementation, not a new permission vocabulary:

```ts
import type { GroupRole, GroupSummary } from '@schedule/contracts';

export type WorkbenchEntryId =
  | 'backfill'
  | 'calendar'
  | 'config'
  | 'duty'
  | 'events'
  | 'groups'
  | 'leave'
  | 'manual'
  | 'members'
  | 'notifications'
  | 'statistics'
  | 'swap';

export interface WorkbenchEntry {
  readonly id: WorkbenchEntryId;
  readonly label: string;
  readonly requiresAdministrator: boolean;
  readonly tabRoute?: '/pages/calendar/index' | '/pages/notifications/index';
}

export interface WorkbenchSection {
  readonly entries: readonly WorkbenchEntry[];
  readonly groupId?: string;
  readonly id: string;
  readonly label: string;
  readonly role?: GroupRole;
}

export const workbenchEntries: readonly WorkbenchEntry[] = [
  {
    id: 'calendar',
    label: '排班日历',
    requiresAdministrator: false,
    tabRoute: '/pages/calendar/index',
  },
  { id: 'groups', label: '群组管理', requiresAdministrator: false },
  { id: 'manual', label: '手动排班', requiresAdministrator: true },
  { id: 'backfill', label: '排班补录', requiresAdministrator: true },
  { id: 'leave', label: '请假', requiresAdministrator: false },
  { id: 'swap', label: '换班', requiresAdministrator: false },
  { id: 'duty', label: '加扣班', requiresAdministrator: false },
  { id: 'events', label: '事件', requiresAdministrator: true },
  {
    id: 'notifications',
    label: '通知',
    requiresAdministrator: false,
    tabRoute: '/pages/notifications/index',
  },
  { id: 'statistics', label: '统计', requiresAdministrator: false },
  { id: 'members', label: '成员', requiresAdministrator: false },
  { id: 'config', label: '排班配置', requiresAdministrator: true },
];

export function getVisibleWorkbenchEntries(role: GroupRole): readonly WorkbenchEntry[] {
  if (role === 'guest') {
    return workbenchEntries.filter(({ id }) => id === 'calendar' || id === 'groups');
  }
  if (role === 'member') {
    return workbenchEntries.filter(({ requiresAdministrator }) => !requiresAdministrator);
  }
  return workbenchEntries;
}

export function buildWorkbenchSections(
  groups: readonly GroupSummary[],
  isPlatformAdmin: boolean,
): readonly WorkbenchSection[] {
  const sections = groups.map((group) => ({
    entries: getVisibleWorkbenchEntries(group.role),
    groupId: group.id,
    id: `group:${group.id}`,
    label: group.name,
    role: group.role,
  }));
  return isPlatformAdmin
    ? [...sections, { entries: [], id: 'platform', label: '平台管理' }]
    : sections;
}
```

The empty platform section is only an entry signal from the existing `GET /platform/me` boolean; Task 4 must not invent platform permissions or navigate to a not-yet-registered route.

Create `apps/miniprogram/features/profile/profile-logic.ts` with the exact public model below and an injected dependency pair. For every non-guest group, invoke `dependencies.listGroupMembers(group.id)` and `dependencies.listGroupContacts(group.id)` in one `Promise.all`; find the member with `isCurrentUser`; then match `contact.membershipId === member.id`:

```ts
import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';

export type OwnContactState = 'available' | 'missing' | 'not-applicable' | 'unavailable';

export interface OwnGroupContactSummary {
  readonly contact?: GroupMemberContact;
  readonly groupId: string;
  readonly groupName: string;
  readonly membershipId?: string;
  readonly role: GroupSummary['role'];
  readonly state: OwnContactState;
}

export interface ProfileLogicDependencies {
  readonly listGroupContacts: (groupId: string) => Promise<GroupMemberContact[]>;
  readonly listGroupMembers: (groupId: string) => Promise<GroupMember[]>;
}

export async function loadOwnGroupContacts(
  groups: readonly GroupSummary[],
  dependencies: ProfileLogicDependencies,
): Promise<readonly OwnGroupContactSummary[]> {
  return Promise.all(
    groups.map(async (group) => {
      const base = { groupId: group.id, groupName: group.name, role: group.role } as const;
      if (group.role === 'guest') {
        return { ...base, state: 'not-applicable' as const };
      }
      const [members, contacts] = await Promise.all([
        dependencies.listGroupMembers(group.id),
        dependencies.listGroupContacts(group.id),
      ]);
      const currentMember = members.find((member) => member.isCurrentUser);
      if (currentMember === undefined) {
        return { ...base, state: 'unavailable' as const };
      }
      const contact = contacts.find(({ membershipId }) => membershipId === currentMember.id);
      return contact === undefined
        ? { ...base, membershipId: currentMember.id, state: 'missing' as const }
        : {
            ...base,
            contact,
            membershipId: currentMember.id,
            state: 'available' as const,
          };
    }),
  );
}
```

Run the two focused suites. Expected: both pass; exact call counts are two member calls and two contact calls for the three-group fixture.

- [ ] **Step 10: Extend the manifest test first, then register only the two required non-tab routes**

Modify `scripts/miniprogram-app-shell.test.mjs` before `app.json`. Change the registered-route expectation to this exact order:

```js
expect(listRegisteredPages(appJson)).toEqual([
  'pages/auth/login/index',
  'pages/auth/profile-setup/index',
  'pages/invite/invite',
  'pages/workbench/index',
  'pages/calendar/index',
  'pages/notifications/index',
  'pages/profile/index',
]);
```

Keep the native tabBar expectation unchanged and add:

```js
expect(appJson.pages).toContain('pages/invite/invite');
expect(appJson.tabBar.list.some(({ pagePath }) => pagePath === 'pages/invite/invite')).toBe(false);
```

Run the shell test. Expected: FAIL because the two routes are not registered. Then modify only the `pages` array in `apps/miniprogram/app.json` to the seven-route order above. Do not add a custom tab bar, subpackage, old invite UI, V1/V2 route, renderer option, permission declaration, or query parameter to a tab route. The new invite page is a V3 bridge required by the server’s already-shipped `pages/invite/invite?t=...` share path.

- [ ] **Step 11: Compose App launch restoration and protected-401 routing**

First create `apps/miniprogram/features/auth/auth-runtime.test.ts` with this complete content:

```ts
import { describe, expect, it, vi } from 'vitest';

import type { AuthLandingStatus } from './auth-flow.js';
import { createAuthRuntime, type AuthRuntimeDependencies } from './auth-runtime.js';

function createHarness() {
  let currentRoute = 'pages/calendar/index';
  let pendingInviteToken: string | undefined;
  let restoreError: unknown;
  let status: AuthLandingStatus = 'authenticated';
  let unauthorizedHandler: (() => void) | undefined;
  const markUnauthorized = vi.fn(() => {
    status = 'anonymous';
  });
  const reportBootstrapError = vi.fn();
  const reLaunch = vi.fn();
  const switchTab = vi.fn();
  const dependencies = {
    getCurrentRoute: () => currentRoute,
    reLaunch,
    session: {
      get state() {
        return { status };
      },
      getPendingInviteToken: () => pendingInviteToken,
      markUnauthorized,
      restore: vi.fn(() =>
        restoreError === undefined ? Promise.resolve() : Promise.reject(restoreError),
      ),
    },
    reportBootstrapError,
    setUnauthorizedHandler: vi.fn((handler: () => void) => {
      unauthorizedHandler = handler;
    }),
    switchTab,
  } satisfies AuthRuntimeDependencies;
  return {
    dependencies,
    getUnauthorizedHandler: () => unauthorizedHandler,
    markUnauthorized,
    reportBootstrapError,
    reLaunch,
    runtime: createAuthRuntime(dependencies),
    setCurrentRoute: (route: string) => {
      currentRoute = route;
    },
    setPendingInviteToken: (token: string | undefined) => {
      pendingInviteToken = token;
    },
    setRestoreError: (error: unknown) => {
      restoreError = error;
    },
    setStatus: (nextStatus: AuthLandingStatus) => {
      status = nextStatus;
    },
    switchTab,
  };
}

describe('auth runtime', () => {
  it('marks memory state and coalesces repeated protected-401 login navigation', () => {
    const harness = createHarness();
    harness.runtime.initialize();
    const handler = harness.getUnauthorizedHandler();
    if (handler === undefined) throw new Error('unauthorized handler was not registered');
    handler();
    handler();
    harness.runtime.navigateForCurrentSession();
    expect(harness.markUnauthorized).toHaveBeenCalledTimes(2);
    expect(harness.reLaunch).toHaveBeenCalledTimes(1);
    expect(harness.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/auth/login/index' }),
    );
    expect('writeStoredToken' in harness.dependencies).toBe(false);
  });

  it('resets the navigation latch after sign-in and switches to workbench once', () => {
    const harness = createHarness();
    harness.runtime.initialize();
    const handler = harness.getUnauthorizedHandler();
    if (handler === undefined) throw new Error('unauthorized handler was not registered');
    handler();
    harness.setStatus('authenticated');
    harness.setCurrentRoute('pages/auth/login/index');
    harness.setPendingInviteToken(undefined);
    harness.runtime.resetUnauthorizedNavigation();
    harness.runtime.navigateForCurrentSession();
    expect(harness.switchTab).toHaveBeenCalledTimes(1);
    expect(harness.switchTab).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
  });

  it('terminates a launch restore/navigation rejection through the injected reporter', async () => {
    const harness = createHarness();
    const launchError = new Error('navigation unavailable');
    harness.setRestoreError(launchError);
    harness.runtime.restoreAndNavigate();
    await vi.waitFor(() => {
      expect(harness.reportBootstrapError).toHaveBeenCalledWith(launchError);
    });
  });
});
```

Run it and expect FAIL because `auth-runtime.ts` does not exist.

Create `apps/miniprogram/features/auth/auth-runtime.ts` with the complete injected runtime below so pages never import the side-effectful `App()` entry module. Use `getCurrentPages()` without `.at()` (the mini-program TypeScript target is ES2020), keep `wx.reLaunch`/`wx.switchTab` as member calls, and never register an `async` unauthorized handler:

```ts
import { setUnauthorizedHandler } from '../../api/client.js';
import { sessionStore } from '../../store/session.js';
import {
  createUnauthorizedNavigator,
  getSessionLandingTarget,
  loginRoute,
  type AuthLandingStatus,
  type ReLaunchPort,
} from './auth-flow.js';

export interface AuthRuntimeDependencies extends ReLaunchPort {
  readonly session: {
    readonly state: { readonly status: AuthLandingStatus };
    getPendingInviteToken(): string | undefined;
    markUnauthorized(): void;
    restore(): Promise<void>;
  };
  reportBootstrapError(error: unknown): void;
  setUnauthorizedHandler(handler: () => void): void;
  switchTab(options: { readonly url: string }): void;
}

export interface AuthRuntime {
  initialize(): void;
  navigateForCurrentSession(): void;
  resetUnauthorizedNavigation(): void;
  restoreAndNavigate(): void;
}

export function createAuthRuntime(dependencies: AuthRuntimeDependencies): AuthRuntime {
  const unauthorizedNavigator = createUnauthorizedNavigator(dependencies);
  const navigateForCurrentSession = (): void => {
    const target = getSessionLandingTarget(
      dependencies.session.state.status,
      dependencies.session.getPendingInviteToken() !== undefined,
    );
    if (target.kind === 'reLaunch' && target.url === loginRoute) {
      unauthorizedNavigator.redirectToLogin();
    } else if (target.kind === 'reLaunch') {
      dependencies.reLaunch({ url: target.url });
    } else if (target.kind === 'switchTab') {
      dependencies.switchTab({ url: target.url });
    }
  };

  return {
    initialize: () => {
      dependencies.setUnauthorizedHandler(() => {
        dependencies.session.markUnauthorized();
        unauthorizedNavigator.redirectToLogin();
      });
    },
    navigateForCurrentSession,
    resetUnauthorizedNavigation: unauthorizedNavigator.reset,
    restoreAndNavigate: () => {
      void dependencies.session
        .restore()
        .then(navigateForCurrentSession)
        .catch((error: unknown) => {
          try {
            dependencies.reportBootstrapError(error);
          } catch {
            return;
          }
        });
    },
  };
}

const authRuntime = createAuthRuntime({
  getCurrentRoute: () => {
    const pages = getCurrentPages();
    return pages[pages.length - 1]?.route;
  },
  reLaunch: (options) => wx.reLaunch(options),
  reportBootstrapError: (error) => {
    wx.showToast({
      icon: 'none',
      title: error instanceof Error ? error.message : '会话恢复失败，请重试。',
    });
  },
  session: sessionStore,
  setUnauthorizedHandler: (handler) => setUnauthorizedHandler(handler),
  switchTab: (options) => wx.switchTab(options),
});

export function initializeAuthRuntime(): void {
  authRuntime.initialize();
}

export function navigateForCurrentSession(): void {
  authRuntime.navigateForCurrentSession();
}

export function restoreAndNavigate(): void {
  authRuntime.restoreAndNavigate();
}

export function resetUnauthorizedNavigation(): void {
  authRuntime.resetUnauthorizedNavigation();
}
```

Run `pnpm vitest run apps/miniprogram/features/auth/auth-runtime.test.ts`; expected: `1` file / `3` tests pass. The runtime updates in-memory session state and navigation only; the existing protected-request client remains the sole storage deletion point for that 401 response. The launch helper owns the terminal rejection path, so `App.onLaunch` creates no floating derived Promise.

Replace `apps/miniprogram/app.ts` with this complete composition root:

```ts
import { readInviteToken } from './features/auth/auth-flow.js';
import { initializeAuthRuntime, restoreAndNavigate } from './features/auth/auth-runtime.js';
import { sessionStore } from './store/session.js';

initializeAuthRuntime();

App({
  onLaunch(options): void {
    const inviteToken = readInviteToken(options.query);
    if (inviteToken !== undefined) {
      sessionStore.setPendingInviteToken(inviteToken);
    }
    restoreAndNavigate();
  },
});
```

The injected `auth-flow.test.ts` suite is the unit boundary for navigation decisions and one-shot behavior. Review the small `app.ts` composition root directly and validate framework registration in the simulator matrix; do not add an `app.test.ts` that evaluates `App()`/global `wx` during test collection.

- [ ] **Step 12: Replace the login shell and create the missing-profile page**

Replace `apps/miniprogram/pages/auth/login/index.ts` so it retains the Task 3 renderer observation and adds only one guarded action:

```ts
import {
  navigateForCurrentSession,
  resetUnauthorizedNavigation,
} from '../../../features/auth/auth-runtime.js';
import { sessionStore } from '../../../store/session.js';

interface LoginPageData {
  readonly errorMessage: string;
  readonly renderer: string;
  readonly submitting: boolean;
}

interface LoginPageMethods {
  handleLogin(): Promise<void>;
}

Page<LoginPageData, LoginPageMethods>({
  data: { errorMessage: '', renderer: 'unknown', submitting: false },
  onLoad(): void {
    this.setData({ renderer: this.renderer });
  },
  async handleLogin(): Promise<void> {
    if (this.data.submitting) return;
    this.setData({ errorMessage: '', submitting: true });
    try {
      await sessionStore.signInWithWechat();
      resetUnauthorizedNavigation();
      navigateForCurrentSession();
    } catch (error) {
      this.setData({
        errorMessage: error instanceof Error ? error.message : '登录失败，请重试。',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
```

Replace `apps/miniprogram/pages/auth/login/index.wxml` with one `page-shell`, a title/description, conditional error text, and a native button with `bindtap="handleLogin"`, `disabled="{{submitting}}"`, and `loading="{{submitting}}"`. Exact visible strings are `微信登录`, `登录后查看所属群组的排班。`, and `微信一键登录`. Do not request avatar, nickname, phone number, location, or another scope. Replace `apps/miniprogram/pages/auth/login/index.wxss` with explicit `.auth-card`, `.auth-card__description`, `.auth-card__error`, and `.auth-card__button` styles using Task 3 tokens and an 88rpx minimum button height.

Create `apps/miniprogram/pages/auth/profile-setup/index.json` from the Task 3 shared WebView page JSON. Create `apps/miniprogram/pages/auth/profile-setup/index.ts` with explicit `ProfileSetupPageData`/`ProfileSetupPageMethods`, registered as `Page<ProfileSetupPageData, ProfileSetupPageMethods>`. Data is exactly `{ errorMessage: '', realName: '', submitting: false }`; `handleNameInput(event: WechatMiniprogram.Input)` assigns only `event.detail.value`; guarded `handleSubmit(): Promise<void>` calls `sessionStore.completeProfile(this.data.realName)`, then `navigateForCurrentSession`, catches the original `Error.message`, and finally clears `submitting`. Import the navigator from `../../../features/auth/auth-runtime.js`. Create `apps/miniprogram/pages/auth/profile-setup/index.wxml` with `page-shell show-back="{{false}}"`, a native text input with `maxlength="50"`, and a native submit button; visible strings are `完善资料`, `真实姓名用于排班和邀请核对。`, `请输入真实姓名`, and `保存并继续`. Create `apps/miniprogram/pages/auth/profile-setup/index.wxss` with the same exact card/error/button classes and 88rpx button minimum as login. Do not add editing, version construction, or a second profile request.

- [ ] **Step 13: Create the V3 invite bridge with failure-safe pending-token behavior**

Create `apps/miniprogram/pages/invite/invite.json` from the shared WebView page JSON. Create `apps/miniprogram/pages/invite/invite.ts` with explicit `InvitePageData`/`InvitePageMethods` and a discriminated data state (`loading`, `ready`, `accepting`, `error`), registered as `Page<InvitePageData, InvitePageMethods>` and importing `navigateForCurrentSession` from `../../features/auth/auth-runtime.js`. Type `onLoad` query as `Record<string, string | undefined>` and `handleAccept(): Promise<void>`. Use these exact lifecycle/action rules:

1. `onLoad(query)` calls `readInviteToken(query)` and writes a non-empty value through `sessionStore.setPendingInviteToken`.
2. `onShow` branches on the current session landing target. Anonymous and needs-profile states reLaunch through `navigateForCurrentSession`; authenticated state calls `resolveInvite(pendingToken)` exactly once per show; missing token sets a local error and calls no endpoint.
3. The resolved view displays only existing `ResolveInviteResponse` fields: group name, invitee real name, permission role, and optional schedule-role name.
4. `handleAccept` is guarded by `accepting`, calls `sessionStore.consumePendingInvite()`, then `wx.switchTab({ url: '/pages/workbench/index' })`; rejection displays the same error and leaves the pending token untouched unless the accept itself already succeeded.

Use `this.setData` only through the page receiver. Create `apps/miniprogram/pages/invite/invite.wxml` with stable loading/error/ready branches through `shell-state`; the ready branch lists only the four resolved contract fields and has one native confirmation button with 88rpx minimum height. Create `apps/miniprogram/pages/invite/invite.wxss` with `.invite-card`, `.invite-field`, `.invite-error`, and `.invite-action` classes using existing tokens. Do not recover the old invite page, infer an event/permission, allow the user to edit `confirmRealName`, or add another accept field.

- [ ] **Step 14: Wire group-scoped workbench entries and profile/contact summaries**

Replace `apps/miniprogram/pages/workbench/index.ts` so `onShow` reads a snapshot from `sessionStore.state`; authenticated state maps `buildWorkbenchSections(state.groups, state.isPlatformAdmin)`, otherwise invokes `navigateForCurrentSession` imported from `../../features/auth/auth-runtime.js`. Define `WorkbenchPageData`/`WorkbenchPageMethods` and register `Page<WorkbenchPageData, WorkbenchPageMethods>`. Type selection events as `WechatMiniprogram.BaseEvent<Record<string, never>, { readonly groupId?: unknown }>` and entry events with `{ readonly route?: unknown }`. Implement:

- `handleSelectGroup`: read `event.currentTarget.dataset.groupId`, narrow it with `typeof === 'string'`, call `setActiveGroupId`, and refresh data exactly once.
- `handleEntry`: narrow `dataset.route`; for the two declared tab routes call `wx.switchTab({ url: route })`; for entries without a route call `wx.showToast({ icon: 'none', title: '当前版本尚未开放' })` exactly once.
- Do not present a hidden entry as enabled, and do not treat visibility as authorization.

Replace `apps/miniprogram/pages/workbench/index.wxml` so it loops `sections` in order, identifies the active group, loops each section’s `entries`, and binds only `data-group-id`/`data-route`; the platform section renders a disabled `平台管理` row with `当前版本尚未开放`. Use stable IDs as `wx:key`, never array indexes. Replace `apps/miniprogram/pages/workbench/index.wxss` with explicit section, selected-group, enabled-tab-route, and disabled-entry classes while keeping 88rpx touch targets.

Replace `apps/miniprogram/pages/profile/index.ts` with explicit `ProfilePageData`/`ProfilePageMethods`, registered as `Page<ProfilePageData, ProfilePageMethods>`. `onShow` requires an authenticated state, then calls `loadOwnGroupContacts` once per invocation with injected endpoint wrappers; import `navigateForCurrentSession` from `../../features/auth/auth-runtime.js`. A later `onShow` intentionally starts a fresh network refresh, so two shows mean at most two members+contacts calls per non-guest group; within one invocation each endpoint is called exactly once. Use a monotonically increasing request version to ignore the older result, never cancel a request, and never publish stale success/error/loading state. Wrap each load in `try/catch/finally`: only the current version may publish summaries or its `Error.message`, and `finally` clears loading only for that version. Render `profile.realName`, each group name/role, and contact state. Add `handleLogout(): void` that calls `sessionStore.clear()` once and `wx.reLaunch({ url: '/pages/auth/login/index' })` once. Replace `apps/miniprogram/pages/profile/index.wxml` so it shows long/short numbers only when present plus `已确认`/`未确认`, `未填写联系方式`, `游客无需联系方式`, or `暂时无法确认成员身份` according to the typed summary; it exposes no phone action yet. Replace `apps/miniprogram/pages/profile/index.wxss` with explicit profile header, group card, contact-state, error, and 88rpx logout-button classes using existing tokens. Do not call `updateProfile`.

- [ ] **Step 15: Run focused, static, DevTools, and simulator validation**

Run the automated checks first:

```powershell
pnpm vitest run apps/miniprogram/features/auth/auth-flow.test.ts apps/miniprogram/features/auth/auth-runtime.test.ts apps/miniprogram/store/session.test.ts apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.test.ts scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs apps/miniprogram/api/client.test.ts
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/app.json apps/miniprogram/app.ts apps/miniprogram/features/auth/auth-flow.ts apps/miniprogram/features/auth/auth-flow.test.ts apps/miniprogram/features/auth/auth-runtime.ts apps/miniprogram/features/auth/auth-runtime.test.ts apps/miniprogram/store/session.ts apps/miniprogram/store/session.test.ts apps/miniprogram/features/navigation/workbench-navigation.ts apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.ts apps/miniprogram/features/profile/profile-logic.test.ts apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/auth/profile-setup/index.json apps/miniprogram/pages/auth/profile-setup/index.ts apps/miniprogram/pages/invite/invite.json apps/miniprogram/pages/invite/invite.ts apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/profile/index.ts scripts/miniprogram-app-shell.test.mjs
git diff --check
```

Expected: every named suite passes; typecheck/lint/Prettier/diff checks exit `0`. Do not hard-code a total test count until the complete fixture helpers are written; record Vitest’s literal file/test totals in the checkpoint.

Then run the tracked DevTools/smoke sequence:

```powershell
pnpm miniprogram:devtools:build-npm
pnpm miniprogram:devtools:preview
pnpm miniprogram:smoke
```

Expected: all three commands exit `0`; the manifest-driven smoke opens all seven registered routes, uses `switchTab` for the four tab pages and `reLaunch` for login/profile-setup/invite, and reports no script-level error.

Perform a full, non-hot-reload build in the current stable WeChat DevTools. Record the literal About-dialog DevTools version and selected debug base-library version. Test these simulator scenarios while watching Network and vConsole:

1. Clean storage launch: login page, zero profile/group/platform calls before a login token exists.
2. Double-tap login: one `wx.login`, one `/auth/wechat/login`; empty/fail path displays error and does not retry silently.
3. Existing profile: token stored, one `/users/me`/groups/platform context, native switchTab to workbench.
4. Missing profile: login response without `profile` and restored `/users/me` 404 both land on profile setup; submit makes one `POST /users` and no PATCH.
5. Expired token plus multiple protected failures: token clears and exactly one reLaunch reaches login.
6. Deep-link `pages/invite/invite?t=...`: pending token survives login/profile; resolve shows only contract fields; failed accept retains token; successful accept with token override records session storage update before pending-token removal and refreshes identity/context.
7. From profile-setup and invite, call `wx.switchTab({ url: '/pages/workbench/index' })` and verify `getCurrentPages()` retains only the workbench tab; no query state or non-tab page remains.
8. Owner/administrator/member/guest groups: entry order/visibility matches tests; unavailable entries do not navigate; platform row appears only for `isPlatformAdmin: true`.
9. Profile: guest makes no member/contact requests; each non-guest group makes one members+contacts pair per `onShow`; a rapid second show may make a second pair but the stale first result cannot publish; same names cannot cross-wire contacts; logout preserves a pending invite.
10. Calendar tab still reports `this.renderer === 'skyline'` on a supported simulator and remains usable under the Task 3 recorded forced-WebView compatibility result; automatic fallback remains separately evidenced or explicitly unverified. Task 4 adds no Worklet or TDesign component, so both remain `N/A` rather than claimed as validated.

If the installed DevTools exposes a Worklet compilation option under wording different from the team config key, record the literal UI label and leave it unchanged; Task 4 contains no worklet function. A hot reload is not sufficient because current Skyline tooling does not support it as acceptance evidence; perform a full compile.

- [ ] **Step 16: Run cross-client browser smoke and the core guard**

Task 4 changes the mini-program authentication/session composition and exercises shared backend auth contracts without modifying them. Run the existing Web smoke to prove no cross-client auth regression:

```powershell
pnpm smoke:browser
```

Expected: exit `0` with existing Web login/session/role scenarios passing. Append `运行/浏览器验证：pnpm smoke:browser 通过。` to `docs/debug/debug-feedback-log.md`, then run:

```powershell
pnpm smoke:check-core
```

Expected: exit `0`. If browser smoke cannot run because its documented external service prerequisite is unavailable, Task 4 remains `已实现待浏览器复核`, record the exact blocker, and do not commit the authentication checkpoint as `已完成`.

- [ ] **Step 17: Perform the Task 4 semantic audit, checkpoint, and push**

Record this audit with literal evidence in the debug log and project status:

```text
Receiver/this: wx.login, wx.reLaunch, wx.switchTab, wx.showToast, storage methods, and Page this.setData remain receiver-bound; the injected ports are tested with methods that mutate this.calls; the unauthorized navigator is a closure arrow.
Promise/error: duplicate calls return the same slot Promise; a new user operation starts a superseding session generation so deferred restore cannot overwrite sign-in; exact-Promise finally guards cannot clear a newer slot; generation invalidation prevents late success/catch publication; restore absorbs into a typed state; user actions rethrow/catch once; no floating rejection or widened catch scope.
Nullish: login branches on response.profile === undefined, invite token override on result.token !== undefined, active group on optional ID, and no || replaces a contract fallback.
Type narrowing: Page data/methods and input/query/dataset/error values are explicit and narrowed before use; roles/statuses remain contract/discriminated unions; no `any`, unsafe cast, non-null assertion, or invented field.
Side effects/calls: duplicate login/restore/invite taps coalesce; no-token restore calls zero APIs; clear/401 invalidation cannot resurrect token/profile; profile POST survives context retry exactly once; App/invite duplicate token capture writes once; non-guest contact loading calls one members+contacts pair per group; protected 401 performs no second storage deletion and redirects once.
Ordering: accept success -> optional token persist/in-memory update -> pending token clear -> profile/context reload; accept failure never clears pending.
Authorization: role filtering mirrors Web visibility only; server remains authoritative; platform entry derives only from GET /platform/me.
Scope: no updateProfile, contract, endpoint signature, backend, permission, Worklet, TDesign render, V1/V2 page, or old manifest fragment changes.
```

Review `git diff` line by line. Update `docs/project-status.md` with the Task 4 state, exact automated/runtime/browser results, commit message, next batch “Task 5 only,” and its stop condition. Append the introduction hashes, behavior audit, and runtime evidence to `docs/debug/debug-feedback-log.md`. Then run this final checkpoint set:

```powershell
pnpm vitest run apps/miniprogram/features/auth/auth-flow.test.ts apps/miniprogram/features/auth/auth-runtime.test.ts apps/miniprogram/store/session.test.ts apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.test.ts scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs apps/miniprogram/api/client.test.ts
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/app.json apps/miniprogram/app.ts apps/miniprogram/features/auth/auth-flow.ts apps/miniprogram/features/auth/auth-flow.test.ts apps/miniprogram/features/auth/auth-runtime.ts apps/miniprogram/features/auth/auth-runtime.test.ts apps/miniprogram/store/session.ts apps/miniprogram/store/session.test.ts apps/miniprogram/features/navigation/workbench-navigation.ts apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.ts apps/miniprogram/features/profile/profile-logic.test.ts apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/auth/profile-setup/index.ts apps/miniprogram/pages/invite/invite.ts apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/profile/index.ts docs/project-status.md docs/debug/debug-feedback-log.md
pnpm smoke:check-core
git diff --check
```

Expected: every command exits `0`; if the browser-smoke record or a guarded core file is inconsistent, `smoke:check-core` fails and the checkpoint stops.

Stage only the Task 4 paths and its two checkpoint docs; inspect the exact staged diff; then commit and push:

```powershell
git diff
git add scripts/miniprogram-app-shell.test.mjs apps/miniprogram/app.json apps/miniprogram/app.ts apps/miniprogram/features/auth/auth-flow.ts apps/miniprogram/features/auth/auth-flow.test.ts apps/miniprogram/features/auth/auth-runtime.ts apps/miniprogram/features/auth/auth-runtime.test.ts apps/miniprogram/store/session.ts apps/miniprogram/store/session.test.ts apps/miniprogram/features/navigation/workbench-navigation.ts apps/miniprogram/features/navigation/workbench-navigation.test.ts apps/miniprogram/features/profile/profile-logic.ts apps/miniprogram/features/profile/profile-logic.test.ts apps/miniprogram/pages/auth/login/index.ts apps/miniprogram/pages/auth/login/index.wxml apps/miniprogram/pages/auth/login/index.wxss apps/miniprogram/pages/auth/profile-setup/index.json apps/miniprogram/pages/auth/profile-setup/index.ts apps/miniprogram/pages/auth/profile-setup/index.wxml apps/miniprogram/pages/auth/profile-setup/index.wxss apps/miniprogram/pages/invite/invite.json apps/miniprogram/pages/invite/invite.ts apps/miniprogram/pages/invite/invite.wxml apps/miniprogram/pages/invite/invite.wxss apps/miniprogram/pages/workbench/index.ts apps/miniprogram/pages/workbench/index.wxml apps/miniprogram/pages/workbench/index.wxss apps/miniprogram/pages/profile/index.ts apps/miniprogram/pages/profile/index.wxml apps/miniprogram/pages/profile/index.wxss docs/project-status.md docs/debug/debug-feedback-log.md
git diff --cached --check
git diff --cached
git commit -m "feat(miniprogram): add V3 auth and role routing"
git push
```

Expected: normal fast-forward push to the configured upstream. Never stage private DevTools state, generated `miniprogram_npm`, preview output, screenshots, unrelated user changes, or a failed runtime checkpoint. If push fails, retain the local commit, record the exact failure, and never force-push.

**Task 4 stop condition:** stop immediately after the checkpoint/push attempt. Do not begin calendar logic, calendar view-model tests, calendar data loading, or Task 5 styling in the same conversation.

### Task 5: Port Date, Filter, Sort, And `CalendarMonthViewModel` Semantics

**Task boundary:** Execute Task 5 only after the Task 4 checkpoint and push attempt are recorded. This task creates pure mini-program calendar logic, tests the API-to-VM mapping, and lets the calendar page fetch and display VM-owned foundation state. It does not build the V3-2 golden calendar components, swiper, detail sheets, event routing, persistent cache, Worklet gesture code, or TDesign calendar. The current shared calendar contract is sufficient for the fields it actually owns and must not be changed in this task.

- [ ] **Step 1: Reconfirm Task 4 and audit the Web semantic introduction points**

Run before editing:

```powershell
git status --short --branch
git branch --show-current
git log -8 --oneline --decorate
git rev-list --left-right --count 'HEAD...@{upstream}'
git log -S 'actualMemberName ?? plannedMemberName' -- apps/web/src/features/calendar
git log -S 'getShiftStartOrder' -- apps/web/src/features/calendar/calendar-views.ts
git log -S 'getAvailablePhoneOptions' -- apps/web/src/features/calendar/calendar-logic.ts
git blame -L 1,240 -- apps/web/src/features/calendar/calendar-logic.ts
git blame -L 1,240 -- apps/web/src/features/calendar/calendar-views.ts
git log -S 'calendarChangeMarkerSchema' -- packages/contracts/src/calendar.ts
git blame -L 1,160 -- packages/contracts/src/calendar.ts
```

Expected: a clean worktree at the Task 4 checkpoint, with the precise Web/calendar and contract introduction hashes available for the debug log. Confirm again that `CalendarChangeMarker` is exactly `swap | leave-cover | overtime`, assignments have no marker event ID, and the calendar contract has no deduction marker or marker permission. If any of those facts changed after this plan was written, stop and regenerate Task 5 from the new contract rather than guessing.

- [ ] **Step 2: Write comprehensive calendar-logic tests before the mini-program port**

Create `apps/miniprogram/features/calendar/calendar-logic.test.ts`. Use current contract-typed fixtures and add exact tests for:

```ts
describe('business date and month logic', () => {
  it('uses China Standard Time at the UTC month boundary', () => {
    expect(getCurrentBusinessDate(new Date('2026-07-31T15:59:59.000Z'))).toBe('2026-07-31');
    expect(getCurrentBusinessDate(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08-01');
    expect(getCurrentBusinessMonth(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08');
  });

  it('moves across year boundaries while keeping Web month-helper semantics', () => {
    expect(addBusinessMonths('2026-01', -1)).toBe('2025-12');
    expect(addBusinessMonths('2026-12', 1)).toBe('2027-01');
    expect(getBusinessMonthLabel('2026-08')).toBe('2026年8月');
    expect(() => addBusinessMonths('2026-8', 1)).toThrow();
    expect(() => addBusinessMonths('2026-08', 0.5)).toThrow();
    expect(() => parseBusinessMonth('2026-13')).toThrow();
    expect(() => parseBusinessDate('2026-02-29')).toThrow();
    expect(() => parseBusinessDate('2026-2-01')).toThrow();
  });

  it('builds a Monday-first, seven-column month grid', () => {
    const weeks = buildMonthGrid(2026, 8);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.map((cell) => cell?.businessDate)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-08-01',
      '2026-08-02',
    ]);
    expect(weeks.at(-1)?.map((cell) => cell?.businessDate)).toEqual([
      '2026-08-31',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(getWeekdayLabel('2026-08-01')).toBe('周六');
    expect(isWeekend('2026-08-01')).toBe(true);
    expect(isPastBusinessDate('2026-08-01', '2026-08-02')).toBe(true);
  });
});

describe('assignment filters and stable Web ordering', () => {
  it('uses nullish actual/planned fallback and never treats an empty actual name as missing', () => {
    expect(getDutyMembershipId(makeAssignment({ actualMembershipId: undefined }))).toBe(
      'planned-member',
    );
    expect(
      getDutyMemberName(makeAssignment({ actualMemberName: '', plannedMemberName: '计划姓名' })),
    ).toBe('');
  });

  it('filters by role, shift, effective membership and changes without mutating input', () => {
    const assignments = Object.freeze([
      makeAssignment({ id: 'visible', changeMarkers: ['swap'] }),
      makeAssignment({ id: 'hidden', scheduleRoleId: 'other-role' }),
    ]);
    const result = filterCalendarAssignments(assignments, {
      membershipIds: ['planned-member'],
      onlyChanges: true,
      roleIds: ['role-1'],
      shiftTypeIds: ['shift-1'],
    });
    expect(result.map(({ id }) => id)).toEqual(['visible']);
    expect(assignments.map(({ id }) => id)).toEqual(['visible', 'hidden']);
  });

  it('sorts each day by CST start with midnight last, role, slot, period, then source index', () => {
    const assignments = [
      makeAssignment({ id: 'stable-first', startsAt: '2026-08-01T06:00:00+08:00' }),
      makeAssignment({ id: 'midnight', startsAt: '2026-08-02T00:00:00+08:00' }),
      makeAssignment({ id: 'earlier', startsAt: '2026-08-01T07:00:00+08:00' }),
      makeAssignment({ id: 'stable-second', startsAt: '2026-08-01T06:00:00+08:00' }),
    ];
    expect(sortCalendarAssignments(assignments).map(({ id }) => id)).toEqual([
      'stable-first',
      'stable-second',
      'earlier',
      'midnight',
    ]);
    expect(assignments.map(({ id }) => id)).toEqual([
      'stable-first',
      'midnight',
      'earlier',
      'stable-second',
    ]);
  });
});

describe('display semantics', () => {
  it('formats cross-day instants in CST and maps only existing marker IDs', () => {
    expect(formatShiftTimeRange(makeAssignment())).toBe('08:00–16:00');
    expect(getCalendarMarkerLabel('swap')).toBe('换');
    expect(getCalendarMarkerLabel('leave-cover')).toBe('替');
    expect(getCalendarMarkerLabel('overtime')).toBe('加');
  });

  it('shortens known and long holiday names without changing the source', () => {
    expect(getHolidayShortLabel('劳动节')).toBe('五一');
    expect(getHolidayShortLabel('一个很长的节日名称')).toBe('一个很长');
  });

  it('offers no action without a number, dial for confirmed, and copy for unconfirmed', () => {
    expect(getAvailablePhoneActions(undefined)).toEqual([]);
    expect(getAvailablePhoneActions(makeMember({ isConfirmed: true }))).toEqual([
      { kind: 'dial', label: '长号', number: '13800000000' },
      { kind: 'dial', label: '短号', number: '6601' },
    ]);
    expect(getAvailablePhoneActions(makeMember({ isConfirmed: false }))).toEqual([
      { kind: 'copy', label: '长号', number: '13800000000' },
      { kind: 'copy', label: '短号', number: '6601' },
    ]);
  });
});
```

The complete test file must define `makeAssignment(overrides)` and `makeMember(overrides)` as `satisfies CalendarDutyAssignment` / `satisfies CalendarDutyMember`, not `as any`. Correct the sorting fixture so the two stable assignments have identical semantic keys, `earlier` is 07:00 CST, and `midnight` is 00:00 CST on the assignment’s business day; all four share `businessDate`. Add separate assertions that role-name, `slotPosition`, and `schedulePeriodId` each break ties in that order.

- [ ] **Step 3: Run calendar-logic tests and observe the planned failure**

Run:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts
```

Expected: FAIL because `apps/miniprogram/features/calendar/calendar-logic.ts` does not exist. A fixture or test import failure is not the intended red state.

- [ ] **Step 4: Implement the Web-equivalent pure calendar logic**

Create `apps/miniprogram/features/calendar/calendar-logic.ts`. Keep it independent of `wx`, Page, endpoints, storage, and UI components. Its public surface and exact algorithms are:

```ts
import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';

const businessMonthPattern = /^\d{4}-\d{2}$/u;
const realBusinessMonthPattern = /^(\d{4})-(\d{2})$/u;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const chinaOffsetMilliseconds = 8 * 60 * 60 * 1000;

export interface CalendarGridCell {
  readonly businessDate: string;
}
export type CalendarGridWeek = readonly (CalendarGridCell | null)[];

export interface CalendarAssignmentFilters {
  readonly membershipIds?: readonly string[];
  readonly onlyChanges?: boolean;
  readonly roleIds?: readonly string[];
  readonly shiftTypeIds?: readonly string[];
}

export interface PhoneAction {
  readonly kind: 'copy' | 'dial';
  readonly label: '短号' | '长号';
  readonly number: string;
}

export function parseBusinessMonth(value: string): {
  readonly month: number;
  readonly year: number;
} {
  const match = realBusinessMonthPattern.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (match === null || !Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error('The business month must use a real YYYY-MM value.');
  }
  return { month, year };
}

export function parseBusinessDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const match = businessDatePattern.exec(value);
  if (match === null) throw new Error('The business date must use the YYYY-MM-DD format.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('The business date is not a real calendar date.');
  }
  return { day, month, year };
}

function formatUtcDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getCurrentBusinessDate(now = new Date()): string {
  return formatUtcDate(new Date(now.getTime() + chinaOffsetMilliseconds));
}

export function getCurrentBusinessMonth(now = new Date()): string {
  return getCurrentBusinessDate(now).slice(0, 7);
}

export function addBusinessMonths(businessMonth: string, delta: number): string {
  if (!businessMonthPattern.test(businessMonth) || !Number.isInteger(delta)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const absoluteMonth = Number(yearText) * 12 + (Number(monthText) - 1) + delta;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function getBusinessMonthLabel(businessMonth: string): string {
  if (!businessMonthPattern.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  return `${Number(yearText)}年${Number(monthText)}月`;
}

export function buildMonthGrid(year: number, month: number): readonly CalendarGridWeek[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('The calendar month must be a valid year and 1-12 month.');
  }
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks: (CalendarGridCell | null)[][] = [];
  let week: (CalendarGridCell | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    week.push({
      businessDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function weekdayIndex(businessDate: string): number {
  const { day, month, year } = parseBusinessDate(businessDate);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function getWeekdayLabel(businessDate: string): string {
  return `周${['一', '二', '三', '四', '五', '六', '日'][weekdayIndex(businessDate)]}`;
}

export function isWeekend(businessDate: string): boolean {
  return weekdayIndex(businessDate) >= 5;
}

export function isPastBusinessDate(businessDate: string, today: string): boolean {
  return businessDate < today;
}

export function getDutyMembershipId(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export function getDutyMemberName(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMemberName ?? assignment.plannedMemberName;
}

export function filterCalendarAssignments(
  assignments: readonly CalendarDutyAssignment[],
  filters: CalendarAssignmentFilters,
): CalendarDutyAssignment[] {
  const roleIds = new Set(filters.roleIds ?? []);
  const shiftTypeIds = new Set(filters.shiftTypeIds ?? []);
  const membershipIds = new Set(filters.membershipIds ?? []);
  return assignments.filter((assignment) => {
    if (filters.onlyChanges === true && assignment.changeMarkers.length === 0) return false;
    if (roleIds.size > 0 && !roleIds.has(assignment.scheduleRoleId)) return false;
    if (shiftTypeIds.size > 0 && !shiftTypeIds.has(assignment.shiftTypeId)) return false;
    if (membershipIds.size > 0) {
      const membershipId = getDutyMembershipId(assignment);
      if (membershipId === undefined || !membershipIds.has(membershipId)) return false;
    }
    return true;
  });
}

export function formatChinaStandardTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('The shift time must be a valid instant.');
  const shifted = new Date(date.getTime() + chinaOffsetMilliseconds);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

function getShiftStartOrder(assignment: CalendarDutyAssignment): number {
  const [hours = '0', minutes = '0'] = formatChinaStandardTime(assignment.startsAt).split(':');
  const value = Number(hours) * 60 + Number(minutes);
  return value === 0 ? 24 * 60 : value;
}

export function sortCalendarAssignments(
  assignments: readonly CalendarDutyAssignment[],
): CalendarDutyAssignment[] {
  return assignments
    .map((assignment, sourceIndex) => ({ assignment, sourceIndex }))
    .sort(
      (first, second) =>
        first.assignment.businessDate.localeCompare(second.assignment.businessDate) ||
        getShiftStartOrder(first.assignment) - getShiftStartOrder(second.assignment) ||
        first.assignment.scheduleRoleName.localeCompare(
          second.assignment.scheduleRoleName,
          'zh-Hans-CN',
        ) ||
        first.assignment.slotPosition - second.assignment.slotPosition ||
        first.assignment.schedulePeriodId.localeCompare(second.assignment.schedulePeriodId) ||
        first.sourceIndex - second.sourceIndex,
    )
    .map(({ assignment }) => assignment);
}

export function formatShiftTimeRange(assignment: CalendarDutyAssignment): string {
  return `${formatChinaStandardTime(assignment.startsAt)}–${formatChinaStandardTime(
    assignment.endsAt,
  )}`;
}

export function getCalendarMarkerLabel(marker: CalendarChangeMarker): '加' | '换' | '替' {
  switch (marker) {
    case 'swap':
      return '换';
    case 'leave-cover':
      return '替';
    case 'overtime':
      return '加';
  }
}

export function getCalendarMarkerDescription(marker: CalendarChangeMarker): string {
  switch (marker) {
    case 'swap':
      return '换班';
    case 'leave-cover':
      return '请假替班';
    case 'overtime':
      return '加班';
  }
}

const holidayShortLabels: Readonly<Record<string, string>> = {
  元旦: '元旦',
  除夕: '除夕',
  春节: '春节',
  清明节: '清明',
  劳动节: '五一',
  端午节: '端午',
  中秋节: '中秋',
  国庆节: '国庆',
};

export function getHolidayShortLabel(holidayName: string): string {
  return (
    holidayShortLabels[holidayName] ??
    (holidayName.length <= 4 ? holidayName : holidayName.slice(0, 4))
  );
}

export function getAvailablePhoneActions(
  member: CalendarDutyMember | undefined,
): readonly PhoneAction[] {
  if (member === undefined) return [];
  const kind = member.isConfirmed ? 'dial' : 'copy';
  const actions: PhoneAction[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    actions.push({ kind, label: '长号', number: member.mobilePhone });
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    actions.push({ kind, label: '短号', number: member.shortPhone });
  }
  return actions;
}
```

Run the focused tests. Expected: all calendar-logic tests pass. Compare the port line by line with the audited Web functions. `addBusinessMonths`, `getBusinessMonthLabel`, and `isPastBusinessDate` retain the Web behavior exactly for their accepted inputs; strict `parseBusinessMonth`/`parseBusinessDate` are new boundary validators used before API-to-VM mapping, not silent changes to those Web helpers. Any other deliberate difference must be added as a separately tested behavior change and separate commit; do not label it a refactor.

- [ ] **Step 5: Write `CalendarMonthViewModel` golden/state tests before the mapper**

Create `apps/miniprogram/features/calendar/calendar-view-model.test.ts` using one fixed August 2026 contract fixture with:

- two assignments with fixed IDs `assignment-1`/`assignment-2` on the same day in reverse service order, including a long full name;
- an actual member override on one assignment and a planned-only member on the other;
- all three current marker IDs, one repeated marker to prove action-ID uniqueness;
- confirmed, unconfirmed, and no-number members;
- one confirmed member whose long/short phone values intentionally match, proving phone action identity is assignment/label based rather than number based;
- an off-day holiday and a compensating workday holiday;
- role/shift/member filter options and a filter that removes one assignment.

Add these exact assertions:

```ts
const ready = buildCalendarMonthViewModel({
  calendar,
  filters: {},
  holidays,
  status: 'ready',
  today: '2026-08-15',
});
expect(ready.status).toBe('ready');
if (ready.status !== 'ready') throw new Error('expected ready VM');
expect(ready.businessMonth).toBe('2026-08');
expect(ready.monthLabel).toBe('2026年8月');
expect(ready.weekdayLabels).toEqual(['一', '二', '三', '四', '五', '六', '日']);
expect(ready.isMonthEmpty).toBe(false);
expect(ready.weeks.every((week) => week.days.length === 7)).toBe(true);
expect(ready.weeks[0]?.id).toBe('week:2026-08:0');
expect(ready.weeks[0]?.days[0]).toMatchObject({
  id: 'cell:2026-08:0:0',
  kind: 'padding',
});

const denseCell = ready.weeks
  .flatMap(({ days }) => days)
  .find((day) => day.kind === 'day' && day.businessDate === '2026-08-15');
if (denseCell?.kind !== 'day') throw new Error('expected a real calendar day');
const denseDay = denseCell;
expect(denseDay).toMatchObject({
  id: '2026-08-15',
  kind: 'day',
  dayNumber: 15,
  isEmpty: false,
  isPast: false,
  isToday: true,
  isWeekend: true,
  weekdayLabel: '周六',
});
expect(denseDay?.assignments.map(({ memberName }) => memberName)).toEqual([
  '一位名字很长的值班医生', '实际替班医生',
]);
expect(denseDay?.assignments[0]).toMatchObject({
  borderToken: 'color-border-strong',
  roleName: '门诊',
  shiftTypeAbbreviation: 'A',
  shiftTypeName: '上午班',
  timeRange: '08:00–12:00',
});
expect(denseDay?.assignments.flatMap(({ markers }) => markers).map(({ type }))).toEqual([
  'swap', 'swap', 'leave-cover', 'overtime',
]);
expect(new Set(denseDay?.assignments.flatMap(({ markers }) => markers).map(({ actionId }))).toHaveProperty(
  'size',
  4,
);
expect(denseDay?.assignments.flatMap(({ markers }) => markers)[0]).not.toHaveProperty('eventId');
expect(JSON.stringify(ready)).not.toContain('deduction');
expect(denseDay.assignments.flatMap(({ phoneActions }) => phoneActions)[0]).toMatchObject({
  actionId: 'assignment-1:phone:长号',
  assignmentId: 'assignment-1',
  kind: 'dial',
});
expect(
  new Set(denseDay.assignments.flatMap(({ phoneActions }) => phoneActions).map(({ actionId }) => actionId)),
).toHaveProperty('size', denseDay.assignments.flatMap(({ phoneActions }) => phoneActions).length);

expect(ready.filters.roles[0]).toEqual({ id: '', label: '全部岗位' });
expect(ready.filters.shiftTypes[0]).toEqual({ id: '', label: '全部班种' });
expect(ready.filters.members[0]).toEqual({ id: '', label: '全部成员' });
expect(ready.filters).toMatchObject({
  selectedMembershipIndex: 0,
  selectedRoleIndex: 0,
  selectedShiftTypeIndex: 0,
});

expect(findDay(ready, '2026-08-16')?.holiday).toMatchObject({
  isOffDay: true,
  tone: 'off-day',
});
expect(findDay(ready, '2026-08-17')?.holiday).toMatchObject({
  isWorkday: true,
  tone: 'workday',
});
expect(findDay(ready, '2026-08-01')?.isEmpty).toBe(true);
```

Also assert that each assignment carries the exact contract shift colors, confirmed numbers map to `dial`, unconfirmed numbers map to `copy`, no number maps to `[]`, and a missing member name maps to `待定` using `??`, not truthiness. Assert source `calendar.assignments`, `members`, `roles`, `shiftTypes`, `holidays.dates`, and input filter arrays remain deeply equal after mapping.

Add a status table:

```ts
expect(createCalendarMonthStateViewModel('2026-08', 'loading')).toMatchObject({
  status: 'loading',
});
expect(createCalendarMonthStateViewModel('2026-08', 'error', '网络错误')).toMatchObject({
  message: '网络错误',
  status: 'error',
});
expect(createCalendarMonthStateViewModel('2026-08', 'forbidden')).toMatchObject({
  status: 'forbidden',
});
expect(createCalendarMonthStateViewModel('2026-08', 'conflict')).toMatchObject({
  status: 'conflict',
});
for (const status of ['cached', 'refreshing'] as const) {
  expect(
    buildCalendarMonthViewModel({ calendar, filters: {}, holidays, status, today }),
  ).toMatchObject({
    status,
  });
}
```

Finally, add tests that an assignment whose `businessDate` does not start with `calendar.businessMonth + '-'`, a holiday-year mismatch, and an invalid `today` each throw before a partial VM is returned. Run the suite and expect FAIL because `calendar-view-model.ts` does not exist.

- [ ] **Step 6: Implement the complete renderer-neutral VM mapper**

Create `apps/miniprogram/features/calendar/calendar-view-model.ts`. The renderer-neutral mapper imports only shared contract types and functions/types from `calendar-logic.ts`; it must not import the API client, endpoints, `wx`, Page, storage, or UI components. Define these exact public types:

```ts
import type {
  CalendarChangeMarker,
  CalendarReadModel,
  ConfirmedHolidayDate,
  HolidayReadModel,
} from '@schedule/contracts';
import type { CalendarAssignmentFilters, PhoneAction } from './calendar-logic.js';

export type CalendarDataStatus = 'cached' | 'ready' | 'refreshing';
export type CalendarStateStatus = 'conflict' | 'error' | 'forbidden' | 'loading';
export type CalendarHolidayTone = 'neutral' | 'off-day' | 'workday';

export interface CalendarMarkerViewModel {
  readonly action: 'open-assignment-details';
  readonly actionId: string;
  readonly assignmentId: string;
  readonly borderToken: 'color-danger' | 'color-primary' | 'color-warning';
  readonly description: string;
  readonly fillToken: 'color-danger-light' | 'color-primary-light' | 'color-warning-light';
  readonly foregroundToken: 'color-danger' | 'color-primary' | 'color-warning';
  readonly label: '加' | '换' | '替';
  readonly type: CalendarChangeMarker;
}

export interface CalendarAssignmentViewModel {
  readonly assignmentId: string;
  readonly backgroundColor: string;
  readonly borderToken: 'color-border-strong';
  readonly foregroundColor: string;
  readonly markers: readonly CalendarMarkerViewModel[];
  readonly memberName: string;
  readonly membershipId?: string;
  readonly phoneActions: readonly CalendarPhoneActionViewModel[];
  readonly roleId: string;
  readonly roleName: string;
  readonly schedulePeriodId: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly slotPosition: number;
  readonly timeRange: string;
}

export interface CalendarPhoneActionViewModel extends PhoneAction {
  readonly actionId: string;
  readonly assignmentId: string;
}

export interface CalendarHolidayViewModel {
  readonly borderToken: 'color-border' | 'color-danger' | 'color-warning';
  readonly description: string;
  readonly fillToken: 'color-danger-light' | 'color-surface' | 'color-warning-light';
  readonly foregroundToken: 'color-danger' | 'color-text-muted' | 'color-warning';
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
  readonly label: string;
  readonly tone: CalendarHolidayTone;
}

export interface CalendarDayViewModel {
  readonly assignments: readonly CalendarAssignmentViewModel[];
  readonly businessDate: string;
  readonly dayNumber: number;
  readonly holiday?: CalendarHolidayViewModel;
  readonly id: string;
  readonly isEmpty: boolean;
  readonly isPast: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly kind: 'day';
  readonly weekdayLabel: string;
}

export interface CalendarPaddingDayViewModel {
  readonly id: string;
  readonly kind: 'padding';
}

export type CalendarDayCellViewModel = CalendarDayViewModel | CalendarPaddingDayViewModel;

export interface CalendarWeekViewModel {
  readonly days: readonly CalendarDayCellViewModel[];
  readonly id: string;
}

export interface CalendarFilterOption {
  readonly id: string;
  readonly label: string;
}
export interface CalendarFilterViewModel {
  readonly members: readonly CalendarFilterOption[];
  readonly onlyChanges: boolean;
  readonly roles: readonly CalendarFilterOption[];
  readonly selectedMembershipIds: readonly string[];
  readonly selectedMembershipIndex: number;
  readonly selectedRoleIds: readonly string[];
  readonly selectedRoleIndex: number;
  readonly selectedShiftTypeIds: readonly string[];
  readonly selectedShiftTypeIndex: number;
  readonly shiftTypes: readonly CalendarFilterOption[];
}

interface CalendarMonthBaseViewModel {
  readonly businessMonth: string;
  readonly monthLabel: string;
}

export interface CalendarMonthStateViewModel extends CalendarMonthBaseViewModel {
  readonly message: string;
  readonly status: CalendarStateStatus;
}

export interface CalendarMonthDataViewModel extends CalendarMonthBaseViewModel {
  readonly assignmentCount: number;
  readonly filters: CalendarFilterViewModel;
  readonly isMonthEmpty: boolean;
  readonly status: CalendarDataStatus;
  readonly weekdayLabels: readonly ['一', '二', '三', '四', '五', '六', '日'];
  readonly weeks: readonly CalendarWeekViewModel[];
}

export type CalendarMonthViewModel = CalendarMonthDataViewModel | CalendarMonthStateViewModel;
```

Implement `createCalendarMonthStateViewModel(businessMonth, status, message?)` so it validates the month and supplies these defaults: loading `正在加载排班`, forbidden `无权查看该群组排班`, conflict `排班数据已变化，请刷新`, error `加载排班失败，请重试`. An explicit non-empty message overrides the default; `''` does not.

Implement `buildCalendarMonthViewModel(input)` with input `{ calendar, filters, holidays, status, today }`, where status is `CalendarDataStatus`. Use this exact mapping sequence:

1. Parse `calendar.businessMonth` and `today`; throw if either is invalid. Do not require `today` to belong to the rendered month because past/future months still need a real current-date comparison. Enforce `holidays.year === parsed calendar year` and ensure every rendered grid date belongs to `calendar.businessMonth`.
2. Copy/filter/sort assignments via `filterCalendarAssignments` then `sortCalendarAssignments`; never sort a contract array in place.
3. Group sorted assignments by `businessDate` while preserving their sorted order. Build member and holiday maps by `membershipId` and `date` respectively.
4. Build the Monday-first grid without nullable cells. Every week gets `id = 'week:' + businessMonth + ':' + weekIndex`; every padding cell gets `id = 'cell:' + businessMonth + ':' + weekIndex + ':' + cellIndex` and `kind: 'padding'`; every real cell gets `id = businessDate`, `kind: 'day'`, and the full `CalendarDayViewModel`. `isEmpty` reflects the filtered display array, not the server month globally.
5. Map effective identity with `actualMembershipId ?? plannedMembershipId` and `actualMemberName ?? plannedMemberName ?? '待定'`. Find phone data by effective membership ID only.
6. Copy `shiftTypeColor` to `backgroundColor`, `shiftTypeTextColor` to `foregroundColor`, all full role/shift/member names, IDs, slot, period, and formatted CST time range.
7. Map each marker with `actionId = assignment.id + ':marker:' + marker + ':' + markerIndex`. Map each phone action with `actionId = assignment.id + ':phone:' + action.label`, retain `assignmentId`, and never use the number as UI identity because two actions may share a number. Use `swap` primary tokens, `leave-cover` danger tokens, and `overtime` warning tokens. The marker action is assignment details because the contract has no event ID. Do not add an `eventId`, permission boolean, `deduction`, or synthesized backend identity.
8. Map holiday tone with off-day precedence, then workday, then neutral. Preserve both booleans and name; use the short-label helper. Token triples are danger/danger-light/danger, warning/warning-light/warning, or text-muted/surface/border.
9. Prepend exact UI sentinels `{ id: '', label: '全部岗位' }`, `{ id: '', label: '全部班种' }`, and `{ id: '', label: '全部成员' }` to copied contract options. Compute each selected picker index as `0` for an empty selection or the matching real-option index plus one; reject or normalize a selected ID absent from the current options back to `0` without mutating input. Copy selected filter arrays with spread syntax and boolean-normalize only with `filters.onlyChanges === true`.
10. `assignmentCount` is the filtered count; `isMonthEmpty` is `assignmentCount === 0`; status remains the caller’s exact `ready`, `cached`, or `refreshing` value.

The VM module must contain small exhaustive mapping helpers for marker token triples and holiday tone. Use a `never` exhaustiveness assignment only after the `switch`; do not cast a string to a marker union. Run the VM tests and expect all cases to pass.

- [ ] **Step 7: Start the controller test boundary with failure-state classification**

Create `apps/miniprogram/features/calendar/calendar-page-controller.test.ts` and begin it with imports for `ApiClientError`, Vitest, current contract types, and `getCalendarFailureState` from the not-yet-created controller. Add this pure test before any production controller code:

```ts
it('classifies forbidden before conflict using code or status', () => {
  expect(
    getCalendarFailureState(new ApiClientError('FORBIDDEN', 'denied', 'req', undefined, 403)),
  ).toBe('forbidden');
  expect(
    getCalendarFailureState(new ApiClientError('OTHER', 'denied by status', 'req', undefined, 403)),
  ).toBe('forbidden');
  expect(
    getCalendarFailureState(
      new ApiClientError('FORBIDDEN', 'denied by code', 'req', undefined, 500),
    ),
  ).toBe('forbidden');
  expect(
    getCalendarFailureState(
      new ApiClientError('FORBIDDEN', 'forbidden wins', 'req', undefined, 409),
    ),
  ).toBe('forbidden');
  expect(
    getCalendarFailureState(
      new ApiClientError('CONFLICT', 'forbidden status wins', 'req', undefined, 403),
    ),
  ).toBe('forbidden');
  expect(
    getCalendarFailureState(new ApiClientError('CONFLICT', 'changed', 'req', undefined, 409)),
  ).toBe('conflict');
  expect(
    getCalendarFailureState(
      new ApiClientError('OTHER', 'changed by status', 'req', undefined, 409),
    ),
  ).toBe('conflict');
  expect(getCalendarFailureState(new Error('offline'))).toBe('error');
});
```

Run `pnpm vitest run apps/miniprogram/features/calendar/calendar-page-controller.test.ts`. Expected: FAIL because `calendar-page-controller.ts` does not exist. The future controller classifier must narrow with `instanceof ApiClientError`; forbidden wins when code is `FORBIDDEN` or status is `403`, conflict follows when code is `CONFLICT` or status is `409`, and everything else is `error`. It must not inspect arbitrary object properties or swallow the original page-visible message.

- [ ] **Step 8: Write calendar page-controller tests before network/page orchestration**

Continue the same `apps/miniprogram/features/calendar/calendar-page-controller.test.ts`. Build a `createHarness()` whose dependencies are all `vi.fn` ports and whose fixed `calendar`, `guestCalendar = { calendar, groupName: '一病区' }`, and `holidays` fixtures satisfy the current shared contracts. Add these exact red tests below the classifier table:

```ts
it('single-flights and caches one owner/member load with protected endpoints only', async () => {
  const harness = createHarness();
  const target = { businessMonth: '2026-08', groupId: 'group-1', groupRole: 'owner' } as const;
  const first = harness.controller.load(target);
  const second = harness.controller.load(target);
  expect(first).toBe(second);
  await first;
  await harness.controller.load(target);
  expect(harness.getCalendar).toHaveBeenCalledTimes(1);
  expect(harness.getCalendar).toHaveBeenCalledWith('group-1', '2026-08');
  expect(harness.getHolidays).toHaveBeenCalledTimes(1);
  expect(harness.getHolidays).toHaveBeenCalledWith(2026);
  expect(harness.getLoggedInGuestCalendar).not.toHaveBeenCalled();
  expect(harness.getGuestHolidays).not.toHaveBeenCalled();
});

it('uses only the existing logged-in guest calendar and guest holiday endpoints for guest', async () => {
  const harness = createHarness();
  await harness.controller.load({
    businessMonth: '2026-08',
    groupId: 'guest-group',
    groupRole: 'guest',
  });
  expect(harness.getLoggedInGuestCalendar).toHaveBeenCalledTimes(1);
  expect(harness.getLoggedInGuestCalendar).toHaveBeenCalledWith('guest-group', '2026-08');
  expect(harness.getGuestHolidays).toHaveBeenCalledTimes(1);
  expect(harness.getGuestHolidays).toHaveBeenCalledWith(2026);
  expect(harness.getCalendar).not.toHaveBeenCalled();
  expect(harness.getHolidays).not.toHaveBeenCalled();
  expect(lastPublishedDataViewModel(harness.publish).businessMonth).toBe('2026-08');
});

it('single-flights a forced same-key retry and runs one additional endpoint pair', async () => {
  const harness = createHarness();
  const target = { businessMonth: '2026-08', groupId: 'group-1', groupRole: 'member' } as const;
  await harness.controller.load(target);
  const firstRetry = harness.controller.load(target, true);
  const secondRetry = harness.controller.load(target, true);
  expect(firstRetry).toBe(secondRetry);
  await firstRetry;
  expect(harness.getCalendar).toHaveBeenCalledTimes(2);
  expect(harness.getHolidays).toHaveBeenCalledTimes(2);
});

it('ignores a stale prior-month completion and does not let its finally clear the newer slot', async () => {
  const augustCalendar = createDeferred<CalendarReadModel>();
  const septemberCalendar = createDeferred<CalendarReadModel>();
  const augustHolidays = createDeferred<HolidayReadModel>();
  const septemberHolidays = createDeferred<HolidayReadModel>();
  const harness = createHarness({
    getCalendar: vi
      .fn()
      .mockReturnValueOnce(augustCalendar.promise)
      .mockReturnValueOnce(septemberCalendar.promise),
    getHolidays: vi
      .fn()
      .mockReturnValueOnce(augustHolidays.promise)
      .mockReturnValueOnce(septemberHolidays.promise),
  });
  const august = harness.controller.load({
    businessMonth: '2026-08',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const september = harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  augustCalendar.resolve(calendar);
  augustHolidays.resolve(holidays);
  await august;
  const duplicateSeptember = harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  expect(duplicateSeptember).toBe(september);
  expect(harness.getCalendar).toHaveBeenCalledTimes(2);
  septemberCalendar.resolve(septemberFixture);
  septemberHolidays.resolve(septemberHolidayFixture);
  await september;
  expect(lastPublishedDataViewModel(harness.publish).businessMonth).toBe('2026-09');
  await harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  expect(harness.getCalendar).toHaveBeenCalledTimes(2);
});

it('does not return an old cached month while another context is loading', async () => {
  const septemberCalendar = createDeferred<CalendarReadModel>();
  const augustReturnCalendar = createDeferred<CalendarReadModel>();
  const harness = createHarness({
    getCalendar: vi
      .fn()
      .mockResolvedValueOnce(calendar)
      .mockReturnValueOnce(septemberCalendar.promise)
      .mockReturnValueOnce(augustReturnCalendar.promise),
  });
  const augustTarget = {
    businessMonth: '2026-08',
    groupId: 'group-1',
    groupRole: 'member',
  } as const;
  await harness.controller.load(augustTarget);
  const september = harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const augustReturn = harness.controller.load(augustTarget);
  expect(harness.getCalendar).toHaveBeenCalledTimes(3);
  augustReturnCalendar.resolve(calendar);
  await augustReturn;
  septemberCalendar.resolve(septemberFixture);
  await september;
  expect(lastPublishedDataViewModel(harness.publish).businessMonth).toBe('2026-08');
});

it('rebuilds filters locally without mutating source or adding endpoint calls', async () => {
  const harness = createHarness();
  await harness.controller.load({
    businessMonth: '2026-08',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const sourceAssignmentIds = calendar.assignments.map(({ id }) => id);
  const sourceMemberIds = calendar.members.map(({ membershipId }) => membershipId);
  harness.controller.setFilters({ roleIds: ['role-1'], onlyChanges: true });
  expect(harness.getCalendar).toHaveBeenCalledTimes(1);
  expect(harness.getHolidays).toHaveBeenCalledTimes(1);
  expect(calendar.assignments.map(({ id }) => id)).toEqual(sourceAssignmentIds);
  expect(calendar.members.map(({ membershipId }) => membershipId)).toEqual(sourceMemberIds);
  expect(lastPublishedDataViewModel(harness.publish).filters.selectedRoleIndex).toBe(1);
});

it('invalidates old source and phone actions while a new context loads or fails', async () => {
  const septemberCalendar = createDeferred<CalendarReadModel>();
  const harness = createHarness({
    getCalendar: vi
      .fn(() => Promise.resolve(calendar))
      .mockResolvedValueOnce(calendar)
      .mockReturnValueOnce(septemberCalendar.promise),
  });
  await harness.controller.load({
    businessMonth: '2026-08',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const oldAction = firstPhoneAction(lastPublishedDataViewModel(harness.publish));
  const september = harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const publishCountWhileLoading = harness.publish.mock.calls.length;
  expect(harness.controller.performPhoneAction(oldAction.actionId)).toBe(false);
  harness.controller.setFilters({ onlyChanges: true });
  expect(harness.publish).toHaveBeenCalledTimes(publishCountWhileLoading);
  septemberCalendar.reject(new Error('september unavailable'));
  await september;
  const publishCountAfterFailure = harness.publish.mock.calls.length;
  harness.controller.setFilters({ roleIds: ['role-1'] });
  expect(harness.publish).toHaveBeenCalledTimes(publishCountAfterFailure);
  expect(harness.controller.performPhoneAction(oldAction.actionId)).toBe(false);
  await harness.controller.load({
    businessMonth: '2026-09',
    groupId: 'group-1',
    groupRole: 'member',
  });
  expect(harness.getCalendar).toHaveBeenCalledTimes(3);
});

it('looks up a typed phone action and invokes exactly one matching wx port', async () => {
  const harness = createHarness();
  await harness.controller.load({
    businessMonth: '2026-08',
    groupId: 'group-1',
    groupRole: 'member',
  });
  const ready = lastPublishedDataViewModel(harness.publish);
  const actions = ready.weeks
    .flatMap(({ days }) => days)
    .flatMap((day) => (day.kind === 'day' ? day.assignments : []))
    .flatMap(({ phoneActions }) => phoneActions);
  const dial = actions.find(({ kind }) => kind === 'dial');
  const copy = actions.find(({ kind }) => kind === 'copy');
  if (dial === undefined || copy === undefined) throw new Error('phone fixtures are incomplete');
  expect(harness.controller.performPhoneAction(dial.actionId)).toBe(true);
  expect(harness.controller.performPhoneAction(copy.actionId)).toBe(true);
  expect(harness.controller.performPhoneAction('unknown')).toBe(false);
  expect(harness.makePhoneCall).toHaveBeenCalledTimes(1);
  expect(harness.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: dial.number });
  expect(harness.setClipboardData).toHaveBeenCalledTimes(1);
  expect(harness.setClipboardData).toHaveBeenCalledWith({ data: copy.number });
});

it.each([
  [new ApiClientError('FORBIDDEN', 'denied', undefined, undefined, 403), 'forbidden'],
  [new ApiClientError('CONFLICT', 'changed', undefined, undefined, 409), 'conflict'],
  [new Error('offline'), 'error'],
] as const)('publishes %s without swallowing its message', async (error, status) => {
  const harness = createHarness({ getCalendar: vi.fn(() => Promise.reject(error)) });
  await expect(
    harness.controller.load({ businessMonth: '2026-08', groupId: 'group-1', groupRole: 'owner' }),
  ).resolves.toBeUndefined();
  expect(harness.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: error.message, status }),
  );
});

it.each([
  ['0', 3, 0],
  ['1', 3, 1],
  ['', 3, undefined],
  [1, 3, undefined],
  ['-1', 3, undefined],
  ['1.5', 3, undefined],
  ['3', 3, undefined],
  ['0', 0, undefined],
  ['0', 1.5, undefined],
  [[1], 3, undefined],
] as const)('narrows selector picker value %j', (value, optionCount, expected) => {
  expect(parseSelectorPickerIndex(value, optionCount)).toBe(expected);
});
```

The helpers `lastPublishedDataViewModel` and `firstPhoneAction` must narrow `CalendarMonthViewModel.status`/`CalendarDayCellViewModel.kind` before reading data fields; neither may cast. The owner/member test proves the ordinary protected route, and the guest test proves the already-existing `getLoggedInGuestCalendar(...).calendar` plus `getGuestHolidays` route. These endpoint pairs are mutually exclusive. Do not call the protected `getCalendar`/`getHolidays` pair for a guest and do not add an endpoint.

- [ ] **Step 9: Run controller tests and observe the planned failure**

Run:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-page-controller.test.ts
```

Expected: FAIL because `calendar-page-controller.ts` does not exist. A fixture/type failure is not the intended red state.

- [ ] **Step 10: Implement the injected calendar page controller**

Create `apps/miniprogram/features/calendar/calendar-page-controller.ts`. Use only current contract types, the pure calendar logic/VM, and injected ports. Its public boundary is exactly:

```ts
import type {
  CalendarReadModel,
  GroupRole,
  GuestCalendarReadModel,
  HolidayReadModel,
} from '@schedule/contracts';
import { ApiClientError } from '../../api/client.js';
import type { CalendarAssignmentFilters } from './calendar-logic.js';
import type { CalendarMonthViewModel } from './calendar-view-model.js';

export type CalendarFailureStatus = 'conflict' | 'error' | 'forbidden';

export interface CalendarLoadTarget {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly groupRole: GroupRole;
}

export interface CalendarPageControllerDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  getToday(): string;
  makePhoneCall(options: { readonly phoneNumber: string }): void;
  publish(viewModel: CalendarMonthViewModel): void;
  setClipboardData(options: { readonly data: string }): void;
}

export interface CalendarPageController {
  load(target: CalendarLoadTarget, force?: boolean): Promise<void>;
  performPhoneAction(actionId: string): boolean;
  setFilters(filters: CalendarAssignmentFilters): void;
}

export function parseSelectorPickerIndex(value: unknown, optionCount: number): number | undefined;
export function getCalendarFailureState(error: unknown): CalendarFailureStatus;
export function createCalendarPageController(
  dependencies: CalendarPageControllerDependencies,
): CalendarPageController;
```

Implement these exact semantics:

1. Keep private `filters`, `latestCalendar`, `latestHolidays`, `latestViewModel`, `currentContextKey`, `lastSuccessfulKey`, numeric `requestGeneration`, and `inFlight?: { key: string; promise: Promise<void> }`. No storage or persistent cache is introduced.
2. `getCalendarFailureState` uses only `error instanceof ApiClientError`; code `FORBIDDEN` or status `403` returns `forbidden`, then code `CONFLICT` or status `409` returns `conflict`, otherwise `error`. The forbidden predicate has precedence when code/status disagree.
3. `parseSelectorPickerIndex` accepts only a base-10 integer string whose numeric value is `>= 0` and `< optionCount`; reject arrays, numbers, empty strings, negatives, fractions, invalid `optionCount`, and out-of-range values with `undefined`.
4. `load` is not `async`. Build `key = groupId + ':' + groupRole + ':' + businessMonth`. Return the exact current Promise when the same key is already in flight. Return `Promise.resolve()` without an endpoint call only when `force !== true`, `key === currentContextKey`, `key === lastSuccessfulKey`, `latestCalendar`/`latestHolidays` are defined, and `latestViewModel` is a data status. A request for a different key always advances the context/generation before any cache decision.
5. Before a real load, increment `requestGeneration`, clear `lastSuccessfulKey`, and, when `key !== currentContextKey`, reset copied filters to `{}` and set `currentContextKey = key`. For both a new context and a forced retry, set `latestCalendar`/`latestHolidays` to `undefined`, replace `latestViewModel` with the loading VM, and publish that loading VM once. This invalidates all old phone actions, ensures a failed force refresh is reloadable from `onShow`, and prevents `setFilters` from rebuilding stale source while loading or after a failure.
6. Parse the real business month and select exactly one endpoint pair: guest calls `getLoggedInGuestCalendar(groupId, month)` and `getGuestHolidays(year)`; owner/administrator/member call `getCalendar(groupId, month)` and `getHolidays(year)`. Unwrap only the current guest response’s `.calendar`.
7. On success, first check the captured generation. Only the current request stores source, builds/publishes `ready`, updates `latestViewModel`, and records `lastSuccessfulKey`. On rejection, only the current request builds the classified state with `error instanceof Error ? error.message : undefined`, stores it as `latestViewModel`, and publishes it; the public Promise resolves after publishing so event handlers do not float rejections.
8. In `.finally()`, clear `inFlight` only when it still contains the exact Promise. A stale completion/finally cannot publish or erase the newer request slot.
9. `setFilters` copies input arrays and makes zero endpoint calls. It rebuilds/publishes exactly once only when `latestCalendar` and `latestHolidays` both belong to `currentContextKey`; while loading or after failure it stores the copied filters but publishes nothing.
10. `performPhoneAction` searches `latestViewModel` only after narrowing to a data status, then finds the exact `actionId`. `dial` calls `dependencies.makePhoneCall({ phoneNumber })` once; `copy` calls `dependencies.setClipboardData({ data: number })` once; an empty, missing, stale-context, or unknown ID returns `false` and calls neither. Never trust `kind` or `number` from a WXML dataset.

Run the controller suite again. Expected: all cases pass. Then run the logic and VM suites together; all must remain green.

- [ ] **Step 11: Add and run the static VM-consumption guard before page changes**

Create `scripts/miniprogram-calendar-boundary.test.mjs` with this complete content:

```js
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(repositoryRoot, 'apps', 'miniprogram');

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('mini-program calendar VM boundary', () => {
  it('renders only view-model fields and keeps Skyline page-level', () => {
    const wxml = readText('pages/calendar/index.wxml');
    const page = readText('pages/calendar/index.ts');
    const wxss = readText('pages/calendar/index.wxss');
    expect(wxml).toContain('viewModel.');
    expect(wxml).not.toMatch(
      /actualMemberName|plannedMemberName|changeMarkers|shiftTypeColor|shiftTypeTextColor/gu,
    );
    expect(page).toContain('createCalendarPageController');
    expect(page).not.toMatch(/Promise\.all|requestGeneration|lastSuccessfulKey|inFlight/gu);
    expect(readText('pages/calendar/index.json')).toMatch(/"renderer"\s*:\s*"skyline"/u);
    expect(readText('pages/calendar/index.json')).not.toContain('t-calendar');
    expect(wxml).not.toMatch(/enhanced=|show-scrollbar=/gu);
    expect(wxss).toContain('.calendar-page__toolbar');
    expect(wxss).toContain('display: flex');
    expect(wxss).toContain('display: block');
    expect(wxss).toContain(':active');
    expect(wxss).not.toMatch(/constant\(|display:\s*grid|place-items|:focus/gu);
  });

  it('does not synthesize unsupported event or marker contract fields', () => {
    expect(readText('features/calendar/calendar-view-model.ts')).not.toMatch(/eventId|deduction/gu);
  });
});
```

Run now:

```powershell
pnpm vitest run scripts/miniprogram-calendar-boundary.test.mjs
```

Expected: FAIL because the Task 3 placeholder page has no `viewModel.`/controller delegation. This is the intended page-boundary red state. If a comment creates a false positive, remove the unnecessary comment rather than weakening the semantic guard.

- [ ] **Step 12: Wire the typed page and WXML only through the tested controller**

Replace `apps/miniprogram/pages/calendar/index.ts`. Define explicit `CalendarPageData` and `CalendarPageMethods` interfaces and register `Page<CalendarPageData, CalendarPageMethods>`, with `viewModel: CalendarMonthViewModel` so the initial loading branch does not narrow the Page data type permanently. The page imports existing endpoint functions only to inject member-call wrappers into `createCalendarPageController`; it contains no network Promise orchestration.

Use these exact members and event types:

```ts
interface CalendarPageData {
  readonly businessMonth: string;
  readonly hasActiveGroup: boolean;
  readonly renderer: string;
  readonly viewModel: CalendarMonthViewModel;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type PhoneActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;

interface CalendarPageMethods {
  controller?: CalendarPageController;
  applyPicker(kind: 'member' | 'role' | 'shift', event: PickerEvent): void;
  handleMemberFilter(event: PickerEvent): void;
  handleNextMonth(): void;
  handleOnlyChanges(event: WechatMiniprogram.SwitchChange): void;
  handlePhoneAction(event: PhoneActionEvent): void;
  handlePreviousMonth(): void;
  handleRetry(): void;
  handleRoleFilter(event: PickerEvent): void;
  handleShiftFilter(event: PickerEvent): void;
  loadMonth(force?: boolean): void;
}
```

Implement these exact page rules:

- `onLoad` records `this.renderer` and creates one controller. Inject endpoints with arrows that preserve the original member call (`getCalendar(groupId, month)`, `getLoggedInGuestCalendar(groupId, month)`, `getHolidays(year)`, `getGuestHolidays(year)`), `getToday: () => getCurrentBusinessDate()`, `makePhoneCall: (options) => wx.makePhoneCall(options)`, `setClipboardData: (options) => wx.setClipboardData(options)`, and `publish: (viewModel) => this.setData({ viewModel })`.
- `onShow` requires authenticated session and finds `activeGroupId` in `state.groups`. Otherwise call `navigateForCurrentSession` or set `hasActiveGroup: false` with visible `暂无可用群组`; do not guess a role. With a group, set `hasActiveGroup: true` and call `loadMonth()`; controller success-key caching prevents duplicate same-context calls.
- `loadMonth(force = false)` obtains the current group again and calls `void this.controller?.load({ businessMonth: this.data.businessMonth, groupId: group.id, groupRole: group.role }, force)`. The controller owns terminal error publication, so this produces no floating rejection.
- Previous/next handlers call the Web-equivalent `addBusinessMonths`, update `businessMonth`, then invoke `loadMonth` from the `setData` completion callback. The controller detects the new context, resets filters, invalidates old source/actions, and publishes loading exactly once. No swiper or Worklet is added.
- `applyPicker` passes `event.detail.value` as `unknown` to `parseSelectorPickerIndex(value, options.length)`. Index `0` maps to an empty selected array; a valid nonzero index maps to the sentinel-adjusted option ID; invalid/array/negative/fraction/out-of-range values are no-ops. The three named handlers call it with the correct option list. `handleOnlyChanges` accepts only `typeof event.detail.value === 'boolean'` and rebuilds locally. None of these handlers calls an endpoint.
- `handleRetry` calls `loadMonth(true)`; repeated taps while the same key is in flight receive the controller’s exact existing Promise and cannot duplicate calls.
- `handlePhoneAction` narrows only `dataset.actionId` to a non-empty string and calls `controller.performPhoneAction(actionId)`. WXML never supplies `kind` or `number`, so a dataset cannot select an unverified side effect.

Replace `apps/miniprogram/pages/calendar/index.wxml` with this complete VM-only foundation:

```xml
<page-shell title="排班日历">
  <view class="calendar-page">
    <shell-state
      wx:if="{{!hasActiveGroup}}"
      kind="empty"
      title="暂无可用群组"
      description="请先加入或选择一个群组。"
    />
    <shell-state
      wx:elif="{{viewModel.status === 'loading'}}"
      kind="loading"
      title="正在加载排班"
    />
    <view wx:else class="calendar-page__body">
      <shell-state
        wx:if="{{viewModel.status === 'forbidden'}}"
        kind="forbidden"
        title="无权查看该群组排班"
        description="请联系群组管理员确认权限。"
      />
      <shell-state
        wx:elif="{{viewModel.status === 'error'}}"
        kind="error"
        title="加载排班失败"
        description="{{viewModel.message}}"
      >
        <button class="calendar-page__retry" bindtap="handleRetry">重试</button>
      </shell-state>
      <shell-state
        wx:elif="{{viewModel.status === 'conflict'}}"
        kind="conflict"
        title="排班数据已变化"
        description="{{viewModel.message}}"
      >
        <button class="calendar-page__retry" bindtap="handleRetry">刷新</button>
      </shell-state>
      <view wx:else class="calendar-page__data">
        <view class="calendar-page__toolbar">
          <button class="calendar-page__month-action" bindtap="handlePreviousMonth">上月</button>
          <text class="calendar-page__month-label">{{viewModel.monthLabel}}</text>
          <button class="calendar-page__month-action" bindtap="handleNextMonth">下月</button>
        </view>
        <view class="calendar-page__filters">
          <picker range="{{viewModel.filters.roles}}" range-key="label" value="{{viewModel.filters.selectedRoleIndex}}" bindchange="handleRoleFilter">
            <view class="calendar-page__picker">岗位</view>
          </picker>
          <picker range="{{viewModel.filters.shiftTypes}}" range-key="label" value="{{viewModel.filters.selectedShiftTypeIndex}}" bindchange="handleShiftFilter">
            <view class="calendar-page__picker">班种</view>
          </picker>
          <picker range="{{viewModel.filters.members}}" range-key="label" value="{{viewModel.filters.selectedMembershipIndex}}" bindchange="handleMemberFilter">
            <view class="calendar-page__picker">成员</view>
          </picker>
          <label class="calendar-page__switch-label">
            <text>仅变更</text>
            <switch checked="{{viewModel.filters.onlyChanges}}" bindchange="handleOnlyChanges" />
          </label>
        </view>
        <text class="calendar-page__summary">{{viewModel.assignmentCount}} 个班次</text>
        <view wx:if="{{viewModel.isMonthEmpty}}" class="calendar-page__empty">本月暂无符合条件的班次。</view>
        <view wx:else class="calendar-page__weeks">
          <view wx:for="{{viewModel.weeks}}" wx:for-item="week" wx:key="id" class="calendar-week">
            <view wx:for="{{week.days}}" wx:for-item="day" wx:key="id" class="calendar-day">
              <view wx:if="{{day.kind === 'padding'}}" class="calendar-day__padding"></view>
              <view wx:else class="calendar-day__content">
                <view class="calendar-day__header">
                  <text>{{day.dayNumber}} {{day.weekdayLabel}}</text>
                  <text wx:if="{{day.holiday}}" class="calendar-day__holiday">{{day.holiday.label}}</text>
                </view>
                <view wx:for="{{day.assignments}}" wx:for-item="assignment" wx:key="assignmentId" class="calendar-assignment">
                  <text class="calendar-assignment__member">{{assignment.memberName}}</text>
                  <text>{{assignment.roleName}} · {{assignment.shiftTypeName}}（{{assignment.shiftTypeAbbreviation}}）</text>
                  <text>{{assignment.timeRange}}</text>
                  <view class="calendar-assignment__markers">
                    <text wx:for="{{assignment.markers}}" wx:for-item="marker" wx:key="actionId" class="calendar-marker" data-action-id="{{marker.actionId}}">{{marker.label}}</text>
                  </view>
                  <view wx:if="{{assignment.phoneActions.length > 0}}" class="calendar-assignment__phones">
                    <button wx:for="{{assignment.phoneActions}}" wx:for-item="phoneAction" wx:key="actionId" class="calendar-assignment__phone" data-action-id="{{phoneAction.actionId}}" bindtap="handlePhoneAction">{{phoneAction.label}}</button>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</page-shell>
```

Use only stable VM keys: `week.id`, `day.id`, `assignment.assignmentId`, `marker.actionId`, and `phoneAction.actionId`. Padding branches on `day.kind === 'padding'`; real-day fields are referenced only in the `day` branch. Do not use an array index, phone number, nullable business date, or WXML-composed identity. Marker badges have no tap binding in Task 5 and must not claim event routing.

Replace `apps/miniprogram/pages/calendar/index.wxss` with these supported explicit block/flex boundaries; use `:active`, not unsupported `:focus`, and do not add grid, `place-items`, `constant()`, or an enhanced scroll-view property:

```css
@import '../../tokens/index.wxss';

.calendar-page,
.calendar-page__body,
.calendar-page__data,
.calendar-page__weeks,
.calendar-week,
.calendar-day,
.calendar-day__content,
.calendar-assignment {
  display: block;
}

.calendar-page__toolbar,
.calendar-page__filters,
.calendar-page__switch-label,
.calendar-day__header,
.calendar-assignment__markers,
.calendar-assignment__phones {
  display: flex;
}

.calendar-page__toolbar,
.calendar-day__header {
  align-items: center;
  justify-content: space-between;
}

.calendar-page__toolbar {
  min-height: var(--v3-touch-min);
  margin-bottom: var(--v3-space-md);
}

.calendar-page__month-action,
.calendar-page__retry,
.calendar-assignment__phone {
  min-height: var(--v3-touch-min);
  padding: 0 var(--v3-space-sm);
  color: var(--v3-color-primary);
  background: var(--v3-color-surface);
  border: 1rpx solid var(--v3-color-border);
  border-radius: var(--v3-radius-md);
}

.calendar-page__month-action:active,
.calendar-page__retry:active,
.calendar-assignment__phone:active {
  opacity: 0.72;
}

.calendar-page__month-label,
.calendar-assignment__member {
  color: var(--v3-color-text);
  font-weight: 700;
}

.calendar-page__filters {
  flex-wrap: wrap;
  gap: var(--v3-space-sm);
  margin-bottom: var(--v3-space-sm);
}

.calendar-page__picker,
.calendar-page__switch-label {
  min-height: var(--v3-touch-min);
  padding: 0 var(--v3-space-sm);
  align-items: center;
  color: var(--v3-color-text);
  background: var(--v3-color-surface);
  border: 1rpx solid var(--v3-color-border);
  border-radius: var(--v3-radius-md);
}

.calendar-page__switch-label {
  gap: var(--v3-space-xs);
}

.calendar-page__summary,
.calendar-page__empty {
  display: block;
  margin-bottom: var(--v3-space-sm);
  color: var(--v3-color-text-muted);
}

.calendar-week {
  margin-bottom: var(--v3-space-sm);
  border: 1rpx solid var(--v3-color-border);
  border-radius: var(--v3-radius-md);
  background: var(--v3-color-surface);
}

.calendar-day {
  min-height: 72rpx;
  border-bottom: 1rpx solid var(--v3-color-border);
}

.calendar-day:last-child {
  border-bottom: 0;
}

.calendar-day__padding {
  display: block;
  min-height: 72rpx;
  background: var(--v3-color-background);
}

.calendar-day__content,
.calendar-assignment {
  padding: var(--v3-space-sm);
}

.calendar-day__holiday,
.calendar-marker {
  padding: 2rpx var(--v3-space-xs);
  color: var(--v3-color-warning);
  background: var(--v3-color-surface);
  border: 1rpx solid var(--v3-color-border);
  border-radius: var(--v3-radius-sm);
}

.calendar-assignment {
  margin-top: var(--v3-space-xs);
  border-left: 6rpx solid var(--v3-color-primary);
}

.calendar-assignment text {
  display: block;
  color: var(--v3-color-text);
  white-space: normal;
}

.calendar-assignment__markers,
.calendar-assignment__phones {
  flex-wrap: wrap;
  gap: var(--v3-space-xs);
  margin-top: var(--v3-space-xs);
}
```

Task 5’s list is an inspectable foundation, not the V3-2 final grid. Do not register or render `t-calendar`: the current official TDesign Calendar page declares WebView rendering support, while this page is the recorded Skyline page.

- [ ] **Step 13: Rerun the page boundary and focused calendar tests**

Run:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts scripts/miniprogram-calendar-boundary.test.mjs
```

Expected: all four files pass. The static guard now proves controller delegation, VM-only WXML, page-level Skyline, and absence of unsupported marker fields in production VM code.

- [ ] **Step 14: Run focused and full mini-program automated validation**

Run:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/features/calendar/calendar-logic.ts apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/pages/calendar/index.ts scripts/miniprogram-calendar-boundary.test.mjs
git diff --check
```

Expected: every named and full mini-program suite passes; config audit, typecheck, lint, Prettier, and diff checks exit `0`. Record literal file/test totals rather than relying on a planned number. Confirm with `git diff -- packages/contracts/src apps/miniprogram/api/endpoints.ts` that both are empty.

- [ ] **Step 15: Compile in DevTools and run the calendar simulator smoke**

Run the tracked commands established by Task 3:

```powershell
pnpm miniprogram:devtools:build-npm
pnpm miniprogram:devtools:preview
pnpm miniprogram:smoke
```

Expected: npm build, manifest-driven simulator smoke, and preview exit `0`. If CLI login/preview cannot run, record the literal failure and keep the task `已实现待开发者工具/模拟器复核`; do not substitute a static test for runtime evidence.

In the current stable DevTools, perform a full compile and verify:

1. Calendar logs/observes `this.renderer === 'skyline'` and vConsole records `glass-easel` on the supported debug base library; repeat the Task 3 forced-WebView compatibility check and automatic-fallback/unsupported-client evidence rule without assuming automatic fallback.
2. August 2026 fixture or API data shows Monday-first padding, full names, all same-day assignments, CST time, weekend/today/past, off-day/workday, and only 换/替/加.
3. Midnight-start assignments appear after non-midnight assignments for the same business date; identical keys preserve source order.
4. Each role/shift/member/change filter updates VM display locally with zero network requests and does not reorder the source; the first real picker option remains selectable after the explicit “全部” sentinel.
5. Month previous/next creates one endpoint pair per load: owner/administrator/member use protected calendar+holiday, guest uses logged-in guest calendar+guest holiday. The opposite pair remains at zero calls; repeated retry while loading does not duplicate calls; stale prior-month resolution cannot overwrite the selected month.
6. Confirmed number invokes one dial action; unconfirmed number invokes one clipboard action; no-number rows expose no phone entry.
7. Loading, error, forbidden, conflict, empty day, and no-group states are readable; retry has a stable touch target.
8. No Worklet function executes and no TDesign component is rendered. `compileWorklet: true` remains an engineering configuration fact, not evidence of a Worklet runtime path. TDesign 1.16.0 remains installed but its Calendar component is not used because its current official renderer table is WebView-only.

If native `button`, `picker`, or `switch` cannot reproduce its documented Skyline/WebView behavior in the tracked Stable DevTools run, stop the runtime gate at `已实现待开发者工具/模拟器复核`; rerun the exact control case in the current Nightly and record both versions/results before asserting compatibility. Record the literal DevTools version, debug base library, phone platform/WeChat version, renderer and component-framework observations, forced-WebView compatibility result, automatic-fallback evidence or unverified state, API call counts, and any device limitation. Do not claim iOS/Android/OHOS coverage that was not actually run.

- [ ] **Step 16: Apply browser-smoke/core-check applicability correctly**

Task 5 is limited to `apps/miniprogram/features/calendar`, the V3 calendar page, its tests, and checkpoint docs. It does not touch `apps/web`, `apps/api`, `packages/contracts`, mini-program auth/client/config, or a shared router. Therefore `pnpm smoke:browser` is **not required** for the planned Task 5 diff; record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序纯日历逻辑/VM 与页面消费边界，未改 Web/API/共享契约/认证核心链路）。`

If implementation reveals a real need to modify `packages/contracts/src`, an endpoint signature, Web calendar logic, API behavior, auth, router, or build core, stop Task 5 and regenerate/approve a new plan. Only that newly authorized core-path change would make `pnpm smoke:browser` mandatory. Do not silently broaden this commit.

Always run before committing:

```powershell
pnpm smoke:check-core
```

Expected: exit `0`; the guard accepts the recorded non-applicability because the staged diff contains no guarded core path. A non-zero result is a hard stop.

- [ ] **Step 17: Perform the Task 5 semantic, design, placeholder, and type audit**

Record and verify every line of this checklist:

```text
Receiver/this: logic/VM use no receiver; Page calls this.setData through its receiver; injected endpoint and wx wrappers remain member calls; controller phone effects invoke their dependency receiver.
Promise/error: one exact Promise is shared for the current in-flight group/role/month context; changing context supersedes the single slot; Promise.all rejects as one load; stale generation/finally cannot publish or clear a newer slot; classified error retains the original message; controller terminates page-facing rejection paths.
Nullish: actualMembershipId ?? plannedMembershipId; actualMemberName ?? plannedMemberName ?? '待定'; empty string is not replaced; optional phone fields use explicit undefined/length checks.
Type narrowing: real data boundaries validate dates/months; selector strings, switch booleans, action IDs, and unknown errors are narrowed; marker switches exhaust the shared union; Page/VM states are discriminated before field access.
Side effects/calls: filters and mapping are pure and non-mutating; sort decorates source index; owner/member uses one protected calendar+holiday pair, guest uses one guest calendar+holiday pair; duplicate in-flight load shares; each verified phone action invokes exactly one port.
Ordering: business date -> CST start (00:00 last) -> zh-Hans-CN role name -> slotPosition -> schedulePeriodId -> original source index.
Contract: no packages/contracts or endpoint diff; no eventId, deduction, marker permission, backend field, persistent cache, or invented authorization.
Rendering: WXML consumes VM fields only; week/cell/assignment/marker/phone keys are stable VM IDs; full names and all assignments remain; Skyline stays page-level; Worklet and TDesign rendering are N/A.
V1/V2: no page, manifest, component, fixture, screenshot, or behavior is restored or referenced.
```

Run targeted scans:

```powershell
$templateLeak = rg -n "actualMemberName|plannedMemberName|changeMarkers|shiftTypeColor|shiftTypeTextColor" apps/miniprogram/pages/calendar/index.wxml
if ($LASTEXITCODE -eq 0) { throw "raw calendar fields leaked into WXML:`n$templateLeak" }
if ($LASTEXITCODE -ne 1) { throw 'calendar WXML boundary scan failed to run' }
$unsupportedContract = rg -n "eventId|deduction" apps/miniprogram/features/calendar/calendar-logic.ts apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-page-controller.ts
if ($LASTEXITCODE -eq 0) { throw "unsupported production contract field found:`n$unsupportedContract" }
if ($LASTEXITCODE -ne 1) { throw 'calendar production contract scan failed to run' }
$placeholder = rg -n "as any|TODO|TBD|implement later|fill in details" apps/miniprogram/features/calendar --glob '!*.test.ts'
if ($LASTEXITCODE -eq 0) { throw "calendar production placeholder found:`n$placeholder" }
if ($LASTEXITCODE -ne 1) { throw 'calendar production placeholder scan failed to run' }
$contractDiff = git diff -- packages/contracts/src apps/miniprogram/api/endpoints.ts
if ($LASTEXITCODE -ne 0) { throw 'contract boundary diff command failed' }
if ($contractDiff.Length -gt 0) { throw "Task 5 changed a read-only boundary:`n$contractDiff" }
```

Expected: all four checks produce no matches/diff. Review the design coverage explicitly: Sections 3, 5, 6, 9, 10, 12, 13, and 14 are covered by Tasks 3–5 as mapped at the top; V3-2 interactions remain intentionally out of scope. Review placeholder copy in every changed WXML: only real loading/error/empty/availability messages may remain; no planning marker or future-implementation copy is user-visible. Verify every WXML field exists on the correct VM union branch and every action ID type matches its dataset guard.

- [ ] **Step 18: Update checkpoint docs, commit, push, and stop V3-1**

Update `docs/project-status.md` with the Task 5 outcome, exact test/tool/runtime results, browser-smoke applicability, `smoke:check-core` result, renderer/forced-WebView compatibility and automatic-fallback evidence, behavior audit, planned commit, and the next active batch. The next active batch is **not Task 6 implementation**: it is “review the completed V3-1 checkpoint and use `writing-plans` to generate the V3-2 execution plan from the real code.”

Append the Web/contract introduction hashes, golden-data results, VM boundary audit, DevTools evidence, and `运行/浏览器验证` line to `docs/debug/debug-feedback-log.md`. Then run this final checkpoint set:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/features/calendar/calendar-logic.ts apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/pages/calendar/index.ts scripts/miniprogram-calendar-boundary.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
pnpm smoke:check-core
git diff --check
```

Expected: every command exits `0`; the core guard confirms the staged Task 5 boundary and its recorded browser-smoke applicability.

Review `git diff` line by line and list every behavior change. Stage only:

```powershell
git add apps/miniprogram/features/calendar/calendar-logic.ts apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-page-controller.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/calendar/index.wxml apps/miniprogram/pages/calendar/index.wxss scripts/miniprogram-calendar-boundary.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git diff --cached --check
git diff --cached
git commit -m "feat(miniprogram): add typed calendar view model"
git push
```

Expected: a coherent Task 5 checkpoint and normal fast-forward push. Do not stage shared contracts/endpoints, private config, generated npm output, preview artifacts, screenshots, or unrelated changes. If relevant tests/runtime fail, do not commit. If push fails, retain the local commit and record the failure without force-pushing.

**Task 5 and V3-1 stop condition:** stop immediately after the Task 5 checkpoint/push attempt. Do not execute Task 6, create final calendar components, add a swiper/Worklet, add persistent calendar cache, implement event/detail routing, or begin V3-2 in the same conversation.

## V3-1 Completion Gate

V3-1 is complete only when all three independent checkpoints satisfy their own stop conditions and the repository records:

- Task 3: reproducible V3 manifest, four-item native tabBar, reusable local-scroll shell, page-level calendar Skyline declaration, full DevTools compile, forced-WebView compatibility result, and automatic-fallback evidence or explicit unverified state.
- Task 4: session restore/login/profile/invite state machine, one-shot 401 navigation, exact role matrix, ID-based own-contact summary, simulator matrix, Web browser smoke, and core guard.
- Task 5: Web-equivalent pure calendar logic, complete renderer-neutral VM, VM-only WXML boundary, fixed golden data, calendar DevTools/simulator smoke, explicit browser-smoke applicability, and core guard.
- No V1/V2 page or manifest is restored; no API, contract field, marker, permission, backend rule, profile edit, persistent cache, Worklet path, or unverified TDesign component is added.
- The delivery-roadmap stage index still points to this V3-1 plan; project status and debug log agree with the three checkpoint hashes, validations, external runtime states, and push outcomes.

If any item lacks evidence, keep the precise three-state status (`已实现待开发者工具/模拟器复核`, `已完成`, or `待用户复核`) and do not promote V3-2. After V3-1 is complete, the only permitted next action is a new documentation/planning conversation that rereads the checkpointed code and produces the V3-2 plan with `writing-plans`.
