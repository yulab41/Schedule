# Mini Program trial upload: route, lineage and lease traps

Every item below cost a failed upload or a wasted version number; run them in this order when uploading
a trial from an agent session.

## 1. GitHub proxy vs WeChat CI direct IPv4

Clearing the process proxy is required for the WeChat upload (it must not leave over IPv4), but Git
still needs the proxy to fetch `origin/main`, which the lineage gate does first:

```powershell
$env:HTTPS_PROXY=''; $env:HTTP_PROXY=''; $env:ALL_PROXY=''
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='http.proxy'
$env:GIT_CONFIG_VALUE_0='http://127.0.0.1:7892'   # git only
```

Without the `GIT_CONFIG_*` pair the run dies with `Git fetch failed with exit code 128`. With the
process proxy left in place the WeChat upload fails over an IPv6 egress (`invalid ip: 2409:8a55:…`),
which burns the version number (`.165`/`.166`).

## 2. Canonical equivalence proof must be refreshed

Changing a file listed in `apps/miniprogram/release/trial-lineage-policy.v1.json` (for example
`apps/miniprogram/src/pages/workbench/index.ts` for checkpoint `5285dd1`) fails the gate with
`Required checkpoint … must be an ancestor of trial HEAD or match its canonical equivalence proof`.
Refresh the recorded blob with `git rev-parse HEAD:<path>` and extend the checkpoint `reason` with the
approved change, as a separate `chore(release)` commit — never by weakening the gate.

## 3. An upload purpose is bound to one RUN_ID and SHA

After `prepare-release-worktree.mjs --purpose upload` pinned a lease to SHA X, freezing the same lease
on SHA Y fails with `Upload purpose is bound to a different RUN_ID/SHA`. Release the slot and Acquire
again with a new `TaskId` (new RUN_ID) before preparing the new SHA.

## 4. Release is refused while a process holds the worktree

`manage-worktree-pool.ps1 -Action Release` returns `Refusing to release while an active process is
observed` while the DevTools project window still points at that slot. Close the project window first
(`close_project_window`), wait a few seconds, then release.

## 5. DevTools needs the allow-listed build and a token

- The simulator must run a build produced with the trial version that the backend allowlist accepted;
  a gate-only rebuild stamps `version=local` and the app can hang in `loading`.
- Confirm the running identity from the in-app build label (`0.1.0-p10.…@<short sha>`), not from the
  IDE title bar.
- CLI automation needs the MCP token (`wechatide -c <client> <tool> … --token <token>`); copy it from
  设置 → 安全 when it expires.

## 6. Mechanical deletions: re-derive, then compare

A line-based WXSS stripper that pushed a selector list as one array element and then `join`-ed it
silently collapsed multi-line selectors. Delete only what matches the marker selector, re-derive the
result from `HEAD` for every touched file, and compare non-blank lines before writing.
