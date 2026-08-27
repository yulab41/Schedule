# pnpm preflight and build policy

pnpm 11 wrote unresolved `set this to true or false` values for four optional install scripts.
That config mismatch made every command run install and then fail. The four scripts are explicitly
`false`; `esbuild` remains the only relevant approved build.

`verifyDepsBeforeRun: false` prevents implicit installs. Dependency changes still require explicit
`pnpm install --frozen-lockfile`; the release worktree fingerprints every tracked dependency input
and installs on a miss.

Never enable all dependency scripts to remove a warning. Treat pnpm major upgrades as a separate
supply-chain checkpoint.
