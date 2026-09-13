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
