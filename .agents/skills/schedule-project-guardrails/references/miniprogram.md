# Mini Program routing

Read this reference only when the task touches `apps/miniprogram/**`, Mini runtime behavior, a Mini build, native evidence, preview, or upload.

Authoritative sources:

- [Mini Program AGENTS.md](../../../../apps/miniprogram/AGENTS.md)
- The active section of the [migration plan](../../../../apps/miniprogram/docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md)
- [Mini test plan](../../../../apps/miniprogram/docs/testing/test-plan.md)
- [miniprogram-ci runbook](../../../../apps/miniprogram/docs/runbooks/miniprogram-ci.md)
- [release and rollback runbook](../../../../apps/miniprogram/docs/runbooks/release-and-rollback.md)
- [Xiaomi 14 acceptance protocol](../../../../docs/audit/XIAOMI14_TEST_PROTOCOL.md)

## Execution boundary

Load `$miniprogram-development` for Mini tasks, but do not invoke its WeChat DevTools actions. This repository forbids an agent from starting, waking, closing, inspecting, controlling, or automating the DevTools GUI/CLI. Node-based repository scripts remain available within the selected task level.

Mini source lives in `src/`; generated `dist/` is ignored and never hand-edited. A Mini build or upload must come from the target SHA in the independent clean managed worktree. Never mix main-worktree `dist` with candidate source.

Before an experience upload:

1. Enter `L3`, establish the exact clean SHA, and run the worktree checker with `-RequireReady -ExpectedCommit <sha> -ForMiniprogramUpload -MiniProgramVersion <version>`.
2. Confirm the production-profile `build-profile.json` binds the same version and SHA, reports a clean build, and contains no `version=local` fallback.
3. Report the change, short SHA, version/description, dirty-tree state, and test pages; obtain the user's explicit approval for this upload in the current message.
4. Use only the existing Node `miniprogram-ci` runbook. An upload does not authorize review submission or formal publication.

A Mini-only change must not automatically deploy a server, migrate a database, create a production backup, or change production capabilities. Those are separate `L4` actions requiring explicit current-message authorization.

Web golden images and user-operated DevTools are supporting evidence. Xiaomi 14 Android `trial` evidence tied to the same SHA/version is the final visual and interaction acceptance source. Never generalize it to iOS, all Android devices, or all platforms.
