# Release cache and hash-identical reuse

The release packager uses immutable content-addressed caches under `runtime/release-cache/v1` for
ECS build outputs, the dist archive, and API flat archive. Keys include sorted file hashes,
toolchain, command arguments, platform, and production build settings—not Git commit or mtime.

Cache hits still require an exact clean commit, shell LF/syntax, payload SHA, and restored build-tree
hashes. Corruption is a miss; cache contents never include env files, credentials, database data,
sessions, or upload keys. Outputs are copied, not hardlinked.

When every application/control/schema hash equals current production, the trusted
`schedule-ecs-reuse-release` command can switch only manifest/current-release after a backup and
two verifier runs. Any difference requires full deployment.
