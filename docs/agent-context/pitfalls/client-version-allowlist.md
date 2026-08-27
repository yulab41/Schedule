# Client version allowlist

Never edit production `MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS` with a PowerShell pipe or ad hoc remote
script. Use the root-owned trusted control:

```text
schedule-client-version-allowlist ensure VERSION...
schedule-client-version-allowlist verify
```

It is add-only and idempotent, takes release then capability locks, atomically preserves
root:root/0600, recreates API+Web only on change, compares capability JSON by exact keys/values
without field-order assumptions, dynamically probes unknown=426, and restores on error/signal.

Version retirement, audit submission, and formal Mini release require separate explicit approval.
