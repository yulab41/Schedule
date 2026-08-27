# Selective agent context

Every implementation conversation reads the compact `docs/project-status.md` and
`pitfall-index.json`. Match the user request, planned commands, and expected modified paths against
each entry's `signals` and `paths`, then read only the matching `detail` files.

Re-run matching when the diff expands into another path family. A `guard` failure or any
`staleWhen` condition invalidates the recorded conclusion: treat it as a hypothesis and return to
source, Git history, and systematic debugging evidence.

Do not load all detail files “for awareness,” and do not read the complete debug feedback log.
Use `rg` with an exact pitfall ID, commit, route, or error when historical evidence is needed.

States:

- `active`: implementation or production proof remains.
- `blocked`: an external decision or credential is required.
- `fixed-pending-external`: guarded locally but still needs device/platform confirmation.
- `fixed-guarded`: implemented, tested, and protected by a regression guard.
- `superseded`: retained only for schema compatibility; remove from the active index on cleanup.
