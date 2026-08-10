# WeChat Mini Program V3-2 Calendar Golden Baseline And Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V3-2 calendar golden baseline on the real V3-1 checkpoint: self-drawn calendar grid with micro badges and independent event routing (Task 6), three-page month swiping plus month/week/list modes and a read-only calendar cache (Task 7), and date/duty/event/phone detail bottom sheets (Task 8), without adding APIs, contract fields, marker types, permissions, or offline writes.

**Architecture:** V3-2 is contract-first, test-first, and code-light. It extends the renderer-neutral `CalendarMonthViewModel` and the injected `CalendarPageController` from V3-1; all routing, mode, cache, sheet, and event-timeline semantics live in pure TypeScript modules with exact signatures and pinned tests. WXML components (`calendar-grid`, `assignment-row`, `marker-badge`, `holiday-tag`, `calendar-week`, `calendar-list`, and four sheets) consume only VM fields and emit stable action IDs; no component imports `wx`, endpoints, or the session singleton. The calendar page remains page-level Skyline/`glass-easel`; no Worklet runtime, TDesign Calendar, generic calendar library, or unverified Skyline component is introduced.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, Vitest 3, WeChat Mini Program base library 3.16.2, WeChat DevTools Stable `2.01.2510290`, Skyline/`glass-easel` calendar page only, native `swiper`/`scroll-view`/`picker`/`switch`, `wx.makePhoneCall`/`wx.setClipboardData`/`wx.getStorageSync`/`wx.setStorageSync`, no new dependency.

---

## Plan Authority And Prerequisite Gate

This plan is authorized only because the V3-1 completion gate is recorded and reproducible. Before any checkbox, the executor must confirm:

- `git status --short --branch` shows `main` tracking `origin/main`; the only untracked path is `apps/miniprogram/minitest/` (recorded DevTools artifact, preserved, never staged).
- `ebfbb31` → `bc534c0` → `ce21a51` are reachable from `origin/main` in that order, and `git merge-base --is-ancestor origin/main HEAD` succeeds. Local, approved V3-2 documentation/task commits are allowed to make `HEAD` ahead of upstream because this plan deliberately defers the only push until Task 8.
- `git diff --name-only ce21a51..HEAD` contains only the V3-2 plan/checkpoint documents before Task 6; after Task 6 or Task 7 it may additionally contain only the already completed, local V3-2 task paths. Any unapproved production path, private DevTools state, generated npm output, or unrelated user change is a hard stop.
- `docs/project-status.md` and the `当前阶段` summary in `docs/debug/debug-feedback-log.md` both record V3-1 as complete / 待用户复核, list the three pushed checkpoint hashes, and forbid Task 6 without user approval of this plan.
- Focused validation passes: `pnpm vitest run apps/miniprogram scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs`, `pnpm miniprogram:typecheck`, and `pnpm smoke:check-core`.

Recorded at plan revision time (2026-08-10): `ce21a51` is the V3-1 code checkpoint; the focused suite is `12` files / `74` tests; `pnpm miniprogram:typecheck` and `pnpm smoke:check-core` exit `0`; the only untracked path is `apps/miniprogram/minitest/`. The plan/checkpoint commits may be ahead of `origin/main`; they must remain docs-only until the user approves Task 6. If any prerequisite is false when a task starts, stop and regenerate the affected task from the actual checkpoint instead of adapting paths or signatures from memory.

## Scope And Prohibitions

V3-2 executes exactly Tasks 6, 7, and 8 from the delivery roadmap. It does not start Task 9 (workflows), Task 10 (notifications/profile), manual scheduling, statistics, or any V3-3+ work.

Prohibited in all three tasks:

- No new or modified API route, request/response contract field, `CalendarChangeMarker` type, permission, backend rule, or offline write queue.
- No change to `apps/miniprogram/api/endpoints.ts`, `apps/miniprogram/api/client.ts`, `packages/contracts/**`, `apps/web/**`, `apps/api/**`, `project.config.json`, `.env.example`, or the tracked manifest route set. Event timeline reuses the existing `listEvents(groupId, cursor?, pageSize?)` wrapper and filters `event.affectedShiftIds.includes(assignmentId)` client-side; no `shiftId` query is added.
- No V1/V2 page, component, manifest, fixture, screenshot, or behavior is restored or referenced.
- No generic calendar library (`wx_calendar`, `t-calendar`, etc.), no new npm dependency, no TDesign component inside the Skyline calendar page.
- No Worklet function. Touch drag uses JS `touchstart/touchmove/touchend` plus CSS `transform/transition`; any claim of smoothness requires DevTools/device evidence.
- No CSS `display: grid`, `constant()`, `place-items`, or `:focus` in mini-program WXSS (V3-1 guard remains; the 7-column grid uses flex rows).
- No vague instructions: every interface, signature, action ID, threshold, state transition, and test assertion below is normative.

## Git And GitHub Checkpoint Policy

- Task 6, Task 7, and Task 8 each form one independent **local** checkpoint commit with the roadmap version-node message.
- GitHub receives exactly **one push** after all three tasks pass their stop conditions (`git push` once, containing the three checkpoint commits), per the user's instruction to reduce GitHub resource consumption. No per-task push. If the user later requires a single squash commit, that is a separate explicit request; this plan defaults to three local commits + one push.
- Before each local commit: run the task's validation set, review `git diff` line by line, list behavior changes, stage only task files plus `docs/project-status.md` and `docs/debug/debug-feedback-log.md`, and run `git diff --cached --check`.
- This plan revision is one **local-only** docs checkpoint. Do not push it now; the sole normal fast-forward `git push` occurs after Task 8 and includes the approved plan revision plus the three task commits.

## File Responsibility Map

Every created/modified file has one primary responsibility. Read-only boundaries are explicit.

