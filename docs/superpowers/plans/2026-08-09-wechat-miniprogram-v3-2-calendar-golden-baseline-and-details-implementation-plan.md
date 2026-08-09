# WeChat Mini Program V3-2 Calendar Golden Baseline And Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V3-2 calendar golden baseline on the real V3-1 checkpoint: self-drawn calendar grid with micro badges and independent event routing (Task 6), three-page month swiping plus month/week/list modes and a read-only calendar cache (Task 7), and date/duty/event/phone detail bottom sheets (Task 8), without adding APIs, contract fields, marker types, permissions, or offline writes.

**Architecture:** V3-2 is contract-first, test-first, and code-light. It extends the renderer-neutral `CalendarMonthViewModel` and the injected `CalendarPageController` from V3-1; all routing, mode, cache, sheet, and event-timeline semantics live in pure TypeScript modules with exact signatures and pinned tests. WXML components (`calendar-grid`, `assignment-row`, `marker-badge`, `holiday-tag`, `calendar-week`, `calendar-list`, and four sheets) consume only VM fields and emit stable action IDs; no component imports `wx`, endpoints, or the session singleton. The calendar page remains page-level Skyline/`glass-easel`; no Worklet runtime, TDesign Calendar, generic calendar library, or unverified Skyline component is introduced.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, Vitest 3, WeChat Mini Program base library 3.16.2, WeChat DevTools Stable `2.01.2510290`, Skyline/`glass-easel` calendar page only, native `swiper`/`scroll-view`/`picker`/`switch`, `wx.makePhoneCall`/`wx.setClipboardData`/`wx.getStorageSync`/`wx.setStorageSync`, no new dependency.

---

## Plan Authority And Prerequisite Gate

This plan is authorized only because the V3-1 completion gate is recorded and reproducible. Before any checkbox, the executor must confirm:

- `git status --short --branch` shows `main` tracking `origin/main`; the only untracked path is `apps/miniprogram/minitest/` (recorded DevTools artifact, preserved, never staged).
- `git log --oneline --decorate -10` contains `ce21a51 feat(miniprogram): add typed calendar view model`, `bc534c0 feat(miniprogram): add V3 auth and role routing`, and `ebfbb31 feat(miniprogram): add V3 app shell and native navigation` in `origin/main` history; `HEAD == origin/main`.
- `git diff --stat ce21a51..HEAD` touches only `docs/project-status.md` and `docs/debug/debug-feedback-log.md` (no production code after the V3-1 code checkpoint).
- `docs/project-status.md` records V3-1 as complete / 待用户复核, lists the three checkpoint hashes as pushed, and forbids Task 6 execution without this plan.
- Focused validation passes: `pnpm vitest run apps/miniprogram scripts/miniprogram-calendar-boundary.test.mjs scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs`, `pnpm miniprogram:typecheck`, `pnpm smoke:check-core`.

Recorded at plan time (2026-08-09): `HEAD == origin/main == 5c1715a`; `ce21a51..HEAD` is docs-only; focused suite `12` files / `74` tests passed; `pnpm miniprogram:typecheck` exit `0`; `pnpm smoke:check-core` exit `0` with `变更文件：apps/miniprogram/minitest/` (untracked only). If any of these facts is false when a task starts, stop and regenerate the task from the actual checkpoint instead of adapting paths or signatures from memory.

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
- The plan document checkpoint itself (this round) is committed and pushed as a docs-only checkpoint with message `docs(miniprogram): plan V3-2 calendar golden baseline and details`.

## File Responsibility Map

Every created/modified file has one primary responsibility. Read-only boundaries are explicit.

