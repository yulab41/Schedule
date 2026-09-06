# UX-CLEANUP-10 feedback3 checkpoint

## Scope

This checkpoint covers the third follow-up requested after trial `.92`:

- the group mobile-phone consent success message now uses the shared `ui-toast` surface and clears after 2 seconds;
- the retired Mini `pages/identity/unbind` page was removed, and profile unbinding now uses an inline native confirmation modal with the existing idempotent API client;
- the Mini profile panel now reads the existing `/auth/password/status` capability and shows a Web-matched initial-password reminder, reusing the existing password sheet for the edit action.

The old POC/diagnostic pages were audited and retained because they are still referenced by the index, diagnostics, or manual scheduling flows. No unrelated page was deleted.

## Evidence

- Warm slot: `runtime/wt/general-3`, branch `codex/ux-cleanup-10-feedback3`, base `92f16c5396b596f08128af026dad635b6260cd54`.
- Guardrail L2 inspector: `RESULT=PASS`; dependency mode `REUSE_ONLY`; no cold install.
- Typecheck: `pnpm --filter @schedule/miniprogram typecheck` passed.
- Targeted regression: 58 tests passed across profile account, profile controller, identity pages, group settings, toast lifecycle, and P10 profile native checks.
- Mini full test: `pnpm miniprogram:test` passed; 139 test files passed, 1 conditional skip, 857 tests passed and 13 conditional skips. The workbench import assertion now accepts both legal quote styles.
- Mini verify: `pnpm --filter @schedule/miniprogram verify` passed; production package `5,051,233` bytes; manifest `15ebcad4b22d092bd7101f44274067f604d27eeeb892675ced0f5c3c1b07dbc6`.
- Icon parity: `pnpm icon:parity:check` passed.
- The full Mini test is now green after making the workbench import assertion quote-style agnostic; no application behavior was changed by that test-only fix.

## Compatibility and boundaries

- The old unbind route is absent from `app.json` and its four page files are deleted. The unbind API client and session cleanup remain because they are still the supported business path.
- The password status route already exists in API and is guarded as `core`; no API or schema change is introduced here.
- Reminder dismissal is scoped to the profile id and stored by a dedicated Mini storage helper. It does not persist profile data or credentials.
- Before the release step, no production deployment, database migration, Web release, or Mini upload has been performed. Live production and trial `.92` remain unchanged.
- No real phone call, group exit, privacy change, or identity mutation was used for acceptance. Xiaomi 14/native WeChat evidence is pending.

## Next stop condition

Commit and push the test-fix checkpoint, then execute the authorized release candidate flow. Do not claim production or trial effectiveness until that release chain is executed and verified.
