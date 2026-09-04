# Production routing

Read this reference only after the current user message explicitly authorizes the exact `L4` action.

Authoritative sources:

- [ECS deployment runbook](../../../../docs/deployment/aliyun-ecs.md)
- [operations runbook](../../../../docs/operations/runbook.md#动态发布身份与基线冻结)
- Current release/control scripts under [`infra/scripts`](../../../../infra/scripts)
- [release-cache pitfall](../../../../docs/agent-context/pitfalls/release-cache-and-reuse.md)

## Authorization and local configuration

Reconfirm the authorized target and action immediately before connecting. Design approval, code approval, test approval, Git push, release-candidate creation, and Mini upload do not authorize production.

A production release value from a prompt, plan, or status file is only a recorded observation. Claim a current live release only after the current message authorizes the required `L4` read and the runbook query succeeds immediately before the operation. Otherwise record `LIVE_RELEASE_VERIFIED=false`; never use the stale value as a rollback candidate or proof of deployment state.

Machine-specific operator notes may exist only at `$REPO_ROOT/runtime/local/production-operator.md`. The repository ignores the entire `runtime/local/` directory. Read that file only when `L4` requires it; never quote, copy, stage, or commit its private-key path, host/IP, username, or other machine-specific values. Do not create a tracked placeholder. The skill validator proves the path is ignored without creating it.

## Execution invariants

- Start from the exact clean candidate and current runbook. Preserve the server database as authoritative; never upload a local database, local sessions, credentials, or generated local state.
- Create and verify the required production backup before an authorized deployment or rollback, then report the backup identifier, deployed release, and verification outcome.
- Do not stream a multi-step remote script over stdin when `docker compose run`, a database client, or another child may inherit and consume the remaining script. Use the reviewed fixed script mechanism from ignored local operator notes/runbooks, or explicitly detach child stdin where the runbook supports it.
- Under VPN/TUN, an SSH banner timeout can be transient routing failure. Verify route and name resolution before one bounded retry; do not change credentials or weaken host verification as a workaround.
- If the formal domain resolves locally into `198.18.x.x`, treat it as a local TUN synthetic address rather than production evidence. Use only the audited physical-route mechanism from ignored local notes; never commit a real server IP.
- Stop on release/hash/schema/path/backup/verifier mismatch. Do not improvise an ad hoc remote mutation.
