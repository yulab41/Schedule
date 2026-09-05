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
- `L3` selects the applicable plan/runbook gates; apply the candidate preflight and evidence reuse rules below.
- Browser smoke and core-smoke triggers remain those in root `AGENTS.md`; a unit-test pass is not a browser/runtime pass.
- Run the fast `pnpm icon:parity` gate before expensive Mini/Web tests. It is the only icon parity checker;
  do not recreate its inventory or rerun its child generator checks as separate gates.
- For a final candidate, `pnpm verify` includes format, lint, build, typecheck, `icon:parity:check`, Mini
  tests, and root tests. Run only the additional Mini package audit, package-size, source/package lineage,
  and release checks not covered by `verify`.
- Web build and Mini full suite are CPU/disk-heavy and run serially. Preserve long-command output in ignored
  `runtime/` evidence; on timeout inspect resources first and rerun only the failed bounded command.
- Browser evidence must first record whether the Web and API services are running and whether the requested
  page actually needs the API. The isolated icon gallery is the preferred browser target for icon work.

## Candidate preflight

Before any full `pnpm verify`, finish the applicable cheap gates in this order:

1. Official `format:check` scope, `git diff --check`, conflict-marker scan, and existing document line limits.
2. This skill's `scripts/validate-project-skill.ps1` when affected; affected ledger/runbook consistency checks.
3. Official dependency health via [dependency lifecycle](dependency-lifecycle.md), then affected static contracts.

A failure stops Web build, Mini full tests, and root full tests; fix it before freezing the candidate.

## Application evidence fingerprint

Bind application evidence to app-tree digest, lock/build inputs (including release tools), toolchain, dependency
fingerprint, and profile/environment; retain exact commands, results, and artifact identity separately from Git SHA.
For docs/audit/ledger/status-only changes that leave those inputs unchanged, reuse application builds, Mini full
tests, Web build, package and manifest evidence; run only affected document/ledger/format/guard checks.
A repository commit SHA change alone never invalidates application evidence. Changed inputs or missing evidence
require only affected gates; version/SHA-bound artifacts keep their original identity and cannot be relabelled.

## Comparable evidence

Test-count, duration, and package-size comparisons are valid only when the clean parent SHA and clean new SHA use the same toolchain, command, profile, environment variables, dependency fingerprint, and inclusion/exclusion rules. Record skipped tests and environmental services. If these differ, report two independent measurements, not an improvement/regression percentage.

Temporary manifests, screenshots, logs, and reports may be written only to a root-level path already proven ignored with `git check-ignore`. Recheck `git status` after the command. Never place evidence beside tracked source merely to make a tool convenient.

Classify claims by evidence layer: static inspection, Node automation, user-operated DevTools, Xiaomi 14 `trial`, or production. One layer cannot silently substitute for another.

## Frequent interpretation errors

- A browser smoke month with no assignments may be a legitimate fixture/business empty state. Confirm the requested month, fixture, API result, and assertion contract before classifying it as a product outage.
- Disabling a diagnostic feature at runtime does not prove its code was excluded from the bundle. Use the relevant source and package-output audits when the claim is about package contents.
- A passing candidate built against main-worktree `dist` is not clean evidence; rebuild producers in the candidate worktree.
