# pnpm preflight and build policy

pnpm 11 wrote unresolved `set this to true or false` values for four optional install scripts.
That config mismatch made every command run install and then fail. The four scripts are explicitly
`false`; `esbuild` remains the only relevant approved build.

`verifyDepsBeforeRun: false` prevents implicit installs. Dependency changes still require explicit
authorization and a complete preflight. Run `node scripts/check-dependency-environment.mjs` first;
`MATCH` reuses the worktree-local environment, while `MISS` only reports why it is stale or unhealthy.
When the current task authorizes an install, `node scripts/install-dependency-environment.mjs` performs
at most one frozen install and records a marker only after health passes. The release worktree uses the
same source/toolchain/layout/store/link-health contract.

Never enable all dependency scripts to remove a warning. Treat pnpm major upgrades as a separate
supply-chain checkpoint.
