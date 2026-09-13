# Feedback21 visitor cache, QR, and CSV export

## Scope and root cause

- Baseline: `2d63e5a3`, exclusive warm slot `general-5`, `REUSE_ONLY`, no dependency install.
- Visitor clearing was introduced by `325f82ea`: `onHide` and `onUnload` invalidated the resolved group, month window, holidays, filters, and rendered calendar. This made every foreground return resolve and read again.
- The supplied September CSV is 2,562 bytes with 30 records. It has valid UTF-8 bytes but no UTF-8 BOM. September 8 and 9 contain `全天班,全`; the other 28 records contain `全天班,全天`. Both exceptional rows are swapped duties, but swap code changes only actual membership. Export code faithfully exposed the stored assignment snapshot.
- Export processing was queued and picked up by the minute notification job. The CSV builder is a small linear map; queue pickup, not the 30-row payload, explains the near-minute latency.
- The prior group QR response selected one global `WECHAT_QR_ENV_VERSION` and cached only by group, so it could not safely return release and trial images together.

## Changes

- Persist public visitor calendar and holiday snapshots for seven days, stripping full mobile phone values and never storing visitor keys or guest tokens. Hide/unload no longer purge the public cache; invalid/revoked visitor responses clear only the affected group. Cached data stays visible during transient network failure while a foreground refresh runs.
- Generate and cache release/trial QR images separately. `WECHAT_TRIAL_VISITOR_QR_ENABLED=false` disables trial generation without affecting release. The Mini Program composes each QR and the group name into one PNG used by preview and long-press save.
- Prefix CSV with UTF-8 BOM for Microsoft Excel. Process a newly created export immediately; the minute worker remains the pending-job recovery path.
- Remove the redundant export hero and selection summary. After generation the Mini Program downloads the authenticated temporary file automatically and shows only Send file and Cancel; a failed automatic download exposes one recovery action.

## Evidence and boundary

- Targeted Mini export/visitor/QR tests: 53 passed after RED expectations captured old ready/download and hide-clearing behavior.
- Contracts/API targeted tests: 23 passed. Mini and API typecheck/build passed. Final Mini production verify passed with main package 1,713,723 bytes and total package 4,554,857 bytes.
- Final `pnpm verify` passed: Mini 1,160 passed/16 skipped; root 1,255 passed/439 skipped, with format, lint, builds, typecheck and icon parity. An earlier run hit a Windows libuv close assertion after Web output completed; an isolated Web build and the final full Web build both passed.
- 运行/浏览器验证：`pnpm smoke:browser` 未完成。默认5173端口在本机不可绑定，改用3105后登录页通过；warm槽按规则没有`.env`，本地API未启动，管理员登录停在`/login?redirect=/`。未复制主工作区或生产凭据。`pnpm smoke:check-core`用于确认该结果已如实记录。
- No WeChat DevTools control and no Xiaomi 14 acceptance. API/contract behavior needs a separately authorized production deployment; this task does not connect to or mutate production.

## Next stop

Finish final gates, checkpoint and push. Then use the already authorized clean SHA for a dynamically allocated experience upload and add-only allowlist. Xiaomi 14 verification remains pending.
