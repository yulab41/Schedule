# Feedback23 implementation evidence

## Scope and causes

- Export selector overflow: the export panel mounted `ui-selector` without the local padded field wrapper used by the surrounding form. The shared selector was not changed.
- Guest calendar drift: member and guest already consume the same `WorkbenchViewModel`, and guest WXSS imports the member calendar stylesheet. Commit `e94a54ca` changed the member week template to `shiftGroups/tint`, duty state, collapse and adaptive height while the guest template retained the older rendering.
- Member binding QR: the existing platform-admin one-time binding ticket and transactional identity conflict checks are reused. The QR scene contains only an opaque one-time ticket; visible account/group information is drawn outside the QR.

## Behavior changes

- Guest week cells render grouped tinted shifts, the same duty-state labels and the same adaptive-height calculation as the member calendar.
- Guest detail cards use the existing shift-card and phone-detail expansion helpers. Phone values remain subject to the existing per-group effective consent boundary; guest event reads continue through the public guest event route.
- Group owners/admins and developer admins can request a ten-minute member binding QR for an active unbound membership. The scanner must explicitly confirm; conflicts, stale membership/auth versions, revoked/expired/used tickets and already-bound targets fail closed.
- Export selector padding is local to the export panel.

## Validation

- `pnpm verify`: passed. Mini 1164 passed / 16 skipped; root 1257 passed / 440 skipped. Formatting, lint, build, typecheck and icon parity passed.
- Targeted Mini: export/guest/layout 48 passed; QR suites 19 passed.
- `pnpm smoke:browser`: attempted, stopped at `http://localhost:5173` with `ERR_CONNECTION_REFUSED` because the warm worktree had no running Web server. No browser result is claimed.
- MySQL integration suites were discovered but skipped because the approved local test database environment was not configured. Production backup/migration/verifier evidence is required before delivery is marked deployed.
- Node/static checks do not constitute Xiaomi 14 native acceptance.

## Production and trial delivery

- Application checkpoint `87475d5113bf263db48b260ce719701d5a1e8102` was pushed to `origin/main`.
- Fresh L4 route verification passed. The immediate production rollback candidate was `159da99a7225056d60a139d760618663b6e94101`.
- Encrypted production backup `cc678008-9368-4332-a7f7-0e7bc070fe19` completed with 54 tables, 108086228 bytes and SHA-256 `4e14781b4d0a71a5ee7dc0f41f3099c2e2d9f7480c07de236092a02c11c2d8e0`.
- Application/API deployment and schema59 migration completed. The production verifier passed; six transient 502 responses occurred while containers restarted and then recovered.
- Trial `0.1.0-p10.20260913.125` was allocated locally but rejected before the WeChat upload because a separately prebuilt manifest had a different build timestamp. Its immutable failed allocation is retained and it was not allowlisted.
- Trial `0.1.0-p10.20260913.126` uploaded successfully from application SHA `87475d51`, production-clean, 359 files, Manifest `66e8d858b4d1d435f44d1963dea17b6a993acb17e2fcb35a4c6d1e9dd418b32c`. Receipt, manifest and remote lightweight tag match.
- Trusted add-only allowlist `ensure` added only 126. Verifier and public probes passed: 126 and retained 124 return 200; failed 125 and a dynamic unknown version return 426.
- No review submission, formal Mini Program publication, old-version retirement or Xiaomi 14 acceptance was performed.
