# Debugging routing

Read this reference for an unknown root cause, a regression, or a known symptom routed from `known-pitfalls.md`.

Authoritative sources:

- Root [regression rules](../../../../AGENTS.md)
- [pitfall index](../../../../docs/agent-context/pitfall-index.json) and only its matching detail files
- [debug feedback log](../../../../docs/debug/debug-feedback-log.md), searched by exact pitfall ID, commit, route, or error
- [PowerShell fail-fast pitfall](../../../../docs/agent-context/pitfalls/windows-shell-fail-fast.md)

Invoke `$systematic-debugging` only while the root cause is unknown. For a regression, locate the introducing behavior with `git log -S` and `git blame`, reproduce it with a test that fails on the old behavior, and audit receiver binding, async/catch scope, null semantics, narrowing, side effects, and call counts before calling a change a refactor.

Do not read the complete debug feedback log. Search an exact identifier and read a bounded surrounding section. When a pitfall guard fails or its `staleWhen` condition matches, treat the recorded remedy as a hypothesis and investigate again.

## Deterministic failure handling

- A Git predicate such as `diff --quiet` legitimately returns `1` for “different”. Capture and classify that code explicitly; do not let strict PowerShell native-error handling turn the predicate into an unexamined exception. Any code outside the documented set fails.
- When a text patch misses because escaping, CRLF/LF, or context changed, reread the exact bounded file region and apply a smaller patch against current bytes. Do not repeat the same escaped replacement or switch to an opaque bulk rewrite.
- Separate infrastructure, fixture, expected empty-state, and product failures before changing code. Preserve the original failing evidence and rerun the same targeted test after the fix.
- Network/TUN or production symptoms do not grant `L4`; diagnose locally with read-only checks until the user explicitly authorizes the production action.
