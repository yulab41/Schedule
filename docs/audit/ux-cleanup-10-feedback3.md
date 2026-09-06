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
- Mini verify: `pnpm --filter @schedule/miniprogram verify` passed; production package `5,051,233` bytes; manifest `d3894de534648f53dedf733a5c1e87c2e9d0d145d9637a26cf37700c1be0c1dd`.
- Icon parity: `pnpm icon:parity:check` passed.
- Full historical Mini test run reached 854 passed / 13 skipped before this checkpoint's final storage-helper correction; it also exposed the repository's existing workbench quote assertion. The corrected feedback3 tests pass independently; the unrelated workbench assertion remains outside this scope.

## Compatibility and boundaries

- The old unbind route is absent from `app.json` and its four page files are deleted. The unbind API client and session cleanup remain because they are still the supported business path.
- The password status route already exists in API and is guarded as `core`; no API or schema change is introduced here.
- Reminder dismissal is scoped to the profile id and stored by a dedicated Mini storage helper. It does not persist profile data or credentials.
- No production deployment, database migration, Web release, or Mini upload was performed in this checkpoint. Live production and trial `.92` remain unchanged.
- No real phone call, group exit, privacy change, or identity mutation was used for acceptance. Xiaomi 14/native WeChat evidence is pending.

## Next stop condition

Commit and push the Mini-only checkpoint, release the warm slot, and wait for explicit release/upload authorization in a later turn. Do not claim production or trial effectiveness until that release chain is executed and verified.
