# Client version allowlist

Never edit production `MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS` with a PowerShell pipe or ad hoc remote
script. Use the root-owned trusted control:

```text
schedule-client-version-allowlist ensure VERSION...
schedule-client-version-allowlist replace VERSION...
schedule-client-version-allowlist verify
```

`ensure` is add-only and idempotent; `replace` requires a nonempty exact list and is used only after
explicit version-retirement authorization and availability of the replacement Mini build. It preserves
the original legacy identifier rather than aliasing old clients to the new version. Both take release
then capability locks, atomically preserve
root:root/0600, recreates API+Web only on change, compares capability JSON by exact keys/values
without field-order assumptions, probe all supported versions and retired/unknown=426, and restore on error/signal.

Version retirement, audit submission, and formal Mini release require separate explicit approval.
