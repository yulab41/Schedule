# Feedback24 export selector and anonymous guest calendar

## Native evidence and causes

- Xiaomi 14 trial126 showed the member selector popover clipped at the export card boundary. The shared selector was correct; `.export-form-card { overflow: hidden }` clipped its absolute popover.
- File type still used native `picker`, unlike role/member selectors.
- Guest calendar called the common `createWorkbenchViewModel` without member's nurse display options. This disabled nurse ordering, duty state/default collapse and the configured month-cell shift preference.
- Guest week/list swiper reset the edge panel to center with the normal 260ms duration, producing a visible reverse rebound. Member uses a zero-duration center commit with a lock and bounded queue.
- The guest startup path rendered persisted public months before the current active month refresh settled, allowing stale shift content to flash.

## Changes

- Export file type now uses the existing single-select `ui-selector`; the export card locally permits selector popovers to overflow.
- A separate public visitor display-settings route returns only group id, group-default view and the enabled group-default month shift id after validating the current visitor key. The existing strict guest calendar response is unchanged for old clients. First entry follows the group default; a refreshed group setting is applied when the current session has not deliberately diverged from its previous default.
- Guest nurse calendars pass the same nurse preset and group month-shift preference into the common ViewModel. Month cells use the member 62px row metric; week current-panel and compact event/status behavior match the member template.
- Week/list buttons and gestures share a one-commit pager with 0ms recenter, commit lock and a bounded rapid-action queue.
- Persisted public cache is loaded as network-failure fallback but is not rendered before the active network month settles. The in-memory preload window is two periods in each direction.

## Evidence

- RED: `feedback24-guest-export.test.mjs` failed 4/4 on the prior code.
- Targeted Mini and upload-transform tests: 54 passed.
- Full `pnpm verify`: Mini 1168 passed / 16 skipped; root 1258 passed / 441 skipped, including formatting, lint, builds, typechecks and icon parity.
- Mini production verify: main 1726528 bytes, total 4574757 bytes, Worklet 2/2 and deterministic manifest passed.
- Browser smoke was executed but localhost:5173 was not running (`ERR_CONNECTION_REFUSED`); this is recorded as unavailable runtime evidence, not a browser pass.
- `pnpm smoke:check-core` passed after the browser outcome was recorded.
- MySQL visitor integration requires a configured local test database; the warm slot has no `.env`, so it is not claimed as run.
- Xiaomi 14 acceptance is pending a future uploaded checkpoint; Node/static tests do not establish native gesture or layout acceptance.

## Cumulative production and trial delivery

- A concurrent production release was verified as real and allowed to finish. Its DOCX/schema60 branch was merged with Feedback24 instead of being overwritten; cumulative application checkpoint `463f4512` was pushed to `origin/main`.
- Post-concurrency encrypted backup `f2ade922-8942-44fd-8cf9-5351489ee66d` completed with 54 tables, 256201 rows, 108185080 bytes and SHA-256 `aaa2095a01672f1b9c7153100e462f60f40168cca4e6a637f359e6e0ad8584f5`.
- Schema60/API deployment and the full production verifier passed. Trial `0.1.0-p10.20260913.127` uploaded from clean production SHA `463f4512` with Manifest `f570cb98b0cf9ebb05c5db4f30831c61a1f04cd108ec1fd3f21aa37a834c9812`.
- Trusted add-only allowlisting retained every prior version. The allowlist verifier, full ECS verifier and public probes passed: 127 and 126 returned 200; a dynamic unknown version returned 426.
- No review submission, formal Mini Program publication or old-version retirement was performed. Xiaomi 14 acceptance remains pending.
