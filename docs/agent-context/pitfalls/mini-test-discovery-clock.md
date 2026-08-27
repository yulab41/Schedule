# Mini test discovery and clock

Mini page tests use `process.cwd()` and must run from `apps/miniprogram`. Root Vitest excludes Mini
scripts; `pnpm miniprogram:test` is the only full Mini entry and uses `--dir scripts`.

Root Vitest excludes `runtime/**`, root `src/**`, `.artifacts/**`, and Mini scripts so historical
worktrees cannot be rediscovered.

Duty/swap fixtures use 2026-08-26/27 assignments. Their tests set system time to
2026-08-25T04:00:00Z and restore real time per test. Do not fake timers globally or make fixture
dates follow today; both hide the China business-date rule or break `vi.waitFor`.