| Path                                                                                                        | Task/action                    | Single responsibility                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/miniprogram/features/calendar/calendar-golden-data.ts`                                                | T6 create                      | Own the typed V3-2 golden calendar/holiday/events fixture consumed by VM, routing, mode, sheet, and timeline tests.                                               |
| `apps/miniprogram/features/calendar/calendar-golden-data.test.ts`                                           | T6 create; T7/T8 modify        | Pin golden dataset semantics: multi-assignment day, full names, colors, holidays/调休, markers, phone permission, past/today/weekend/cross-month, event timeline. |
| `apps/miniprogram/features/calendar/calendar-routing.ts`                                                    | T6 create; T8 modify           | Resolve stable action IDs to date/assignment/events/phone route targets with exact regexes and role-based marker routing.                                         |
| `apps/miniprogram/features/calendar/calendar-routing.test.ts`                                               | T6 create; T8 modify           | Prove every row of the event routing table, invalid/empty/stale action IDs, and guest marker fallback.                                                            |
| `apps/miniprogram/components/calendar-grid/index.{json,ts,wxml,wxss}`                                       | T6 create                      | Render weekday header and flex 7-column month grid from `weeks`; emit `route` with `day.routeActionId`; never render raw contract fields.                         |
| `apps/miniprogram/components/assignment-row/index.{json,ts,wxml,wxss}`                                      | T6 create                      | Render one duty row (full name, shift badge, time, markers, phone entry) from `CalendarAssignmentViewModel`; emit `route` and stop propagation.                   |
| `apps/miniprogram/components/marker-badge/index.{json,ts,wxml,wxss}`                                        | T6 create                      | Render one marker badge with label/description/aria and VM token classes; emit `route` with `marker.actionId`.                                                    |
| `apps/miniprogram/components/holiday-tag/index.{json,ts,wxml,wxss}`                                         | T6 create                      | Render off-day/workday/neutral holiday tag from `CalendarHolidayViewModel`; short label visible, full name in aria-label.                                         |
| `apps/miniprogram/features/calendar/calendar-view-model.ts`                                                 | T6/T7 modify                   | Add `routeActionId` (T6), `mode`/`savedAt`/`isStale` and week/list builders (T7); remain renderer-neutral and contract-read-only.                                 |
| `apps/miniprogram/features/calendar/calendar-view-model.test.ts`                                            | T6/T7 modify                   | Extend existing fixtures/tests for route IDs, mode builders, and cached fields; no `as any`.                                                                      |
| `apps/miniprogram/pages/calendar/index.json`                                                                | T6/T7/T8 modify                | Register grid/row/badge/tag components (T6), week/list components (T7), and four sheets (T8); keep page-level Skyline.                                            |
| `apps/miniprogram/pages/calendar/index.ts`                                                                  | T6/T7/T8 modify                | Own page state: controller injection, swiper slot routing, view mode, sheets, event controller; no network orchestration outside controllers.                     |
| `apps/miniprogram/pages/calendar/index.wxml`                                                                | T6/T7/T8 modify                | Consume only VM fields/components; bind stable action IDs and sheet events.                                                                                       |
| `apps/miniprogram/pages/calendar/index.wxss`                                                                | T6/T7/T8 modify                | Own page-level layout tokens (toolbar, swiper, mode bar, sheet host) with flex/block rules only.                                                                  |
| `scripts/miniprogram-calendar-boundary.test.mjs`                                                            | T6/T7/T8 modify                | Keep proving WXML consumes VM/component fields only, page JSON keeps Skyline, no unsupported marker/event/TDesign/grid/CSS fields.                                |
| `apps/miniprogram/features/calendar/calendar-views.ts`                                                      | T7 create                      | Port Web week/list helpers and `buildDayList` plus `formatChinaDateTime`; pure, no `wx`.                                                                          |
| `apps/miniprogram/features/calendar/calendar-views.test.ts`                                                 | T7 create                      | Lock week start/days/label, visible-week, today index, day-list ordering, and CST date-time formatting.                                                           |
| `apps/miniprogram/features/calendar/calendar-view-mode.ts`                                                  | T7 create                      | Own the month/week/list mode state machine and month/week stepping rules.                                                                                         |
| `apps/miniprogram/features/calendar/calendar-view-mode.test.ts`                                             | T7 create                      | Pin the mode transition table and month/week sync semantics.                                                                                                      |
| `apps/miniprogram/store/calendar-cache.ts`                                                                  | T7 create                      | Own read-only calendar snapshot cache: key, freshness, read/write/invalidate, parse-error isolation.                                                              |
| `apps/miniprogram/store/calendar-cache.test.ts`                                                             | T7 create                      | Lock key format, freshness window, write/read/invalidate, corrupt-record and storage-throw handling, no offline write semantics.                                  |
| `apps/miniprogram/components/calendar-week/index.{json,ts,wxml,wxss}`                                       | T7 create                      | Render one week (7 day cells) from a `CalendarWeekViewModel`; emit `route`.                                                                                       |
| `apps/miniprogram/components/calendar-list/index.{json,ts,wxml,wxss}`                                       | T7 create                      | Render the list view from `days`; emit `route`.                                                                                                                   |
| `apps/miniprogram/features/calendar/calendar-page-controller.ts`                                            | T7 modify                      | Add cache ports and view-mode state; keep generation/in-flight/slot semantics; cache-first publish on network failure only.                                       |
| `apps/miniprogram/features/calendar/calendar-page-controller.test.ts`                                       | T7 modify                      | Extend harness with cache/user-id ports; pin cache-first sequences, stale-cache fallback, and view-mode rebuild call counts.                                      |
| `apps/miniprogram/components/bottom-sheet/index.{json,ts,wxml,wxss}`                                        | T8 create                      | Generic sheet host with open/close/drag/bounce state machine and mask; emits `close`; no business data.                                                           |
| `apps/miniprogram/features/sheets/bottom-sheet-logic.ts`                                                    | T8 create                      | Pure phase machine, drag threshold/velocity decision, offset clamp; no `wx`.                                                                                      |
| `apps/miniprogram/features/sheets/bottom-sheet-logic.test.ts`                                               | T8 create                      | Pin phase transitions, 80 px / 0.8 px·ms⁻¹ thresholds, and clamp bounds.                                                                                          |
| `apps/miniprogram/components/date-detail-sheet/index.{json,ts,wxml,wxss}`                                   | T8 create                      | Show full date/weekday/holiday and all assignments from one `CalendarDayViewModel`; emit `close`/`route`.                                                         |
| `apps/miniprogram/components/duty-detail-sheet/index.{json,ts,wxml,wxss}`                                   | T8 create                      | Show one assignment's member/role/shift/time/colors/markers/phones; emit `close`/`route`.                                                                         |
| `apps/miniprogram/components/phone-sheet/index.{json,ts,wxml,wxss}`                                         | T8 create                      | Show member name and long/short numbers with dial (confirmed) or copy (unconfirmed) buttons; emit `close`/`dial`/`copy`.                                          |
| `apps/miniprogram/components/event-timeline-sheet/index.{json,ts,wxml,wxss}`                                | T8 create                      | Present event timeline items/status/message/hasMore and change-chain summary; emit `close`.                                                                       |
| `apps/miniprogram/features/events/event-description.ts`                                                     | T8 create                      | Port Web event-timeline.ts narrative/type-label/change/chain/format helpers; pure, no `wx`.                                                                       |
| `apps/miniprogram/features/events/event-description.test.ts`                                                | T8 create                      | Lock narratives, labels, change extraction, chain summary, fallback for unknown types, and JSON formatting.                                                       |
| `apps/miniprogram/features/events/event-timeline-controller.ts`                                             | T8 create                      | Load one `listEvents` page, filter by `affectedShiftIds`, build items, single-flight per assignment, generation guard, terminal publish.                          |
| `apps/miniprogram/features/events/event-timeline-controller.test.ts`                                        | T8 create                      | Pin call counts, stale-response suppression, error message preservation, empty/ready states, and `hasMore`.                                                       |
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

All route resolution requires the VM to be a data status (`cached`/`ready`/`refreshing`) after narrowing; state VMs return `undefined`. Empty, non-string, stale (from an old month slot), or unknown action IDs return `undefined` and produce no side effect.

## Golden Dataset (2026-08, Golden Calendar)

`apps/miniprogram/features/calendar/calendar-golden-data.ts` exports exactly these normative values as typed constants (`CalendarReadModel`, `HolidayReadModel`, `readonly ScheduleEvent[]`); the JSON below maps 1:1 to contract field names and the executor writes them with the exact same values:

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
  {"affectedMembershipIds":[],"affectedShiftIds":[],"eventStatus":"completed","eventType":"schedule_period_published","groupId":"golden-group","id":"golden-event-4","objectType":"schedule_period","occurredAt":"2026-08-14T18:00:00+08:00","operationId":"golden-op-4","schedulePeriodId":"golden-period-1"},
  {"affectedMembershipIds":[],"affectedShiftIds":[],"beforeData":{"shiftTypeName":"旧班种","status":"pending"},"afterData":{"shiftTypeName":"新班种","status":"approved"},"eventStatus":"completed","eventType":"shift_type_changed","groupId":"golden-group","id":"golden-event-5","objectType":"shift_type","occurredAt":"2026-08-13T15:00:00+08:00","operationId":"golden-op-5"}
]
```

The dataset is deliberately normative: `golden-a1` (confirmed member, 长号+短号, dial), `golden-a2` (unconfirmed member, copy; swap+leave-cover markers; planned-only fallback differs from actual), `golden-a3` (no phone number; overtime+swap; long full name `欧阳修远`; night shift 20:00–02:00 crossing midnight), `golden-a4` (empty actual name stays empty, member with no number), `golden-a5` (cross-month 08-31 20:00 → 09-01 04:00; overtime). Today is `2026-08-15` (Saturday, 调休上班 workday holiday); `2026-08-01` (past, Saturday, 建军节 off-day) and `2026-08-16` (Sunday, 休息日 off-day) cover past/today/weekend/holiday states; grid padding covers `2026-07-27…07-31` (week 0) and `2026-09-01…09-06` (last week).

## Semantic Audit Contract (All Tasks)

Every task's pre-commit audit must re-verify this exact checklist against the real diff:

