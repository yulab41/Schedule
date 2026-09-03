# Testing and evidence routing

Read this reference when choosing gates, comparing baselines, or making an acceptance claim.

Authoritative sources:

- [Web verification](../../../../docs/testing/verification.md)
- [Mini test plan](../../../../apps/miniprogram/docs/testing/test-plan.md)
- [Mini audit master plan](../../../../docs/audit/AUDIT_MASTER_PLAN.md) and current [audit status](../../../../docs/audit/STATUS.md) when that audit is active
- Existing package scripts in [root package.json](../../../../package.json) and [Mini package.json](../../../../apps/miniprogram/package.json)

## Gate selection

- `L1` defaults to a targeted red/green regression and gates for affected packages/files. Do not run full-repository verification merely because it exists.
- `L2` adds only the integration and runtime gates needed for the requested cross-boundary claim.
- `L3` runs the full relevant candidate gate set from the applicable plan/runbook after the final SHA is frozen. Do not repeatedly run expensive gates for the same final SHA and identical input/toolchain fingerprint when valid evidence already exists.
- Browser smoke and core-smoke triggers remain those in root `AGENTS.md`; a unit-test pass is not a browser/runtime pass.

## Comparable evidence

Test-count, duration, and package-size comparisons are valid only when the clean parent SHA and clean new SHA use the same toolchain, command, profile, environment variables, dependency fingerprint, and inclusion/exclusion rules. Record skipped tests and environmental services. If these differ, report two independent measurements, not an improvement/regression percentage.

Temporary manifests, screenshots, logs, and reports may be written only to a root-level path already proven ignored with `git check-ignore`. Recheck `git status` after the command. Never place evidence beside tracked source merely to make a tool convenient.

Classify claims by evidence layer: static inspection, Node automation, user-operated DevTools, Xiaomi 14 `trial`, or production. One layer cannot silently substitute for another.

## Frequent interpretation errors

- A browser smoke month with no assignments may be a legitimate fixture/business empty state. Confirm the requested month, fixture, API result, and assertion contract before classifying it as a product outage.
- Disabling a diagnostic feature at runtime does not prove its code was excluded from the bundle. Use the relevant source and package-output audits when the claim is about package contents.
- A passing candidate built against main-worktree `dist` is not clean evidence; rebuild producers in the candidate worktree.
