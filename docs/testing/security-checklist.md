# Security Checklist — Web 1.0

Every item below is verified by an automated test. The acceptance matrix lives
in `tests/security/security.integration.test.ts`; the load harness
(`tests/load/run-load-test.ts`) also asserts the concurrency invariants.

| Check                                  | Verification                                                                                                                                                                                 | Result                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Authentication required everywhere     | All business routes use `app.authenticate`; anonymous requests get 401 (user-route integration suite).                                                                                       | Pass                                     |
| Cross-group isolation                  | A member of group A receives 403 on group B's calendar, members, contacts, events, event detail, scheduling config, and exports; no response contains group B's name, code, or roster names. | Pass (security matrix)                   |
| No cross-group data in error responses | 403/404 bodies contain only generic messages with the request ID.                                                                                                                            | Pass (security matrix)                   |
| Group-code guessing rate limit         | Five failed claims return 404; the sixth attempt in the one-minute window returns 429 (durable per-user window).                                                                             | Pass (security matrix + group suite)     |
| Duplicate submission protection        | Idempotent approvals replay the same operation ID without a second event, second audit row, or second request row.                                                                           | Pass (security matrix + workflow suites) |
| Partial-transaction rollback           | A stale approval returns 409 and writes no `leave_request_approved` event; every workflow suite verifies the same pattern for generation, templates, swaps, and duty adjustments.            | Pass                                     |
| Concurrent same-shift writes           | 20 parallel swap creations on one shift leave exactly one active request (database-enforced unique index).                                                                                   | Pass (load harness)                      |
| Sensitive log redaction                | Passwords, tokens, and telephone fields (nested, format-payload, child-binding) are replaced with `[REDACTED]`; error stacks never reach clients or logs.                                    | Pass (`apps/api/src/app.test.ts`)        |
| No plaintext credentials               | `.env` and secrets are gitignored; cloud credentials are never stored in the repository; login passwords never enter application state.                                                      | Pass (repo audit, session tests)         |
| Phone privacy in exports               | Export CSV content excludes phone numbers; export creation/download is audit-logged.                                                                                                         | Pass (export suite)                      |
| Append-only events and audits          | No API route can update or delete `schedule_events`/`audit_logs`; corrections append linked events; production grants will be SELECT/INSERT-only.                                            | Pass (event suite)                       |
| Platform operations audited            | Holiday import/confirm, group restore, user status changes, and deregistration each write a security-audit row.                                                                              | Pass (holiday + platform suites)         |
| Backup encryption                      | Archives are AES-256-GCM encrypted; restore fails on a wrong key or tampered ciphertext; backup rows carry SHA-256.                                                                          | Pass (backup unit + platform suite)      |
| Recycle-window enforcement             | Restore outside 30 days is rejected and the purge job frees group codes; deregistration nulls the external UID and clears contacts.                                                          | Pass (platform suite)                    |

## Residual notes

- The API trusts only the `Authorization` header through the `AuthPort`
  contract; caller-supplied identity headers are never trusted.
- Rate limiting exists for group-code attempts and idempotent operation IDs; a
  CAPTCHA provider is deferred until a challenge service can be configured
  without storing credentials (documented Task 8 decision).
- The draft-expiry admin reminder from design 16.2 remains unimplemented
  (schema has no draft-expiry concept); revisit with the next planning batch.