```text
Receiver/this: pure logic/VM/cache/sheet modules use no receiver; components call this.triggerEvent and this.setData through their own receiver; page handlers call this.setData; injected wx wrappers keep member calls (wx.makePhoneCall, wx.setClipboardData, wx.getStorageSync, wx.setStorageSync, wx.nextTick if used).
Promise/error: calendar controller and event controller share one exact Promise per in-flight context/assignment; changing context supersedes the slot; Promise.all rejects as one load; classified error keeps the original message; stale generation/finally cannot publish, clear a newer slot, or write cache; page-facing rejections terminate in `void` with no unhandled rejection.
Nullish: actualMemberName ?? plannedMemberName ?? '待定'; empty string is not replaced; phoneActions use length > 0; optional cache/user-id/role use explicit undefined checks; no `||` that would swallow ''.
Type narrowing: viewModel.status/kind and EventTimelineState.status are discriminated before field access; dataset values are narrowed to non-empty string; role comes from the typed session group; route regex groups are revalidated before use; no `as any` or non-null assertion.
Side effects/calls: filters and mapping are pure and non-mutating; each verified dial/copy calls exactly one wx port; each calendar month load calls exactly one endpoint pair (guest or protected) plus at most one cache write; each assignment event load calls listEvents exactly once per in-flight request; setData happens only through page/component receivers; no endpoint call from components.
Stale async: numeric requestGeneration in both controllers; cache writes and publishes require the current generation; swiper re-center uses a locked flag and the controller key; an old month's resolution cannot publish into the active slot.
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

Expected: `main` tracks `origin/main` with zero divergence, HEAD is the docs-only plan checkpoint (or a later approved checkpoint), all 12 files / 74 tests pass, typecheck exits `0`, and only `apps/miniprogram/minitest/` is untracked. Any other state stops Task 6.

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
  CalendarMonthViewModel,
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
  viewModel: CalendarMonthViewModel | undefined,
): CalendarRouteTarget | undefined;
```

Implementation contract (normative):

1. `actionId.length === 0` or `viewModel` is undefined or a state status (`loading`/`error`/`forbidden`/`conflict`) → `undefined`.
2. Narrow the VM to a data status; for `mode: 'week'`/`'list'` search `week.days`/`days`; for `mode: 'month'` search `weeks[].days[]`. Only `kind: 'day'` cells participate.
3. First pass: exact equality against `day.routeActionId` → `{ kind: 'date', day }`; exact equality against `assignment.routeActionId` → `{ kind: 'assignment', assignment }`.
4. Second pass: for each marker in each assignment, exact equality with `marker.actionId` → `role === 'guest' ? { kind: 'assignment', assignment } : { kind: 'events', assignment }`.
5. Third pass: for each phone action in each assignment, exact equality with `phoneAction.actionId` → `{ kind: 'phone', phoneAction, assignment }`.
6. No match → `undefined`. Never derive a target from `kind` or `number` supplied by WXML.

Create `calendar-routing.test.ts` with a harness that builds the golden VM once (`buildCalendarMonthViewModel({ calendar: goldenCalendar, filters: {}, holidays: goldenHolidays, status: 'ready', today: goldenToday })`) and asserts the exact routing table rows:

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
}
```

`handleRouteAction` narrows `dataset.actionId` to a non-empty string, reads the active group's role from the session snapshot, and calls `resolveCalendarRouteAction(actionId, role, this.data.viewModel)`; a defined target is `void this.controller?.openRoute(target)` — Task 6 stores the target in an instance field and renders a temporary `console`/toast-free placeholder? **No:** Task 6 must not open sheets. Normative Task 6 behavior: route resolution is exercised only by unit tests; the page handler asserts `target !== undefined` and keeps a `lastRoute` instance field (tested by the boundary guard via page source, not by runtime). Sheets arrive in Task 8 and replace `lastRoute`.

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
git diff --check
```

