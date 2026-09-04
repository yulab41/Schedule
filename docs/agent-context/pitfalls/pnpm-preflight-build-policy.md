# pnpm preflight and build policy

pnpm 11 wrote unresolved `set this to true or false` values for four optional install scripts.
That config mismatch made every command run install and then fail. The four scripts are explicitly
`false`; `esbuild` remains the only relevant approved build.

`verifyDepsBeforeRun: false` prevents implicit installs. Run
`& scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly` first; a healthy matching environment is
reused with `INSTALL_INVOKED=false`, while a missing or changed environment fails closed. Installation
belongs only to the separately authorized dependency-maintenance channel described by the repository
Skill. The release worktree uses the same source/toolchain/layout/store/link-health contract and never
installs automatically.

Never enable all dependency scripts to remove a warning. Treat pnpm major upgrades as a separate
supply-chain checkpoint.