| Path                                                                                                        | Task/action                    | Single responsibility                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/miniprogram/features/calendar/calendar-golden-data.ts`                                                | T6 create                      | Own the typed V3-2 golden calendar/holiday/events fixture consumed by VM, routing, mode, sheet, and timeline tests.                                               |
| `apps/miniprogram/features/calendar/calendar-golden-data.test.ts`                                           | T6 create; T7/T8 modify        | Pin golden dataset semantics: multi-assignment day, full names, colors, holidays/调休, markers, phone permission, past/today/weekend/cross-month, event timeline. |
| `apps/miniprogram/features/calendar/calendar-routing.ts`                                                    | T6 create; T7 modify           | Resolve stable action IDs across one or more data-month VMs with exact matches and role-based marker routing.                                                     |
| `apps/miniprogram/features/calendar/calendar-routing.test.ts`                                               | T6 create; T7 modify           | Prove every routing-table row, invalid/empty/stale IDs, guest fallback, and cross-month slot lookup.                                                              |
| `apps/miniprogram/components/calendar-grid/index.{json,ts,wxml,wxss}`                                       | T6 create                      | Render weekday header and flex 7-column month grid from `weeks`; emit `route` with `day.routeActionId`; never render raw contract fields.                         |
| `apps/miniprogram/components/assignment-row/index.{json,ts,wxml,wxss}`                                      | T6 create                      | Render one duty row (full name, shift badge, time, markers, phone entry) from `CalendarAssignmentViewModel`; emit `route` and stop propagation.                   |
| `apps/miniprogram/components/marker-badge/index.{json,ts,wxml,wxss}`                                        | T6 create                      | Render one marker badge with label/description/aria and VM token classes; emit `route` with `marker.actionId`.                                                    |
| `apps/miniprogram/components/holiday-tag/index.{json,ts,wxml,wxss}`                                         | T6 create                      | Render off-day/workday/neutral holiday tag from `CalendarHolidayViewModel`; short label visible, full name in aria-label.                                         |
| `apps/miniprogram/features/calendar/calendar-view-model.ts`                                                 | T6/T7 modify                   | Add stable route IDs (T6), then cache metadata (T7); remain renderer-neutral and contract-read-only.                                                              |
| `apps/miniprogram/features/calendar/calendar-view-model.test.ts`                                            | T6/T7 modify                   | Extend fixtures/tests for route IDs, golden data, and cache metadata; no `as any`.                                                                                |
| `apps/miniprogram/pages/calendar/index.json`                                                                | T6/T7/T8 modify                | Register grid/row/badge/tag components (T6), week/list components (T7), and four sheets (T8); keep page-level Skyline.                                            |
| `apps/miniprogram/pages/calendar/index.ts`                                                                  | T6/T7/T8 modify                | Own page state: controller injection, swiper slot routing, view mode, sheets, event controller; no network orchestration outside controllers.                     |
| `apps/miniprogram/pages/calendar/index.wxml`                                                                | T6/T7/T8 modify                | Consume only VM fields/components; bind stable action IDs and sheet events.                                                                                       |
| `apps/miniprogram/pages/calendar/index.wxss`                                                                | T6/T7/T8 modify                | Own page-level layout tokens (toolbar, swiper, mode bar, sheet host) with flex/block rules only.                                                                  |
| `scripts/miniprogram-calendar-boundary.test.mjs`                                                            | T6/T7/T8 modify                | Keep proving WXML consumes VM/component fields only, page JSON keeps Skyline, no unsupported marker/event/TDesign/grid/CSS fields.                                |
| `apps/miniprogram/features/calendar/calendar-views.ts`                                                      | T7 create                      | Port Web week/list helpers, `formatChinaDateTime`, and validated week-to-month helpers; pure, no `wx`.                                                            |
| `apps/miniprogram/features/calendar/calendar-views.test.ts`                                                 | T7 create                      | Lock week start/days/label, visible-week, cross-month dates, day-list ordering, and CST date-time formatting.                                                     |
| `apps/miniprogram/features/calendar/calendar-view-mode.ts`                                                  | T7 create                      | Own the month/week/list state machine, canonical three-slot recenter/rotation helpers, and touch-source guards.                                                   |
| `apps/miniprogram/features/calendar/calendar-view-mode.test.ts`                                             | T7 create                      | Pin every mode transition, cross-year month/week step, tuple rotation, toolbar recenter, and ignored callback case.                                               |
| `apps/miniprogram/features/calendar/calendar-surface.ts`                                                    | T7 create                      | Build month/week/list renderer-neutral surfaces from month-slot VMs; enumerate every visible phone action without raw contracts.                                  |
| `apps/miniprogram/features/calendar/calendar-surface.test.ts`                                               | T7 create                      | Prove cross-month week composition, slot absence errors, list order, action lookup, and source immutability.                                                      |
| `apps/miniprogram/store/calendar-cache.ts`                                                                  | T7 create                      | Own version/role/user-isolated read snapshots, five-minute freshness, schema validation, exact-key removal, and storage-failure isolation.                        |
| `apps/miniprogram/store/calendar-cache.test.ts`                                                             | T7 create                      | Lock identity key, freshness boundary, malformed/invalid storage, exact write/remove calls, and no queue/mutation semantics.                                      |
| `apps/miniprogram/components/calendar-week/index.{json,ts,wxml,wxss}`                                       | T7 create                      | Render one week (7 day cells) from a `CalendarWeekViewModel`; emit `route`.                                                                                       |
| `apps/miniprogram/components/calendar-list/index.{json,ts,wxml,wxss}`                                       | T7 create                      | Render the list view from `days`; emit `route`.                                                                                                                   |
| `apps/miniprogram/features/calendar/calendar-page-controller.ts`                                            | T7 modify                      | Replace its one-slot internals with per-context month slots, holiday-year single-flight, cache-first reads, and stale-response guards.                            |
| `apps/miniprogram/features/calendar/calendar-page-controller.test.ts`                                       | T7 modify                      | Extend harness with identity/cache/month-slot ports; pin three-slot calls, cross-month weeks, stale suppression, cache fallback, and phone lookup.                |
| `apps/miniprogram/components/bottom-sheet/index.{json,ts,wxml,wxss}`                                        | T8 create                      | Generic sheet host with two-phase open/close/drag/bounce state and an internal content scroll-view; emits keyed close lifecycle events only.                      |
| `apps/miniprogram/features/sheets/bottom-sheet-logic.ts`                                                    | T8 create                      | Pure phase machine, drag threshold/velocity decision, offset clamp; no `wx`.                                                                                      |
| `apps/miniprogram/features/sheets/bottom-sheet-logic.test.ts`                                               | T8 create                      | Pin phase transitions, 80 px / 0.8 px·ms⁻¹ thresholds, and clamp bounds.                                                                                          |
| `apps/miniprogram/features/calendar/calendar-sheet-host.ts`                                                 | T8 create                      | Own the keyed, two-phase page sheet host state; preserve content until a matching close completion.                                                               |
| `apps/miniprogram/features/calendar/calendar-sheet-host.test.ts`                                            | T8 create                      | Pin open, request-close, matched completion, replacement, and stale completion behavior without page `this`.                                                      |
| `apps/miniprogram/components/date-detail-sheet/index.{json,ts,wxml,wxss}`                                   | T8 create                      | Render the date-sheet body from one `CalendarDayViewModel`; emit `route` only inside the persistent page-level host.                                              |
| `apps/miniprogram/components/duty-detail-sheet/index.{json,ts,wxml,wxss}`                                   | T8 create                      | Render one duty-sheet body with member/role/shift/time/colors/markers/phones; emit `route` only.                                                                  |
| `apps/miniprogram/components/phone-sheet/index.{json,ts,wxml,wxss}`                                         | T8 create                      | Render the phone-sheet body with confirmed dial or unconfirmed copy actions; emit `dial`/`copy` only.                                                             |
| `apps/miniprogram/components/event-timeline-sheet/index.{json,ts,wxml,wxss}`                                | T8 create                      | Render derived display items/status/message/hasMore/change chain inside the persistent host; no lifecycle event.                                                  |
| `apps/miniprogram/features/events/event-description.ts`                                                     | T8 create                      | Port Web narrative/type-label/change/chain helpers and map raw events to WXML-safe display items; pure, no `wx`.                                                  |
| `apps/miniprogram/features/events/event-description.test.ts`                                                | T8 create                      | Lock narratives, labels, initiator-time lookup, display mapping, chain summary, fallback, and JSON formatting.                                                    |
| `apps/miniprogram/features/events/event-timeline-controller.ts`                                             | T8 create                      | Load one permitted `listEvents` page, client-filter by shift, build display items, single-flight, generation guard, and terminal publish.                         |
| `apps/miniprogram/features/events/event-timeline-controller.test.ts`                                        | T8 create                      | Pin group+assignment calls, stale-response suppression, error preservation, WXML-safe display state, empty/ready states, and `hasMore`.                           |
| `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`                               | Plan round modify              | Update the V3-2 stage-index row and Task 6/7/8 dependency note to point at this plan.                                                                             |
| `docs/project-status.md`                                                                                    | Plan round + every task modify | Record plan checkpoint, then each task outcome/validation/next batch before its local commit.                                                                     |
| `docs/debug/debug-feedback-log.md`                                                                          | Plan round + every task modify | Append plan round record and each task's runtime/browser-smoke/core-guard record.                                                                                 |
| `packages/contracts/src/**`, `apps/miniprogram/api/**`, `apps/web/**`, `apps/api/**`, `project.config.json` | Read only                      | Explicit non-change boundaries for V3-2.                                                                                                                          |

## Stable Identifiers, Action IDs, And Event Routing Table

The VM owns every UI identity. V3-2 adds exactly two route IDs:

- `CalendarDayViewModel.routeActionId` = `` `date:${businessDate}` ``.
- `CalendarAssignmentViewModel.routeActionId` = `` `assignment:${assignmentId}` ``.

Marker and phone action IDs are unchanged from V3-1:

- marker: `` `${assignmentId}:marker:${marker}:${markerIndex}` `` (e.g. `assignment-2:marker:swap:0`).
- phone: `` `${assignmentId}:phone:${label}` `` where `label` is `长号` or `短号` (e.g. `assignment-1:phone:长号`).

`resolveCalendarRouteAction(actionId, role, viewModel)` implements exactly this table (normative):

| 热区                                            | Dataset action ID          | Matching rule (priority order)                                                    | Route target                                                                                      | Notes                                                                                    |
| ----------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 日期空白（day cell 背景，不含排班行/徽章/电话） | `day.routeActionId`        | exact equality with a real day in the active data VM                              | `{ kind: 'date', day }`                                                                           | Padding cells have no `routeActionId` and no tap binding.                                |
| 排班行（姓名/班种/时间区域）                    | `assignment.routeActionId` | exact equality with a real assignment                                             | `{ kind: 'assignment', assignment }`                                                              | Inner markers/phones use `catchtap` and emit their own action IDs; they must not bubble. |
| marker 微标签                                   | `marker.actionId`          | regex `` `^.+:marker:(swap\|leave-cover\|overtime):\d+$` `` and exact match in VM | role `guest` → `{ kind: 'assignment', assignment }`; otherwise → `{ kind: 'events', assignment }` | Guest has no event panel (design 9); fallback opens the duty sheet.                      |
| 电话入口                                        | `phoneAction.actionId`     | regex `` `^.+:phone:(长号\|短号)$` `` and exact match in VM                       | `{ kind: 'phone', phoneAction, assignment }`                                                      | Sheet decides dial/copy from `kind`; no dataset supplies `kind` or `number`.             |

All route resolution requires one or more data VMs (`cached`/`ready`/`refreshing`) after narrowing; state VMs are omitted. Empty, non-string, stale (from an old month slot), or unknown action IDs return `undefined` and produce no side effect.

## Deprecated Example Dataset (2026-08, Golden Calendar)

**Deprecated by user direction (2026-08-10):** the canonical mini-program golden sample is the real 2026 Web snapshot previously collected and persisted in `apps/miniprogram/features/calendar/calendar-golden-data.ts`. The sample below is retained only as historical planning prose: it must not be exported, rendered, or used for runtime/DevTools assertions. Tests use the real snapshot for integration behavior and small controlled `ScheduleEvent` vectors only where the snapshot lacks a required event type.

```text
goldenBusinessMonth = "2026-08"
goldenToday = "2026-08-15"

goldenCalendar = {
  "businessMonth": "2026-08", "groupId": "golden-group",
  "assignments": [
    {"actualMemberName":"张伟","actualMembershipId":"golden-member-1","businessDate":"2026-08-15","changeMarkers":[],"endsAt":"2026-08-15T12:00:00+08:00","id":"golden-a1","plannedMemberName":"张伟","plannedMembershipId":"golden-member-1","schedulePeriodId":"golden-period-1","scheduleRoleId":"golden-role-1","scheduleRoleName":"门诊","shiftTypeAbbreviation":"A","shiftTypeColor":"#1F5AA6","shiftTypeId":"golden-shift-a","shiftTypeName":"早班","shiftTypeTextColor":"#FFFFFF","slotPosition":1,"startsAt":"2026-08-15T06:00:00+08:00"},
    {"actualMemberName":"李思远","actualMembershipId":"golden-member-2","businessDate":"2026-08-15","changeMarkers":["swap","leave-cover"],"endsAt":"2026-08-15T16:00:00+08:00","id":"golden-a2","plannedMemberName":"计划医生甲","plannedMembershipId":"golden-member-4","schedulePeriodId":"golden-period-2","scheduleRoleId":"golden-role-2","scheduleRoleName":"急诊","shiftTypeAbbreviation":"B","shiftTypeColor":"#0CA678","shiftTypeId":"golden-shift-b","shiftTypeName":"白班","shiftTypeTextColor":"#FFFFFF","slotPosition":1,"startsAt":"2026-08-15T08:00:00+08:00"},
    {"actualMemberName":"欧阳修远","actualMembershipId":"golden-member-3","businessDate":"2026-08-15","changeMarkers":["overtime","swap"],"endsAt":"2026-08-16T02:00:00+08:00","id":"golden-a3","plannedMemberName":"欧阳修远","plannedMembershipId":"golden-member-3","schedulePeriodId":"golden-period-2","scheduleRoleId":"golden-role-2","scheduleRoleName":"急诊","shiftTypeAbbreviation":"N","shiftTypeColor":"#E03131","shiftTypeId":"golden-shift-n","shiftTypeName":"夜班","shiftTypeTextColor":"#FFFFFF","slotPosition":2,"startsAt":"2026-08-15T20:00:00+08:00"},
    {"actualMemberName":"","actualMembershipId":"golden-member-3","businessDate":"2026-08-16","changeMarkers":[],"endsAt":"2026-08-16T12:00:00+08:00","id":"golden-a4","plannedMemberName":"","plannedMembershipId":"golden-member-3","schedulePeriodId":"golden-period-1","scheduleRoleId":"golden-role-1","scheduleRoleName":"门诊","shiftTypeAbbreviation":"A","shiftTypeColor":"#1F5AA6","shiftTypeId":"golden-shift-a","shiftTypeName":"早班","shiftTypeTextColor":"#FFFFFF","slotPosition":3,"startsAt":"2026-08-16T06:00:00+08:00"},
    {"actualMemberName":"王芳","actualMembershipId":"golden-member-4","businessDate":"2026-08-31","changeMarkers":["overtime"],"endsAt":"2026-09-01T04:00:00+08:00","id":"golden-a5","plannedMemberName":"王芳","plannedMembershipId":"golden-member-4","schedulePeriodId":"golden-period-2","scheduleRoleId":"golden-role-2","scheduleRoleName":"急诊","shiftTypeAbbreviation":"N","shiftTypeColor":"#E03131","shiftTypeId":"golden-shift-n","shiftTypeName":"夜班","shiftTypeTextColor":"#FFFFFF","slotPosition":1,"startsAt":"2026-08-31T20:00:00+08:00"}
  ],
  "members": [
    {"isConfirmed":true,"membershipId":"golden-member-1","mobilePhone":"13800000001","realName":"张伟","shortPhone":"6601"},
    {"isConfirmed":false,"membershipId":"golden-member-2","mobilePhone":"13900000002","realName":"李思远","shortPhone":"6602"},
    {"isConfirmed":true,"membershipId":"golden-member-3","realName":"欧阳修远"},
    {"isConfirmed":false,"membershipId":"golden-member-4","mobilePhone":"13700000004","realName":"王芳"}
  ],
  "roles": [
    {"id":"golden-role-1","name":"门诊"},
    {"id":"golden-role-2","name":"急诊"}
  ],
  "shiftTypes": [
    {"abbreviation":"A","color":"#1F5AA6","crossesMidnight":false,"id":"golden-shift-a","isAllDay":false,"name":"早班","startTime":"06:00","endTime":"12:00","textColor":"#FFFFFF"},
    {"abbreviation":"B","color":"#0CA678","crossesMidnight":false,"id":"golden-shift-b","isAllDay":false,"name":"白班","startTime":"08:00","endTime":"16:00","textColor":"#FFFFFF"},
    {"abbreviation":"N","color":"#E03131","crossesMidnight":true,"id":"golden-shift-n","isAllDay":false,"name":"夜班","startTime":"20:00","endTime":"04:00","textColor":"#FFFFFF"}
  ]
}

goldenHolidays = { "confirmed": true, "year": 2026,
  "dates": [
    {"date":"2026-08-01","holidayName":"建军节","isOffDay":true,"isWorkday":false},
    {"date":"2026-08-15","holidayName":"调休上班","isOffDay":false,"isWorkday":true},
    {"date":"2026-08-16","holidayName":"休息日","isOffDay":true,"isWorkday":false}
  ] }

goldenEvents = [
  {"affectedMembershipIds":["golden-member-2","golden-member-4"],"affectedShiftIds":["golden-a2"],"beforeData":{"initiatorAssignment":{"actualMemberName":"计划医生甲"},"initiatorAssignmentId":"golden-a2","targetAssignment":{"actualMemberName":"王芳"},"targetAssignmentId":"golden-a4"},"afterData":{"initiatorAssignment":{"actualMemberName":"李思远"},"initiatorAssignmentId":"golden-a2","initiatorMemberName":"李思远","targetAssignment":{"actualMemberName":"王芳"},"targetAssignmentId":"golden-a4"},"eventStatus":"completed","eventType":"swap_completed","groupId":"golden-group","id":"golden-event-1","objectId":"golden-swap-1","objectType":"swap_request","occurredAt":"2026-08-15T09:00:00+08:00","operationId":"golden-op-1","schedulePeriodId":"golden-period-2"},
  {"affectedMembershipIds":["golden-member-1"],"affectedShiftIds":["golden-a4"],"afterData":{"strategy":"shift-forward"},"eventStatus":"completed","eventType":"leave_cover_completed","groupId":"golden-group","id":"golden-event-2","objectType":"leave_request","occurredAt":"2026-08-15T10:00:00+08:00","operationId":"golden-op-2","reason":"临时家事","schedulePeriodId":"golden-period-1"},
  {"affectedMembershipIds":["golden-member-3"],"affectedShiftIds":["golden-a3"],"afterData":{"deductedMemberName":"欧阳修远","initiatorMemberName":"张伟","overtimeMemberName":"李思远"},"eventStatus":"completed","eventType":"duty_adjustment_completed","groupId":"golden-group","id":"golden-event-3","objectType":"duty_adjustment","occurredAt":"2026-08-15T11:00:00+08:00","operationId":"golden-op-3","schedulePeriodId":"golden-period-2"},
  {"affectedMembershipIds":[],"affectedShiftIds":["golden-a2"],"eventStatus":"completed","eventType":"schedule_period_published","groupId":"golden-group","id":"golden-event-4","objectType":"schedule_period","occurredAt":"2026-08-14T18:00:00+08:00","operationId":"golden-op-4","schedulePeriodId":"golden-period-1"},
  {"affectedMembershipIds":[],"affectedShiftIds":["golden-a2"],"beforeData":{"shiftTypeName":"旧班种","status":"pending"},"afterData":{"shiftTypeName":"新班种","status":"approved"},"eventStatus":"completed","eventType":"shift_type_changed","groupId":"golden-group","id":"golden-event-5","objectType":"shift_type","occurredAt":"2026-08-13T15:00:00+08:00","operationId":"golden-op-5"}
]
```

The preceding example is not normative. The real snapshot's assignment IDs, event IDs, members, holidays, and calendar coverage are the source of truth; no production behavior may depend on `golden-*` values.

## Semantic Audit Contract (All Tasks)

Every task's pre-commit audit must re-verify this exact checklist against the real diff:

```text
Receiver/this: pure logic/VM/cache/sheet modules use no receiver; components call this.triggerEvent and this.setData through their own receiver; page handlers call this.setData; injected wx wrappers keep member calls (wx.makePhoneCall, wx.setClipboardData, wx.getStorageSync, wx.setStorageSync, wx.nextTick if used).
Promise/error: each calendar context and event-assignment controller shares one exact Promise per in-flight key; changing the key supersedes only its own slot; `loadMonths` aggregates only the first-seen per-month promises, while each current cache/endpoint branch handles its classified error before the public promise resolves; stale generation/finally cannot publish, clear a newer slot, or write cache; page-facing calls resolve their handled error state and `void` has no unhandled rejection.
Nullish: actualMemberName ?? plannedMemberName ?? '待定'; empty string is not replaced; phoneActions use length > 0; optional cache/user-id/role use explicit undefined checks; no `||` that would swallow ''.
Type narrowing: viewModel.status/kind and EventTimelineState.status are discriminated before field access; dataset values are narrowed to non-empty string; role comes from the typed session group; route regex groups are revalidated before use; no `as any` or non-null assertion.
Side effects/calls: filters and mapping are pure and non-mutating; each verified dial/copy calls exactly one wx port; each missing calendar month calls exactly one allowed calendar endpoint, and each not-yet-loaded holiday year exactly one holiday endpoint, with at most one cache write per successful month; each assignment event load calls `listEvents(groupId, undefined, 100)` exactly once per in-flight request; `setData` happens only through page/component receivers; no endpoint call from components.
Stale async: numeric generation is scoped to calendar context/slot and event assignment; cache writes and publishes require the current generation; swiper re-center uses a locked flag plus navigation epoch; an old month, holiday year, sheet key, or event assignment cannot publish into the current surface.
Contract: no packages/contracts or endpoint diff; no eventId on markers, no deduction, no marker permission, no backend field, no offline write; listEvents is filtered client-side by affectedShiftIds.
Rendering: WXML consumes VM fields and component properties only; stable keys are week.id/day.id/assignment.assignmentId/marker.actionId/phoneAction.actionId; full names and all assignments remain; Skyline stays page-level; Worklet and TDesign rendering are N/A.
V1/V2: no old page, manifest, component, fixture, screenshot, or behavior is restored or referenced.
```

---

## Task 6: Self-Drawn Calendar Grid, Micro Badges, And Independent Event Routing

**Task boundary:** Task 6 builds the golden month grid, compact two-row day cells with micro badges, and the four-row event routing table. It must not add the swiper, month/week/list modes, cache, bottom sheets, or event fetching.

**Prerequisites (run before editing):**

```powershell
git status --short --branch
git rev-list --left-right --count 'HEAD...@{upstream}'
git log -5 --oneline --decorate
pnpm vitest run apps/miniprogram scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm miniprogram:typecheck
```

Expected: `main` tracks `origin/main`; `origin/main` is an ancestor of HEAD and the allowed ahead commits are this approved docs checkpoint only; all 12 files / 74 tests pass, typecheck exits `0`, and only `apps/miniprogram/minitest/` is untracked. Any other state stops Task 6.

### 6.1 View-Model Route IDs (write tests first)

Extend `apps/miniprogram/features/calendar/calendar-view-model.ts` with exactly two fields:

```ts
export interface CalendarDayViewModel {
  // existing fields unchanged ...
  readonly routeActionId: string; // `date:${businessDate}`
}

export interface CalendarAssignmentViewModel {
  // existing fields unchanged ...
  readonly routeActionId: string; // `assignment:${assignmentId}`
}
```

In `calendar-view-model.test.ts` add these exact assertions (they fail until the fields exist):

```ts
const denseDay = findDay(ready, '2026-08-15');
if (denseDay === undefined) throw new Error('expected a real calendar day');
expect(denseDay.routeActionId).toBe('date:2026-08-15');
expect(denseDay.assignments[0]?.routeActionId).toBe('assignment:assignment-1');
expect(denseDay.assignments[1]?.routeActionId).toBe('assignment:assignment-2');
```

Mapping rules: `routeActionId` is set only on `kind: 'day'` cells and only for real assignments; padding cells keep `{ id, kind: 'padding' }` without a route field; the WXML/guard may never reference `routeActionId` inside a padding branch.

Narrative support: `CalendarAssignmentViewModel` also carries two read-only copies used only by event narratives and the duty-detail sheet: `plannedMemberName?: string` and `actualMemberName?: string` (copied verbatim from the contract; `undefined` preserved; `memberName` keeps the `actual ?? planned ?? '待定'` effective value). WXML must never bind these two fields; the boundary guard keeps forbidding `actualMemberName|plannedMemberName` in WXML.

### 6.2 Routing Module (test-first)

Create `apps/miniprogram/features/calendar/calendar-routing.ts` with this exact public boundary:

```ts
import type { GroupRole } from '@schedule/contracts';
import type {
  CalendarAssignmentViewModel,
  CalendarDayViewModel,
  CalendarMonthDataViewModel,
  CalendarPhoneActionViewModel,
} from './calendar-view-model.js';

export type CalendarRouteTarget =
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'assignment' }
  | { readonly day: CalendarDayViewModel; readonly kind: 'date' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'events' }
  | {
      readonly assignment: CalendarAssignmentViewModel;
      readonly kind: 'phone';
      readonly phoneAction: CalendarPhoneActionViewModel;
    };

export function resolveCalendarRouteAction(
  actionId: string,
  role: GroupRole,
  viewModels: readonly CalendarMonthDataViewModel[],
): CalendarRouteTarget | undefined;
```

Implementation contract (normative):

1. `actionId.length === 0` or `viewModels.length === 0` → `undefined`.
2. Traverse each supplied VM in its input order, then only `weeks[].days[]`; only `kind: 'day'` cells participate. Task 6 does not mention or branch on Task 7's week/list surface types.
3. First pass: exact equality against `day.routeActionId` → `{ kind: 'date', day }`; exact equality against `assignment.routeActionId` → `{ kind: 'assignment', assignment }`.
4. Second pass: for each marker in each assignment, exact equality with `marker.actionId` → `role === 'guest' ? { kind: 'assignment', assignment } : { kind: 'events', assignment }`.
5. Third pass: for each phone action in each assignment, exact equality with `phoneAction.actionId` → `{ kind: 'phone', phoneAction, assignment }`.
6. No match → `undefined`. Never derive a target from `kind` or `number` supplied by WXML.

Create `calendar-routing.test.ts` with a harness that builds the golden VM once (`buildCalendarMonthViewModel({ calendar: goldenCalendar, filters: {}, holidays: goldenHolidays, status: 'ready', today: goldenToday })`), passes it as `[goldenVm]`, and asserts the exact routing table rows:

| Input action ID                                                                                                        | role   | Expected target                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `date:2026-08-15`                                                                                                      | member | `{ kind: 'date', day.businessDate: '2026-08-15' }`                                                      |
| `assignment:golden-a2`                                                                                                 | member | `{ kind: 'assignment', assignment.assignmentId: 'golden-a2' }`                                          |
| `golden-a2:marker:swap:0`                                                                                              | member | `{ kind: 'events', assignment.assignmentId: 'golden-a2' }`                                              |
| `golden-a2:marker:leave-cover:1`                                                                                       | member | `{ kind: 'events', assignment.assignmentId: 'golden-a2' }`                                              |
| `golden-a3:marker:overtime:0`                                                                                          | guest  | `{ kind: 'assignment', assignment.assignmentId: 'golden-a3' }`                                          |
| `golden-a3:marker:swap:1`                                                                                              | guest  | `{ kind: 'assignment', assignment.assignmentId: 'golden-a3' }`                                          |
| `golden-a1:phone:长号`                                                                                                 | member | `{ kind: 'phone', phoneAction.actionId: 'golden-a1:phone:长号', assignment.assignmentId: 'golden-a1' }` |
| `golden-a1:phone:短号`                                                                                                 | member | `{ kind: 'phone', phoneAction.actionId: 'golden-a1:phone:短号' }`                                       |
| `''` / `date:2026-09-01` / `assignment:missing` / `golden-a2:marker:swap:9` / `golden-a4:phone:长号` / `not-an-action` | any    | `undefined`                                                                                             |

Expected initial failure: `calendar-routing.ts` does not exist (red state). The VM test above fails first with `routeActionId` missing; implement `routeActionId` in the VM before the routing module so the routing test can import the golden fixture.

### 6.3 Golden Data And Golden Test (test-first)

Create `calendar-golden-data.ts` with the exact fixture from the **Golden Dataset** section, and `calendar-golden-data.test.ts` with these normative assertions (each fails on the empty/missing module before the fixture exists):

```ts
const ready = buildCalendarMonthViewModel({
  calendar: goldenCalendar,
  filters: {},
  holidays: goldenHolidays,
  status: 'ready',
  today: goldenToday,
});
expect(ready.status).toBe('ready');
if (ready.status !== 'ready') throw new Error('expected ready VM');
expect(ready.weekdayLabels).toEqual(['一', '二', '三', '四', '五', '六', '日']);
expect(ready.weeks[0]?.days[0]).toMatchObject({ kind: 'padding' }); // 2026-07-27 pad
expect(ready.weeks[0]?.days[5]).toMatchObject({
  businessDate: '2026-08-01',
  kind: 'day',
  isPast: true,
  isWeekend: true,
});
expect(ready.weeks[0]?.days[5]).toMatchObject({
  holiday: expect.objectContaining({ holidayName: '建军节', isOffDay: true, tone: 'off-day' }),
});

const denseDay = findDay(ready, '2026-08-15');
if (denseDay === undefined) throw new Error('expected 2026-08-15');
expect(denseDay).toMatchObject({
  isPast: false,
  isToday: true,
  isWeekend: true,
  weekdayLabel: '周六',
  holiday: expect.objectContaining({ isWorkday: true, tone: 'workday' }),
});
expect(denseDay.assignments.map(({ memberName }) => memberName)).toEqual([
  '张伟',
  '李思远',
  '欧阳修远',
]);
expect(denseDay.assignments.map(({ timeRange }) => timeRange)).toEqual([
  '06:00–12:00',
  '08:00–16:00',
  '20:00–02:00',
]);
expect(denseDay.assignments[0]).toMatchObject({
  backgroundColor: '#1F5AA6',
  foregroundColor: '#FFFFFF',
  phoneActions: [
    { actionId: 'golden-a1:phone:长号', kind: 'dial', label: '长号', number: '13800000001' },
    { actionId: 'golden-a1:phone:短号', kind: 'dial', label: '短号', number: '6601' },
  ],
});
expect(denseDay.assignments[1].phoneActions).toEqual([
  expect.objectContaining({ kind: 'copy', number: '13900000002' }),
  expect.objectContaining({ kind: 'copy', number: '6602' }),
]);
expect(denseDay.assignments[2].phoneActions).toEqual([]);
expect(denseDay.assignments.flatMap(({ markers }) => markers).map(({ type }) => type)).toEqual([
  'swap',
  'leave-cover',
  'overtime',
  'swap',
]);
expect(
  new Set(denseDay.assignments.flatMap(({ markers }) => markers).map(({ actionId }) => actionId)),
).toHaveProperty('size', 4);

const sunday = findDay(ready, '2026-08-16');
expect(sunday?.assignments[0]?.memberName).toBe(''); // empty string preserved
expect(sunday?.assignments[0]?.phoneActions).toEqual([]);
expect(sunday?.holiday).toMatchObject({ isOffDay: true, tone: 'off-day' });

const crossMonth = findDay(ready, '2026-08-31');
expect(crossMonth?.assignments[0]).toMatchObject({
  memberName: '王芳',
  timeRange: '20:00–04:00',
  markers: [{ type: 'overtime' }],
});
expect(ready.weeks.at(-1)?.days.slice(1)).toEqual(
  Array.from({ length: 6 }, () => expect.objectContaining({ kind: 'padding' })),
);
expect(JSON.stringify(ready)).not.toContain('deduction');
expect(JSON.stringify(ready)).not.toContain('eventId');
expect(denseDay.assignments[0]).toMatchObject({
  actualMemberName: '张伟',
  plannedMemberName: '张伟',
});
expect(denseDay.assignments[1]).toMatchObject({
  actualMemberName: '李思远',
  plannedMemberName: '计划医生甲',
});
```

Also assert source immutability: deep-equal `goldenCalendar`, `goldenHolidays`, and the input filter arrays before/after mapping.

### 6.4 Component Contracts (properties/events; WXML/WXSS by the executor)

All four components are registered in `apps/miniprogram/pages/calendar/index.json` under `usingComponents`. Component JSON is `{ "component": true }`; no TDesign, no renderer declaration inside components (the Skyline page owns the renderer).

`calendar-grid`:

- properties: `weeks: Array` (typed `CalendarWeekViewModel[]`), `role: String` (typed `GroupRole`).
- events: `route` (detail: `{ actionId: string }`).
- Layout spec (normative): weekday header row of 7 equal flex cells (`flex: 1`, height `var(--v3-touch-min)` baseline 56rpx, weekend color `var(--v3-color-weekend)`); each week is a flex row; each day cell `min-height: 160rpx`, `padding: 8rpx`, `background: var(--v3-color-surface)`, `border: 1rpx solid var(--v3-color-border)`, `border-radius: var(--v3-radius-md)`; today `border: 2rpx solid var(--v3-color-primary)`; past `background: #F3F4F6`; off-day `background: var(--v3-color-warning-light)` with `background-blend-mode` not used; the day header row shows `dayNumber` (bold, `--v3-font-size-md`) and `holiday-tag` on the right; assignments render as stacked `assignment-row` rows below. The cell background is a `catchtap` emitting `route` with `day.routeActionId`; padding cells render an empty flex cell with no tap binding.

`assignment-row`:

- properties: `assignment: Object` (typed `CalendarAssignmentViewModel`), `hideShiftBadge: Boolean` (default `false`), `role: String`.
- events: `route` (detail `{ actionId: string }`).
- Layout spec: `min-height: 64rpx`, `border-left: 6rpx solid var(--v3-color-border-strong)`; member name `--v3-font-size-sm`, `font-weight: 700`, `color: var(--v3-color-text)`, `white-space: normal` (full names never truncated); shift badge uses `backgroundColor: assignment.backgroundColor` and `color: assignment.foregroundColor`, `border-radius: var(--v3-radius-sm)`, `padding: 2rpx 12rpx`, hidden when `hideShiftBadge`; time text `--v3-font-size-xs`, `color: var(--v3-color-text-muted)`; markers row `flex-wrap: wrap` with `marker-badge` children; phone entry visible only when `assignment.phoneActions.length > 0`, one native button per action with `min-height: 64rpx`, `min-width: 128rpx`, `margin: 0`, `padding: 0 16rpx`, label `长号`/`短号`, `data-action-id="{{item.actionId}}"`.
- Propagation: every inner tap (`name/row area`, shift badge is non-interactive, marker buttons, phone buttons) uses `catchtap`; row-level tap emits `assignment.routeActionId`; marker buttons emit `marker.actionId`; phone buttons emit `phoneAction.actionId`.

`marker-badge`:

- properties: `marker: Object` (typed `CalendarMarkerViewModel`).
- events: `route` (detail `{ actionId: string }`).
- Spec: `display: flex`, `min-width: 40rpx`, `min-height: 40rpx`, `border-radius: var(--v3-radius-sm)`, classes derived from `marker.fillToken`/`borderToken`/`foregroundToken` (tokens exist: `color-primary(-light)`, `color-danger(-light)`, `color-warning(-light)`); visible label `marker.label` (`换`/`替`/`加`); `aria-label="{{marker.description}}"`; pressed state `opacity: 0.72` via `hover-class`.

`holiday-tag`:

- properties: `holiday: Object` (typed `CalendarHolidayViewModel`).
- Spec: `padding: 2rpx 12rpx`, `border-radius: var(--v3-radius-sm)`, `font-size: var(--v3-font-size-xs)`; off-day uses danger tokens, workday uses warning tokens, neutral uses text-muted/surface/border; visible `holiday.label`; full name in `aria-label="{{holiday.holidayName}}"`.

### 6.5 Page Wiring And Boundary Guard (test-first)

Modify `apps/miniprogram/pages/calendar/index.ts`:

```ts
interface CalendarPageMethods {
  // existing methods unchanged ...
  handleRouteAction(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly actionId?: unknown }>,
  ): void;
  lastResolvedRoute?: CalendarRouteTarget;
}
```

`handleRouteAction` narrows the custom component event's `event.detail.actionId` to a non-empty string, reads the active group's typed role from the session snapshot, narrows the displayed month VM, and calls `resolveCalendarRouteAction(actionId, role, [dataViewModel])`. A defined target is assigned to the page instance field `this.lastResolvedRoute`; `undefined` is a no-op. Task 6 deliberately has no sheet, toast, controller method, endpoint call, or other UI side effect. In particular, `CalendarPageController` has no `openRoute` method and Task 6 must not invent one. Task 8 replaces this dormant typed sink with the sheet host state machine.

Replace `apps/miniprogram/pages/calendar/index.wxml` with:

- `<page-shell title="排班日历">` unchanged shell/state branches (loading/forbidden/error/conflict/no-group).
- Data branch: toolbar (上一月/下一月 buttons and month label), filters, summary, and `<calendar-grid weeks="{{viewModel.weeks}}" role="{{activeRole}}" bind:route="handleRouteAction" />` replacing the V3-1 hand-rolled week/day markup.
- The empty state (`viewModel.isMonthEmpty`) renders the same visible string as V3-1.

`activeRole` is a new page data field (`''` default; `onShow` sets it from the active group or keeps `''` when `hasActiveGroup` is false).

Modify `scripts/miniprogram-calendar-boundary.test.mjs` so the first test additionally asserts:

```js
expect(wxml).toContain('calendar-grid');
expect(wxml).toContain('bind:route="handleRouteAction"');
expect(wxml).not.toMatch(
  /actualMemberName|plannedMemberName|changeMarkers|shiftTypeColor|shiftTypeTextColor|eventId|deduction/gu,
);
expect(page).toContain('resolveCalendarRouteAction');
expect(page).toContain('activeRole');
expect(wxss).toContain('.calendar-page__toolbar');
expect(wxss).toContain('display: flex');
expect(wxss).toContain('display: block');
expect(wxss).not.toMatch(/constant\(|display:\s*grid|place-items|:focus/gu);
```

### 6.6 Task 6 Steps

- [ ] **Step 1:** Run prerequisites; record literal Git/test results.
- [ ] **Step 2:** Add `routeActionId` tests in `calendar-view-model.test.ts`; run and observe the two failures (`routeActionId` missing).
- [ ] **Step 3:** Implement `routeActionId` in `calendar-view-model.ts`; run the VM suite until green.
- [ ] **Step 4:** Create `calendar-golden-data.ts` and `calendar-golden-data.test.ts`; run and observe module-missing red, then green after the fixture exists.
- [ ] **Step 5:** Create `calendar-routing.test.ts`; observe red (module missing), then implement `calendar-routing.ts` per section 6.2; run green.
- [ ] **Step 6:** Create the four components and update page JSON/WXML/WXSS/TS per sections 6.4–6.5; update the boundary guard first, observe its red state on the placeholder page, then green after wiring.
- [ ] **Step 7:** Run the full Task 6 validation set:

```powershell
pnpm vitest run apps/miniprogram/features/calendar scripts/miniprogram-calendar-boundary.test.mjs
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/features/calendar/calendar-golden-data.ts apps/miniprogram/features/calendar/calendar-golden-data.test.ts apps/miniprogram/features/calendar/calendar-routing.ts apps/miniprogram/features/calendar/calendar-routing.test.ts apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/calendar/index.wxml apps/miniprogram/pages/calendar/index.wxss apps/miniprogram/pages/calendar/index.json scripts/miniprogram-calendar-boundary.test.mjs
pnpm smoke:check-core
git diff --exit-code -- packages/contracts/src apps/miniprogram/api/endpoints.ts apps/miniprogram/api/client.ts
git diff --check
```

Expected: all commands exit `0`, including the empty contract/API diff assertion. Browser smoke: **not applicable** (Task 6 touches only mini-program components/features/pages/scripts guards; record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序日历组件/路由/VM，未改 Web/API/契约/认证/构建核心链路）` in the debug log).

- [ ] **Step 8:** DevTools/simulator gate: `pnpm miniprogram:devtools:build-npm`, `pnpm miniprogram:devtools:preview`, `pnpm miniprogram:smoke`. In the simulator, feed golden data by one of two explicit methods: (a) a local API/dev-server payload that serves `goldenCalendar` for `GET /groups/:id/calendar?businessMonth=2026-08` (no repo change), or (b) a **temporary, non-committed** swap of the page's controller injection from endpoints to the golden fixture, restored to the endpoints before any commit; the debug log records which method and the restore state. Open `pages/calendar/index` and verify the golden month renders 7-column flex rows, full names, three same-day rows in order 06:00/08:00/20:00, night badge `N`, `换/替/加` badges, today/off-day/workday/past backgrounds, `08-31` cross-month row `20:00–04:00`, and phone entries only on rows with numbers. Record the literal DevTools version, base library, renderer indicator (`skyline`), and screenshots under the ignored `.tmp-miniprogram-preview` directory.
- [ ] **Step 9:** Run the Task 6 semantic audit from the **Semantic Audit Contract** section, review `git diff` line by line, update `docs/project-status.md` and `docs/debug/debug-feedback-log.md`, stage only Task 6 files plus the two docs, run `git diff --cached --check`, and create the **local** commit `feat(miniprogram): build calendar golden baseline`.

**Task 6 stop condition:** stop after the local checkpoint commit. Do not add swiper, week/list modes, cache, sheets, or event fetching.

---

## Task 7: Three-Page Month Swiping, Month/Week/List Modes, And Read-Only Cache

**Task boundary:** Task 7 adds native three-page month swiping, the `month`/`week`/`list` view modes shared with the VM/filters, and a read-only snapshot cache. It must not add detail sheets or event loading.

**Prerequisites:** Task 6 local checkpoint committed; `git status` clean except `apps/miniprogram/minitest/`; Task 6 validation commands still pass.

### 7.1 Week/List Logic Port (test-first)

Create `apps/miniprogram/features/calendar/calendar-views.ts` (pure port of Web `apps/web/src/features/calendar/calendar-views.ts`, no `wx`):

```ts
import type { CalendarDutyAssignment } from '@schedule/contracts';
import type { CalendarGridWeek } from './calendar-logic.js';

export interface DayListEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

export function getWeekStartDate(businessDate: string): string;
export function getWeekDays(businessDate: string): readonly string[];
export function addWeeks(businessDate: string, delta: number): string;
export function getBusinessMonthOf(businessDate: string): string;
export function getBusinessMonthsForWeek(
  weekStart: string,
): readonly [string] | readonly [string, string];
export function getWeekLabel(businessDate: string): string;
export function getVisibleWeekForMonth(businessMonth: string, today: string): string;
export function getWeekIndexForToday(
  weeks: readonly CalendarGridWeek[],
  today: string,
): number | undefined;
export function getWeekdayLabel(businessDate: string): string;
export function isWeekend(businessDate: string): boolean;
export function buildDayList(
  assignments: readonly CalendarDutyAssignment[],
  today: string,
): readonly DayListEntry[];
export function formatChinaDateTime(value: string): string; // 'YYYY-MM-DD HH:mm' in CST
```

Semantics are copied exactly from the Web implementation: Monday-first week start (`(getUTCDay() + 6) % 7`); `getWeekLabel('2026-08-05') === '2026年8月3日 – 8月9日'` (including both spaces around `–`); `getVisibleWeekForMonth` returns the week of `today` when `today` is inside the displayed month, otherwise the first calendar week for that month; `buildDayList` includes only dates with assignments, sorted ascending, and preserves the Web day ordering (start time with 00:00 last, then zh-Hans-CN role, slot, period, source index). `getBusinessMonthsForWeek('2026-08-31')` returns `['2026-08', '2026-09']`; `getBusinessMonthsForWeek('2026-12-28')` returns `['2026-12', '2027-01']`. `formatChinaDateTime` parses the instant, shifts +8h, and returns `YYYY-MM-DD HH:mm`.

Create `calendar-views.test.ts` porting the Web spec cases (week start/days/label, visible week, today index, day list, weekend) plus `formatChinaDateTime`:

```ts
expect(getWeekStartDate('2026-08-05')).toBe('2026-08-03');
expect(getWeekDays('2026-08-05')).toEqual([
  '2026-08-03',
  '2026-08-04',
  '2026-08-05',
  '2026-08-06',
  '2026-08-07',
  '2026-08-08',
  '2026-08-09',
]);
expect(addWeeks('2026-08-05', 1)).toBe('2026-08-12');
expect(addWeeks('2026-08-03', -1)).toBe('2026-07-27');
expect(getWeekLabel('2026-08-05')).toBe('2026年8月3日 – 8月9日');
expect(getVisibleWeekForMonth('2026-08', '2026-08-12')).toBe('2026-08-10');
expect(getVisibleWeekForMonth('2026-09', '2026-08-12')).toBe('2026-08-31');
expect(getWeekdayLabel('2026-08-03')).toBe('周一');
expect(isWeekend('2026-08-08')).toBe(true);
expect(formatChinaDateTime('2026-08-15T09:00:00+08:00')).toBe('2026-08-15 09:00');
expect(getBusinessMonthsForWeek('2026-08-31')).toEqual(['2026-08', '2026-09']);
expect(getBusinessMonthsForWeek('2026-12-28')).toEqual(['2026-12', '2027-01']);
expect(() => addWeeks('2026-08-05', 1.5)).toThrow();
```

Expected red: module missing. The golden day-list test builds `buildDayList(goldenCalendar.assignments, goldenToday)` and asserts dates `['2026-08-15', '2026-08-16', '2026-08-31']` with `2026-08-15` first and its three assignments in golden order.

### 7.2 View-Mode State Machine (test-first)

Create `apps/miniprogram/features/calendar/calendar-view-mode.ts`:

```ts
export type CalendarViewMode = 'list' | 'month' | 'week';

export interface CalendarViewModeState {
  readonly businessMonth: string;
  readonly mode: CalendarViewMode;
  readonly weekStart: string;
}

export type CalendarMonthSlots = readonly [string, string, string];

export function createCalendarViewModeState(today: string): CalendarViewModeState;
export function switchCalendarViewMode(
  state: CalendarViewModeState,
  mode: CalendarViewMode,
  today: string,
): CalendarViewModeState;
export function stepCalendarMonth(
  state: CalendarViewModeState,
  delta: number,
  today: string,
): CalendarViewModeState;
export function stepCalendarWeek(
  state: CalendarViewModeState,
  delta: number,
): CalendarViewModeState;
export function recenterMonthSlots(businessMonth: string): CalendarMonthSlots;
export function rotateMonthSlots(slots: CalendarMonthSlots, swiperIndex: 0 | 2): CalendarMonthSlots;
```

Transition table (normative):

| Method                                          | From state  | Next state                                                                                                                  |
| ----------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `createCalendarViewModeState(today)`            | —           | `{ businessMonth: getBusinessMonthOf(today), mode: 'month', weekStart: getWeekStartDate(today) }`                           |
| `switchCalendarViewMode(state, 'month', today)` | any         | `mode: 'month'`; `businessMonth` and `weekStart` unchanged                                                                  |
| `switchCalendarViewMode(state, 'week', today)`  | any         | `mode: 'week'`; `weekStart` is preserved, or becomes `getVisibleWeekForMonth(state.businessMonth, today)` if it was invalid |
| `switchCalendarViewMode(state, 'list', today)`  | any         | `mode: 'list'`; `businessMonth` and `weekStart` unchanged                                                                   |
| `stepCalendarMonth(state, delta, today)`        | month/list  | `businessMonth: addBusinessMonths(state.businessMonth, delta)`; `weekStart: getVisibleWeekForMonth(nextMonth, today)`       |
| `stepCalendarMonth(state, delta, today)`        | week        | throws `Error('Month stepping is not available in week mode.')`                                                             |
| `stepCalendarWeek(state, delta)`                | week only   | `weekStart: addWeeks(state.weekStart, delta)` and `businessMonth: getBusinessMonthOf(nextWeekStart)`                        |
| `stepCalendarWeek(state, delta)`                | month/list  | throws `Error('Week stepping requires week mode.')`                                                                         |
| `recenterMonthSlots(month)`                     | valid month | `[month - 1, month, month + 1]`; tuple positions are the only business-month source for the swiper                          |
| `rotateMonthSlots(slots, 0)` / `(slots, 2)`     | exact tuple | `[month - 2, month - 1, month]` / `[month, month + 1, month + 2]`; any other index is rejected before calling               |

`getBusinessMonthOf` validates a real business date before returning `slice(0, 7)`. Tests pin every row, including `createCalendarViewModeState('2026-08-15')` exactly equals `{ businessMonth: '2026-08', mode: 'month', weekStart: '2026-08-10' }`, reject `swiperIndex` `1`/`3`, and prove that all helpers leave their input object/tuple unchanged.

### 7.3 Read-Only Cache Module (test-first)

Create `apps/miniprogram/store/calendar-cache.ts`:

```ts
import type { CalendarReadModel, GroupRole, HolidayReadModel } from '@schedule/contracts';

export const calendarCacheKeyPrefix = 'schedule.calendarCache.v1:';
export const calendarCacheFreshnessMilliseconds = 5 * 60 * 1000;

export interface CalendarCacheIdentity {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly groupRole: GroupRole;
  readonly groupVersion: number;
  readonly userId: string;
}

export interface CalendarCacheRecord {
  readonly calendar: CalendarReadModel;
  readonly holidays: HolidayReadModel;
  readonly identity: CalendarCacheIdentity;
  readonly savedAt: string; // ISO 8601 UTC
  readonly schemaVersion: 1;
}

export interface CalendarCachePort {
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  setStorageSync(key: string, value: unknown): void;
}

export function buildCalendarCacheKey(identity: CalendarCacheIdentity): string;
export function isCalendarCacheFresh(record: CalendarCacheRecord, now?: Date): boolean;

export interface CalendarCache {
  read(identity: CalendarCacheIdentity): CalendarCacheRecord | undefined;
  write(
    identity: CalendarCacheIdentity,
    calendar: CalendarReadModel,
    holidays: HolidayReadModel,
    now?: Date,
  ): void;
  remove(identity: CalendarCacheIdentity): void;
}

export function createCalendarCache(port: CalendarCachePort): CalendarCache;
```

Rules (normative):

- Key format is `` `${calendarCacheKeyPrefix}${encodeURIComponent(userId)}:${encodeURIComponent(groupId)}:${groupRole}:${groupVersion}:${businessMonth}` ``. `encodeURIComponent` applies separately to each arbitrary contract ID before the delimiter, so `user:a`/`group` cannot collide with `user`/`a:group`. Empty `userId`/`groupId`, invalid `GroupRole`, non-positive/non-integer `groupVersion`, or invalid `businessMonth` throws before storage access.
- `groupVersion` is the existing `GroupSummary.version`, not a calendar contract field or cache-version guess. A group version change produces a different key, so old snapshots cannot be read; V3-2 does not add a write flow that tries to invalidate a broad prefix.
- `write` stamps `schemaVersion: 1` and `savedAt = now.toISOString()` (default `new Date()`), stores the literal validated `calendar`/`holidays`, and calls `port.setStorageSync` exactly once. `remove` calls `port.removeStorageSync` once for that exact identity only.
- `isCalendarCacheFresh` returns true only when `savedAt` parses, is not in the future, and `0 <= now - savedAt <= 300000`; `savedAt + 300000ms` is fresh and `+300001ms` is stale.
- `read` catches storage errors, accepts only a non-array object with `schemaVersion === 1`, exact identity equality, and successful `calendarReadModelSchema.safeParse` / `holidayReadModelSchema.safeParse`; otherwise it returns `undefined` without throwing. A string, malformed object, invalid nested payload, or wrong identity is corrupt cache data, not a retryable API response.
- This module is a read snapshot only. It never queues, replays, buffers, or fabricates a mutation; V3-2 has no write success from which to call `remove`.

Create `calendar-cache.test.ts` with a `Map<string, unknown>` port and exact assertions: member and guest identities with otherwise equal group/month create different keys; group versions `7` and `8` create different keys; `user:a`/`group` and `user`/`a:group` create different keys; `savedAt + 5min` is fresh and `+5min+1ms` stale; write/read round trip calls `setStorageSync` once; string/malformed/invalid-contract/wrong-identity reads return undefined; a throwing `getStorageSync` returns undefined; `remove` calls the exact key once; empty user/group, invalid month, and `groupVersion: 0` throw before any port call.

### 7.4 Per-Month Controller And Cache Integration (test-first)

Task 7 does **not** overload V3-1's single `CalendarMonthViewModel` with week/list shapes. It keeps each loaded business month as a month VM, then builds a separate renderer-neutral surface from one or two such VMs. This is required because a week can span two calendar months (and two holiday years).

```ts
export interface CalendarContext {
  readonly groupId: string;
  readonly groupRole: GroupRole;
  readonly groupVersion: number;
  readonly userId: string;
}

export interface CalendarLoadTarget extends CalendarContext {
  readonly businessMonth: string;
}

export interface CalendarMonthSlotUpdate {
  readonly businessMonth: string;
  readonly context: CalendarContext;
  readonly viewModel: CalendarMonthViewModel;
}

export interface CalendarPageControllerDependencies {
  // Existing endpoint and wx ports remain member-bound wrappers.
  readonly cache: CalendarCache;
  readonly publish: (update: CalendarMonthSlotUpdate) => void;
}

export interface CalendarPageController {
  activate(context: CalendarContext): void;
  getMonthViewModels(months: readonly string[]): readonly CalendarMonthDataViewModel[];
  load(target: CalendarLoadTarget, force?: boolean): Promise<void>;
  loadMonths(context: CalendarContext, months: readonly string[], force?: boolean): Promise<void>;
  performPhoneAction(actionId: string): boolean;
  setFilters(filters: CalendarAssignmentFilters): void;
}
```

`activate` compares all four context fields and clears only the active filter/visible-slot selection when any changes. Each slot is keyed by the full cache identity and owns `{ generation, inFlight?, calendar?, holidays?, lastSuccessful?, viewModel? }`; a promise is shared only for the exact key. A per-context/per-year holiday slot is also single-flight: loading July/August/September 2026 makes exactly three calendar calls and one holiday call for the active role, not three holiday calls. `loadMonths` validates/deduplicates its month array in first-seen order and returns `Promise.all` of the per-month loads.

For one month: use a non-forced successful in-memory slot first; otherwise read the exact cache identity. A valid snapshot publishes `cached` immediately with `cacheSavedAt` and `isStale = !isCalendarCacheFresh(record)`, then starts the network refresh. No snapshot publishes `loading`. A current success publishes `ready`, stores one exact cache record, and clears cache metadata. A current failure keeps/re-publishes the cached VM as stale without an error state; without cache it publishes V3-1's classified state/error message. `force` bypasses only in-memory success, never cache-first visibility. A completion may publish/write only when its slot generation and context still match; `.finally()` clears only the exact same slot promise.

`CalendarMonthDataViewModel` gains only optional `cacheSavedAt?: string` and `isStale?: boolean`; `BuildCalendarMonthViewModelInput` gains those same optional inputs. They are present only with `status: 'cached'`; existing V3-1 callers remain `ready` and unchanged. `setFilters` rebuilds every loaded VM for the active context, makes zero endpoint/cache calls, and keeps a filter when stepping month within the same group/version.

Create/extend `calendar-page-controller.test.ts` red first with these assertions:

| Scenario                       | Exact assertion                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Three initial slots, same year | `loadMonths(context, ['2026-07','2026-08','2026-09'])` calls protected calendar three times and holidays once; guest calls guest calendar three times and guest holidays once; opposite endpoint counts stay zero. |
| Cross-year week                | `loadMonths(context, ['2026-12','2027-01'])` makes two calendar calls and one holiday call for each year.                                                                                                          |
| Fresh cache then success       | Updates are `cached` then `ready`; one calendar refresh and one cache write occur.                                                                                                                                 |
| Cache then rejection           | Update remains cached with `isStale: true`; no error state and zero cache writes occur.                                                                                                                            |
| No cache rejection             | Updates are loading then the original classified error message.                                                                                                                                                    |
| Same key / force               | Same in-flight calls return `===`; success-cache load makes zero calls; forced load still shows cache then makes exactly one role-correct request pair.                                                            |
| Stale slot completion          | A superseded slot cannot publish, clear a newer in-flight entry, or write its cache key.                                                                                                                           |
| Filter / phone                 | Filter rebuilds loaded slots with zero requests; the same phone action resolves once from month, cross-month week, and list surfaces.                                                                              |

### 7.5 Month/Week/List Surface Builders (test-first)

Create `apps/miniprogram/features/calendar/calendar-surface.ts`:

```ts
import type {
  CalendarDayViewModel,
  CalendarMonthDataViewModel,
  CalendarMonthViewModel,
  CalendarPhoneActionViewModel,
  CalendarStateStatus,
  CalendarWeekViewModel,
} from './calendar-view-model.js';

export interface CalendarMonthSlotViewModel {
  readonly businessMonth: string;
  readonly viewModel: CalendarMonthViewModel;
}

export type CalendarSurfaceViewModel =
  | {
      readonly kind: 'list';
      readonly days: readonly CalendarDayViewModel[];
      readonly monthLabel: string;
    }
  | { readonly kind: 'month'; readonly month: CalendarMonthDataViewModel }
  | {
      readonly kind: 'week';
      readonly week: CalendarWeekViewModel;
      readonly weekLabel: string;
      readonly weekStart: string;
    }
  | {
      readonly businessMonth: string;
      readonly kind: 'state';
      readonly message: string;
      readonly status: CalendarStateStatus;
    };

export function buildCalendarSurfaceViewModel(input: {
  readonly businessMonth: string;
  readonly mode: CalendarViewMode;
  readonly monthSlots: readonly CalendarMonthSlotViewModel[];
  readonly weekStart: string;
}): CalendarSurfaceViewModel;
export function findCalendarPhoneAction(
  slots: readonly CalendarMonthSlotViewModel[],
  actionId: string,
): CalendarPhoneActionViewModel | undefined;
```

Month mode requires the center month data VM. List mode uses its real-day cells with assignments, sorts them by business date, and never creates a cross-month list. Week mode validates `weekStart`, calls `getBusinessMonthsForWeek`, requires every required month data VM, and selects each real day from the correct source month; `2026-08-31` therefore shows August 31 plus September 1–6 from the September slot, not padding or invented empty data. Missing slots produce `{ kind: 'state', businessMonth: missingMonth, status: 'loading', message: '正在加载排班' }`; an existing month state preserves its exact `status`/`message`. State surfaces bind no route event until every required VM is data. Every selected day/assignment keeps its Task 6 route IDs. `findCalendarPhoneAction` traverses deduplicated real-day assignments in all passed slots, so controller lookup does not assume `.weeks` exists on a future surface union.

`calendar-surface.test.ts` first fails because the module is absent, then pins: month surface uses the central VM; golden list dates are `2026-08-15`, `2026-08-16`, `2026-08-31`; the August 31 week demands September and returns seven real dates when both fixtures are supplied; absent September returns exactly `{ kind: 'state', businessMonth: '2026-09', status: 'loading', message: '正在加载排班' }`; phone `golden-a1:phone:长号` is found exactly once; inputs and all source VMs are unchanged. Extend `calendar-routing.test.ts` with `[AugustVm, SeptemberVm]` and assert `date:2026-09-01` resolves only when the September data VM is supplied. The VM test adds cached metadata assertions (`cached` has both fields; `ready` has neither), not mode/weekday/list fields.

### 7.6 Three-Page Swiper Rotation Rules (page-level, test-first via pure module)

`calendar-view-mode.ts` owns the pure `recenterMonthSlots(center)` and `rotateMonthSlots(slots, 0 | 2)` functions declared in §7.2. The page never calls `rotateMonthSlots` for a toolbar action; toolbar and week-navigation actions call `recenterMonthSlots(nextBusinessMonth)`.

Page data uses these exact fields:

```ts
interface CalendarPageData {
  readonly cacheNotice?: { readonly savedAtText: string; readonly stale: boolean };
  readonly monthSlots: readonly [
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
  ];
  readonly surface: CalendarSurfaceViewModel;
  readonly swiperIndex: 1;
  readonly viewMode: CalendarViewMode;
  readonly weekStart: string;
}
```

`monthSlots[1].businessMonth` is the sole selected-month source; no parallel `businessMonth` data field exists. On show, the page narrows a non-empty authenticated `profile.id`, active group ID/role, and positive integer `group.version` before constructing `CalendarContext`; otherwise it keeps the no-group state and makes zero calls. Initial slots are state VMs for `[previous, current, next]`, then `controller.loadMonths(context, months)` requests all three. The page holds a monotonic `navigationEpoch` and `swiperLocked` instance fields. Its `publish(update)` finds the business month in the current tuple; index `-1`, a non-current group/version, or an older navigation epoch is ignored without `setData`. A valid update writes only `monthSlots[index]`, then rebuilds `surface` from the tuple and current mode/week start. `cacheNotice` is undefined unless the center VM is `cached` with both cache fields; otherwise it is `{ savedAtText: cacheSavedAt, stale: isStale === true }`. `handleRouteAction` passes every currently narrowed data VM in `monthSlots` to `resolveCalendarRouteAction`; this keeps September day/row/marker/phone taps valid in an August 31–September 6 week without passing a surface union or raw data.

`handleSwiperChange(event)` first narrows `event.detail.current` to `0 | 1 | 2` and `event.detail.source` to the literal `'touch'`. It returns for non-touch, disabled (week/list), locked, `1`, or invalid source/index. Otherwise it captures/increments `navigationEpoch`, locks, constructs `const slotMonths: CalendarMonthSlots = [monthSlots[0].businessMonth, monthSlots[1].businessMonth, monthSlots[2].businessMonth]`, calls `rotateMonthSlots(slotMonths, current)`, preserves the two reusable VM slots, creates only the new edge state VM, and calls `setData({ monthSlots, surface, swiperIndex: 1 })`. Its callback unlocks only if the captured epoch remains current, then calls `loadMonths` for the tuple; existing slots create zero requests and the new edge causes exactly one calendar request plus a holiday request only for a not-yet-loaded year.

Month/list toolbar calls `stepCalendarMonth`, then `recenterMonthSlots(next.businessMonth)` and `loadMonths` without an animated callback. Week toolbar (`上一周`/`下一周`/`本周`) calls `stepCalendarWeek`; it recenters on `next.businessMonth`, computes `getBusinessMonthsForWeek(next.weekStart)`, loads the three slots plus the required cross-month pair as their set union, and builds the week surface only after both source months are data. The native `<swiper>` is rendered only in month mode; week/list never receive or handle a swiper change.

### 7.7 Week/List Components And Page Wiring

- `calendar-week` properties: `week: Object` (`CalendarWeekViewModel`), `role: String`; event `route` detail `{ actionId: string }`. Its own `index.json` registers `assignment-row` and `holiday-tag`; it renders exactly seven flex cells, each `flex: 1`/`min-height: 208rpx`, with full day header and a sole-duty `hideShiftBadge` only when `day.assignments.length === 1`.
- `calendar-list` properties: `days: Array` (`CalendarDayViewModel[]`), `role: String`; event `route` detail `{ actionId: string }`. Its own `index.json` registers `assignment-row` and `holiday-tag`; it renders a date card (`MM-DD 周X`, today and holiday labels) then every row without truncating names.
- Page WXML has three typed mode buttons (`data-mode="month|week|list"`, `handleViewModeTap` rejects any other string), month/list toolbar, and week toolbar. The handler builds the ephemeral `CalendarViewModeState` from center-slot month plus `viewMode`/`weekStart`, calls `switchCalendarViewMode`, then recenters/loads the resulting month(s). Its month branch uses `<swiper circular enhanced duration="{{240}}" current="{{swiperIndex}}" bindchange="handleSwiperChange">` with exactly three `swiper-item` grid components. Its week/list branches consume `surface.week`/`surface.days`; `surface.kind === 'state'` uses the existing state renderer and binds no route. `cacheNotice` renders `可能不是最新数据` only when `stale` is true and never exposes raw storage data.
- `calendar-page__swiper` uses a measured `height: calc(100vh - 312rpx)` and flex rows; no `display: grid`. It does not create another vertical `scroll-view` because `page-shell` remains the only page-level scroll owner.
- Boundary guard first fails because the Task 6 page lacks the modes, then requires `monthSlots`, `calendar-grid`, `calendar-week`, `calendar-list`, `bindchange="handleSwiperChange"`, `cacheNotice`, `rotateMonthSlots`, `recenterMonthSlots`, `swiperLocked`, and `navigationEpoch`. It permits `enhanced` only on the `<swiper>` tag, rejects `<scroll-view ... enhanced>`, raw contract fields, `Promise.all`, `requestGeneration`, `lastSuccessfulKey`, and `inFlight` in the page source.

### 7.8 Task 7 Steps

- [x] **Step 1:** Run Task 7 prerequisites: Task 6 local commit exists; `origin/main` is an ancestor; only its approved docs/Task 6 commits are ahead; the Task 6 validation set passes.
- [x] **Step 2:** Write `calendar-views.test.ts` including the spaces in the Web week label and two cross-month cases; observe module-missing red; implement only `calendar-views.ts`; run green.
- [x] **Step 3:** Write `calendar-view-mode.test.ts` for all transition-table rows, non-touch/center/locked swiper no-ops, tuple rotation, and toolbar recenter; observe red; implement only `calendar-view-mode.ts`; run green.
- [x] **Step 4:** Write `calendar-cache.test.ts` with the full identity matrix and throwing/corrupt storage; observe red; implement only `calendar-cache.ts`; run green.
- [x] **Step 5:** Extend month-VM/routing tests for cache metadata and cross-month route lookup, then write `calendar-surface.test.ts` including August 31–September 6 and mode-independent phone lookup; observe red; implement the VM metadata and `calendar-surface.ts`; run green.
- [x] **Step 6:** Extend controller tests for per-month slots, per-year holidays, cache-first, stale protection, and filter rebuild; observe red; implement controller changes; run green.
- [x] **Step 7:** Create `calendar-week`/`calendar-list`, then update the boundary guard before calendar page TS/JSON/WXML/WXSS; observe guard red and only then wire the components/page to green.
- [x] **Step 8:** Run this exact Task 7 validation set:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-routing.test.ts apps/miniprogram/features/calendar/calendar-views.test.ts apps/miniprogram/features/calendar/calendar-view-mode.test.ts apps/miniprogram/features/calendar/calendar-surface.test.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/store/calendar-cache.test.ts apps/miniprogram/features/calendar/calendar-golden-data.test.ts scripts/miniprogram-calendar-boundary.test.mjs
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/features/calendar/calendar-view-model.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-routing.ts apps/miniprogram/features/calendar/calendar-routing.test.ts apps/miniprogram/features/calendar/calendar-views.ts apps/miniprogram/features/calendar/calendar-views.test.ts apps/miniprogram/features/calendar/calendar-view-mode.ts apps/miniprogram/features/calendar/calendar-view-mode.test.ts apps/miniprogram/features/calendar/calendar-surface.ts apps/miniprogram/features/calendar/calendar-surface.test.ts apps/miniprogram/features/calendar/calendar-page-controller.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/store/calendar-cache.ts apps/miniprogram/store/calendar-cache.test.ts apps/miniprogram/components/calendar-week/index.json apps/miniprogram/components/calendar-week/index.ts apps/miniprogram/components/calendar-week/index.wxml apps/miniprogram/components/calendar-week/index.wxss apps/miniprogram/components/calendar-list/index.json apps/miniprogram/components/calendar-list/index.ts apps/miniprogram/components/calendar-list/index.wxml apps/miniprogram/components/calendar-list/index.wxss apps/miniprogram/pages/calendar/index.json apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/calendar/index.wxml apps/miniprogram/pages/calendar/index.wxss scripts/miniprogram-calendar-boundary.test.mjs
pnpm smoke:check-core
git diff --exit-code -- packages/contracts/src apps/miniprogram/api/endpoints.ts apps/miniprogram/api/client.ts
git diff --check
```

Expected: every command exits `0`, the boundary diff is empty, and `pnpm smoke:browser` is recorded as not applicable because no Web/API/contract/auth/router/build-core file changed.

- [x] **Step 9:** DevTools/simulator gate: `pnpm miniprogram:devtools:build-npm` (no warnings), `pnpm miniprogram:devtools:preview` (154.8 KB), and `pnpm miniprogram:smoke` (7/7 pages, no script error) passed on Stable DevTools / base library `3.16.2`. Skyline automation cannot inspect handlers or screenshots; the user explicitly delegates July/August/September swipes, August 31–September 6, list order and cache-notice visual checks to manual DevTools review. Controller tests retain call-count evidence; no fallback claim is inferred.
- [x] **Step 10:** Complete the semantic audit, update both checkpoint documents, stage only Task 7 paths, run `git diff --cached --check`/`git diff --cached`, list behavioral changes, and create the **local** commit `feat(miniprogram): add calendar navigation and read cache`.

**Task 7 stop condition:** stop after the local checkpoint commit. Do not add detail sheets, event loading, or V3-3 work.

**Push-policy override (2026-08-10):** The user explicitly replaces this plan's deferred single-push policy. After every validated project checkpoint, create the normal local commit and normally fast-forward push it to `origin/main`; never force-push. This override applies to Task 7 regression fixes and the remaining V3-2 checkpoints.

---

## Task 8: Date, Duty, Event, And Phone Detail Bottom Sheets

**Task boundary:** Task 8 adds the generic bottom sheet and the four detail sheets, plus event timeline loading and phone dial/copy wiring. It does not add workflows, approvals, notifications, or V3-3 pages.

**Prerequisites:** Task 7 local checkpoint committed; `git status` clean except `apps/miniprogram/minitest/`; Task 7 validation still passes.

### 8.1 Bottom-Sheet State Machine (test-first)

Create `apps/miniprogram/features/sheets/bottom-sheet-logic.ts` with this public boundary:

```ts
export type BottomSheetPhase = 'closed' | 'closing' | 'dragging' | 'open' | 'opening' | 'settling';

export type BottomSheetPhaseEvent =
  | 'close-finished'
  | 'close-requested'
  | 'drag-bounced'
  | 'drag-started'
  | 'open-finished'
  | 'open-requested';

export const bottomSheetAnimationMilliseconds = 280;
export const bottomSheetBounceMilliseconds = 200;
export const bottomSheetDragCloseThresholdPx = 80;
export const bottomSheetDragCloseVelocityPxPerMillisecond = 0.8;
export const bottomSheetMaximumDragOffsetPx = 640;

export interface BottomSheetDragSample {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly elapsedMilliseconds: number;
}

export function nextBottomSheetPhase(
  phase: BottomSheetPhase,
  event: BottomSheetPhaseEvent,
): BottomSheetPhase;
export function shouldBeginBottomSheetDrag(
  scrollTop: number,
  sample: BottomSheetDragSample,
): boolean;
export function shouldCloseBottomSheet(sample: BottomSheetDragSample): boolean;
export function clampBottomSheetDragOffset(offsetPx: number): number;
```

The only non-identity transitions are normative: `closed + open-requested → opening`; `opening + open-finished → open`; `opening + close-requested → closing`; `open + drag-started → dragging`; `open + close-requested → closing`; `dragging + drag-bounced → settling`; `dragging + close-requested → closing`; `settling + open-finished → open`; `settling + close-requested → closing`; `closing + close-finished → closed`; `closing + open-requested → opening`. Every other phase/event pair keeps its current phase, including `open + open-requested` (a new `sheetKey` replaces content without replaying an animation).

`shouldBeginBottomSheetDrag` is true only when `scrollTop <= 1`, `deltaY > 0`, and `Math.abs(deltaY) > Math.abs(deltaX)`. `shouldCloseBottomSheet` is true only after the same vertical-intent test and either `deltaY >= 80` or (`elapsedMilliseconds > 0` and `deltaY / elapsedMilliseconds > 0.8`); exactly `0.8` is false. `clampBottomSheetDragOffset` returns a finite offset clamped to `[0, 640]`; NaN/infinity become `0`. Touch deltas use `touch.clientY` CSS pixels, never rpx.

Create `bottom-sheet-logic.test.ts` before the module. Assert all 36 phase/event pairs, `79.9`/`80`, `0.8`/`0.81`, horizontal/negative/zero samples, `scrollTop` `1`/`1.01`, and `-1`/`0`/`641`/NaN clamp results. Expected initial failure: module missing; after implementation every assertion is green.

### 8.2 Bottom-Sheet Component

`apps/miniprogram/components/bottom-sheet/index.*`:

- properties: `title: String` (default `''`), `visible: Boolean` (default `false`), `sheetKey: Number` (default `0`).
- events: `request-close` and `closed`, both with detail `{ sheetKey: number }`; no component emits an unkeyed close event.
- Implementation contract: the parent keeps the component and its slot mounted while `visible` changes `true → false`. The mask and close button use `catchtap` to call `requestClose`, which transitions to `closing`, emits `request-close` once for the current key, and starts the 280 ms close timer. Only a timer whose captured `sheetKey` and phase still match may transition to `closed` and emit `closed`; `detached` and every key/visibility replacement call `clearTimeout` first. Thus the parent can preserve content during closing, and a late `closed` from an old key cannot clear reopened content.
- WXML has a mask, a panel with `transform: translateY({{dragOffsetPx}}px)`, and an internal `<scroll-view scroll-y bindscroll="handleContentScroll">` containing the slot. The mask/panel use CSS `transform 280ms ease-out`; a rejected drag uses `transform 200ms ease-out`; `dragging` has no transition. The panel/header records `touchstart`; content move is owned only after `shouldBeginBottomSheetDrag(scrollTop, sample)` succeeds, otherwise its native scroll remains available. The component records `scrollTop` from the scroll event, calls `setData` at most once per accepted `touchmove`, and never rebuilds slot data during a move.
- On a valid downward end, `shouldCloseBottomSheet` starts `closing`; otherwise `drag-bounced → settling`, resets offset to `0`, and the 200 ms timer sends `open-finished`. A new visible `sheetKey` clears any timer, resets offset/scroll position, and enters `opening` only from `closed`/`closing`; an open sheet merely swaps keyed content. WXML exposes a `<slot />` and a close affordance with `aria-label="关闭"`; panel taps use `catchtap` so they never close the mask.

Component tests (or a minimal DevTools component harness if the Vitest adapter cannot mount mini-program components) must prove: opening emits no close; mask close emits `request-close` once and `closed` once after 280 ms; `visible=false` retains slot content until `closed`; `sheetKey` replacement cancels the old timer; the stale key is ignored by the host; a 79.9 px drag settles at zero; an 80 px drag requests close; scroll `> 1` blocks drag ownership. Record the adapter limitation rather than skipping a state assertion.

### 8.3 Event Description Port And Timeline Controller (test-first)

Create `apps/miniprogram/features/events/event-description.ts` as a line-for-line semantic port of Web `apps/web/src/features/events/event-timeline.ts`. It is pure and has no `wx`; raw `ScheduleEvent` data never crosses into WXML:

```ts
import type { CalendarChangeMarker, JsonObject, ScheduleEvent } from '@schedule/contracts';
import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';

export interface EventChangeItem {
  readonly after?: string;
  readonly before?: string;
  readonly label: string;
}
export interface EventNarrativeContext {
  readonly initiatedAt?: string;
}
export interface EventTimelineDisplayItem {
  readonly changes: readonly EventChangeItem[];
  readonly id: string;
  readonly marker?: CalendarChangeMarker;
  readonly narrative?: string;
  readonly occurredAtText: string;
  readonly reason?: string;
  readonly typeLabel: string;
}
export interface EventTimelineDisplay {
  readonly changeChainSummary?: string;
  readonly items: readonly EventTimelineDisplayItem[];
}

export const eventTypeLabels: Readonly<Record<string, string>>;
export function getEventTypeLabel(eventType: string): string;
export function formatEventTime(occurredAt: string): string;
export function extractEventChanges(event: ScheduleEvent): readonly EventChangeItem[];
export function buildEventNarrative(
  event: ScheduleEvent,
  assignment?: CalendarAssignmentViewModel,
  context?: EventNarrativeContext,
): string | undefined;
export function buildChangeChainSummary(
  events: readonly ScheduleEvent[],
  assignmentId: string,
): string | undefined;
export function buildEventTimelineDisplay(
  events: readonly ScheduleEvent[],
  assignment: CalendarAssignmentViewModel,
): EventTimelineDisplay;
export function formatJsonValue(value: JsonObject | undefined): string;
```

Copy the Web type-label/change-label/skipped-key/status-label tables, marker mapper, primitive and nested-member readers, all request/completed narratives, fallback, sorting, and chain summary exactly. `assignment.assignmentId`, `plannedMemberName`, `actualMemberName`, and `roleName` replace Web's `id`, names, and `scheduleRoleName`; `formatEventTime` delegates to Task 7 `formatChinaDateTime`. Unknown types remain `排班变更` plus the Web changes fallback. `buildEventTimelineDisplay` sorts by `occurredAt`, then `id`; makes a first-seen `objectId → occurredAt` map only from `objectType === 'swap_request' && eventType === 'swap_request_created'`; and maps each sorted event to the display fields above. A completed swap receives `initiatedAt` only from that map, never from its own completion timestamp.

Write `event-description.test.ts` before implementation. Use the real snapshot's VM helper with discriminated `findDay` narrowing (no `as any`) for supported integration cases; use a small test-local typed `ScheduleEvent` vector for missing `leave-cover` and deterministic display ordering. Pin: labels `swap_completed → 换班已生效` and unknown → `排班变更`; markers `[undefined, undefined, 'swap', 'leave-cover', 'overtime']`; a completed swap has no invented `发起时间` without a matching request-created event; leave-cover contains `整体顺延`; duty adjustment exactly `欧阳修远 的班次由 李思远 代值（由 张伟 发起）。`; the typed status/shift vector yields `{ 班种: 旧班种 → 新班种, 状态: 待审批 → 已批准 }`; and `formatJsonValue(undefined) === ''`.

Create `apps/miniprogram/features/events/event-timeline-controller.ts`:

```ts
import type { ScheduleEventPage } from '@schedule/contracts';
import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';
import type { EventTimelineDisplayItem } from './event-description.js';

export interface EventTimelineState {
  readonly assignmentId?: string;
  readonly changeChainSummary?: string;
  readonly errorMessage?: string;
  readonly groupId?: string;
  readonly hasMore: boolean;
  readonly items: readonly EventTimelineDisplayItem[];
  readonly status: 'error' | 'idle' | 'loading' | 'ready';
}
export interface EventTimelineDependencies {
  readonly listEvents: (
    groupId: string,
    cursor?: string,
    pageSize?: number,
  ) => Promise<ScheduleEventPage>;
  readonly publish: (state: EventTimelineState) => void;
}
export interface EventTimelineController {
  load(groupId: string, assignment: CalendarAssignmentViewModel): Promise<void>;
  reset(): void;
}
export function createEventTimelineController(
  dependencies: EventTimelineDependencies,
): EventTimelineController;
```

`load` is non-`async`. The in-flight identity is the exact pair `{ groupId, assignmentId: assignment.assignmentId }`: only the same pair returns the identical Promise; changing either value increments one numeric generation. Every non-idle publish includes both identity fields. It publishes loading, calls `listEvents(groupId, undefined, 100)` exactly once, filters only `event.affectedShiftIds.includes(assignment.assignmentId)`, then publishes the derived display and `hasMore: page.nextCursor !== undefined` only for the current pair/generation. It fetches no second page in V3-2. A failure publishes the original `Error.message` when available, empty display, and `hasMore: false`, then resolves the public Promise. `reset` increments generation, clears the exact slot, and publishes idle; `.finally()` clears `inFlight` only when it is the same Promise. The page creates this controller only for a non-guest event route; guest code never reaches `listEvents`.

Write `event-timeline-controller.test.ts` with a `vi.fn` endpoint port. Assert `(groupId, undefined, 100)` once, same group/assignment `first === second`, same assignment ID in a different group returns a new Promise and stale first-group resolution cannot publish, different-assignment stale resolve cannot publish, handled failure resolves with message, cursor means `hasMore`, empty response is ready with no items, raw event objects never appear in published state, `golden-a2` receives only its three affected fixture events, and reset makes the next load call the port again.

### 8.4 Detail Sheets (presentational; properties/events normative)

The page registers exactly one persistent `bottom-sheet` and renders one of the following four **sheet-body** components in its slot. A body component does not import/register `bottom-sheet`, does not receive `visible`/`sheetKey`, and never emits a lifecycle close event; the single host owns scrolling, animation, mask close, and keyed completion.

`date-detail-sheet`:

- `index.json` registers `assignment-row`; properties: `day: Object` (`CalendarDayViewModel`), `monthLabel: String`.
- event: `route` (detail `{ actionId: string }`).
- Content spec: full date line (`day.dayNumber` + `day.weekdayLabel`), holiday line (full `holidayName` + `休息日`/`调休上班` when present), then all `day.assignments` rendered through `assignment-row` (full names, badges, markers, phones). Empty day shows `当日无排班`（valid empty copy）.

`duty-detail-sheet`:

- `index.json` registers `marker-badge`; properties: `assignment: Object` (`CalendarAssignmentViewModel`), `role: String` (`GroupRole`).
- event: `route`.
- Content spec: member full name (never truncated), role name, shift type full name + abbreviation, time range, shift color chips (`backgroundColor`/`foregroundColor` swatches), marker list with `marker-badge` + description, phone entries exactly as the grid row (same buttons, same action IDs). A `查看事件记录` button is present only when `role !== 'guest'` and emits `route` with the first marker's `actionId` (no marker → hidden; events without a marker are not reachable, matching Web marker-driven entry).

`phone-sheet`:

- `index.json` has no nested component; properties: `memberName: String`, `phoneActions: Array` (`CalendarPhoneActionViewModel[]`).
- events: `dial` (detail `{ actionId: string }`), `copy` (detail `{ actionId: string }`).
- Content spec: one row per action: label (`长号`/`短号`), the number, and a button — `拨打` for `kind: 'dial'` (confirmed), `复制（未确认）` for `kind: 'copy'`; no number ever renders without its action; `phoneActions.length === 0` renders `该成员暂无电话号码` and no buttons (valid empty copy).

`event-timeline-sheet`:

- `index.json` registers `marker-badge`; properties: `assignment: Object` (`CalendarAssignmentViewModel`), `status: String`, `items: Array` (`EventTimelineDisplayItem[]`), `errorMessage: String`, `hasMore: Boolean`, `changeChainSummary: String`.
- event: none. Its local data is `isChainExpanded: Boolean` (default `false`); its `changeChainSummary` observer resets it to false; `handleChainToggle()` calls its own `this.setData` once with the inverse only when a non-empty summary exists.
- Content spec: loading state `正在加载事件`; error state uses `errorMessage` and has no retry button (re-open makes the one permitted page request); empty ready state is `该班次暂无事件记录。`; ready entries use only `item.occurredAtText`, `item.marker`, `item.typeLabel`, `item.narrative`, `item.reason`, and `item.changes`. A marker badge appears only for `item.marker`; a reason line uses `原因：…`; changes appear only when `narrative` is absent. `hasMore` shows `仅显示最近 100 条`; a native `<button bindtap="handleChainToggle">人员变更链</button>` and `wx:if` `<view>` show `changeChainSummary` when expanded. No unverified `<details>` tag, WXML formatter, `ScheduleEvent`, `beforeData`, or `afterData` is used.

The detail-body component harness asserts date/duty/phone emit only their declared custom events and no `request-close`/`closed`; the event body starts collapsed, expands once for a non-empty chain, ignores toggle for an empty chain, and resets collapsed on a new summary. The persistent host harness remains responsible for all open/close timing assertions in §8.2.

### 8.5 Keyed Page Host, Routing, And Dial/Copy Wiring (test-first)

Create `apps/miniprogram/features/calendar/calendar-sheet-host.ts` before changing page `this`:

```ts
export type CalendarSheetContent =
  | { readonly day: CalendarDayViewModel; readonly kind: 'date' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'duty' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'events' }
  | {
      readonly assignment: CalendarAssignmentViewModel;
      readonly kind: 'phone';
      readonly phoneActions: readonly CalendarPhoneActionViewModel[];
    };
export type CalendarSheetKind = CalendarSheetContent['kind'] | 'none';
export interface CalendarSheetHostState {
  readonly content?: CalendarSheetContent;
  readonly sheetKey: number;
  readonly visible: boolean;
}
export function openCalendarSheet(
  current: CalendarSheetHostState,
  content: CalendarSheetContent,
): CalendarSheetHostState;
export function requestCalendarSheetClose(current: CalendarSheetHostState): CalendarSheetHostState;
export function completeCalendarSheetClose(
  current: CalendarSheetHostState,
  sheetKey: number,
): CalendarSheetHostState;
export function getCalendarSheetKind(current: CalendarSheetHostState): CalendarSheetKind;
export function getCalendarSheetTitle(current: CalendarSheetHostState): string;
```

`openCalendarSheet` increments `sheetKey`, stores the new content, and sets `visible: true`; `requestCalendarSheetClose` keeps `content`/`sheetKey` and changes only `visible` to false; `completeCalendarSheetClose` removes content only when `current.visible === false` and its exact key matches, otherwise returns the same state. `getCalendarSheetKind` returns `none` for no content; `getCalendarSheetTitle` returns `日期详情`/`值班详情`/`事件记录`/`电话联系` by kind and `''` for none. The initial state is `{ sheetKey: 0, visible: false }`. Write `calendar-sheet-host.test.ts` first: date open yields key 1 and `日期详情`; request-close retains date; matching close yields no content/title; repeated request is referentially unchanged; an events-to-phone replacement gets a new key; its late old-key completion leaves the visible phone untouched.

Page additions are exactly:

```ts
interface CalendarPageData {
  // Task 7 fields ...
  readonly eventTimeline: EventTimelineState;
  readonly sheetHost: CalendarSheetHostState;
  readonly sheetKind: CalendarSheetKind;
  readonly sheetTitle: string;
}
interface CalendarPageMethods {
  handleCopy(event: ActionIdEvent): void;
  handleDial(event: ActionIdEvent): void;
  handleRouteAction(event: ActionIdEvent): void;
  handleSheetClosed(event: SheetLifecycleEvent): void;
  handleSheetRequestClose(event: SheetLifecycleEvent): void;
}
type ActionIdEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;
type SheetLifecycleEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly sheetKey?: unknown }
>;
```

`handleRouteAction` narrows the custom-event `detail.actionId`, role, group, and all data VMs in the current three slots, then calls `resolveCalendarRouteAction(actionId, group.role, dataMonths)`. Undefined is a no-op. It maps `date`, `assignment`, `events`, and `phone` targets to the corresponding `CalendarSheetContent`, calls `openCalendarSheet`, derives kind/title, and sets `sheetHost`/`sheetKind`/`sheetTitle` in exactly one call. For `events` only, it also resets `eventTimeline` to idle and calls `void eventController.load(group.id, assignment)`; guest targets are already `assignment` and therefore cannot call the event endpoint. The event controller dependency injects `listEvents: (groupId, cursor, pageSize) => listEvents(groupId, cursor, pageSize)` and a publish callback that calls `setData({ eventTimeline: state })` only while the host content is the same visible events assignment **and** the current active group ID equals `state.groupId`. No component imports an endpoint.

`handleSheetRequestClose` narrows `detail.sheetKey`, ignores a non-current key, and sets only the result of `requestCalendarSheetClose`; it does not reset events or clear content. `handleSheetClosed` narrows the key, remembers whether the currently retained content is events, applies `completeCalendarSheetClose`, derives kind/title, and clears all three page fields in one call; it calls `eventController.reset()` exactly once only if that completion removed the events content. A stale, reopened, or mismatched close event has zero `setData`/reset side effects. Page WXML contains exactly one unconditional `<bottom-sheet title="{{sheetTitle}}" visible="{{sheetHost.visible}}" sheet-key="{{sheetHost.sheetKey}}">`, binds both lifecycle events on it, and conditionally renders one body by `sheetKind` in its slot. Because request-close leaves kind/content unchanged, the body remains mounted throughout closing; switching bodies retains the host and supplies its new key.

`handleDial` and `handleCopy` narrow `event.detail.actionId` to a non-empty string and call `controller.performPhoneAction(actionId)` once. The controller performs exactly one member-bound `wx.makePhoneCall` for a `dial` action or one member-bound `wx.setClipboardData` for a `copy` action; unknown/mismatched action IDs return false and make no platform call. V3-2 adds no toast, retry, event pagination, or phone permission; the sheet stays open after either attempt and errors remain platform-managed.

The boundary guard requires exactly one `bottom-sheet`, all four detail-body tags, `bind:request-close="handleSheetRequestClose"`, `bind:closed="handleSheetClosed"`, `bind:dial="handleDial"`, and `bind:copy="handleCopy"`; it rejects raw contract fields and `wx.` in component files. Page-source checks require `createEventTimelineController`, `openCalendarSheet`, `completeCalendarSheetClose`, `getCalendarSheetKind`, `getCalendarSheetTitle`, and a single `listEvents(` occurrence in the injection wrapper; it rejects `activeSheet`, `openRoute`, direct endpoint calls from components, and `<details` in mini-program WXML.

### 8.6 Task 8 Steps

- [x] **Step 1:** Confirm Task 7's local commit, `origin/main` ancestor, only approved plan/Task 6/Task 7 commits ahead, no untracked path except `apps/miniprogram/minitest/`, and its validation set is green.
- [x] **Step 2:** Write `bottom-sheet-logic.test.ts` and `calendar-sheet-host.test.ts`; observe module-missing red states; implement their pure modules and green every phase/key assertion.
- [x] **Step 3:** Write `event-description.test.ts` against the real fixture where possible and controlled local events where the deprecated plan sample is absent; observe module-missing red; implement the pure display boundary and green the no-invented-initiation-time assertion.
- [x] **Step 4:** Write `event-timeline-controller.test.ts`; observe module-missing red; implement single-page, client-filtered controller semantics and green all call/generation/error assertions.
- [x] **Step 5:** Create `bottom-sheet` and four detail components with their own `index.json` dependencies. Update the boundary guard before page JSON/WXML/TS/WXSS; observe guard red, then wire the keyed host and component events to green.
- [x] **Step 6:** Run this exact Task 8 validation set:

```powershell
pnpm vitest run apps/miniprogram/features/calendar/calendar-logic.test.ts apps/miniprogram/features/calendar/calendar-view-model.test.ts apps/miniprogram/features/calendar/calendar-routing.test.ts apps/miniprogram/features/calendar/calendar-views.test.ts apps/miniprogram/features/calendar/calendar-view-mode.test.ts apps/miniprogram/features/calendar/calendar-surface.test.ts apps/miniprogram/features/calendar/calendar-sheet-host.test.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/store/calendar-cache.test.ts apps/miniprogram/features/calendar/calendar-golden-data.test.ts apps/miniprogram/features/sheets/bottom-sheet-logic.test.ts apps/miniprogram/features/events/event-description.test.ts apps/miniprogram/features/events/event-timeline-controller.test.ts scripts/miniprogram-calendar-boundary.test.mjs
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check apps/miniprogram/features/calendar/calendar-routing.ts apps/miniprogram/features/calendar/calendar-routing.test.ts apps/miniprogram/features/calendar/calendar-sheet-host.ts apps/miniprogram/features/calendar/calendar-sheet-host.test.ts apps/miniprogram/features/calendar/calendar-page-controller.ts apps/miniprogram/features/calendar/calendar-page-controller.test.ts apps/miniprogram/features/events/event-description.ts apps/miniprogram/features/events/event-description.test.ts apps/miniprogram/features/events/event-timeline-controller.ts apps/miniprogram/features/events/event-timeline-controller.test.ts apps/miniprogram/features/sheets/bottom-sheet-logic.ts apps/miniprogram/features/sheets/bottom-sheet-logic.test.ts apps/miniprogram/components/bottom-sheet/index.json apps/miniprogram/components/bottom-sheet/index.ts apps/miniprogram/components/bottom-sheet/index.wxml apps/miniprogram/components/bottom-sheet/index.wxss apps/miniprogram/components/date-detail-sheet/index.json apps/miniprogram/components/date-detail-sheet/index.ts apps/miniprogram/components/date-detail-sheet/index.wxml apps/miniprogram/components/date-detail-sheet/index.wxss apps/miniprogram/components/duty-detail-sheet/index.json apps/miniprogram/components/duty-detail-sheet/index.ts apps/miniprogram/components/duty-detail-sheet/index.wxml apps/miniprogram/components/duty-detail-sheet/index.wxss apps/miniprogram/components/phone-sheet/index.json apps/miniprogram/components/phone-sheet/index.ts apps/miniprogram/components/phone-sheet/index.wxml apps/miniprogram/components/phone-sheet/index.wxss apps/miniprogram/components/event-timeline-sheet/index.json apps/miniprogram/components/event-timeline-sheet/index.ts apps/miniprogram/components/event-timeline-sheet/index.wxml apps/miniprogram/components/event-timeline-sheet/index.wxss apps/miniprogram/pages/calendar/index.json apps/miniprogram/pages/calendar/index.ts apps/miniprogram/pages/calendar/index.wxml apps/miniprogram/pages/calendar/index.wxss scripts/miniprogram-calendar-boundary.test.mjs
pnpm smoke:check-core
git diff --exit-code -- packages/contracts/src apps/miniprogram/api/endpoints.ts apps/miniprogram/api/client.ts
git diff --check
```

Expected: every command exits `0`, the contract/API diff is empty, and record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序日历详情组件/事件/电话/底部面板，未改 Web/API/契约/认证/构建核心链路）。`

- [ ] **Step 7:** DevTools/simulator gate: blank date → date sheet; row → duty; guest marker → duty and member marker → event; phone → phone sheet; confirmed dial/unconfirmed copy each call once; `<80px` returns to zero, `≥80px` closes, and content drag activates only after top. Use the persisted real Web snapshot to inspect each event/marker type it contains; missing types remain covered by the pure controlled-vector tests. Capture opening, scroll, bounce, closing, stale-key replacement, and each sheet state.
- [ ] **Step 8:** Complete the semantic audit, update checkpoint docs, review `git diff`/`git diff --cached` and behavior changes, stage only Task 8 files plus docs, validate `git diff --cached --check`, then create the **local** commit `feat(miniprogram): add calendar detail sheets`.
- [ ] **Step 9:** After all three local commits exist and all stop conditions are met, run the **full V3-2 checkpoint set** once:

```powershell
pnpm vitest run apps/miniprogram scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm smoke:check-core
git diff --check
git log --oneline -6
git push
```

Expected: all tests pass, `HEAD` contains the three V3-2 commits, and one normal fast-forward push publishes them to `origin/main`. Record the push result in `docs/project-status.md`; a failed push keeps all three local commits and records the failure without force-pushing.

**V3-2 stop condition:** stop after the single push attempt. Do not start Task 9 or any V3-3 work.

---

## Renderer, Device, And Performance Validation Matrix

Every task records literal evidence; claims without evidence stay `待验证`.

| Dimension       | Required checks                                                                                                                                                                  | Record                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| DevTools        | Stable `2.01.2510290`; debug base library `3.16.2`; `pnpm miniprogram:devtools:build-npm` warnings; `pnpm miniprogram:devtools:preview`; `pnpm miniprogram:smoke` route coverage | version, library, build output, warnings list                                                   |
| Renderer        | Calendar page `renderer: skyline` + `componentFramework: glass-easel`; forced WebView run on the same page; automatic-fallback on unsupported client                             | literal indicator, forced-WebView result, `automatic fallback: unverified` unless real evidence |
| Screenshots     | Golden month in Web (existing Web golden baseline) vs DevTools month/week/list and each sheet state; verify full names, colors, badges, holiday/调休, padding, cross-month row   | paths under ignored `.tmp-miniprogram-preview`, diff notes                                      |
| Low-end Android | WeChat client version, base library; swipe month, week/list switch, sheet drag/scroll, phone sheet open                                                                          | device, WeChat version, min/avg fps, long frames, touch-to-visual latency, memory               |
| iOS             | Same gesture walk on one iPhone                                                                                                                                                  | device, iOS/WeChat version, same metrics                                                        |
| Performance     | `wx.getPerformance` or DevTools Performance: first calendar load, month switch, view-mode switch, sheet open/close, event load; main-package size                                | literal ms values and package size                                                              |
| Cache           | Offline/failure drill: cached snapshot + `可能不是最新数据` badge; no error state when cache exists; no offline write                                                            | screenshots, call counts                                                                        |

## Documentation Checkpoint (This Plan Round)

After this plan passes self-review, update in one docs-only commit:

1. `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`: revise the V3-2 stage-index row to this plan, state `已重新审校，待用户复核；批准前禁止执行 Task 6`, and state contract-first/test-first/code-light plus three local task commits and one push after Task 8.
2. `docs/project-status.md`: record the corrected V3-1/debug-log gate, Git facts, `12` files / `74` focused tests, typecheck/core-guard results, only `apps/miniprogram/minitest/` untracked, and next batch `user approval → Task 6 only; stop after every task; one push after Task 8`. The plan remains `待用户复核`.
3. `docs/debug/debug-feedback-log.md`: append `### V3-2 计划复审与门禁修正（2026-08-10）`, including the corrected stale summary, V3-1 evidence, plan corrections, `运行/浏览器验证：pnpm smoke:browser 不适用（仅计划文档变更，未改 Web/API/契约/认证/构建核心链路）。`, and `pnpm smoke:check-core 通过。`.
4. Stage only the four listed docs, review `git diff --cached --check` and `git diff --cached`, then create local commit `docs(miniprogram): revise V3-2 calendar execution plan`. Do **not** run `git push`; it is intentionally deferred to the Task 8 checkpoint.

## Plan Self-Review Checklist

Run before the documentation commit and fix any failure inline:

```powershell
$planPath = 'docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md'
$forbiddenTerms = @('T' + 'ODO', 'T' + 'BD', '自行' + '实现', '按需' + '处理', '适当' + '校验', '类似上一' + '任务', 'fill in ' + 'details', 'implement ' + 'later')
$placeholderMatches = foreach ($term in $forbiddenTerms) { $match = rg -n --fixed-strings -- $term $planPath; if ($LASTEXITCODE -eq 0) { $match } elseif ($LASTEXITCODE -ne 1) { throw "placeholder scan failed: $term" } }
if ($null -ne $placeholderMatches) { throw "placeholder found: $placeholderMatches" }
$required = @('routeActionId', 'resolveCalendarRouteAction', 'rotateMonthSlots', 'recenterMonthSlots', 'switchCalendarViewMode', 'shouldCloseBottomSheet', 'buildEventTimelineDisplay', 'CalendarCacheIdentity', 'CalendarSheetHostState', 'golden-a1', 'golden-a5')
foreach ($identifier in $required) { rg -q --fixed-strings -- $identifier $planPath; if ($LASTEXITCODE -ne 0) { throw "missing plan identifier: $identifier" } }
rg -q --fixed-strings 'CalendarChangeMarker' packages/contracts/src/calendar.ts; if ($LASTEXITCODE -ne 0) { throw 'contract marker check failed' }
rg -q --fixed-strings 'export function listEvents' apps/miniprogram/api/endpoints.ts; if ($LASTEXITCODE -ne 0) { throw 'endpoint signature check failed' }
$lineCount = (Get-Content -LiteralPath $planPath -Encoding utf8).Count; if ($lineCount -lt 800 -or $lineCount -gt 1200) { throw "plan line count out of range: $lineCount" }
pnpm exec prettier --check $planPath docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md docs/project-status.md docs/debug/debug-feedback-log.md
git diff --check
```

Expected: no placeholder hits; every stable identifier in later tasks matches an earlier definition; contract/endpoint source still matches the plan; 800–1200 lines; Prettier and `git diff --check` pass. Then verify the spec-coverage mapping: design sections 3 (1:1 calendar), 5 (calendar-shell/grid/rows/badges/tags/sheets), 6 (VM, markers, touch), 10 (read-only cache), 11 (performance/package), 12 (tests/screenshots), 13 (stop conditions), 14 (no generic calendar), 15 (execution model) are covered by Tasks 6–8; anything missing is a plan failure to fix before commit. After the local docs commit, **stop**. Do not execute Task 6 in this conversation.