Expected: all pass; `git diff -- packages/contracts/src apps/miniprogram/api/endpoints.ts` is empty. Browser smoke: **not applicable** (Task 6 touches only mini-program components/features/pages/scripts guards; record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序日历组件/路由/VM，未改 Web/API/契约/认证/构建核心链路）` in the debug log).

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

Semantics are copied exactly from the Web implementation: Monday-first week start (`(getUTCDay() + 6) % 7`); `getWeekLabel('2026-08-05') === '2026年8月3日–8月9日'`; `getVisibleWeekForMonth` returns the week of `today` when `today` is inside the month, otherwise the week of the month's first day; `buildDayList` includes only dates that have assignments, sorted ascending, each day's assignments sorted by the Web `groupAssignmentsByDate` order (start time with 00:00 last, then role name zh-Hans-CN, slot, period). `formatChinaDateTime` is a new additive helper: parse the instant, shift by +8h, format UTC fields as `YYYY-MM-DD HH:mm` (e.g. `2026-08-15T09:00:00+08:00` → `2026-08-15 09:00`).

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
expect(getWeekLabel('2026-08-05')).toBe('2026年8月3日–8月9日');
expect(getVisibleWeekForMonth('2026-08', '2026-08-12')).toBe('2026-08-10');
expect(getVisibleWeekForMonth('2026-09', '2026-08-12')).toBe('2026-08-31');
expect(getWeekdayLabel('2026-08-03')).toBe('周一');
expect(isWeekend('2026-08-08')).toBe(true);
expect(formatChinaDateTime('2026-08-15T09:00:00+08:00')).toBe('2026-08-15 09:00');
expect(() => addWeeks('2026-08-05', 1.5)).toThrow();
```

Expected red: module missing. The golden day-list test builds `buildDayList(goldenCalendar.assignments, goldenToday)` and asserts dates `['2026-08-15', '2026-08-16', '2026-08-31']` with `2026-08-15` first and its three assignments in golden order.

### 7.2 View-Mode State Machine (test-first)

Create `apps/miniprogram/features/calendar/calendar-view-mode.ts`:

```ts
export type CalendarViewMode = 'list' | 'month' | 'week';

export interface CalendarViewModeState {
  readonly mode: CalendarViewMode;
  readonly month: string;
  readonly weekStart: string;
}

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
```

Transition table (normative):

| Method                                          | From state          | Next state                                                                                                                                       |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createCalendarViewModeState(today)`            | —                   | `{ mode: 'month', month: getCurrentBusinessMonth(), weekStart: getWeekStartDate(today) }`                                                        |
| `switchCalendarViewMode(state, 'month', today)` | any                 | `mode: 'month'`; `month`/`weekStart` unchanged                                                                                                   |
| `switchCalendarViewMode(state, 'week', today)`  | any                 | `mode: 'week'`; `weekStart` unchanged if non-empty, else `getVisibleWeekForMonth(state.month, today)`                                            |
| `switchCalendarViewMode(state, 'list', today)`  | any                 | `mode: 'list'`; `month`/`weekStart` unchanged                                                                                                    |
| `stepCalendarMonth(state, delta, today)`        | any                 | `month: addBusinessMonths(state.month, delta)`; `mode: 'week'` → `weekStart: getVisibleWeekForMonth(month, today)`; other modes keep `weekStart` |
| `stepCalendarWeek(state, delta)`                | `mode: 'week'` only | `weekStart: addWeeks(state.weekStart, delta)`; `month: getBusinessMonthOf(weekStart)` (Web `syncMonthToWeek`)                                    |
| `stepCalendarWeek(state, delta)`                | `mode !== 'week'`   | throws `Error('Week stepping requires week mode.')`                                                                                              |

`getBusinessMonthOf` is an additive export of `calendar-views.ts` (returns `businessDate.slice(0, 7)` after validation). Tests pin every row plus immutability of the input state.

### 7.3 Read-Only Cache Module (test-first)

Create `apps/miniprogram/store/calendar-cache.ts`:

```ts
import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';

export const calendarCacheKeyPrefix = 'schedule.calendarCache.v1:';
export const calendarCacheFreshnessMilliseconds = 5 * 60 * 1000;

export interface CalendarCacheRecord {
  readonly businessMonth: string;
  readonly calendar: CalendarReadModel;
  readonly groupId: string;
  readonly holidays: HolidayReadModel;
  readonly savedAt: string; // ISO 8601 UTC
}

export interface CalendarCachePort {
  read(key: string): CalendarCacheRecord | undefined;
  remove(key: string): void;
  write(key: string, record: CalendarCacheRecord): void;
}

export function buildCalendarCacheKey(
  userId: string,
  groupId: string,
  businessMonth: string,
): string;
export function isCalendarCacheFresh(record: CalendarCacheRecord, now?: Date): boolean;

export interface CalendarCache {
  read(userId: string, groupId: string, businessMonth: string): CalendarCacheRecord | undefined;
  write(
    userId: string,
    groupId: string,
    businessMonth: string,
    calendar: CalendarReadModel,
    holidays: HolidayReadModel,
    now?: Date,
  ): void;
  invalidate(userId: string, groupId: string, businessMonth?: string): void;
}

export function createCalendarCache(port: CalendarCachePort): CalendarCache;
```

Rules (normative):

- Key format: `` `schedule.calendarCache.v1:${userId}:${groupId}:${businessMonth}` ``; no user id or empty segment ever produces a key (throw on empty `userId`/`groupId`/`businessMonth`).
- `write` stamps `savedAt = now.toISOString()` (default `new Date()`), stores the literal `calendar`/`holidays` objects, and calls `port.write` exactly once.
- `isCalendarCacheFresh` returns `true` only when `record.savedAt` parses and `now - savedAt <= 5 * 60 * 1000`; an unparsable `savedAt` is stale.
- `read` returns `undefined` when the port returns undefined, when JSON parsing fails, when `groupId`/`businessMonth` mismatch the record, or when the calendar/holidays fail contract shape validation (`z.parse` from `@schedule/contracts`); it never throws to the caller.
- `invalidate(userId, groupId, businessMonth?)` removes the exact key, or all keys with the prefix `schedule.calendarCache.v1:${userId}:${groupId}:` when month is omitted (the port must expose a `keys()` capability? **No**: the port has only read/remove/write; month-omitted invalidation is implemented by an injected `listKeys?: () => readonly string[]` optional port — if absent, `invalidate` with month omitted removes only the exact month key and returns a `removedCount` of 0/1; V3-2 tests use a memory port with `listKeys`).
- This module is a read snapshot only; it never creates a write queue, never buffers a mutation, and is not used by any write flow in V3-2.

Create `calendar-cache.test.ts` with a memory port and these assertions: key format; fresh/stale boundary (`now = savedAt + 5min` → fresh; `+1ms` → stale); write-then-read round trip; corrupt JSON → undefined without throw; storage port throwing → `read` returns undefined; `invalidate` with month removes one key and `removedCount` is exact; `invalidate` without month and `listKeys` removes all group keys; empty `userId` throws.

### 7.4 Controller Cache Integration (test-first)

Extend `apps/miniprogram/features/calendar/calendar-page-controller.ts`:

```ts
export interface CalendarPageControllerDependencies {
  // V3-1 fields unchanged ...
  readonly cache: CalendarCache;
  readonly getCurrentUserId: () => string | undefined;
}

export interface CalendarPageController {
  // V3-1 methods unchanged ...
  setViewMode(mode: CalendarViewMode, weekStart?: string): void;
}
```

Private state adds `viewMode: CalendarViewMode = 'month'`, `weekStart: string | undefined`, and reuses the existing generation/in-flight machinery. New load flow (replaces V3-1 flow; normative):

1. Same-context success-cache check first, exactly as V3-1 (`force !== true && key === lastSuccessfulKey && ... data VM`) → resolve without network.
2. `const userId = dependencies.getCurrentUserId(); const cacheRecord = userId === undefined ? undefined : dependencies.cache.read(userId, target.groupId, target.businessMonth);`
3. If `cacheRecord` exists: publish immediately `buildCalendarMonthViewModel({ calendar: cacheRecord.calendar, filters, holidays: cacheRecord.holidays, status: 'cached', today, mode: viewMode, weekStart, savedAt: cacheRecord.savedAt, isStale: !isCalendarCacheFresh(cacheRecord) })` **before** the network request, and do **not** publish a loading state. The published sequence becomes `[cached, ready]` on success or stays `[cached]` on failure.
4. If no cache: publish `loading` (V3-1 behavior), then network.
5. On success (current generation only): build/publish `ready` (same input plus `mode`/`weekStart`, no savedAt), write cache exactly once via `dependencies.cache.write(userId, groupId, month, calendar, holidays)` only when `userId !== undefined`, and set `lastSuccessfulKey`.
6. On failure (current generation only): if a cache record exists, keep the published `cached` VM and optionally re-publish it with `isStale: true` (no error state, no cache write); otherwise publish the classified error state as V3-1.
7. `force === true` bypasses step 1 only; cache-first steps 2–3 and failure fallback still apply.
8. `setViewMode(mode, weekStart?)` stores both values and calls `rebuild()` (zero network). When `mode === 'week'` and `weekStart` is `undefined`, the controller computes `getVisibleWeekForMonth(currentMonth, dependencies.getToday())` before rebuilding; when `mode !== 'week'`, `weekStart` is stored as `undefined`. `rebuild()` publishes `ready` from `latestCalendar`/`latestHolidays` with the stored mode; it must not throw for an existing data source, because the week fallback guarantees a real week start.

`rebuild()` and the VM builder now pass `mode`/`weekStart`; `buildCalendarMonthViewModel` throws when `mode === 'week'` and `weekStart` is missing/invalid (test asserts the throw), and `mode` defaults to `'month'` for V3-1-compatible callers.

Extend `calendar-page-controller.test.ts` harness with `cache = createCalendarCache(memoryPort)` and `getCurrentUserId: () => 'user-1'`, then add these red-then-green tests:

| Scenario                                 | Sequence asserted                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh cache, network success             | publish `cached` → publish `ready`; `getCalendar` called once; cache write called once; same-key second `load()` without force → no network, no extra publish |
| Fresh cache, network failure             | publish `cached`; no error publish; `getCalendar` called once; cache write zero                                                                               |
| Stale cache (`savedAt` > 5 min), failure | publish `cached` with `isStale: true`; no error publish                                                                                                       |
| No cache, failure                        | publish `loading` → publish `error` with original message                                                                                                     |
| Force with fresh cache                   | bypasses step 1; still publish `cached` then `ready`; one endpoint pair                                                                                       |
| `setViewMode('week', '2026-08-10')`      | publishes `ready` with `mode: 'week'` and `weekLabel`; zero endpoint calls; same-context load still success-cached                                            |
| Stale prior-month response               | old generation cannot publish into new slot or write cache (existing generation tests keep passing with cache ports present)                                  |

### 7.5 View-Model Week/List Builders (test-first)

Extend `calendar-view-model.ts`:

```ts
export interface CalendarWeekDataViewModel extends CalendarMonthBaseViewModel {
  readonly assignmentCount: number;
  readonly filters: CalendarFilterViewModel;
  readonly isWeekEmpty: boolean;
  readonly isStale?: boolean;
  readonly mode: 'week';
  readonly savedAt?: string;
  readonly status: CalendarDataStatus;
  readonly week: CalendarWeekViewModel; // exactly 7 day cells for weekStart..weekStart+6
  readonly weekLabel: string;
  readonly weekdayLabels: readonly ['一', '二', '三', '四', '五', '六', '日'];
}

export interface CalendarListDataViewModel extends CalendarMonthBaseViewModel {
  readonly assignmentCount: number;
  readonly days: readonly CalendarDayViewModel[];
  readonly filters: CalendarFilterViewModel;
  readonly isListEmpty: boolean;
  readonly isStale?: boolean;
  readonly mode: 'list';
  readonly savedAt?: string;
  readonly status: CalendarDataStatus;
}

export type CalendarMonthViewModel =
  | CalendarMonthDataViewModel
  | CalendarWeekDataViewModel
  | CalendarListDataViewModel
  | CalendarMonthStateViewModel;

export interface BuildCalendarMonthViewModelInput {
  // existing fields ...
  readonly mode?: CalendarViewMode; // 'month' default
  readonly weekStart?: string;
  readonly savedAt?: string;
  readonly isStale?: boolean;
}
```

`CalendarMonthDataViewModel` gains `mode: 'month'` (exact literal) and optional `savedAt`/`isStale`. Builder behavior: `month` mode returns the V3-1 shape plus `mode`/route fields; `week` mode validates `weekStart` (real `YYYY-MM-DD`), builds one `CalendarWeekViewModel` from `getWeekDays(weekStart)` where each day cell maps through the same day mapper (holiday/past/today/weekend/assignments), sets `weekLabel: getWeekLabel(weekStart)`, and `isWeekEmpty = week days all empty`; `list` mode builds `buildDayList`-equivalent VM days (only dates with assignments, day cells with full mapping) and `isListEmpty = days.length === 0`. All modes share the same filter normalization, marker/phone mapping, and stable IDs. `savedAt`/`isStale` are copied verbatim and are meaningful only with `status: 'cached'`; other statuses ignore them (tests assert `savedAt` absent for `ready`).

Golden tests add: week builder for `weekStart '2026-08-10'` → 7 days, `weekLabel '2026年8月10日–8月16日'`, `2026-08-15` day contains the same three assignments; list builder → 3 days in order, `2026-08-15` first; missing/invalid `weekStart` in week mode throws; cached VM carries `savedAt`/`isStale`; month VM mode literal is `'month'`.

### 7.6 Three-Page Swiper Rotation Rules (page-level, test-first via pure module)

The rotation decision is a pure helper in `calendar-view-mode.ts`:

```ts
export interface SwiperSlotRotation {
  readonly months: readonly [string, string, string]; // [target-1, target, target+1]
  readonly targetMonth: string;
}

export function rotateMonthSlots(currentMonth: string, swiperIndex: number): SwiperSlotRotation; // swiperIndex 0 -> delta -1; 2 -> delta +1; else throw
```

Page rules (normative):

- Page data: `monthSlots: readonly CalendarMonthViewModel[]` (always 3), `swiperIndex: number` (always 1 after re-center), `swiperEnabled: boolean` (`true` only when `viewMode === 'month'`), `businessMonth` alias of `monthSlots[1].businessMonth`.
- Initial state: `monthSlots = [createCalendarMonthStateViewModel(prev, 'loading'), createCalendarMonthStateViewModel(current, 'loading'), createCalendarMonthStateViewModel(next, 'loading')]`; `onShow` loads the middle month (controller key `groupId:role:current`).
- `handleSwiperChange(event)`: ignore when `swiperEnabled === false`, when `swiperLocked === true`, or when `event.detail.current === 1`. Otherwise `rotation = rotateMonthSlots(businessMonth, event.detail.current)`; set `swiperLocked = true`; build the new slot array by reusing existing VM slots: swipe left (`current === 0`) → `[stateVM(target-1), monthSlots[0], monthSlots[1]]`; swipe right (`current === 2`) → `[monthSlots[1], monthSlots[2], stateVM(target+1)]`. `setData({ businessMonth: targetMonth, monthSlots, swiperIndex: 1 })` and, in its completion callback, `this.swiperLocked = false`; then `this.loadMonth(targetMonth)`.
- The page's controller `publish` wrapper routes by month: `const slot = monthSlots.findIndex((vm) => vm.businessMonth === viewModel.businessMonth); setData({ ['monthSlots[' + slot + ']']: viewModel, viewModel: slot === 1 ? viewModel : this.data.viewModel })` (computed-key `setData`; `viewModel` stays the active middle slot for WXML).
- Month toolbar (上一月/下一月) uses `stepCalendarMonth` and, after `setData`, calls `loadMonth`; when `viewMode === 'month'`, it also re-centers the swiper slot array through the same rotation helper (target = addBusinessMonths ±1).
- Week toolbar (上一周/下一周/本周) is visible only in week mode; `stepCalendarWeek` may change `businessMonth`; when it does, the swiper slot array re-centers on the new month without animation (`swiperIndex` set directly).
- No request sequence number is needed beyond the controller's existing `requestGeneration` plus `swiperLocked`; the swiper's `bindchange` with `current === 1` is always a no-op.

### 7.7 Week/List Components And Page Wiring

- `calendar-week` properties: `week: Object` (`CalendarWeekViewModel`), `role: String`; event `route`. Renders 7 day cells in one flex row (each `flex: 1`, `min-height: 208rpx`), day header (dayNumber + weekday + holiday-tag), assignments via `assignment-row` with `hideShiftBadge` when a day has exactly one assignment (Web sole-duty rule).
- `calendar-list` properties: `days: Array` (`CalendarDayViewModel[]`), `role: String`; event `route`. Renders each day as a card row (header `MM-DD 周X 今天 节日`, then assignment rows).
- Page WXML: mode bar with three buttons `月 / 周 / 列表` (`data-mode` dataset, `handleViewModeTap`), month toolbar for month/list, week toolbar for week, `<swiper wx:if="{{viewMode === 'month'}}" class="calendar-page__swiper" circular enhanced duration="{{240}}" current="{{swiperIndex}}" bindchange="handleSwiperChange">` with three `<swiper-item>`s binding `monthSlots[0]`/`viewModel`/`monthSlots[2]` through `<calendar-grid>`; `calendar-week`/`calendar-list` for the other modes. Cached state renders a `可能不是最新数据` badge when `viewModel.isStale === true` and `缓存于 {{savedAtTime}}` when `savedAt` exists (`savedAtTime` formatted via `formatChinaDateTime`).
- `calendar-page__swiper` WXSS: `height: calc(100vh - <toolbar/filters/mode-bar fixed heights>)` with flex rows inside; no `display: grid`.
- Boundary guard update: WXML contains `monthSlots`, `calendar-grid`, `calendar-week`, `calendar-list`, `bindchange="handleSwiperChange"`, and `viewModel.isStale`; still no raw contract fields; page source contains `rotateMonthSlots`, `swiperLocked`, and no `Promise.all`/`requestGeneration`/`lastSuccessfulKey`/`inFlight` (controller stays the only owner).

### 7.8 Task 7 Steps

- [ ] **Step 1:** Run Task 7 prerequisites and record Git/test state.
- [ ] **Step 2:** Write `calendar-views.test.ts`; observe red; implement `calendar-views.ts`; green.
- [ ] **Step 3:** Write `calendar-view-mode.test.ts`; observe red; implement `calendar-view-mode.ts` (including `rotateMonthSlots` and `getBusinessMonthOf`); green.
- [ ] **Step 4:** Write `calendar-cache.test.ts`; observe red; implement `store/calendar-cache.ts`; green.
- [ ] **Step 5:** Extend `calendar-view-model.test.ts` (week/list/cached builders); observe red; implement the VM additions; green.
- [ ] **Step 6:** Extend `calendar-page-controller.test.ts` (cache/user-id/view-mode cases); observe red; implement controller changes; green.
- [ ] **Step 7:** Create `calendar-week`/`calendar-list`; rewire the page (slots, mode bar, swiper, cache badges); update the boundary guard first and watch it go red→green.
- [ ] **Step 8:** Run the Task 7 validation set (same commands as Task 6 plus `apps/miniprogram/features/calendar/calendar-views.test.ts`, `calendar-view-mode.test.ts`, `store/calendar-cache.test.ts`, and the two new component Prettier checks; `pnpm smoke:check-core`; `git diff --check`). Record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序日历导航/模式/缓存模块与页面，未改 Web/API/契约/认证/构建核心链路）`.
- [ ] **Step 9:** DevTools/simulator gate: build-npm/preview/smoke; verify swiper forward/backward across months (July/August/September), no duplicate loads on re-center, week mode prev/next/week-start sync, list mode ordering, cache badge after a forced offline failure (DevTools network off), and screenshots for all three modes. Record renderer indicator and any low-end-device note.
- [ ] **Step 10:** Semantic audit, update the two docs, stage Task 7 files only, `git diff --cached --check`, create the **local** commit `feat(miniprogram): add calendar navigation and read cache`.

**Task 7 stop condition:** stop after the local checkpoint commit. Do not add detail sheets, event loading, or V3-3 work.

---

## Task 8: Date, Duty, Event, And Phone Detail Bottom Sheets

**Task boundary:** Task 8 adds the generic bottom sheet and the four detail sheets, plus event timeline loading and phone dial/copy wiring. It does not add workflows, approvals, notifications, or V3-3 pages.

**Prerequisites:** Task 7 local checkpoint committed; `git status` clean except `apps/miniprogram/minitest/`; Task 7 validation still passes.

### 8.1 Bottom-Sheet State Machine (test-first)

Create `apps/miniprogram/features/sheets/bottom-sheet-logic.ts`:

```ts
export type BottomSheetPhase = 'closed' | 'closing' | 'open' | 'opening';

export type BottomSheetPhaseEvent =
  'close-finished' | 'close-requested' | 'open-finished' | 'open-requested';

export const bottomSheetOpenMilliseconds = 280;
export const bottomSheetCloseMilliseconds = 280;
export const bottomSheetDragCloseThresholdPx = 80;
export const bottomSheetDragCloseVelocityPxPerMillisecond = 0.8;

export interface BottomSheetDragSample {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly elapsedMilliseconds: number;
}

export function nextBottomSheetPhase(
  phase: BottomSheetPhase,
  event: BottomSheetPhaseEvent,
): BottomSheetPhase;
export function shouldCloseBottomSheet(sample: BottomSheetDragSample): boolean;
export function clampBottomSheetDragOffset(offsetPx: number): number;
```

Phase transition table (normative; every cell is asserted):

| Phase     | open-requested                         | open-finished               | close-requested    | close-finished      |
| --------- | -------------------------------------- | --------------------------- | ------------------ | ------------------- |
| `closed`  | `opening`                              | `closed` (invalid sequence) | `closed` (ignore)  | `closed`            |
| `opening` | `opening` (ignore)                     | `open`                      | `closing`          | `opening` (invalid) |
| `open`    | `opening` (re-animate on content swap) | `open`                      | `closing`          | `open` (invalid)    |
| `closing` | `closing` (ignore)                     | `closing` (invalid)         | `closing` (ignore) | `closed`            |

`shouldCloseBottomSheet` returns `true` iff `deltaY >= 80` or (`elapsedMilliseconds > 0` and `deltaY / elapsedMilliseconds > 0.8`); `deltaX > deltaY` (horizontal intent) returns `false` before the vertical check; `deltaY <= 0` returns `false`. `clampBottomSheetDragOffset` returns `Math.max(0, offsetPx)`. The 80 px threshold is measured in CSS px via `touch.clientY` deltas; on standard 375 pt screens this equals 160rpx of sheet translation, but the decision uses raw px, not rpx.

Create `bottom-sheet-logic.test.ts` pinning: every transition row; invalid sequences stay in the current phase; threshold boundary (`79.9` false, `80` true); velocity boundary (`0.8` false, `0.81` true); horizontal-drag override; negative/zero delta false; clamp negatives to 0.

### 8.2 Bottom-Sheet Component

`apps/miniprogram/components/bottom-sheet/index.*`:

- properties: `title: String` (default `''`), `visible: Boolean` (default `false`), `sheetKey: String` (default `''`).
- events: `close`.
- Implementation contract: root mask (`catchtap` → emit `close`); sheet panel `transform: translateY({{offsetStyle}})`, transition `transform 280ms ease-out` only when not dragging; drag handlers on the sheet header (`catchtouchmove`) and on the panel (`bindtouchmove`); inner `<scroll-view scroll-y>` tracks `scrollTop` via `bindscroll`; drag starts only when `scrollTop <= 1` and vertical intent dominates; `shouldCloseBottomSheet` decides close vs bounce (`transform` back to `translateY(0)` with 200ms ease-out); when `visible` flips true or `sheetKey` changes while visible, run `open-requested`; after the 280ms transition, run `open-finished`; when closing completes, run `close-finished` and clear content slot. All timers use `setTimeout` with `clearTimeout` on unmount; the pure module owns phase decisions, the component owns `setData` and must call it at most once per touchmove event (start/move/end phases; record in the performance matrix).
- WXML renders `<slot />` for sheet content and a close affordance (`aria-label="关闭"`).

### 8.3 Event Description Port And Timeline Controller (test-first)

Create `apps/miniprogram/features/events/event-description.ts` as a line-by-line port of Web `apps/web/src/features/events/event-timeline.ts` with this exact public boundary (all pure, no `wx`):

```ts
import type { CalendarChangeMarker, JsonObject, ScheduleEvent } from '@schedule/contracts';
import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';

export interface EventChangeItem {
  readonly after?: string;
  readonly before?: string;
  readonly label: string;
}
export interface EventTimelineItem {
  readonly event: ScheduleEvent;
  readonly marker?: CalendarChangeMarker;
}
export interface EventNarrativeContext {
  readonly initiatedAt?: string;
}

export const eventTypeLabels: Readonly<Record<string, string>>; // exact Web table
export function getEventTypeLabel(eventType: string): string;
export function formatEventTime(occurredAt: string): string; // formatChinaDateTime
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
export function buildEventTimelineItems(
  events: readonly ScheduleEvent[],
): readonly EventTimelineItem[];
export function formatJsonValue(value: JsonObject | undefined): string;
```

Port rules: copy `eventTypeLabels`, `changeLabels`, `skippedChangeKeys`, `statusLabels`, `getEventMarker`, `isPrimitive`/`formatPrimitive`, nested/top-level member-name readers, `swap_completed`/`leave_cover_completed`/`duty_adjustment_completed`/request-state narratives, `buildChangeFallbackNarrative`, and the change-chain summary exactly; `CalendarAssignmentViewModel` replaces `CalendarDutyAssignment` only at the call boundary — `assignmentId`, `plannedMemberName`, `actualMemberName` map 1:1, and `scheduleRoleName` reads `roleName` (identical content); `formatEventTime` delegates to `calendar-views.formatChinaDateTime`. Unknown event types fall back to `排班变更` plus a changes-based narrative.

Create `event-description.test.ts` with the golden events and these exact assertions:

```ts
expect(getEventTypeLabel('swap_completed')).toBe('换班已生效');
expect(getEventTypeLabel('unknown_type')).toBe('排班变更');
expect(buildEventTimelineItems(goldenEvents).map(({ event }) => event.id)).toEqual([
  'golden-event-5',
  'golden-event-4',
  'golden-event-1',
  'golden-event-2',
  'golden-event-3',
]);
expect(buildEventTimelineItems(goldenEvents).map(({ marker }) => marker)).toEqual([
  undefined,
  undefined,
  'swap',
  'leave-cover',
  'overtime',
]);
expect(buildEventNarrative(goldenEvents[0]!, goldenAssignmentViewModel('golden-a2'))).toBe(
  '计划医生甲 → 李思远（由李思远 发起，发起时间 2026-08-15 09:00）',
);
expect(buildEventNarrative(goldenEvents[1]!, goldenAssignmentViewModel('golden-a4'))).toContain(
  '整体顺延',
);
expect(buildEventNarrative(goldenEvents[2]!, goldenAssignmentViewModel('golden-a3'))).toBe(
  '欧阳修远 的班次由 李思远 代值（由 张伟 发起）。',
);
expect(buildChangeChainSummary(goldenEvents.slice(0, 3), 'golden-a2')).toMatch(
  /人员变更链：计划医生甲 → 李思远（1 次变更/,
);
expect(extractEventChanges(goldenEvents[4]!)).toEqual([
  { label: '班种', before: '旧班种', after: '新班种' },
  { label: '状态', before: '待审批', after: '已批准' },
]);
expect(formatJsonValue(undefined)).toBe('');
```

`goldenAssignmentViewModel(assignmentId)` is a helper in the test that picks the mapped assignment from the golden VM (narrowed via `findDay`); no `as any`. The chain summary for `golden-a2` must include the `swap_completed` step (initiator side) and skip `golden-a4`'s leave-cover step (different assignment).

Create `apps/miniprogram/features/events/event-timeline-controller.ts`:

```ts
import type { ScheduleEvent, ScheduleEventPage } from '@schedule/contracts';
import type { EventTimelineItem } from './event-description.js';

export interface EventTimelineState {
  readonly assignmentId?: string;
  readonly errorMessage?: string;
  readonly events: readonly ScheduleEvent[];
  readonly hasMore: boolean;
  readonly items: readonly EventTimelineItem[];
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
  load(groupId: string, assignmentId: string): Promise<void>;
  reset(): void;
}

export function createEventTimelineController(
  dependencies: EventTimelineDependencies,
): EventTimelineController;
```

Semantics (normative): `load` is not async; a duplicate in-flight call for the same `assignmentId` returns the exact same Promise; a different assignment increments a numeric generation and supersedes the slot; on success, filter `page.events.filter((event) => event.affectedShiftIds.includes(assignmentId))`, build `items = buildEventTimelineItems(filtered)`, publish `{ status: 'ready', assignmentId, events: filtered, items, hasMore: page.nextCursor !== undefined }` only when the generation is current; on failure publish `{ status: 'error', assignmentId, errorMessage: error instanceof Error ? error.message : undefined, events: [], items: [], hasMore: false }` only when current, and the public Promise resolves (no floating rejection); `reset()` clears the slot and publishes `{ status: 'idle', events: [], items: [], hasMore: false }`; `.finally()` clears `inFlight` only when it still refers to the exact Promise. `listEvents` is called with `(groupId, undefined, 100)` exactly once per in-flight request (Web parity page size).

Create `event-timeline-controller.test.ts` with a `vi.fn` port and assertions: one call per assignment; same-assignment single-flight (`first === second`); generation suppression (stale resolve cannot publish); failure keeps message and resolves; `nextCursor` present → `hasMore: true`; empty page → `items: []`, `status: 'ready'`; reset → `idle` and next load calls `listEvents` again.

### 8.4 Detail Sheets (presentational; properties/events normative)

All four sheets are registered in the calendar page JSON and wrap `bottom-sheet`:

`date-detail-sheet`:

- properties: `day: Object` (`CalendarDayViewModel`), `monthLabel: String`.
- events: `close`, `route` (detail `{ actionId: string }`).
- Content spec: full date line (`day.dayNumber` + `day.weekdayLabel`), holiday line (full `holidayName` + `休息日`/`调休上班` when present), then all `day.assignments` rendered through `assignment-row` (full names, badges, markers, phones). Empty day shows `当日无排班`（valid empty copy）.

`duty-detail-sheet`:

- properties: `assignment: Object` (`CalendarAssignmentViewModel`), `role: String` (`GroupRole`).
- events: `close`, `route`.
- Content spec: member full name (never truncated), role name, shift type full name + abbreviation, time range, shift color chips (`backgroundColor`/`foregroundColor` swatches), marker list with `marker-badge` + description, phone entries exactly as the grid row (same buttons, same action IDs). A `查看事件记录` button is present only when `role !== 'guest'` and emits `route` with the first marker's `actionId` (no marker → hidden; events without a marker are not reachable, matching Web marker-driven entry).

`phone-sheet`:

- properties: `memberName: String`, `phoneActions: Array` (`CalendarPhoneActionViewModel[]`).
- events: `close`, `dial` (detail `{ actionId: string }`), `copy` (detail `{ actionId: string }`).
- Content spec: one row per action: label (`长号`/`短号`), the number, and a button — `拨打` for `kind: 'dial'` (confirmed), `复制（未确认）` for `kind: 'copy'`; no number ever renders without its action; `phoneActions.length === 0` renders `该成员暂无电话号码` and no buttons (valid empty copy).

`event-timeline-sheet`:

- properties: `assignment: Object` (`CalendarAssignmentViewModel`), `status: String`, `items: Array`, `message: String`, `hasMore: Boolean`.
- events: `close`.
- Content spec: loading state (`正在加载事件`), error state (message + no retry button in V3-2; re-open re-fetches), empty state (`该班次暂无事件记录。`), ready list sorted by `buildEventTimelineItems`: each entry shows `formatEventTime(occurredAt)`, marker badge when present, `getEventTypeLabel`, narrative paragraph, reason line (`原因：...`), and a changes list when no narrative exists; `hasMore` shows `仅显示最近 100 条`; when `buildChangeChainSummary` is defined, render the collapsible `人员变更链` summary.

### 8.5 Page Routing And Dial/Copy Wiring (test-first at the unit boundary)

Modify `calendar-routing.ts` only to expose the existing targets; no change to the pure resolver is required beyond Task 6. Page additions:

```ts
interface CalendarPageData {
  // existing fields ...
  readonly activeSheet: CalendarSheetState;
}

type CalendarSheetState =
  | { readonly kind: 'none' }
  | { readonly day: CalendarDayViewModel; readonly kind: 'date' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'duty' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'events' }
  | {
      readonly assignment: CalendarAssignmentViewModel;
      readonly kind: 'phone';
      readonly phoneActions: readonly CalendarPhoneActionViewModel[];
    };

interface CalendarPageMethods {
  // existing methods ...
  handleRouteAction(event: RouteActionEvent): void;
  handleSheetClose(): void;
  handleDial(event: BaseEventWithActionId): void;
  handleCopy(event: BaseEventWithActionId): void;
}

type RouteActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly actionId?: unknown }
>;
type BaseEventWithActionId = RouteActionEvent;
```

Rules (normative):

- `handleRouteAction`: resolve via `resolveCalendarRouteAction(actionId, role, this.data.viewModel)`; `undefined` → no-op; otherwise `setData({ activeSheet })` mapping: `date` → `{ kind: 'date', day }`; `assignment` → `{ kind: 'duty', assignment }`; `events` → `{ kind: 'events', assignment }` and `void this.eventController.load(groupId, assignment.assignmentId)`; `phone` → `{ kind: 'phone', assignment, phoneActions: assignment.phoneActions }`. Opening a sheet while one is open replaces content and re-animates (`bottom-sheet` handles `open-requested` from `open`).
- `handleSheetClose`: `setData({ activeSheet: { kind: 'none' } })` and `this.eventController.reset()` when the closing sheet was events.
- `handleDial`/`handleCopy`: narrow `event.detail.actionId` (the custom-event detail emitted by `phone-sheet`, never a dataset) to a non-empty string; `controller.performPhoneAction(actionId)` executes exactly one `wx.makePhoneCall` or `wx.setClipboardData`; on copy success show `wx.showToast({ title: '已复制', icon: 'none' })` (member call, exactly once); on dial, keep the sheet open until the system call returns (no extra side effect).
- Guest never receives `events` (routing already falls back to `duty`); event sheets therefore never open for guests.
- No new API call: events use the existing `listEvents` wrapper injected into the event controller with member-bound arrows; page imports it only to build the dependency object.

The static boundary guard adds: WXML contains `bottom-sheet`, `date-detail-sheet`, `duty-detail-sheet`, `event-timeline-sheet`, `phone-sheet`, `bind:dial="handleDial"`, `bind:copy="handleCopy"`, and no raw contract fields; page source contains `createEventTimelineController` and no `listEvents(` call outside the injection wrapper.

### 8.6 Task 8 Steps

- [ ] **Step 1:** Run Task 8 prerequisites and record Git/test state.
- [ ] **Step 2:** Write `bottom-sheet-logic.test.ts`; observe red; implement `bottom-sheet-logic.ts`; green.
- [ ] **Step 3:** Write `event-description.test.ts` (uses golden events); observe red; implement `event-description.ts`; green.
- [ ] **Step 4:** Write `event-timeline-controller.test.ts`; observe red; implement `event-timeline-controller.ts`; green.
- [ ] **Step 5:** Create `bottom-sheet` and the four detail sheets; register them in the page JSON; update the boundary guard first (red on the Task 7 page), then wire page WXML/TS per 8.5; guard green.
- [ ] **Step 6:** Run the Task 8 validation set (Task 7 commands plus `features/sheets/bottom-sheet-logic.test.ts`, `features/events/event-description.test.ts`, `features/events/event-timeline-controller.test.ts`, and Prettier over all new component/feature files; `pnpm smoke:check-core`; `git diff --check`). Record `运行/浏览器验证：pnpm smoke:browser 不适用（仅小程序日历详情组件/事件/电话/底部面板，未改 Web/API/契约/认证/构建核心链路）`.
- [ ] **Step 7:** DevTools/simulator gate: golden month tap matrix — date blank opens date sheet; duty row opens duty sheet; marker opens duty sheet for guest and event sheet for member; phone entry opens phone sheet; confirmed dial button and unconfirmed copy button behave exactly once; sheet drag below 80 px bounces back, above closes; content scroll reaches top before drag engages; event sheet shows the five golden events in order with narratives/chain. Record screenshots for each sheet state.
- [ ] **Step 8:** Semantic audit, update the two docs, stage Task 8 files only, `git diff --cached --check`, create the **local** commit `feat(miniprogram): add calendar detail sheets`.
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

1. `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`: set the V3-2 stage-index row to `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md` with status `已生成，待用户复核；批准前禁止执行 Task 6`; add a one-line note that Task 6–8 use contract-first/test-first/code-light format and one GitHub push after all three tasks.
2. `docs/project-status.md`: add the V3-2 plan checkpoint entry (Git facts, 12/74 focused tests, typecheck and `smoke:check-core` results, only `apps/miniprogram/minitest/` untracked), set the next active batch to `execute Task 6 after user approval; stop after each task; single push after Task 8`, and keep the three-state status (`待用户复核`) for the plan.
3. `docs/debug/debug-feedback-log.md`: append `### V3-2 计划检查点（2026-08-09）` with the Git/V3-1 gate evidence and the exact lines `运行/浏览器验证：pnpm smoke:browser 不适用（仅计划文档变更，未改 Web/API/契约/认证/构建核心链路）。` and `pnpm smoke:check-core 通过。`
4. Commit and push: `git add docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md docs/project-status.md docs/debug/debug-feedback-log.md`, `git commit -m "docs(miniprogram): plan V3-2 calendar golden baseline and details"`, `git push`.

## Plan Self-Review Checklist

Run before the documentation commit and fix any failure inline:

```powershell
rg -n "TBD|TODO|自行实现|按需处理|适当校验|类似上一任务|fill in details|implement later" docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md
rg -n "routeActionId|resolveCalendarRouteAction|rotateMonthSlots|setViewMode|shouldCloseBottomSheet|buildEventNarrative|calendarCacheKeyPrefix|golden-a1|golden-a2|golden-a3|golden-a4|golden-a5" docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md
pnpm exec prettier --check docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md
git diff --check
```

Expected: no placeholder hits; every stable identifier in later tasks matches its definition in earlier sections; Prettier and `git diff --check` pass. Then verify the spec-coverage mapping: design sections 3 (1:1 calendar), 5 (calendar-shell/grid/rows/badges/tags/sheets), 6 (VM, markers, touch), 10 (read-only cache), 11 (performance/package), 12 (tests/screenshots), 13 (stop conditions), 14 (no generic calendar), 15 (execution model) are covered by Tasks 6–8; anything missing is a plan failure to fix before commit. After the commit, **stop**. Do not execute Task 6 in this conversation.
