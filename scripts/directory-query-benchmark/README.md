# Directory query isolation benchmark

This harness is guarded to the dedicated local database
`schedule_directory_benchmark` on `127.0.0.1:3317`. It creates deterministic synthetic data from
aggregate shapes only; never point it at production or import raw production directory data.

```powershell
pnpm --filter @schedule/database build
node scripts/directory-query-benchmark/setup-isolation.mjs
pnpm --filter @schedule/api... build
node scripts/directory-query-benchmark/run-legacy-baseline.mjs
node scripts/directory-query-benchmark/run-candidate-benchmark.mjs
node scripts/directory-query-benchmark/prepare-covering-index.mjs
node scripts/directory-query-benchmark/run-index-only-benchmark.mjs
node scripts/directory-query-benchmark/run-candidate-index-benchmark.mjs
node scripts/directory-query-benchmark/semantic-equivalence.mjs
node scripts/directory-query-benchmark/remove-covering-index.mjs
node scripts/directory-query-benchmark/buffer-pool-pressure.mjs
```

Generated plans and reports stay under `runtime/audit/directory-query-isolation/`. `cold-reset.mjs`
stops only the named benchmark MySQL container, verifies buffer-pool restore is disabled, and asks
the helper container to evict only files in the named benchmark volume.
