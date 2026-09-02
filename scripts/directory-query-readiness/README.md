# Directory query production-readiness harness

This harness is local-only. It pins MySQL 8.4.11, a 128 MiB buffer pool, the production schema, and a deterministic synthetic directory with the production-observed table shape. It refuses non-loopback database hosts and any database or port other than `schedule_directory_readiness` on `3318`.

Build the API and database package, then run:

```powershell
pnpm directory:readiness:setup
pnpm directory:readiness:plans
pnpm directory:readiness:concurrency
pnpm directory:readiness:import-ddl
```

Reports are privacy-safe and go to ignored `runtime/audit/directory-query-readiness/`. They contain scenario labels, timings, counts, fingerprints, server counters, and DDL state only; they do not contain source names, phone numbers, employee codes, raw query values, credentials, or SQL samples.

The harness never targets production and does not remove either the original experiment volume or this readiness volume.
