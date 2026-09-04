# Mini Program routing

Read this reference only when the task touches `apps/miniprogram/**`, Mini runtime behavior, a Mini build, native evidence, preview, or upload.

Authoritative sources:

- [Mini Program AGENTS.md](../../../../apps/miniprogram/AGENTS.md)
- The active section of the [migration plan](../../../../apps/miniprogram/docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md)
- [Mini test plan](../../../../apps/miniprogram/docs/testing/test-plan.md)
- [miniprogram-ci runbook](../../../../apps/miniprogram/docs/runbooks/miniprogram-ci.md#体验版版本分配与不可变身份)
- [release and rollback runbook](../../../../apps/miniprogram/docs/runbooks/release-and-rollback.md)
- [Xiaomi 14 acceptance protocol](../../../../docs/audit/XIAOMI14_TEST_PROTOCOL.md)

## Mini guardrail capsule

For a Mini modification, pair this reference with [testing/evidence](testing-and-evidence.md), which is already part of `L1`–`L3` routing. Together they carry the clean-source, upload, production-separation, device-acceptance, comparable-evidence, and bundle-content boundaries without copying a safety paragraph into every prompt. Do not load this capsule for unrelated work.

## Execution boundary

Load `$miniprogram-development` for Mini tasks, but do not invoke its WeChat DevTools actions. This repository forbids an agent from starting, waking, closing, inspecting, controlling, or automating the DevTools GUI/CLI. Node-based repository scripts remain available within the selected task level.

Mini source lives in `src/`; generated `dist/` is ignored and never hand-edited. A Mini build or upload must come from the target SHA in the independent clean managed worktree. Never mix main-worktree `dist` with candidate source.

When a task needs trial evidence but does not authorize an upload, select only the latest eligible existing upload defined by the miniprogram-ci runbook. If no eligible candidate can be proven, report `UPLOAD_REQUIRED`; do not allocate a version or upload. A task that does not need trial evidence does not select a trial at all.

For an authorized upload, allocate the version only through the runbook's exclusive allocation procedure after the final clean SHA and required source/test gates are fixed. If the current checkout has no executable upload/version-allocation lock helper, stop with `UPLOAD_VERSION_ALLOCATION_BLOCKED` rather than choosing a version manually.

Before an experience upload:

1. Enter `L3`, establish the exact clean SHA, complete the required version-independent gates, and run the worktree checker with `-RequireReady -ExpectedCommit <sha>`.
2. Apply the canonical locked version-allocation procedure. Stop on an unavailable lock, uncertain occupied-version state, or tuple conflict.
3. Build the version-bound production artifact, then run the checker with `-RequireReady -ExpectedCommit <sha> -ForMiniprogramUpload -MiniProgramVersion <version>`. Confirm `build-profile.json` binds the same version and SHA, reports a clean build, and contains no `version=local` fallback; bind its upload Manifest to the same immutable identity.
4. Report the change, short SHA, allocated version/description, dirty-tree state, Manifest, and test pages; obtain the user's explicit approval for this upload in the current message.
5. Revalidate the allocation and relevant dynamic baseline immediately before using the existing Node `miniprogram-ci` runbook. An upload does not authorize review submission or formal publication.

A Mini-only change must not automatically deploy a server, migrate a database, create a production backup, or change production capabilities. Those are separate `L4` actions requiring explicit current-message authorization.

Web golden images and user-operated DevTools are supporting evidence. Xiaomi 14 Android `trial` evidence tied to the same SHA/version is the final visual and interaction acceptance source. Never generalize it to iOS, all Android devices, or all platforms.
