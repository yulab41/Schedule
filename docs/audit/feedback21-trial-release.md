# Feedback21 trial release

- Application checkpoint `9e603fdba57b2ed01b112e174728d35c533b1932` was pushed to `origin/main` from the exclusive clean warm slot `general-5` with reused dependencies and no install.
- Trial `0.1.0-p10.20260913.123` uploaded successfully with production profile and description `访客缓存双二维码与CSV导出优化 9e603fd`.
- Frozen upload manifest: `03986dd58120567e31ba9d4d28b157acfd6cbbcbde80485f5b44c20618f5495c`. The immutable allocation, receipt, and remote tag bind the same version and application SHA.
- Later authorization covered host-key reconciliation, production deployment, and add-only release. Two DoH providers, direct TLS, and strict SSH against the existing public-IP ED25519 record authenticated the server before strict formal-domain SSH passed. The previous `known_hosts` file has an ignored backup.
- Production backup `b0bbc0cc-bcf2-4c29-96c5-4eff80274bd1` succeeded with 54 tables, 107,823,088 bytes, and SHA-256 `90b69342c39dbf4f8f4f065c1aa7560e7d99d99cf2deb9ca464e3df1afcdb7f1`.
- Release `be6ff2ac403993cdc10427126a331b1c803605ec` deployed with realtime rollback candidate `83d8a03bfa64817f1ada6afd7c801fc642000978`. Three initial 502 probes recovered during normal warm-up; updater and complete ECS verifier passed.
- Trusted `ensure` appended `.123` without retiring old versions. Allowlist verifier and ECS verifier passed; public probes returned `.123=200`, `.122=200`, and dynamic unknown `=426`.
- No review submission, formal Mini publication, old-version retirement, or direct database mutation occurred. Xiaomi 14 acceptance remains pending.
