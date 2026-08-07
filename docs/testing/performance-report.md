# Performance Report — Web 1.0 Capacity Validation

## Test conditions

- Date: 2026-08-02 (Asia/Hong_Kong).
- Host: Windows 11 workstation, Node.js v24.14.0, pnpm v11.9.0.
- Database: MySQL 8.4 in Docker (test service, isolated `schedule_test` schema on
  host port 3307, single disposable container).
- Method: in-process Fastify `inject` against the real application factory and
  the real MySQL pool — network/HTTP overhead is excluded, so the numbers below
  measure service + database latency, which is the acceptance-relevant part.
- Load harness: `tests/load/run-load-test.ts`, built with `pnpm load:build`,
  run with `pnpm load:test` using `TEST_MYSQL_*` settings. It resets and
  migrates the disposable schema before every run and exits non-zero when an
  acceptance invariant fails.

## Dataset

The harness seeds a synthetic dataset directly in the database:

- 2,000 registered users (`users` + `user_profiles` with fictional names).
- 100 groups with unique four-digit codes.
- 2,000 active memberships (20 members per group, one owner).
- One extra two-member group for the swap race and one extra 100-member group
  for the 12-month generation scenario.

Seeding the full dataset took **191 ms**.

## Scenarios and results

| Scenario                       | Definition                                                                                                      | Result                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Cold start                     | Create the Fastify app from a migrated schema and issue `/health`.                                              | App creation **151 ms**, first request **17 ms**.                                                                |
| 100 concurrent calendar reads  | 100 members across 100 groups read their group's month calendar in parallel.                                    | **202 ms** total, 100/100 returned 200.                                                                          |
| 100 leave submissions          | 100 members in 100 groups submit an all-day sick leave in parallel.                                             | **432 ms** total, 100/100 created.                                                                               |
| 20 leave approvals             | Owners preview and approve 20 of those requests sequentially (preview + approve per group).                     | **644 ms** total, 20/20 approved.                                                                                |
| Same-shift swap race           | 20 concurrent swap requests race on the same published shift.                                                   | **394 ms** total; exactly **1 created, 19 rejected with 409**; one `swap_requests` row.                          |
| 100-member 12-month generation | One group with 100 members generates 12 consecutive month previews in parallel, then publishes the first month. | 12 previews **122 ms**; save+publish **364 ms**; 150 assignments persisted (2 periods).                          |
| Database metrics after run     | `SHOW GLOBAL STATUS` + table counts.                                                                            | `Threads_connected` 10, `Threads_running` 2, `Questions` 54,929; 100 leaves, 1 swap, 2 periods, 150 assignments. |
| Total run                      | Seed + all scenarios + metrics.                                                                                 | **3.4 s** end to end.                                                                                            |

## Acceptance results

- No lost updates or duplicate shifts: the concurrent swap race produced exactly
  one active request and one persisted row; the 19 losers received 409 with the
  conflict contract.
- No partial transactions: leave approvals with stale versions returned 409
  without writing events; the security matrix verifies the same for rollback.
- Cross-group isolation: see [security-checklist.md](./security-checklist.md).
- Single-group 100-member 12-month generation completes in well under a second
  of management time (122 ms preview + 364 ms publish), satisfying the
  "acceptable management operation time" target.

## Capacity recommendations

- The target scale (100 groups / 2,000 users / 100 concurrent users) is
  comfortably within the tested capacity: concurrent read and write scenarios
  complete in hundreds of milliseconds on a single MySQL instance.
- The two obvious future bottlenecks are the index-heavy event/statistics
  queries and the Web entry chunk (680 KiB gzip, pre-existing warning); both
  are acceptable for 1.0 and should be revisited only when active monthly users
  grow materially.
- Browser push and export jobs are out-of-band; their queue tables and batch
  keys already make them idempotent, so they do not add to request latency.
- For production, keep the MySQL instance in the same region as the ECS
  deployment, size memory for `Innodb_buffer_pool_size` above the working set of
  ~100 groups, and monitor `Threads_running`/slow-query logs before raising the
  pool's `connectionLimit`.
- Re-run `pnpm load:test` after every schema or query change that touches
  calendar, statistics, or workflow paths; the harness's acceptance assertions
  fail loudly on duplicate shifts, lost updates, and cross-group leaks.
