# Anonymous boundary telemetry

Boundary markers are fixed low-cardinality route/stage tokens. They are hashed locally and emitted
as `unknown/UNKNOWN`; never pass group/query/user/member IDs, names, phones, dates, counts, request
bodies, visitor material, or raw errors.

The marker registry is closed at type and runtime, and each marker may emit once per app session.
Capability-disabled calls remain retryable after enablement.

Interpret missing markers only against a known-good workbench/telemetry request in the same version
and time window. Page present/controller absent isolates the synchronous boundary; both present but
no business API means inspect capability/controller; both plus API redirects investigation to
rendering or later lifecycle. Re-enter the Mini App for a fresh once-per-session trial.
